
import { createClient } from '@supabase/supabase-js';

// INSTRUCTIONS:
// 1. Create a project at https://database.new
// 2. Go to Project Settings -> API
// 3. Replace the values below with your Project URL and Anon Key
// 4. Ideally, use process.env.SUPABASE_URL in a real build environment, but for this structure:

const SUPABASE_URL = 'https://vgojlwhzxawmkdetywih.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZnb2psd2h6eGF3bWtkZXR5d2loIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4NDM0MjAsImV4cCI6MjA4MTQxOTQyMH0.bC5tLlOdrPsBTvbQ87dXJMqniLnP-I0t1LL3I3VxVCg';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
