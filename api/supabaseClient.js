const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

// Load .env if available (local development)
dotenv.config();

// Helper to clean variables
const clean = (val) => {
  if (!val) return '';
  let s = val.trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
      s = s.slice(1, -1);
  }
  return s;
};

// --- BACKEND CONFIGURATION ---
// The backend needs the URL and the SERVICE_ROLE_KEY (Secret)
// It can also fall back to VITE_SUPABASE_URL for the URL part since the URL is public.

const SUPABASE_URL = clean(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL);
const SUPABASE_SERVICE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);

if (!SUPABASE_URL) {
    console.error("❌ BACKEND ERROR: Missing SUPABASE_URL (or VITE_SUPABASE_URL).");
}

if (!SUPABASE_SERVICE_KEY) {
    // Only warn if in production, to allow build steps to pass
    if (process.env.NODE_ENV === 'production') {
        console.error("❌ BACKEND ERROR: Missing SUPABASE_SERVICE_ROLE_KEY. Database operations will fail.");
    } else {
        console.warn("⚠️ BACKEND WARNING: Missing SUPABASE_SERVICE_ROLE_KEY.");
    }
}

// Initialize
// Use dummy values to prevent crash during build/import, but operations will fail if invalid.
const url = SUPABASE_URL && SUPABASE_URL.startsWith('http') ? SUPABASE_URL : `https://${SUPABASE_URL || 'example.supabase.co'}`;
const key = SUPABASE_SERVICE_KEY || 'placeholder-service-key';

const supabaseAdmin = createClient(url, key);

module.exports = supabaseAdmin;