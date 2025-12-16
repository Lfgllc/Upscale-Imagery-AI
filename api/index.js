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
      
      // 1. VALIDATION: API Key Existence
      // We check this FIRST to fail fast if server is misconfigured
      const API_KEY = process.env.API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
      if (!API_KEY) {
          console.error("CRITICAL ERROR: API Key is missing in server environment variables.");
          return res.status(500).json({ 
              error: "Server configuration error: AI API Key is missing. Please contact support." 
          });
      }

      // 2. VALIDATION: Payload Data
      if (!imageBase64) {
        return res.status(400).json({ error: "No image data provided." });
      }
      if (typeof imageBase64 !== 'string') {
          return res.status(400).json({ error: "Invalid image format. Expected base64 string." });
      }
      if (!prompt) {
        return res.status(400).json({ error: "No prompt provided." });
      }

      // 3. AUTHENTICATION & CREDIT CHECK
      const user = await getAuthenticatedUser(req);
      
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

      // 4. SANITIZATION
      // Strip data URI prefix if present
      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
      
      // Validate sanitized data length (approx check for empty/tiny files)
      if (base64Data.length < 100) {
          return res.status(400).json({ error: "Image file is too small or corrupted." });
      }

      // 5. EXECUTE GEMINI GENERATION
      let generatedText = "";
      
      try {
          const ai = new GoogleGenAI({ apiKey: API_KEY });
          
          console.log("Sending request to Gemini...");
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

          // Check if response exists and has text
          if (!response || !response.text) {
              console.error("Gemini response was empty or missing text.");
              throw new Error("AI returned an empty response. The prompt might have triggered a safety filter.");
          }

          generatedText = response.text;

      } catch (geminiError) {
          console.error("Gemini API Error:", JSON.stringify(geminiError, null, 2));

          const msg = (geminiError.message || "").toLowerCase();
          const status = geminiError.status || 500;

          // Specific Error Mapping for User Feedback
          if (status === 400 || msg.includes("invalid_argument")) {
               return res.status(400).json({ error: "The AI rejected the image. It may be a format we can't process." });
          }
          if (status === 403 || msg.includes("permission_denied")) {
               return res.status(500).json({ error: "Server authentication with AI provider failed." });
          }
          if (status === 429 || msg.includes("resource_exhausted")) {
               return res.status(503).json({ error: "AI System is currently overloaded. Please try again in 1 minute." });
          }
          if (status === 503 || msg.includes("unavailable")) {
               return res.status(503).json({ error: "AI Service is temporarily unavailable. Please try again." });
          }
          if (msg.includes("safety") || msg.includes("blocked")) {
               return res.status(400).json({ error: "The request was blocked by safety filters. Please try a different image or prompt." });
          }

          // Unknown Gemini error
          throw new Error(`AI Service Error: ${geminiError.message}`);
      }

      // 6. DEDUCT CREDITS (Only after successful execution)
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
              
              if (updateError) console.error("Failed to deduct credit after success:", updateError);
          }
      }

      console.log("Generation Successful");

      // 7. RETURN RESPONSE
      const returnedImage = `data:image/jpeg;base64,${base64Data}`;
      res.json({ success: true, image: returnedImage, message: generatedText });

  } catch (serverError) {
    console.error("General Server Error:", serverError);
    
    // Explicitly catch Payload Too Large (Express/Vercel)
    if (serverError.type === 'entity.too.large' || (serverError.message && serverError.message.includes('too large'))) {
        return res.status(413).json({ error: "The image is too large. Please upload a file smaller than 4.5MB." });
    }

    res.status(500).json({ 
        error: serverError.message || "An unexpected internal server error occurred." 
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