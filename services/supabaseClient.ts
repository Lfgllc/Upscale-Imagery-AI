import { createClient } from '@supabase/supabase-js';

// --- CONFIGURATION ---
// Helper to clean environment variables (removes whitespace and accidental quotes)
const cleanEnvVar = (value: string | undefined): string => {
  if (!value) return '';
  let cleaned = value.trim();
  // Remove surrounding quotes if user added them in Vercel (common mistake)
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || 
      (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
      cleaned = cleaned.slice(1, -1);
  }
  return cleaned;
};

// Retrieve and clean variables
// Safely access import.meta.env to prevent "undefined is not an object" error
const env = (import.meta.env || {}) as any;
let SUPABASE_URL = cleanEnvVar(env.VITE_SUPABASE_URL);
const SUPABASE_ANON_KEY = cleanEnvVar(env.VITE_SUPABASE_ANON_KEY); 

// Ensure Protocol
if (SUPABASE_URL && !SUPABASE_URL.startsWith('http')) {
    SUPABASE_URL = `https://${SUPABASE_URL}`;
}

// Validation & Debugging
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn("Supabase environment variables are missing or empty. Check .env file.", {
        url: !!SUPABASE_URL,
        key: !!SUPABASE_ANON_KEY
    });
} else {
    // Log safe details to console to confirm what is being used
    console.log("Supabase Client Initializing:", {
        url: SUPABASE_URL,
        keyStart: SUPABASE_ANON_KEY.substring(0, 5) + '...',
        keyLength: SUPABASE_ANON_KEY.length
    });
}

// Initialize Supabase Client
// Use fallbacks to prevent crash if env vars are missing
const finalUrl = SUPABASE_URL || 'https://placeholder.supabase.co';
const finalKey = SUPABASE_ANON_KEY || 'placeholder';

export const supabase = createClient(finalUrl, finalKey);