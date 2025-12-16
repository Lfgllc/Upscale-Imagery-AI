// VERCEL SERVERLESS FUNCTION ENTRY POINT
import express from 'express';
import Stripe from 'stripe';
import cors from 'cors';
import dotenv from 'dotenv';
// Using the new, recommended SDK
import { GoogleGenAI } from '@google/genai';

// CRITICAL FIX: Import with .js extension for ESM compatibility
import supabaseAdmin from './supabaseClient.js';

dotenv.config();

const app = express();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

// Middleware
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
  let currentCredits = 0;

  // Resolve API Key
  const API_KEY = process.env.API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

  if (!API_KEY) {
      console.error("ERR: API Key not found.");
      return res.status(500).json({ error: "Server Configuration Error: API Key missing." });
  }

  try {
    // 2. CHECK CREDITS (Before generation)
    // We strictly block generation if credits are <= 0
    if (user) {
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('credits')
            .eq('id', user.id)
            .single();

        if (!profile) {
            return res.status(404).json({ error: "User profile not found." });
        }

        currentCredits = profile.credits;

        if (currentCredits < 1) {
            return res.status(403).json({ error: "Insufficient credits. Please upgrade or buy a pack to generate images." });
        }
    }

    // 3. PREPARE DATA (Sanitize)
    // Remove Data URI prefix and whitespace to prevent "string did not match expected pattern"
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const cleanBase64 = base64Data.replace(/\s/g, "");

    // 4. CALL GEMINI (Generation Phase)
    // We use the new GoogleGenAI SDK.
    const ai = new GoogleGenAI({ apiKey: API_KEY });
    
    // Using 'gemini-2.5-flash' as it is the current standard for multimodal speed/cost
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
            parts: [
                { 
                    text: `Act as a professional photo editor. The user wants to edit the attached image. 
                           Instruction: ${prompt}. 
                           Describe the changes you would make in vivid detail as if you were returning the edited layer.` 
                },
                {
                    inlineData: {
                        data: cleanBase64,
                        mimeType: "image/jpeg", // Assuming JPEG, SDK handles auto-detection often but explicit is safer
                    }
                }
            ]
        }
    });

    // Extract text using the direct .text property from the new SDK
    const generatedText = response.text; 

    // 5. DEDUCT CREDITS (Only after success)
    // This ensures we don't charge for failed API calls.
    if (user) {
        // Fetch fresh credits to ensure we don't overwrite a concurrent transaction
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
                // In a strict financial system, we might log this to a 'failed_charges' table
            }
        }
    }

    console.log("AI Generation Successful");

    // 6. RETURN RESPONSE
    // Return the original image (loopback) + the AI's description
    const returnedImage = `data:image/jpeg;base64,${cleanBase64}`;

    res.json({ success: true, image: returnedImage, message: generatedText });

  } catch (error) {
    console.error("Generation Error:", error);
    // Note: We do NOT deduct credits here because the operation failed.
    res.status(500).json({ error: error.message || "Generation Failed" });
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
        const amountTotal = session.amount_total; // Amount in cents
        
        // Logic updated for new pricing model:
        if (amountTotal === 399) creditsToAdd = 5;       // One-time
        else if (amountTotal === 999) creditsToAdd = 25; // Basic ($9.99 -> 25 credits)
        else if (amountTotal === 1999) creditsToAdd = 50;// Pro ($19.99 -> 50 credits)
        else if (amountTotal === 3499) creditsToAdd = 100;// Elite ($34.99 -> 100 credits)

        const { data: currentProfile } = await supabaseAdmin.from('profiles').select('credits').eq('id', user.id).single();
        const currentCredits = currentProfile ? currentProfile.credits : 0;

        await supabaseAdmin.from('profiles').update({ credits: currentCredits + creditsToAdd }).eq('id', user.id);
        res.json({ success: true, addedCredits: creditsToAdd });
    } catch (err) {
        res.status(500).json({ error: "Verification failed" });
    }
});

export default app;