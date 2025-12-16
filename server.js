// BACKEND SERVER FOR UPSCALE IMAGERY AI
// To run: npm install express stripe cors dotenv nodemailer @google/genai @supabase/supabase-js && node server.js

import express from 'express';
import Stripe from 'stripe';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import nodemailer from 'nodemailer';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config();

// Define __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// --- CONFIGURATION ---
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vgojlwhzxawmkdetywih.supabase.co';

// CRITICAL: User Service Role Key for backend updates (Credits/Plans)
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZnb2psd2h6eGF3bWtkZXR5d2loIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTg0MzQyMCwiZXhwIjoyMDgxNDE5NDIwfQ.e8aPDzdUSv5sKFt7mYWSWA_N34kOa27tiVEQCJN7ghM';

// Initialize Supabase Admin (Bypasses RLS)
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder_key', {
  apiVersion: '2023-10-16',
});

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(cors());
app.use(express.static(__dirname));

// --- HELPER FUNCTIONS ---

/**
 * Middleware to verify Supabase JWT and get the user
 */
const getAuthenticatedUser = async (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  return user;
};

// --- ROUTES ---

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date() });
});

/**
 * SECURE GENERATION ENDPOINT
 * 1. Verifies User
 * 2. Checks Credits in Database (Admin Client)
 * 3. Deducts Credit (Admin Client)
 * 4. Calls Gemini
 */
app.post('/api/generate', async (req, res) => {
  const { imageBase64, prompt } = req.body;
  
  // 1. Verify User
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized. Please log in." });
  }

  if (!process.env.API_KEY) {
    return res.status(500).json({ error: "Server misconfiguration: API Key missing" });
  }

  try {
    // 2. Check Credits (Directly from DB via Admin, bypassing RLS)
    const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('credits, plan')
        .eq('id', user.id)
        .single();

    if (profileError || !profile) {
        return res.status(500).json({ error: "Failed to retrieve user profile." });
    }

    // STRICT MODE: Must have credits > 0 to use this endpoint
    if (profile.credits < 1) {
        return res.status(403).json({ error: "Insufficient credits. Please upgrade your plan." });
    }

    // 3. Deduct Credit
    const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({ credits: profile.credits - 1 })
        .eq('id', user.id);

    if (updateError) {
        return res.status(500).json({ error: "Failed to process credits." });
    }

    // 4. Generate Image
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const MODEL_NAME = 'gemini-2.5-flash-image';
    const cleanBase64 = imageBase64.split(',')[1] || imageBase64;

    const systemPrompt = `
      TASK: You are a professional photo editor.
      INPUT: Image of person + User Request.
      GUIDELINES: Preserve identity strictly. Realism. High quality.
      USER REQUEST: ${prompt}
    `;

    const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: {
            parts: [
                { text: systemPrompt },
                { inlineData: { mimeType: 'image/jpeg', data: cleanBase64 } }
            ]
        }
    });

    // Extract image
    let generatedImage = null;
    const parts = response.candidates?.[0]?.content?.parts;
    if (parts) {
        for (const part of parts) {
            if (part.inlineData && part.inlineData.data) {
                generatedImage = `data:image/jpeg;base64,${part.inlineData.data}`;
                break;
            }
        }
    }

    if (!generatedImage) {
        // Refund credit if generation failed
        await supabaseAdmin.from('profiles').update({ credits: profile.credits }).eq('id', user.id);
        throw new Error("AI failed to generate image.");
    }

    // 5. Success
    res.json({ success: true, image: generatedImage, remainingCredits: profile.credits - 1 });

  } catch (error) {
    console.error("Server Generation Error:", error);
    res.status(500).json({ error: error.message || "Failed to generate image" });
  }
});

/**
 * SECURE PAYMENT VERIFICATION
 * Called by frontend after Stripe redirect.
 * Verifies session with Stripe -> Updates DB via Admin.
 */
app.post('/api/verify-checkout', async (req, res) => {
    const { sessionId } = req.body;
    const user = await getAuthenticatedUser(req);
    
    if (!user || !sessionId) return res.status(400).json({ error: "Invalid request" });

    try {
        // 1. Ask Stripe if this session is paid
        const session = await stripe.checkout.sessions.retrieve(sessionId);

        if (session.payment_status !== 'paid') {
            return res.status(400).json({ error: "Payment not completed" });
        }

        // 2. Determine Credits to Add based on Price/Product Metadata
        // Simplification: We map price amount (cents) to credits.
        let creditsToAdd = 0;
        let newPlan = 'NONE';
        const amountTotal = session.amount_total; 

        if (amountTotal === 399) { creditsToAdd = 5; newPlan = 'NONE'; }
        else if (amountTotal === 999) { creditsToAdd = 50; newPlan = 'BASIC'; }
        else if (amountTotal === 1999) { creditsToAdd = 100; newPlan = 'PRO'; }
        else if (amountTotal === 2999) { creditsToAdd = 200; newPlan = 'ELITE'; }

        // 3. Update User Profile (Admin Action)
        // First get current credits
        const { data: currentProfile } = await supabaseAdmin.from('profiles').select('credits').eq('id', user.id).single();
        const currentCredits = currentProfile ? currentProfile.credits : 0;

        await supabaseAdmin.from('profiles').update({
            credits: currentCredits + creditsToAdd,
            plan: newPlan === 'NONE' ? undefined : newPlan // Only update plan if subscription
        }).eq('id', user.id);

        res.json({ success: true, addedCredits: creditsToAdd });

    } catch (err) {
        console.error("Payment Verify Error:", err);
        res.status(500).json({ error: "Verification failed" });
    }
});

/**
 * SEND EMAIL ENDPOINT
 */
app.post('/api/send-email', async (req, res) => {
  const { to, subject, text, html } = req.body;
  
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return res.status(503).json({ error: "Email service not configured." });
  
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false, 
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

  try {
    await transporter.sendMail({ from: process.env.SMTP_FROM, to, subject, text, html });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send email' });
  }
});

app.post('/api/create-payment-intent', async (req, res) => {
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: 399, currency: 'usd', automatic_payment_methods: { enabled: true },
    });
    res.send({ clientSecret: paymentIntent.client_secret });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.post('/api/create-checkout-session', async (req, res) => {
  const { priceId, email } = req.body;
  const DOMAIN = req.headers.origin || 'https://www.upscaleimageryai.com';
  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: email,
      success_url: `${DOMAIN}/#/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${DOMAIN}/#/dashboard`,
    });
    res.json({ url: session.url });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ error: 'API route not found' });
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Backend Server running on port ${PORT}`);
});