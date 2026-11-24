import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
// Support both standard publishable key and legacy anon key environment variables
const supabaseKey = 
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
  '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseKey && 
  !supabaseUrl.includes('your-project-id') &&
  !supabaseUrl.includes('placeholder') &&
  !supabaseKey.includes('placeholder') &&
  !supabaseKey.includes('sb_publishable_...') &&
  supabaseKey !== 'your-anon-key-here' &&
  supabaseKey.trim().length > 10
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
