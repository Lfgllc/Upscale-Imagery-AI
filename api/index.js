// VERCEL SERVERLESS FUNCTION ENTRY POINT
import express from 'express';
import Stripe from 'stripe';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

// CRITICAL: Import with .js extension for ESM compatibility in Vercel environment
import supabaseAdmin from './supabaseClient.js';

dotenv.config();

const app = express();

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

// Middleware: Set limit to 4.5MB to match Vercel's hard limit
app.use(express.json({ limit: '4.5mb' }));
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
  try {
      const { imageBase64, prompt } = req.body;
      
      // 1. VALIDATION: Basic Payload
      if (!imageBase64) {
        return res.status(400).json({ error: "No image provided." });
      }
      if (!prompt) {
        return res.status(400).json({ error: "No prompt provided." });
      }

      // 2. VALIDATION: API Key
      const API_KEY = process.env.API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
      if (!API_KEY) {
          console.error("CRITICAL: API Key is missing from server environment.");
          return res.status(500).json({ error: "Service configuration error. Please contact support." });
      }

      // 3. AUTHENTICATION (Keep existing logic)
      const user = await getAuthenticatedUser(req);
      
      // 4. CHECK CREDITS
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
              return res.status(403).json({ error: "Insufficient credits. Please upgrade or buy a pack." });
          }
      }

      // 5. SANITIZE & VALIDATE IMAGE DATA
      // Remove data URI prefix if present
      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
      
      // Basic check for empty or corrupted strings
      if (!base64Data || base64Data.length < 100) {
          return res.status(400).json({ error: "Invalid image data. The file may be corrupted." });
      }

      // 6. EXECUTE GEMINI GENERATION
      let generatedText = "";
      
      try {
          const ai = new GoogleGenAI({ apiKey: API_KEY });
          
          const response = await ai.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: {
                  parts: [
                      { 
                          text: `Act as a professional photo editor. The user wants to edit the attached image. 
                                 Instruction: ${prompt}. 
                                 Describe the visual changes you would make in high detail, as if you were describing the final edited image.
                                 Ensure the output describes a complete, high-quality image.` 
                      },
                      {
                          inlineData: {
                              data: base64Data,
                              mimeType: "image/jpeg",
                          }
                      }
                  ]
              }
          });

          // Validation: Check if response has text
          if (!response || !response.text) {
              throw new Error("AI returned an empty response.");
          }

          generatedText = response.text;

      } catch (geminiError) {
          console.error("Gemini API Error Details:", JSON.stringify(geminiError, null, 2));

          // Map Gemini specific errors to user-friendly messages
          const msg = geminiError.message || "";
          
          if (msg.includes("400") || msg.includes("INVALID_ARGUMENT")) {
               return res.status(400).json({ error: "The AI could not process this image. It may be too complex or in an unsupported format." });
          }
          if (msg.includes("403") || msg.includes("PERMISSION_DENIED")) {
               return res.status(500).json({ error: "AI Service authentication failed." });
          }
          if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED")) {
               return res.status(503).json({ error: "System is currently at capacity. Please try again in a minute." });
          }
          if (msg.includes("500") || msg.includes("INTERNAL")) {
               return res.status(502).json({ error: "AI Service experienced an internal error. Please try again." });
          }
          if (msg.includes("503") || msg.includes("UNAVAILABLE")) {
               return res.status(503).json({ error: "AI Service is temporarily unavailable. Please try again." });
          }
          if (msg.includes("SAFETY") || msg.includes("BLOCKED")) {
               return res.status(400).json({ error: "The request was blocked by safety filters. Please modify your image or prompt." });
          }

          throw geminiError; // Re-throw unhandled errors to the outer catch
      }

      // 7. DEDUCT CREDITS (Only after successful execution)
      if (user) {
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

      // 8. RETURN RESPONSE
      // Return the clean base64 we used (preserving client optimization)
      const returnedImage = `data:image/jpeg;base64,${base64Data}`;
      res.json({ success: true, image: returnedImage, message: generatedText });

  } catch (serverError) {
    console.error("Critical Server Error:", serverError);
    
    // Check for PayloadTooLarge from Express/Node before we explicitly catch it
    if (serverError.type === 'entity.too.large' || (serverError.message && serverError.message.includes('too large'))) {
        return res.status(413).json({ error: "The image is too large. Please upload a smaller file (under 4MB)." });
    }

    res.status(500).json({ 
        error: serverError.message || "An unexpected system error occurred." 
    });
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