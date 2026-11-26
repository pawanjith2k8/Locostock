'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import { getCurrentProfile } from '@/lib/db';
import { useUser } from '@/context/UserContext';
import { Store, Loader2, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { Profile } from '@/types';

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshProfile, switchRole } = useUser();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function handleAuthCallback() {
      if (!isSupabaseConfigured || !supabase) {
        setStatus('error');
        setErrorMsg('Authentication service is currently unavailable.');
        return;
      }

      // Check for error in query parameters or hash fragment
      let error = searchParams.get('error');
      let errorDescription = searchParams.get('error_description');

      // Supabase often appends error details to the URL hash fragment (#error=...&error_description=...)
      if (!error && typeof window !== 'undefined' && window.location.hash) {
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        error = hashParams.get('error');
        errorDescription = hashParams.get('error_description');
      }

      if (error) {
        setStatus('error');
        setErrorMsg(errorDescription || error || 'Authentication link failed or has expired.');
        return;
      }

      const code = searchParams.get('code');
      const token_hash = searchParams.get('token_hash');
      const type = searchParams.get('type');

      try {
        if (code) {
          // Exchange PKCE authorization code
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        } else if (token_hash) {
          // Exchange token hash
          const { error: verifyError } = await supabase.auth.verifyOtp({
            token_hash,
            type: (type as any) || 'email',
          });
          if (verifyError) throw verifyError;
        }

        // Wait for session to be recognized from URL or local client
        let { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        // If not immediately available but hash is present, parse URL fragment
        if (!session && typeof window !== 'undefined' && window.location.hash) {
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');
          if (accessToken && refreshToken) {
            const { data: setRes, error: setError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (!setError && setRes.session) {
              session = setRes.session;
            }
          }
        }

        if (session?.user) {
          if (!isMounted) return;

          // Ensure shopkeeper profile exists
          let p = await getCurrentProfile();
          if (!p) {
            const newProfile: Profile = {
              id: session.user.id,
              email: session.user.email || '',
              full_name: session.user.user_metadata?.full_name || (session.user.email ? session.user.email.split('@')[0] : 'Shopkeeper'),
              role: 'shopkeeper',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
            try {
              await supabase.from('profiles').insert([newProfile]);
            } catch (profileErr) {
              console.warn('Profile provisioning note:', profileErr);
            }
          }

          await refreshProfile();
          switchRole('shopkeeper');
          setStatus('success');

          // Clean up URL hash without reload
          if (typeof window !== 'undefined' && window.history.replaceState) {
            window.history.replaceState(null, '', window.location.pathname);
          }

          setTimeout(() => {
            router.push('/shopkeeper');
          }, 800);
        } else {
          // Listen for onAuthStateChange if asynchronous session establishment is pending
          const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
            if (currentSession?.user && (event === 'SIGNED_IN' || event === 'USER_UPDATED')) {
              subscription.unsubscribe();
              if (!isMounted) return;
              await refreshProfile();
              switchRole('shopkeeper');
              setStatus('success');
              setTimeout(() => {
                router.push('/shopkeeper');
              }, 800);
            }
          });

          // Timeout fallback if no session is detected after 5 seconds
          setTimeout(() => {
            if (isMounted) {
              setStatus(prev => {
                if (prev === 'verifying') {
                  setErrorMsg('Verification link expired or already used. Please request a new verification email.');
                  return 'error';
                }
                return prev;
              });
            }
          }, 5000);
        }
      } catch (err: any) {
        if (!isMounted) return;
        setStatus('error');
        setErrorMsg(err.message || 'Authentication link verification failed.');
      }
    }

    handleAuthCallback();

    return () => {
      isMounted = false;
    };
  }, [router, searchParams, refreshProfile, switchRole]);

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full bg-[#151C18] p-8 sm:p-10 rounded-3xl border border-[#303D34] shadow-2xl text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-[#1B241F] border border-[#303D34] text-[#22C55E] flex items-center justify-center mx-auto shadow-lg shadow-[#22C55E]/10">
          <Store className="w-8 h-8" />
        </div>

        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#F5F7F5] tracking-tight">
            Loco<span className="text-[#34D399]">Stock</span> Merchant Access
          </h1>
          <p className="text-xs text-[#A1ADA5]">
            Verifying your secure authentication link...
          </p>
        </div>

        {status === 'verifying' && (
          <div className="p-6 bg-[#1B241F] rounded-2xl border border-[#303D34] space-y-3">
            <Loader2 className="w-8 h-8 text-[#22C55E] animate-spin mx-auto" />
            <p className="text-xs font-semibold text-[#F5F7F5]">Establishing Merchant Session</p>
            <p className="text-[11px] text-[#A1ADA5]">
              Please wait while we verify your one-click sign-in link and secure your session.
            </p>
          </div>
        )}

        {status === 'success' && (
          <div className="p-6 bg-[#132B1C] rounded-2xl border border-[#245836] space-y-3">
            <CheckCircle2 className="w-8 h-8 text-[#22C55E] mx-auto" />
            <p className="text-xs font-bold text-[#34D399]">Authentication Confirmed!</p>
            <p className="text-[11px] text-[#A1ADA5]">
              Redirecting you to the Merchant Dashboard...
            </p>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-4">
            <div className="p-4 bg-[#2D1515] rounded-2xl border border-[#5C2424] text-xs text-[#EF4444] space-y-2">
              <div className="flex items-center justify-center gap-1.5 font-bold">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Verification Notice</span>
              </div>
              <p className="text-[11px] text-[#FCA5A5] leading-relaxed">
                {errorMsg}
              </p>
            </div>

            <Link
              href="/shopkeeper/login"
              className="inline-flex items-center justify-center gap-2 w-full py-3 bg-[#22C55E] hover:bg-[#16A34A] text-[#101512] font-black rounded-xl text-xs transition shadow-lg shadow-[#22C55E]/20"
            >
              <span>Return to Merchant Login</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[80vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#22C55E] animate-spin" />
      </div>
    }>
      <CallbackContent />
    </Suspense>
  );
}
