'use client';

import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  MapPin, 
  Save, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Phone, 
  Mail,
  Navigation,
  Compass
} from 'lucide-react';
import { getShopsByOwner, createOrUpdateShop } from '@/lib/db';
import { isSupabaseConfigured } from '@/lib/supabaseClient';
import { Shop } from '@/types';
import { useUser } from '@/context/UserContext';
import LeafletMap from '@/components/LeafletMap';
import Link from 'next/link';
import { ArrowRight, Store } from 'lucide-react';

export default function ShopkeeperShopProfilePage() {
  const { profile } = useUser();
  const [shop, setShop] = useState<Shop | null>(null);
  const [formData, setFormData] = useState<Partial<Shop>>({});
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadShop() {
      if (!isSupabaseConfigured || !profile?.id) {
        setLoading(false);
        setShop(null);
        return;
      }
      setLoading(true);
      try {
        const ownerShops = await getShopsByOwner(profile.id);
        if (ownerShops.length > 0) {
          const s = ownerShops[0];
          setShop(s);
          setFormData({ ...s });
        } else {
          setShop(null);
        }
      } catch (err) {
        console.error('Error loading shop profile:', err);
      } finally {
        setLoading(false);
      }
    }
    loadShop();
  }, [profile]);

  const handleLocationSelect = (lat: number, lon: number) => {
    setFormData(prev => ({
      ...prev,
      latitude: Math.round(lat * 10000) / 10000,
      longitude: Math.round(lon * 10000) / 10000,
    }));
  };

  const handleUseCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          setFormData(prev => ({
            ...prev,
            latitude: Math.round(pos.coords.latitude * 10000) / 10000,
            longitude: Math.round(pos.coords.longitude * 10000) / 10000,
          }));
        },
        err => {
          alert('Could not retrieve browser GPS: ' + err.message);
        }
      );
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shop) return;

    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(false);

    try {
      const updated = await createOrUpdateShop({
        ...formData,
        id: shop.id,
        owner_id: shop.owner_id,
        name: formData.name || shop.name,
      });
      setShop(updated);
      setSuccessMsg(true);
      setTimeout(() => setSuccessMsg(false), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update shop profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-16 text-center text-[#A1ADA5] text-xs">Loading shop profile...</div>;
  }

  if (!isSupabaseConfigured) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-[#1B241F] border border-[#303D34] text-[#F59E0B] flex items-center justify-center mx-auto shadow-xl">
          <Store className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-[#F5F7F5]">Store Profile Offline</h2>
          <p className="text-xs text-[#A1ADA5] max-w-md mx-auto leading-relaxed">
            Store profile and location settings are currently unavailable. Please verify your connection or sign in again.
          </p>
        </div>
        <Link
          href="/shopkeeper/login"
          className="inline-flex items-center gap-2 bg-[#232E27] hover:bg-[#303D34] text-[#F5F7F5] font-bold px-6 py-3 rounded-xl transition border border-[#303D34] text-xs sm:text-sm"
        >
          <span>Merchant Sign In</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-[#1B241F] border border-[#303D34] text-[#34D399] flex items-center justify-center mx-auto shadow-xl">
          <Store className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-[#F5F7F5]">Merchant Sign-In Required</h2>
          <p className="text-xs text-[#A1ADA5] max-w-md mx-auto leading-relaxed">
            Please sign in to your merchant account to edit your store information.
          </p>
        </div>
        <Link
          href="/shopkeeper/login"
          className="inline-flex items-center gap-2 bg-[#22C55E] hover:bg-[#16A34A] text-[#101512] font-black px-6 py-3 rounded-xl transition shadow-lg shadow-[#22C55E]/20 text-xs sm:text-sm"
        >
          <span>Sign In to Merchant Portal</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-[#1B241F] border border-[#303D34] text-[#22C55E] flex items-center justify-center mx-auto shadow-xl">
          <Store className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-[#F5F7F5]">No Registered Shop Found</h2>
          <p className="text-xs text-[#A1ADA5] max-w-md mx-auto leading-relaxed">
            You must register a shop before editing store details and geolocation.
          </p>
        </div>
        <Link
          href="/shopkeeper/onboarding"
          className="inline-flex items-center gap-2 bg-[#22C55E] hover:bg-[#16A34A] text-[#101512] font-black px-6 py-3 rounded-xl transition shadow-lg shadow-[#22C55E]/20 text-xs sm:text-sm"
        >
          <span>Register a New Shop</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-[#F5F7F5] flex items-center gap-2">
          <Building2 className="w-5 h-5 text-[#22C55E]" />
          <span>Shop Profile & Map Location</span>
        </h1>
        <p className="text-xs text-[#A1ADA5]">
          Manage public shop identity, opening hours, contact details, and precise coordinates for customer discovery.
        </p>
      </div>

      {successMsg && (
        <div className="bg-[#132B1C] border border-[#245836] text-[#34D399] p-4 rounded-2xl flex items-center gap-2 text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4 text-[#22C55E]" />
          <span>Shop details and map coordinates updated successfully!</span>
        </div>
      )}

      {errorMsg && (
        <div className="bg-[#2D1515] border border-[#5C2424] text-[#EF4444] p-4 rounded-2xl flex items-center gap-2 text-xs font-semibold">
          <AlertCircle className="w-4 h-4 text-[#EF4444]" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="bg-[#151C18] rounded-3xl border border-[#303D34] p-6 sm:p-8 space-y-6 shadow-2xl">
        {/* Basic Info */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-[#F5F7F5] border-b border-[#303D34] pb-2">
            Store Identity
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-[#A1ADA5] font-semibold mb-1">Shop Name *</label>
              <input
                type="text"
                required
                value={formData.name || ''}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 bg-[#1B241F] border border-[#303D34] rounded-xl text-[#F5F7F5] outline-none focus:border-[#34D399] font-medium"
              />
            </div>

            <div>
              <label className="block text-[#A1ADA5] font-semibold mb-1">Category *</label>
              <select
                value={formData.category || 'Electronics & Hardware'}
                onChange={e => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 bg-[#1B241F] border border-[#303D34] rounded-xl text-[#F5F7F5] outline-none focus:border-[#34D399] font-medium cursor-pointer"
              >
                <option value="Electronics & Hardware" className="bg-[#1B241F]">Electronics & Hardware</option>
                <option value="Stationery & Books" className="bg-[#1B241F]">Stationery & Books</option>
                <option value="Groceries & Household" className="bg-[#1B241F]">Groceries & Household</option>
                <option value="General Store" className="bg-[#1B241F]">General Store</option>
              </select>
            </div>
          </div>

          <div className="text-xs">
            <label className="block text-[#A1ADA5] font-semibold mb-1">Description</label>
            <textarea
              rows={3}
              value={formData.description || ''}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 bg-[#1B241F] border border-[#303D34] rounded-xl text-[#F5F7F5] outline-none focus:border-[#34D399] font-medium"
            />
          </div>
        </div>

        {/* Contact Info */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-[#F5F7F5] border-b border-[#303D34] pb-2">
            Contact & Timings
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block text-[#A1ADA5] font-semibold mb-1">Contact Phone</label>
              <input
                type="text"
                value={formData.contact_phone || ''}
                onChange={e => setFormData({ ...formData, contact_phone: e.target.value })}
                className="w-full px-3 py-2 bg-[#1B241F] border border-[#303D34] rounded-xl text-[#F5F7F5] outline-none focus:border-[#34D399] font-medium"
              />
            </div>

            <div>
              <label className="block text-[#A1ADA5] font-semibold mb-1">Public Email</label>
              <input
                type="email"
                value={formData.contact_email || ''}
                onChange={e => setFormData({ ...formData, contact_email: e.target.value })}
                className="w-full px-3 py-2 bg-[#1B241F] border border-[#303D34] rounded-xl text-[#F5F7F5] outline-none focus:border-[#34D399] font-medium"
              />
            </div>

            <div>
              <label className="block text-[#A1ADA5] font-semibold mb-1">Business Hours</label>
              <input
                type="text"
                value={formData.business_hours || ''}
                onChange={e => setFormData({ ...formData, business_hours: e.target.value })}
                placeholder="e.g. 9:00 AM - 9:30 PM (Mon-Sat)"
                className="w-full px-3 py-2 bg-[#1B241F] border border-[#303D34] rounded-xl text-[#F5F7F5] outline-none focus:border-[#34D399] font-medium"
              />
            </div>
          </div>
        </div>

        {/* Address & Geographic Map Selection */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-[#F5F7F5] border-b border-[#303D34] pb-2">
            Address & Map Pin
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-[#A1ADA5] font-semibold mb-1">Street Address Line *</label>
              <input
                type="text"
                required
                value={formData.address_line || ''}
                onChange={e => setFormData({ ...formData, address_line: e.target.value })}
                className="w-full px-3 py-2 bg-[#1B241F] border border-[#303D34] rounded-xl text-[#F5F7F5] outline-none focus:border-[#34D399] font-medium"
              />
            </div>

            <div>
              <label className="block text-[#A1ADA5] font-semibold mb-1">Locality / Neighborhood *</label>
              <input
                type="text"
                required
                value={formData.locality || ''}
                onChange={e => setFormData({ ...formData, locality: e.target.value })}
                className="w-full px-3 py-2 bg-[#1B241F] border border-[#303D34] rounded-xl text-[#F5F7F5] outline-none focus:border-[#34D399] font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block text-[#A1ADA5] font-semibold mb-1">City *</label>
              <input
                type="text"
                required
                value={formData.city || ''}
                onChange={e => setFormData({ ...formData, city: e.target.value })}
                className="w-full px-3 py-2 bg-[#1B241F] border border-[#303D34] rounded-xl text-[#F5F7F5] outline-none focus:border-[#34D399] font-medium"
              />
            </div>

            <div>
              <label className="block text-[#A1ADA5] font-semibold mb-1">State *</label>
              <input
                type="text"
                required
                value={formData.state || ''}
                onChange={e => setFormData({ ...formData, state: e.target.value })}
                className="w-full px-3 py-2 bg-[#1B241F] border border-[#303D34] rounded-xl text-[#F5F7F5] outline-none focus:border-[#34D399] font-medium"
              />
            </div>

            <div>
              <label className="block text-[#A1ADA5] font-semibold mb-1">Postal Code *</label>
              <input
                type="text"
                required
                value={formData.postal_code || ''}
                onChange={e => setFormData({ ...formData, postal_code: e.target.value })}
                className="w-full px-3 py-2 bg-[#1B241F] border border-[#303D34] rounded-xl text-[#F5F7F5] outline-none focus:border-[#34D399] font-medium"
              />
            </div>
          </div>

          {/* Coordinates inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs bg-[#1B241F] p-4 rounded-2xl border border-[#303D34]">
            <div>
              <label className="block text-[#A1ADA5] font-bold mb-1">Latitude</label>
              <input
                type="number"
                step="0.0001"
                required
                value={formData.latitude ?? ''}
                onChange={e => setFormData({ ...formData, latitude: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-[#151C18] border border-[#303D34] rounded-xl text-[#34D399] outline-none focus:border-[#34D399] font-mono font-bold"
              />
            </div>

            <div>
              <label className="block text-[#A1ADA5] font-bold mb-1">Longitude</label>
              <input
                type="number"
                step="0.0001"
                required
                value={formData.longitude ?? ''}
                onChange={e => setFormData({ ...formData, longitude: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-[#151C18] border border-[#303D34] rounded-xl text-[#34D399] outline-none focus:border-[#34D399] font-mono font-bold"
              />
            </div>
          </div>

          {/* Interactive Leaflet Map */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between text-xs text-[#A1ADA5]">
              <span>Click on the map to re-position your store marker:</span>
              <button
                type="button"
                onClick={handleUseCurrentLocation}
                className="text-[#34D399] font-bold hover:underline flex items-center gap-1"
              >
                <Compass className="w-3.5 h-3.5" />
                <span>Use Current GPS</span>
              </button>
            </div>
            <LeafletMap
              center={[formData.latitude || 12.9654, formData.longitude || 80.2461]}
              zoom={14}
              markers={[
                {
                  lat: formData.latitude || 12.9654,
                  lon: formData.longitude || 80.2461,
                  title: formData.name || 'Your Shop',
                  description: formData.address_line || '',
                },
              ]}
              onLocationSelect={handleLocationSelect}
              height="260px"
            />
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end pt-4 border-t border-[#303D34]">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 bg-[#22C55E] hover:bg-[#16A34A] text-[#101512] font-black px-6 py-3 rounded-xl text-xs transition shadow-lg shadow-[#22C55E]/20"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving Changes...' : 'Save Profile & Coordinates'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
