import { createClient } from '@supabase/supabase-js';

// --- CONFIGURATION ---
// We use Vite environment variables (VITE_*) to securely inject keys at build time.
// The VITE_SUPABASE_ANON_KEY is safe to expose to the browser (it handles RLS).

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://vgojlwhzxawmkdetywih.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY; 

if (!SUPABASE_ANON_KEY) {
    console.warn("WARNING: VITE_SUPABASE_ANON_KEY is missing. Sign up/Login will fail.");
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY || '');