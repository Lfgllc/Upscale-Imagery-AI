// BACKEND SERVER FOR UPSCALE IMAGERY AI
// To run: npm install express stripe cors dotenv && node server.js

import express from 'express';
import Stripe from 'stripe';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

// Define __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Stripe with Secret Key (Keep this secure in .env)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder_key', {
  apiVersion: '2023-10-16',
});

// Middleware
app.use(cors());
app.use(express.json());

// --- SERVE STATIC FRONTEND FILES ---
// This tells the server to share the files in the current folder (like index.html) with the browser
app.use(express.static(__dirname));

// Routes

/**
 * Health Check
 */
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date() });
});

/**
 * Create Payment Intent (for One-time purchases)
 */
app.post('/api/create-payment-intent', async (req, res) => {
  const { items, email } = req.body;

  // Calculate total price based on items on server side to prevent manipulation
  // For this demo, we assume fixed price for one-time unlock
  const amount = 399; // $3.99 in cents

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      receipt_email: email,
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        integration_check: 'accept_a_payment',
      },
    });

    res.send({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (e) {
    console.error(e.message);
    res.status(400).json({ error: e.message });
  }
});

/**
 * Create Checkout Session (for Subscriptions)
 */
app.post('/api/create-checkout-session', async (req, res) => {
  const { priceId, email } = req.body;

  // Use the production domain as fallback if origin header is missing
  const DOMAIN = req.headers.origin || 'https://www.upscaleimageryai.com';

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId, // The API ID of the price from Stripe Dashboard
          quantity: 1,
        },
      ],
      customer_email: email,
      // Redirects to the dashboard on success/cancel
      success_url: `${DOMAIN}/#/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${DOMAIN}/#/dashboard`,
    });

    res.json({ url: session.url });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// --- CATCH-ALL ROUTE ---
// If the user requests a page (not an API), send them the index.html
app.get('*', (req, res) => {
  // Ignore API requests in this catch-all
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'API route not found' });
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`Backend Server running on port ${PORT}`);
  console.log(`- Serving static files from: ${__dirname}`);
  console.log(`- Ensure STRIPE_SECRET_KEY is set in .env`);
});