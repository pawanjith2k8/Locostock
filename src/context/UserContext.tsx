'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { UserRole, Profile } from '@/types';
import { getCurrentProfile, signOutShopkeeper } from '@/lib/db';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';

interface UserContextType {
  role: UserRole;
  profile: Profile | null;
  switchRole: (role: UserRole) => void;
  customerArea: string;
  setCustomerArea: (area: string) => void;
  customerLocation: {
    lat: number;
    lon: number;
    name: string;
  };
  setCustomerLocation: (loc: { lat: number; lon: number; name: string }) => void;
  radiusKm: number;
  setRadiusKm: (r: number) => void;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const PRESET_LOCATIONS = [
  { name: 'Velachery', lat: 12.9759, lon: 80.2212 },
  { name: 'Perungudi', lat: 12.9654, lon: 80.2461 },
  { name: 'Tambaram', lat: 12.9249, lon: 80.1000 },
  { name: 'Thoraipakkam', lat: 12.9416, lon: 80.2337 },
  { name: 'Adyar', lat: 13.0012, lon: 80.2565 },
];

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<UserRole>('customer');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [customerArea, setCustomerAreaState] = useState<string>('');
  const [customerLocation, setCustomerLocation] = useState(PRESET_LOCATIONS[0]);
  const [radiusKm, setRadiusKm] = useState<number>(10);

  // If an auth redirect lands on any route other than /auth/callback (e.g. root Site URL),
  // forward the fragment or query params to /auth/callback so the merchant session is established.
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.pathname !== '/auth/callback') {
      const hasAuthHash = window.location.hash && (
        window.location.hash.includes('access_token=') ||
        window.location.hash.includes('error=')
      );
      const hasAuthQuery = window.location.search && (
        window.location.search.includes('code=') ||
        window.location.search.includes('token_hash=')
      );
      if (hasAuthHash || hasAuthQuery) {
        window.location.replace('/auth/callback' + window.location.search + window.location.hash);
      }
    }
  }, []);

  useEffect(() => {
    try {
      const savedArea = typeof window !== 'undefined' ? localStorage.getItem('locostock_customer_area') : null;
      if (savedArea) {
        setCustomerAreaState(savedArea);
        setCustomerLocation(prev => ({
          ...prev,
          name: savedArea,
        }));
      }
    } catch {
      // LocalStorage access fails safely in strict sandbox
    }
  }, []);

  const setCustomerArea = (newArea: string) => {
    const trimmed = (newArea || '').trim();
    setCustomerAreaState(trimmed);
    try {
      if (typeof window !== 'undefined') {
        if (trimmed) {
          localStorage.setItem('locostock_customer_area', trimmed);
        } else {
          localStorage.removeItem('locostock_customer_area');
        }
      }
    } catch {
      // Ignore
    }
    setCustomerLocation(prev => ({
      ...prev,
      name: trimmed || 'All Areas',
    }));
  };

  const refreshProfile = useCallback(async () => {
    const p = await getCurrentProfile();
    setProfile(p);
    if (p?.role) {
      setRole(p.role);
    }
  }, []);

  useEffect(() => {
    refreshProfile();

    if (isSupabaseConfigured && supabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
        if (session?.user) {
          const p = await getCurrentProfile();
          setProfile(p);
          if (p?.role) setRole(p.role);
        } else {
          setProfile(null);
        }
      });

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [refreshProfile]);

  const switchRole = (newRole: UserRole) => {
    setRole(newRole);
  };

  const signOut = async () => {
    await signOutShopkeeper();
    setProfile(null);
    setRole('customer');
  };

  return (
    <UserContext.Provider
      value={{
        role,
        profile,
        switchRole,
        customerArea,
        setCustomerArea,
        customerLocation,
        setCustomerLocation,
        radiusKm,
        setRadiusKm,
        refreshProfile,
        signOut,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
