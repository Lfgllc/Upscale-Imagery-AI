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

// Helper to safely access env vars in Vite or standard process.env environments
const getEnvVar = (key: string): string => {
  // 1. Try import.meta.env (Vite standard)
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
    return cleanEnvVar(import.meta.env[key]);
  }
  // 2. Try process.env (Fallback for some build tools or legacy setups)
  try {
    // @ts-ignore - process might not be defined in all environments
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      // @ts-ignore
      return cleanEnvVar(process.env[key]);
    }
  } catch (e) {
    // Ignore error if process is not defined
  }
  return '';
};

let SUPABASE_URL = getEnvVar('VITE_SUPABASE_URL');
const SUPABASE_ANON_KEY = getEnvVar('VITE_SUPABASE_ANON_KEY'); 

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
    // Log safe details to console to confirm what is being used (only in dev usually, but useful for debugging this issue)
    const isDev = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.DEV : false;
    if (isDev) {
        console.log("Supabase Client Initialized:", {
            url: SUPABASE_URL,
            keyLength: SUPABASE_ANON_KEY ? SUPABASE_ANON_KEY.length : 0
        });
    }
}

// Initialize Supabase Client
// Use fallbacks to prevent crash if env vars are missing
const finalUrl = SUPABASE_URL || 'https://placeholder.supabase.co';
const finalKey = SUPABASE_ANON_KEY || 'placeholder';

export const supabase = createClient(finalUrl, finalKey);