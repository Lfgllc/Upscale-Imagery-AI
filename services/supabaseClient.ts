import { createClient } from '@supabase/supabase-js';

// --- CONFIGURATION ---
// We strictly use Vite environment variables. 
// Hardcoded values have been removed to prevent mismatches between keys and URLs.

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY; 

if (!SUPABASE_URL) {
    console.error("CRITICAL: VITE_SUPABASE_URL is missing in environment variables.");
}

if (!SUPABASE_ANON_KEY) {
    console.error("CRITICAL: VITE_SUPABASE_ANON_KEY is missing in environment variables.");
}

// Initialize Supabase Client
// We trim() the key to ensure no accidental whitespace from copy-pasting causes invalid key errors.
export const supabase = createClient(
    SUPABASE_URL || '', 
    (SUPABASE_ANON_KEY || '').trim()
);