
import { createClient } from '@supabase/supabase-js';

// --- CONFIGURATION ---
// NOTE: These values are for the PUBLIC client (Frontend).
// The 'ANON' key is safe to be exposed in the browser. It adheres to Row Level Security (RLS).
// It CANNOT delete the database or bypass security rules.
// The SECRET 'Service Role' key is kept safely on the server (server.js / .env).

const SUPABASE_URL = 'https://vgojlwhzxawmkdetywih.supabase.co';
const SUPABASE_PUBLIC_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZnb2psd2h6eGF3bWtkZXR5d2loIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4NDM0MjAsImV4cCI6MjA4MTQxOTQyMH0.bC5tLlOdrPsBTvbQ87dXJMqniLnP-I0t1LL3I3VxVCg';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLIC_ANON_KEY);
