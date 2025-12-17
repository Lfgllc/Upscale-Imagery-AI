import { createClient } from '@supabase/supabase-js';

// --- ROBUST ENVIRONMENT CONFIGURATION ---

// Helper to sanitize values (remove accidental quotes or whitespace)
const clean = (str: string | undefined): string => {
  if (!str) return '';
  const s = str.trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
};

// 1. Initialize variables
let rawUrl = '';
let rawKey = '';

// 2. Attempt to read from Vite's import.meta.env
// We wrap this in a try-catch to prevent "ReferenceError" or "undefined is not an object" 
// in environments where import.meta is not supported or defined.
try {
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    // Vite statically replaces these patterns at build time. 
    // If the variable is missing, it might remain as the expression or become undefined.
    // We assign to temporary variables to ensure the bundler picks them up.
    const vUrl = import.meta.env.VITE_SUPABASE_URL;
    const vKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    
    if (vUrl) rawUrl = vUrl;
    if (vKey) rawKey = vKey;
  }
} catch (e) {
  // Safe to ignore: means we aren't in a standard ESM environment
}

// 3. Fallback to process.env (Node.js / Vercel Serverless / Non-Vite)
if (!rawUrl || !rawKey) {
  try {
    // @ts-ignore
    if (typeof process !== 'undefined' && process.env) {
      // Check both standard names and VITE_ prefixed names
      // @ts-ignore
      rawUrl = rawUrl || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
      // @ts-ignore
      rawKey = rawKey || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
    }
  } catch (e) {
    // Ignore
  }
}

const SUPABASE_URL = clean(rawUrl);
const SUPABASE_ANON_KEY = clean(rawKey);

// 4. Debugging & Validation
const isMissing = !SUPABASE_URL || !SUPABASE_ANON_KEY;

if (isMissing) {
  console.warn("⚠️ Supabase Configuration Missing ⚠️");
  console.warn("Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your .env file or Vercel Environment Variables.");
  console.warn(`Current status -> URL: ${!!SUPABASE_URL}, Key: ${!!SUPABASE_ANON_KEY}`);
} 

// 5. Create Client
// We use placeholders if missing to prevent the app from crashing immediately on load.
// Auth calls will fail, but the UI will render.
const urlToUse = SUPABASE_URL || 'https://placeholder.supabase.co';
const keyToUse = SUPABASE_ANON_KEY || 'placeholder-key';

export const supabase = createClient(urlToUse, keyToUse);