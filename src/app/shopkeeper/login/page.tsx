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
  Loader2
} from 'lucide-react';
import { sendShopkeeperOtp, verifyShopkeeperOtp } from '@/lib/db';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import { useUser } from '@/context/UserContext';

export default function ShopkeeperLoginPage() {
  const router = useRouter();
  const { profile, switchRole, refreshProfile } = useUser();

  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'email' | 'verify'>('email');
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);

  // If merchant is already authenticated, redirect to portal
  useEffect(() => {
    if (profile) {
      switchRole('shopkeeper');
      router.push('/shopkeeper');
    }
  }, [profile, router, switchRole]);

  // Listen for one-click email confirmation link verification in background
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
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleSendVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSupabaseConfigured) {
      setErrorMsg('Authentication service is currently unavailable. Please check your connection.');
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
      setStep('verify');
      setCountdown(30);
      setInfoMsg('Confirmation email sent. Please check your inbox and click the verification link to activate your account.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to send verification email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSupabaseConfigured) {
      setErrorMsg('Authentication service is currently unavailable.');
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
      setErrorMsg(err.message || 'Verification failed. Please check the code or click the link in your email.');
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

        {/* Business-Friendly Operational Status Indicator */}
        <div className="p-3 rounded-xl bg-[#1B241F] border border-[#303D34] flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-2 text-[#A1ADA5]">
            <ShieldCheck className="w-4 h-4 text-[#34D399] shrink-0" />
            <span>Store Portal:</span>
          </div>
          <span className="font-bold px-2.5 py-0.5 rounded-full text-[10px] border flex items-center gap-1.5 bg-[#132B1C] text-[#22C55E] border-[#245836]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse" />
            <span>All systems operational</span>
          </span>
        </div>

        {/* Feedback Alerts */}
        {infoMsg && (
          <div className="p-3.5 bg-[#132B1C] border border-[#245836] rounded-xl text-xs text-[#34D399] flex items-start gap-2.5 font-medium leading-relaxed">
            <CheckCircle2 className="w-4 h-4 text-[#22C55E] shrink-0 mt-0.5" />
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
          <form onSubmit={handleSendVerification} className="space-y-4 text-xs">
            <div>
              <label className="block text-[#A1ADA5] font-semibold mb-1.5">
                Registered Merchant Email *
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#A1ADA5] absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  disabled={loading}
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="shopkeeper@example.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-[#1B241F] border border-[#303D34] rounded-xl text-xs sm:text-sm font-medium text-[#F5F7F5] placeholder-[#A1ADA5]/60 outline-none focus:border-[#34D399] disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#22C55E] hover:bg-[#16A34A] disabled:bg-[#232E27] disabled:text-[#A1ADA5] disabled:cursor-not-allowed text-[#101512] font-black rounded-xl transition text-xs sm:text-sm shadow-lg shadow-[#22C55E]/20 flex items-center justify-center gap-2"
            >
              <span>{loading ? 'Sending Verification...' : 'Send Verification Email'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        ) : (
          /* Step 2: Verification Flow (Email Confirmation Link Primary + OTP Fallback) */
          <div className="space-y-4 text-xs animate-fade-in">
            {/* Primary Action: Click Email Link */}
            <div className="p-4 bg-[#1B241F] rounded-2xl border border-[#303D34] space-y-3 text-center">
              <div className="w-10 h-10 rounded-full bg-[#132B1C] border border-[#245836] text-[#22C55E] flex items-center justify-center mx-auto">
                <Mail className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-[#F5F7F5] text-sm">Check Your Inbox</h3>
                <p className="text-[11px] text-[#A1ADA5] leading-relaxed">
                  We sent a confirmation link to <strong className="text-[#F5F7F5]">{email}</strong>. Click the link in your email to sign in to your merchant portal.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-center gap-2 text-[11px] text-[#34D399] font-medium bg-[#101512]/60 py-2 rounded-xl border border-[#303D34]/70">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#22C55E]" />
                <span>Waiting for email link confirmation...</span>
              </div>
            </div>

            {/* Alternative: 6-Digit Verification Code Accordion */}
            <div className="pt-2 border-t border-[#303D34]/70 space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#A1ADA5]">Received a 6-digit code instead?</span>
                <button
                  type="button"
                  onClick={() => setShowOtpInput(!showOtpInput)}
                  className="text-[#34D399] font-semibold hover:underline"
                >
                  {showOtpInput ? 'Hide Code Box' : 'Enter 6-Digit Code'}
                </button>
              </div>

              {showOtpInput && (
                <form onSubmit={handleVerifyOtp} className="space-y-3 pt-2 animate-fade-in">
                  <p className="text-[11px] text-[#A1ADA5]">
                    A 6-digit verification code has been sent to your email.
                  </p>
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

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 bg-[#22C55E] hover:bg-[#16A34A] text-[#101512] font-black rounded-xl transition text-xs shadow-md flex items-center justify-center gap-2"
                  >
                    <span>{loading ? 'Verifying...' : 'Verify Code & Sign In'}</span>
                    <ShieldCheck className="w-4 h-4" />
                  </button>
                </form>
              )}
            </div>

            {/* Navigation and Resend Actions */}
            <div className="flex items-center justify-between pt-2 text-[11px] text-[#A1ADA5]">
              <button
                type="button"
                onClick={() => {
                  setStep('email');
                  setShowOtpInput(false);
                  setErrorMsg(null);
                  setInfoMsg(null);
                }}
                className="text-[#A1ADA5] hover:text-[#F5F7F5] underline"
              >
                Change email address
              </button>

              {countdown > 0 ? (
                <span>Resend available in {countdown}s</span>
              ) : (
                <button
                  type="button"
                  onClick={handleSendVerification}
                  className="text-[#34D399] font-bold hover:underline inline-flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Resend email</span>
                </button>
              )}
            </div>
          </div>
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
