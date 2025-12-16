// VERCEL SERVERLESS FUNCTION ENTRY POINT
const express = require('express');
const Stripe = require('stripe');
const cors = require('cors');
const dotenv = require('dotenv');
const { GoogleGenAI } = require('@google/genai');

dotenv.config();

// Import Supabase Admin client (CommonJS)
const supabaseAdmin = require('./supabaseClient.js');

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
      
      // 1. VALIDATION: API Key Normalization
      if (!process.env.API_KEY) {
          if (process.env.GEMINI_API_KEY) process.env.API_KEY = process.env.GEMINI_API_KEY;
          else if (process.env.GOOGLE_API_KEY) process.env.API_KEY = process.env.GOOGLE_API_KEY;
      }

      if (!process.env.API_KEY) {
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
      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
      
      if (base64Data.length < 100) {
          return res.status(400).json({ error: "Image file is too small or corrupted." });
      }

      // 5. EXECUTE GEMINI GENERATION
      let generatedImageBase64 = null;
      let generatedText = "";
      
      try {
          // Use process.env.API_KEY directly as per SDK guidelines
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          
          console.log(`Sending request to Gemini... Payload size: ${Math.round(base64Data.length / 1024)}KB`);
          
          const parts = [
              {
                  inlineData: {
                      data: base64Data,
                      mimeType: "image/jpeg",
                  }
              },
              { 
                  text: prompt 
              }
          ];

          let response;
          try {
             // Attempt primary model
             response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image', 
                contents: [{ role: 'user', parts: parts }] // Wrap in array explicitly
             });
          } catch (primaryError) {
             console.warn(`Primary model failed (${primaryError.status || 'unknown'}), attempting fallback...`);
             if (primaryError.response) {
                 console.error("Primary Error Body:", JSON.stringify(primaryError.response, null, 2));
             }
             
             // Fallback to experimental flash model
             response = await ai.models.generateContent({
                model: 'gemini-2.0-flash-exp', 
                contents: [{ role: 'user', parts: parts }]
             });
          }

          // Extract Output (Image or Text)
          if (response.candidates?.[0]?.content?.parts) {
              for (const part of response.candidates[0].content.parts) {
                  if (part.inlineData) {
                      generatedImageBase64 = part.inlineData.data;
                  } else if (part.text) {
                      generatedText += part.text;
                  }
              }
          }

          if (!generatedImageBase64 && !generatedText) {
              console.error("Empty response from Gemini:", JSON.stringify(response, null, 2));
              throw new Error("AI returned an empty response.");
          }

      } catch (geminiError) {
          console.error("Gemini API Error Object:", JSON.stringify(geminiError, Object.getOwnPropertyNames(geminiError)));
          
          const msg = (geminiError.message || "").toLowerCase();
          const status = geminiError.status || 500;

          if (status === 400 || msg.includes("invalid_argument")) {
               return res.status(400).json({ error: "The AI could not process this image. It may be too complex or the format is unsupported." });
          }
          if (status === 403 || msg.includes("permission_denied")) {
               return res.status(500).json({ error: "Server authentication with AI provider failed. Check API Key permissions." });
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

          throw new Error(`AI Service Error: ${geminiError.message}`);
      }

      // 6. DEDUCT CREDITS
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
      if (generatedImageBase64) {
           const fullImage = `data:image/jpeg;base64,${generatedImageBase64}`;
           res.json({ success: true, image: fullImage, message: "Image transformed successfully." });
      } else {
           // Fallback: If model only returned text (e.g. asking for clarification), return original image
           console.warn("Model returned text only:", generatedText);
           const originalImg = `data:image/jpeg;base64,${base64Data}`;
           res.json({ success: true, image: originalImg, message: generatedText || "No visual changes generated." });
      }

  } catch (serverError) {
    console.error("General Server Error:", serverError);
    
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

module.exports = app;