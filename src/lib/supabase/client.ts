import { createBrowserClient } from '@supabase/ssr';

const DEFAULT_SUPABASE_URL = 'https://vnzgpwgobsmvrzrlxzlz.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'sb_publishable_wu63amNz9BRpma-ZYnSWYQ_cSVw9YCR';

export function isSupabaseConfigured(): boolean {
  return true;
}

export function createClient() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('tu-proyecto')
      ? process.env.NEXT_PUBLIC_SUPABASE_URL
      : DEFAULT_SUPABASE_URL;

  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.includes('tu-')
      ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      : DEFAULT_SUPABASE_ANON_KEY;

  return createBrowserClient(url, key);
}
