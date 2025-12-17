import { createClient } from '@supabase/supabase-js';

// --- ROBUST ENVIRONMENT VARIABLE LOADER ---

const getEnv = (key: string): string => {
  let val = '';
  
  // 1. Try Standard Vite (import.meta.env)
  // Wrapped in try-catch because accessing import.meta.env can throw in some polyfilled environments if undefined.
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      // @ts-ignore
      val = import.meta.env[key];
    }
  } catch (e) {
    // Silently fail
  }

  // 2. Try Injected Process (process.env)
  // This handles the fallback injected by vite.config.ts
  if (!val) {
    try {
      // @ts-ignore
      if (typeof process !== 'undefined' && process.env) {
        // @ts-ignore
        val = process.env[key];
      }
    } catch (e) {
      // Silently fail
    }
  }

  return val ? val.trim() : '';
};

const clean = (str: string) => {
  if (!str) return '';
  if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
    return str.slice(1, -1);
  }
  return str;
};

// Retrieve variables checking for both VITE_ prefix and non-prefixed versions
const rawUrl = getEnv('VITE_SUPABASE_URL') || getEnv('SUPABASE_URL');
const rawKey = getEnv('VITE_SUPABASE_ANON_KEY') || getEnv('SUPABASE_ANON_KEY');

const SUPABASE_URL = clean(rawUrl);
const SUPABASE_ANON_KEY = clean(rawKey);

// --- VALIDATION & INITIALIZATION ---

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn("⚠️ Supabase Configuration Missing ⚠️");
  console.warn("Please check your .env file or Vercel Environment Variables.");
}

// Fallback to placeholder to prevent white-screen crashes. 
// API calls will fail gracefully with auth errors instead of the app crashing on load.
const urlToUse = SUPABASE_URL || 'https://placeholder.supabase.co';
const keyToUse = SUPABASE_ANON_KEY || 'placeholder-key';

export const supabase = createClient(urlToUse, keyToUse);
