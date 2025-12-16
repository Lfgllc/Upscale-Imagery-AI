const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

// Load environment variables if running locally
dotenv.config();

// Backend should look for SUPABASE_URL first, then VITE_SUPABASE_URL as a backup
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
    console.error("BACKEND ERROR: SUPABASE_URL is missing from environment variables.");
}

if (!SUPABASE_SERVICE_KEY) {
  // Check if we are in a build phase where env vars might not be present yet
  if (process.env.NODE_ENV !== 'production') {
    console.warn("WARNING: SUPABASE_SERVICE_ROLE_KEY is missing. Database operations will fail.");
  }
}

// Initialize Supabase Admin Client
// Use trim() to clean up any potential whitespace in the secret key
const supabaseAdmin = createClient(
    SUPABASE_URL || '', 
    (SUPABASE_SERVICE_KEY || '').trim()
);

module.exports = supabaseAdmin;