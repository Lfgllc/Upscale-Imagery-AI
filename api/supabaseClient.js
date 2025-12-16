const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

// Load environment variables if running locally
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vgojlwhzxawmkdetywih.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  // Check if we are in a build phase where env vars might not be present yet
  if (process.env.NODE_ENV !== 'production') {
    console.warn("WARNING: SUPABASE_SERVICE_ROLE_KEY is missing. Database operations will fail.");
  }
}

// Initialize Supabase Client
// Note: We use the service role key for the backend to bypass RLS where necessary
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY || '');

module.exports = supabaseAdmin;