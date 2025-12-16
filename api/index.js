// VERCEL SERVERLESS FUNCTION ENTRY POINT
import express from 'express';
import Stripe from 'stripe';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import sharp from 'sharp';

// CRITICAL: Import with .js extension for ESM compatibility in Vercel environment
import supabaseAdmin from './supabaseClient.js';

dotenv.config();

const app = express();

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

// Middleware: High limit for image uploads (though Vercel strictly enforces 4.5MB)
app.use(express.json({ limit: '10mb' }));
app.use(cors());

// --- HELPER FUNCTIONS ---
const getAuthenticatedUser = async (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader === 'Bearer null' || authHeader === 'Bearer undefined') return null;
  const token = authHeader.replace('Bearer ', '');
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  return user;
};

// --- ROUTES ---

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date() });
});

app.post('/api/generate', async (req, res) => {
  const { imageBase64, prompt } = req.body;
  
  if (!imageBase64) {
    return res.status(400).json({ error: "No image provided" });
  }

  // 1. Authenticate User
  const user = await getAuthenticatedUser(req);
  
  // Resolve API Key
  const API_KEY = process.env.API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

  if (!API_KEY) {
      console.error("ERR: API Key not found.");
      return res.status(500).json({ error: "Server Configuration Error: API Key missing." });
  }

  try {
    // 2. CHECK CREDITS (Strict Check Before Generation)
    if (user) {
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('credits')
            .eq('id', user.id)
            .single();

        if (!profile) {
            return res.status(404).json({ error: "User profile not found." });
        }

        if (profile.credits < 1) {
            return res.status(403).json({ error: "Insufficient credits. Please purchase a pack to generate images." });
        }
    }

    // 3. IMAGE PROCESSING & SANITIZATION
    // We use 'sharp' to safely resize and compress the image on the server.
    // This prevents "unexpected format" errors from Gemini and handles memory efficiently.
    let optimizedBase64 = "";
    try {
        // Strip data URI prefix if present
        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
        const inputBuffer = Buffer.from(base64Data, 'base64');

        // VALIDATE IMAGE FORMAT
        const metadata = await sharp(inputBuffer).metadata();
        // Accepted formats: jpeg, png, webp (Gemini supports these)
        const allowedFormats = ['jpeg', 'png', 'webp'];
        if (!allowedFormats.includes(metadata.format)) {
            return res.status(400).json({ error: `Unsupported format (${metadata.format}). Please upload JPEG or PNG.` });
        }

        // Resize to max 1024x1024 (fit: inside) and convert to JPEG (quality: 80)
        // This is a safety net even if client-side resizing fails or is bypassed.
        const processedBuffer = await sharp(inputBuffer)
            .resize(1024, 1024, { 
                fit: 'inside', 
                withoutEnlargement: true 
            })
            .jpeg({ 
                quality: 80, 
                mozjpeg: true 
            })
            .toBuffer();
        
        optimizedBase64 = processedBuffer.toString('base64');
    } catch (imgError) {
        console.error("Image Processing Failed:", imgError);
        return res.status(400).json({ error: "Invalid image data. Please upload a valid PNG or JPEG image." });
    }

    // 4. EXECUTE GEMINI GENERATION
    try {
        const ai = new GoogleGenAI({ apiKey: API_KEY });
        
        // Using 'gemini-2.5-flash' for basic image editing/generation tasks
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    { 
                        text: `Act as a professional photo editor. The user wants to edit the attached image. 
                               Instruction: ${prompt}. 
                               Describe the visual changes you would make in high detail, as if you were describing the final edited image.` 
                    },
                    {
                        inlineData: {
                            data: optimizedBase64,
                            mimeType: "image/jpeg",
                        }
                    }
                ]
            }
        });

        // Extract text from the SDK response
        const generatedText = response.text; 

        // 5. DEDUCT CREDITS (Only after successful execution)
        if (user) {
            // Fetch fresh credits to ensure concurrency safety
            const { data: freshProfile } = await supabaseAdmin
                .from('profiles')
                .select('credits')
                .eq('id', user.id)
                .single();

            if (freshProfile && freshProfile.credits > 0) {
                const { error: updateError } = await supabaseAdmin
                    .from('profiles')
                    .update({ credits: freshProfile.credits - 1 })
                    .eq('id', user.id);
                
                if (updateError) {
                    console.error("Failed to deduct credit after success:", updateError);
                }
            }
        }

        console.log("AI Generation Successful");

        // 6. RETURN RESPONSE
        const returnedImage = `data:image/jpeg;base64,${optimizedBase64}`;
        res.json({ success: true, image: returnedImage, message: generatedText });

    } catch (apiError) {
        console.error("Gemini API Error:", apiError);
        // Provide user-friendly error messages based on status
        if (apiError.status === 503) {
            throw new Error("AI service is currently busy. Please try again in a few seconds.");
        } else if (apiError.status === 400) {
             throw new Error("The AI rejected the request. The image might be unclear or violates safety policies.");
        }
        throw apiError; // Re-throw to be caught by outer catch
    }

  } catch (error) {
    console.error("Route Error:", error);
    // User-friendly error mapping
    let errorMessage = "Generation Failed. Please try again.";
    
    if (error.message?.includes('413')) errorMessage = "Image is too large for the AI model.";
    else if (error.message?.includes('Safety')) errorMessage = "Request blocked by safety filters.";
    else if (error.message?.includes('busy')) errorMessage = "AI Service is temporarily busy. Please try again.";
    else if (error.message) errorMessage = error.message;

    // DO NOT deduct credits here. 
    res.status(500).json({ error: errorMessage });
  }
});

app.post('/api/verify-checkout', async (req, res) => {
    const { sessionId } = req.body;
    const user = await getAuthenticatedUser(req);
    if (!user || !sessionId) return res.status(400).json({ error: "Invalid request" });

    try {
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        if (session.payment_status !== 'paid') return res.status(400).json({ error: "Not paid" });

        let creditsToAdd = 0;
        const amountTotal = session.amount_total; 
        
        // Pricing Logic
        if (amountTotal === 399) creditsToAdd = 5;       
        else if (amountTotal === 999) creditsToAdd = 25; 
        else if (amountTotal === 1999) creditsToAdd = 50;
        else if (amountTotal === 3499) creditsToAdd = 100;

        const { data: currentProfile } = await supabaseAdmin.from('profiles').select('credits').eq('id', user.id).single();
        const currentCredits = currentProfile ? currentProfile.credits : 0;

        await supabaseAdmin.from('profiles').update({ credits: currentCredits + creditsToAdd }).eq('id', user.id);
        res.json({ success: true, addedCredits: creditsToAdd });
    } catch (err) {
        res.status(500).json({ error: "Verification failed" });
    }
});

export default app;