import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // 1. Load env vars from .env files
  // Using (process as any) to avoid TS errors with cwd() in some environments
  const fileEnv = loadEnv(mode, (process as any).cwd(), '');
  
  // 2. Merge with system process.env (Vercel Environment Variables)
  const processEnv = { ...process.env, ...fileEnv };

  return {
    plugins: [react()],
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    },
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        }
      }
    },
    // 3. Expose variables to the client via global replacement
    // We strictly define process.env keys to ensure the code in supabaseClient.ts works
    define: {
      'process.env.SUPABASE_URL': JSON.stringify(processEnv.SUPABASE_URL || processEnv.VITE_SUPABASE_URL || ''),
      'process.env.SUPABASE_ANON_KEY': JSON.stringify(processEnv.SUPABASE_ANON_KEY || processEnv.VITE_SUPABASE_ANON_KEY || ''),
      'process.env.VITE_SUPABASE_URL': JSON.stringify(processEnv.VITE_SUPABASE_URL || ''),
      'process.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(processEnv.VITE_SUPABASE_ANON_KEY || ''),
    }
  };
});
