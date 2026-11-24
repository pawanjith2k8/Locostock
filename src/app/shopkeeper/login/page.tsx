'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Store, 
  Mail, 
  KeyRound, 
  ArrowRight, 
  ShieldCheck, 
  AlertCircle, 
  CheckCircle2, 
  RotateCcw,
  Info,
  Database
} from 'lucide-react';
import { sendShopkeeperOtp, verifyShopkeeperOtp } from '@/lib/db';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import { useUser } from '@/context/UserContext';

export default function ShopkeeperLoginPage() {
  const router = useRouter();
  const { profile, switchRole, refreshProfile } = useUser();

  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  // If merchant is already authenticated, redirect to portal
  useEffect(() => {
    if (profile) {
      switchRole('shopkeeper');
      router.push('/shopkeeper');
    }
  }, [profile, router, switchRole]);

  // Listen for one-click email link verification
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user && (event === 'SIGNED_IN' || event === 'USER_UPDATED')) {
        await refreshProfile();
        switchRole('shopkeeper');
        router.push('/shopkeeper');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [refreshProfile, router, switchRole]);

  // Resend Countdown
  const [countdown, setCountdown] = useState(0);

  // Live Supabase Connectivity Status
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'unreachable' | 'unconfigured'>(
    !isSupabaseConfigured ? 'unconfigured' : 'checking'
  );

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setConnectionStatus('unconfigured');
      return;
    }

    let isMounted = true;
    async function checkConnectivity() {
      try {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';
        
        // Lightweight probe to verify network reachability of Supabase Auth
        const res = await fetch(`${url}/auth/v1/health`, {
          method: 'GET',
          headers: { apikey: key },
        }).catch(() => null);

        if (!isMounted) return;
        if (res && (res.ok || res.status < 500)) {
          setConnectionStatus('connected');
        } else {
          setConnectionStatus('unreachable');
        }
      } catch {
        if (isMounted) setConnectionStatus('unreachable');
      }
    }

    checkConnectivity();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSupabaseConfigured) {
      setErrorMsg('Supabase service is not configured yet. Please configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local to enable email OTP login.');
      return;
    }

    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setInfoMsg(null);

    try {
      await sendShopkeeperOtp(cleanEmail);
      setStep('otp');
      setCountdown(30);
      setInfoMsg(`A 6-digit secure verification code has been sent to ${cleanEmail}`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to send verification code.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSupabaseConfigured) {
      setErrorMsg('Supabase service is not configured yet.');
      return;
    }

    if (!otp.trim()) {
      setErrorMsg('Please enter the verification code.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      await verifyShopkeeperOtp(email.trim(), otp.trim());
      await refreshProfile();
      switchRole('shopkeeper');
      router.push('/shopkeeper');
    } catch (err: any) {
      setErrorMsg(err.message || 'Verification failed. Please check the code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full bg-[#151C18] p-8 sm:p-10 rounded-3xl border border-[#303D34] shadow-2xl space-y-6">
        {/* Branding & Header */}
        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-[#1B241F] border border-[#303D34] text-[#22C55E] flex items-center justify-center mx-auto shadow-lg shadow-[#22C55E]/10">
            <Store className="w-7 h-7" />
          </div>

          <div className="space-y-1">
            <h1 className="text-2xl font-extrabold text-[#F5F7F5] tracking-tight">
              Loco<span className="text-[#34D399]">Stock</span> Merchant
            </h1>
            <p className="text-xs text-[#A1ADA5]">
              Local Products. Real Shops.
            </p>
          </div>

          <p className="text-xs text-[#A1ADA5] max-w-xs mx-auto leading-relaxed">
            Sign in to manage your shop, synchronize real-time product stock, and issue fast electronic bills.
          </p>
        </div>

        {/* Database Status Indicator */}
        <div className="p-3 rounded-xl bg-[#1B241F] border border-[#303D34] flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-2 text-[#A1ADA5]">
            <Database className="w-4 h-4 text-[#34D399] shrink-0" />
            <span>Auth & DB Endpoint:</span>
          </div>
          <span className={`font-bold px-2.5 py-0.5 rounded-full text-[10px] border flex items-center gap-1.5 ${
            connectionStatus === 'connected'
              ? 'bg-[#132B1C] text-[#22C55E] border-[#245836]'
              : connectionStatus === 'checking'
              ? 'bg-[#182635] text-[#38BDF8] border-[#075985]'
              : connectionStatus === 'unreachable'
              ? 'bg-[#2D1F10] text-[#F59E0B] border-[#78350F]'
              : 'bg-[#2D1515] text-[#EF4444] border-[#5C2424]'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${
              connectionStatus === 'connected'
                ? 'bg-[#22C55E]'
                : connectionStatus === 'checking'
                ? 'bg-[#38BDF8] animate-pulse'
                : connectionStatus === 'unreachable'
                ? 'bg-[#F59E0B]'
                : 'bg-[#EF4444]'
            }`} />
            <span>
              {connectionStatus === 'connected'
                ? 'Supabase Live & Reachable'
                : connectionStatus === 'checking'
                ? 'Testing Connection...'
                : connectionStatus === 'unreachable'
                ? 'Host Unreachable (Project Paused)'
                : 'Awaiting Supabase Setup'}
            </span>
          </span>
        </div>

        {/* Unreachable Notice */}
        {connectionStatus === 'unreachable' && (
          <div className="p-3.5 bg-[#231A14] border border-[#523419] rounded-xl text-xs text-[#FBBF24] space-y-1.5 font-medium">
            <div className="flex items-center gap-2 font-bold text-[#F59E0B]">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Supabase Host Unreachable</span>
            </div>
            <p className="text-[11px] text-[#D1D5DB] leading-relaxed">
              The project endpoint <code className="text-[#FBBF24] bg-[#101512] px-1 py-0.5 rounded font-mono break-all">{process.env.NEXT_PUBLIC_SUPABASE_URL}</code> could not be reached over DNS.
            </p>
            <p className="text-[11px] text-[#A1ADA5] leading-relaxed">
              If your free-tier Supabase project was paused due to inactivity, log in to your <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="text-[#34D399] underline font-semibold">Supabase Dashboard</a> and click <strong>Restore Project</strong>. If you have an active project with a different URL, update <code className="text-[#FBBF24] bg-[#101512] px-1 py-0.5 rounded">NEXT_PUBLIC_SUPABASE_URL</code> in <code className="text-[#FBBF24] bg-[#101512] px-1 py-0.5 rounded">.env.local</code>.
            </p>
          </div>
        )}

        {/* Unconfigured Honest Notice */}
        {connectionStatus === 'unconfigured' && (
          <div className="p-3.5 bg-[#231A14] border border-[#523419] rounded-xl text-xs text-[#FBBF24] space-y-1 font-medium">
            <div className="flex items-center gap-2 font-bold text-[#F59E0B]">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Supabase Credentials Required</span>
            </div>
            <p className="text-[11px] text-[#D1D5DB] leading-relaxed">
              Real authentication is disabled until you provide your <code className="text-[#FBBF24] bg-[#101512] px-1 py-0.5 rounded">NEXT_PUBLIC_SUPABASE_URL</code> and <code className="text-[#FBBF24] bg-[#101512] px-1 py-0.5 rounded">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in <code className="text-[#FBBF24] bg-[#101512] px-1 py-0.5 rounded">.env.local</code>.
            </p>
          </div>
        )}

        {/* Feedback Alerts */}
        {infoMsg && (
          <div className="p-3 bg-[#132B1C] border border-[#245836] rounded-xl text-xs text-[#34D399] flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4 text-[#22C55E] shrink-0" />
            <span>{infoMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-3 bg-[#2D1515] border border-[#5C2424] rounded-xl text-xs text-[#EF4444] flex items-center gap-2 font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Step 1: Email Form */}
        {step === 'email' ? (
          <form onSubmit={handleSendOtp} className="space-y-4 text-xs">
            <div>
              <label className="block text-[#A1ADA5] font-semibold mb-1.5">
                Registered Merchant Email *
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#A1ADA5] absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  disabled={!isSupabaseConfigured || loading}
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="shopkeeper@example.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-[#1B241F] border border-[#303D34] rounded-xl text-xs sm:text-sm font-medium text-[#F5F7F5] placeholder-[#A1ADA5]/60 outline-none focus:border-[#34D399] disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={!isSupabaseConfigured || loading}
              className="w-full py-3 bg-[#22C55E] hover:bg-[#16A34A] disabled:bg-[#232E27] disabled:text-[#A1ADA5] disabled:cursor-not-allowed text-[#101512] font-black rounded-xl transition text-xs sm:text-sm shadow-lg shadow-[#22C55E]/20 flex items-center justify-center gap-2"
            >
              <span>{loading ? 'Sending Code...' : isSupabaseConfigured ? 'Send Verification OTP' : 'Database Service Not Configured'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        ) : (
          /* Step 2: OTP Verification Form */
          <form onSubmit={handleVerifyOtp} className="space-y-4 text-xs animate-fade-in">
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-[#A1ADA5] font-semibold">Enter 6-Digit Code or Click Email Link</label>
                <button
                  type="button"
                  onClick={() => setStep('email')}
                  className="text-[11px] text-[#34D399] hover:underline"
                >
                  Change Email
                </button>
              </div>

              <div className="relative">
                <KeyRound className="w-4 h-4 text-[#A1ADA5] absolute left-3.5 top-3" />
                <input
                  type="text"
                  required
                  maxLength={10}
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\s+/g, ''))}
                  placeholder="000000"
                  className="w-full pl-10 pr-4 py-2.5 bg-[#1B241F] border border-[#303D34] rounded-xl text-center text-lg font-mono font-bold tracking-widest text-[#F5F7F5] outline-none focus:border-[#34D399]"
                />
              </div>

              <div className="mt-2.5 p-3 bg-[#1B241F] rounded-xl border border-[#303D34] text-[11px] text-[#A1ADA5] space-y-1">
                <div className="flex items-center gap-1.5 text-[#34D399] font-medium">
                  <Info className="w-3.5 h-3.5 shrink-0" />
                  <span>Two Easy Ways to Sign In:</span>
                </div>
                <p className="leading-relaxed">
                  1. Enter the <strong>6-digit code</strong> from your email above and click Verify, OR<br/>
                  2. Click the <strong>one-click sign-in link</strong> in your email to authenticate instantly.
                </p>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#22C55E] hover:bg-[#16A34A] text-[#101512] font-black rounded-xl transition text-xs sm:text-sm shadow-lg shadow-[#22C55E]/20 flex items-center justify-center gap-2"
            >
              <span>{loading ? 'Verifying...' : 'Verify & Enter Portal'}</span>
              <ShieldCheck className="w-4 h-4" />
            </button>

            {/* Resend countdown */}
            <div className="text-center pt-2 text-[11px] text-[#A1ADA5]">
              {countdown > 0 ? (
                <span>Resend code in {countdown}s</span>
              ) : (
                <button
                  type="button"
                  onClick={handleSendOtp}
                  className="text-[#34D399] font-bold hover:underline inline-flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Resend Code</span>
                </button>
              )}
            </div>
          </form>
        )}

        {/* Footer Link to New Shop Registration */}
        <div className="pt-4 border-t border-[#303D34] text-center text-xs text-[#A1ADA5] space-y-2">
          <div>
            Don&apos;t have a registered shop yet?
          </div>
          <Link
            href="/shopkeeper/onboarding"
            className="inline-flex items-center gap-1.5 font-bold text-[#34D399] hover:underline"
          >
            <span>Register a New Shop</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
