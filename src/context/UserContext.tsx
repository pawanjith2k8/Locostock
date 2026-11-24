'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { UserRole, Profile } from '@/types';
import { getCurrentProfile, signOutShopkeeper } from '@/lib/db';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';

interface UserContextType {
  role: UserRole;
  profile: Profile | null;
  switchRole: (role: UserRole) => void;
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
  { name: 'Perungudi, Chennai', lat: 12.9654, lon: 80.2461 },
  { name: 'Thoraipakkam, Chennai', lat: 12.9416, lon: 80.2337 },
  { name: 'Velachery, Chennai', lat: 12.9759, lon: 80.2212 },
  { name: 'Adyar, Chennai', lat: 13.0012, lon: 80.2565 },
  { name: 'T. Nagar, Chennai', lat: 13.0418, lon: 80.2341 },
];

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<UserRole>('customer');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [customerLocation, setCustomerLocation] = useState(PRESET_LOCATIONS[0]);
  const [radiusKm, setRadiusKm] = useState<number>(10);

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
