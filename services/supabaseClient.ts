import { createClient } from '@supabase/supabase-js';

const supabaseUrlRaw = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKeyRaw = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrlRaw || !supabaseAnonKeyRaw) {
  throw new Error(
    'Supabase environment variables are missing. ' +
    'Required: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY'
  );
}

const supabaseUrl = String(supabaseUrlRaw);
const supabaseAnonKey = String(supabaseAnonKeyRaw);

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);