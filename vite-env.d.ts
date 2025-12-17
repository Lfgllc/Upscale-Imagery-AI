// Manually define ImportMeta and ImportMetaEnv to fix missing type definitions for Vite environment variables.
// This replaces the missing 'vite/client' type definitions.

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly [key: string]: string | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
