/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    /** Request-scoped Supabase client, created once in src/middleware.ts. */
    supabase: import('@supabase/supabase-js').SupabaseClient;
    /** Set only after the admin_users membership check passes. */
    user?: import('@supabase/supabase-js').User;
  }
}

interface ImportMetaEnv {
  readonly SUPABASE_URL: string;
  readonly SUPABASE_ANON_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
