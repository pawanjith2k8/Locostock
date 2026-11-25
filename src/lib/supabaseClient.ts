import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '')
  .trim()
  .replace(/^["']|["']$/g, '')
  .replace(/\/+$/, '');

// Support both standard publishable key and legacy anon key environment variables
const supabaseKey = (
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
  ''
)
  .trim()
  .replace(/^["']|["']$/g, '');

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseKey && 
  !supabaseUrl.includes('your-project-id') &&
  !supabaseUrl.includes('placeholder') &&
  !supabaseKey.includes('placeholder') &&
  !supabaseKey.includes('sb_publishable_...') &&
  supabaseKey !== 'your-anon-key-here' &&
  supabaseKey.length > 10
);

// Official Supabase client for client-side and server-side operations
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : (null as unknown as ReturnType<typeof createClient>);

/**
 * Resolves the environment-aware redirect URL for authentication callbacks.
 * 1. In browser environments: uses window.location.origin (e.g. https://locostock.vercel.app or http://localhost:3000)
 * 2. In server / build environments: checks process.env.NEXT_PUBLIC_APP_URL
 * 3. Default fallback: https://locostock.vercel.app/auth/callback
 */
export function getAuthRedirectUrl(): string {
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    return `${window.location.origin}/auth/callback`;
  }
  if (process.env.NEXT_PUBLIC_APP_URL) {
    const base = process.env.NEXT_PUBLIC_APP_URL.trim().replace(/^["']|["']$/g, '').replace(/\/+$/, '');
    return `${base}/auth/callback`;
  }
  return 'https://locostock.vercel.app/auth/callback';
}
