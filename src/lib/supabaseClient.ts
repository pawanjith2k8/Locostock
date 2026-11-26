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
 * 1. In browser environments: dynamically uses window.location.origin (e.g. https://locostock.vercel.app or http://localhost:3000)
 * 2. In server / build environments: checks process.env.NEXT_PUBLIC_APP_URL
 * 3. In Vercel environments: checks process.env.VERCEL_URL
 * 4. Production fallback: https://locostock.vercel.app/auth/callback
 * Note: Never falls back to localhost when running in production.
 */
export function getAuthRedirectUrl(): string {
  // 1. Browser environments
  if (typeof window !== 'undefined' && window.location?.origin) {
    const origin = window.location.origin.trim().replace(/\/+$/, '');
    if (origin.startsWith('http://') || origin.startsWith('https://')) {
      return `${origin}/auth/callback`;
    }
  }

  // 2. Server environments: NEXT_PUBLIC_APP_URL
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').trim().replace(/^["']|["']$/g, '').replace(/\/+$/, '');
  if (appUrl && (appUrl.startsWith('http://') || appUrl.startsWith('https://'))) {
    // If in production mode but appUrl is set to localhost, prevent redirecting to localhost
    if (process.env.NODE_ENV === 'production' && appUrl.includes('localhost')) {
      return 'https://locostock.vercel.app/auth/callback';
    }
    return `${appUrl}/auth/callback`;
  }

  // 3. Vercel deployment URL
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/+$/, '')}/auth/callback`;
  }

  // 4. Default production fallback
  return 'https://locostock.vercel.app/auth/callback';
}
