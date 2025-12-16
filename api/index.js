// VERCEL SERVERLESS FUNCTION ENTRY POINT
import express from 'express';
import Stripe from 'stripe';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const app = express();

// --- CONFIGURATION ---
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vgojlwhzxawmkdetywih.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error("CRITICAL ERROR: SUPABASE_SERVICE_ROLE_KEY is missing.");
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

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
  const user = await getAuthenticatedUser(req);
  let profile = null;

  // Use GEMINI_API_KEY as requested
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) return res.status(500).json({ error: "Server GEMINI_API_KEY missing" });

  try {
    if (user) {
        const { data } = await supabaseAdmin.from('profiles').select('credits').eq('id', user.id).single();
        profile = data;

        if (!profile || profile.credits < 1) {
            return res.status(403).json({ error: "Insufficient credits. Please upgrade or buy a pack." });
        }
        const { error: updateError } = await supabaseAdmin.from('profiles').update({ credits: profile.credits - 1 }).eq('id', user.id);
        if (updateError) throw new Error("Credit deduction failed");
    }

    // Initialize with correct SDK and Key
    const ai = new GoogleGenAI({ apiKey });
    
    // Ensure clean base64 string
    const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;

    // Call Gemini 2.5 Flash Image for editing
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
            parts: [
                {
                    inlineData: {
                        mimeType: "image/jpeg",
                        data: cleanBase64
                    }
                },
                {
                    text: `Professional photo edit. Preserve identity strictly. ${prompt}`
                }
            ]
        }
    });

    // Extract the generated image from response
    let generatedImage = null;
    let messageText = "";

    if (response.candidates && response.candidates[0].content.parts) {
        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
                generatedImage = `data:image/jpeg;base64,${part.inlineData.data}`;
            } else if (part.text) {
                messageText += part.text;
            }
        }
    }

    if (!generatedImage) {
        console.warn("No image generated, returning original with warning.");
        console.log("Model Text Response:", messageText);
        generatedImage = imageBase64;
    }

    res.json({ success: true, image: generatedImage, message: messageText });

  } catch (error) {
    console.error("Generation Error:", error);
    if (user && profile) await supabaseAdmin.from('profiles').update({ credits: profile.credits }).eq('id', user.id);
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
        else if (amountTotal === 999) creditsToAdd = 50;
        else if (amountTotal === 1999) creditsToAdd = 100;
        else if (amountTotal === 2999) creditsToAdd = 200;

        const { data: currentProfile } = await supabaseAdmin.from('profiles').select('credits').eq('id', user.id).single();
        const currentCredits = currentProfile ? currentProfile.credits : 0;

        await supabaseAdmin.from('profiles').update({ credits: currentCredits + creditsToAdd }).eq('id', user.id);
        res.json({ success: true, addedCredits: creditsToAdd });
    } catch (err) {
        res.status(500).json({ error: "Verification failed" });
    }
});

export default app;