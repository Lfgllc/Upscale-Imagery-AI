// BACKEND SERVER FOR UPSCALE IMAGERY AI
const express = require('express');
const Stripe = require('stripe');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');

// Import shared client (CommonJS)
const supabaseAdmin = require('./api/supabaseClient.js');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(cors());

// --- SECURITY MIDDLEWARE ---
app.use((req, res, next) => {
  const sensitiveFiles = ['/server.js', '/.env', '/package.json', '/tsconfig.json'];
  if (sensitiveFiles.includes(req.path) || req.path.startsWith('/.git')) {
    return res.status(403).send('Forbidden');
  }
  next();
});

// --- SERVE STATIC FILES (PRODUCTION) ---
app.use(express.static(path.join(__dirname, 'dist')));

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

// --- API ROUTES ---
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date() });
});

app.post('/api/generate', async (req, res) => {
  const { imageBase64, prompt } = req.body;
  
  if (!imageBase64) return res.status(400).json({ error: "No image provided" });

  const user = await getAuthenticatedUser(req);
  const API_KEY = process.env.API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

  if (!API_KEY) return res.status(500).json({ error: "Server GEMINI_API_KEY missing" });

  try {
    if (user) {
        const { data: profile } = await supabaseAdmin.from('profiles').select('credits').eq('id', user.id).single();
        if (!profile) return res.status(404).json({ error: "User profile not found." });
        if (profile.credits < 1) return res.status(403).json({ error: "Insufficient credits." });
    }

    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    
    if (base64Data.length < 100) return res.status(400).json({ error: "Image too small." });

    const ai = new GoogleGenAI({ apiKey: API_KEY });
    
    console.log("Processing Generation...");
    
    const parts = [
        {
            inlineData: {
                data: base64Data,
                mimeType: "image/jpeg",
            }
        },
        { text: prompt }
    ];

    let response;
    try {
        response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: [{ role: 'user', parts: parts }]
        });
    } catch (primaryError) {
        console.warn(`Primary model failed, attempting fallback...`);
        response = await ai.models.generateContent({
            model: 'gemini-2.0-flash-exp',
            contents: [{ role: 'user', parts: parts }]
        });
    }

    let generatedImageBase64 = null;
    let generatedText = "";

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
         throw new Error("Empty AI response");
    }

    if (user) {
        const { data: freshProfile } = await supabaseAdmin.from('profiles').select('credits').eq('id', user.id).single();
        if (freshProfile && freshProfile.credits > 0) {
            await supabaseAdmin.from('profiles').update({ credits: freshProfile.credits - 1 }).eq('id', user.id);
        }
    }

    if (generatedImageBase64) {
         const returnedImage = `data:image/jpeg;base64,${generatedImageBase64}`;
         res.json({ success: true, image: returnedImage, message: "Transformation successful" });
    } else {
         const originalImg = `data:image/jpeg;base64,${base64Data}`;
         res.json({ success: true, image: originalImg, message: generatedText || "No changes." });
    }

  } catch (error) {
    console.error("Local Server Error:", error);
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

// CATCH ALL: Serve React App
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ error: 'API route not found' });
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});