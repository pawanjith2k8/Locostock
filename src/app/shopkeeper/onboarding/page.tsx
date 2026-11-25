'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Store, 
  MapPin, 
  ArrowRight, 
  ArrowLeft,
  CheckCircle2, 
  AlertCircle,
  Building2,
  Compass,
  Check,
  User,
  Phone,
  Mail,
  Clock,
  Sparkles
} from 'lucide-react';
import { createOrUpdateShop } from '@/lib/db';
import { isSupabaseConfigured } from '@/lib/supabaseClient';
import { useUser } from '@/context/UserContext';
import LeafletMap from '@/components/LeafletMap';

export default function ShopkeeperOnboardingPage() {
  const router = useRouter();
  const { profile, switchRole } = useUser();

  // Current Step: 1 = Shopkeeper Details, 2 = Shop Info, 3 = Shop Address, 4 = Map Location, 5 = Review & Submit
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Form Fields
  const [ownerName, setOwnerName] = useState(profile?.full_name || '');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState(profile?.email || '');

  const [name, setName] = useState('');
  const [category, setCategory] = useState('Electronics & Hardware');
  const [description, setDescription] = useState('');
  const [businessHours, setBusinessHours] = useState('');

  const [addressLine, setAddressLine] = useState('');
  const [locality, setLocality] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');

  const [latitude, setLatitude] = useState(12.9654);
  const [longitude, setLongitude] = useState(80.2461);
  const [locationConfirmed, setLocationConfirmed] = useState(false);

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleLocationSelect = (lat: number, lon: number) => {
    setLatitude(Math.round(lat * 10000) / 10000);
    setLongitude(Math.round(lon * 10000) / 10000);
    setLocationConfirmed(true);
  };

  const handleUseCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          setLatitude(Math.round(pos.coords.latitude * 10000) / 10000);
          setLongitude(Math.round(pos.coords.longitude * 10000) / 10000);
          setLocationConfirmed(true);
        },
        err => {
          alert('Could not retrieve browser GPS: ' + err.message);
        }
      );
    }
  };

  const validateStep = (step: number): boolean => {
    setErrorMsg(null);
    if (step === 1) {
      if (!ownerName.trim() || !contactPhone.trim()) {
        setErrorMsg('Please enter your owner name and contact phone number.');
        return false;
      }
    } else if (step === 2) {
      if (!name.trim()) {
        setErrorMsg('Please enter the name of your shop.');
        return false;
      }
    } else if (step === 3) {
      if (!addressLine.trim() || !locality.trim() || !city.trim() || !postalCode.trim()) {
        setErrorMsg('Please provide the full physical address details.');
        return false;
      }
    } else if (step === 4) {
      if (!locationConfirmed) {
        setErrorMsg('Please confirm your pinned map coordinates.');
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    setErrorMsg(null);
    setCurrentStep(prev => Math.max(1, prev - 1));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSupabaseConfigured) {
      setErrorMsg('Authentication service is currently unavailable. Please sign in and try again.');
      return;
    }

    if (!profile?.id) {
      setErrorMsg('Merchant sign-in is required before registering a shop.');
      return;
    }

    if (!validateStep(1) || !validateStep(2) || !validateStep(3) || !validateStep(4)) {
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    try {
      await createOrUpdateShop({
        owner_id: profile.id,
        name: name.trim(),
        category,
        description,
        contact_phone: contactPhone,
        contact_email: contactEmail,
        address_line: addressLine,
        locality,
        city,
        state,
        postal_code: postalCode,
        latitude,
        longitude,
        business_hours: businessHours,
      });

      switchRole('shopkeeper');
      router.push('/shopkeeper');
    } catch (err: any) {
      setErrorMsg(err.message || 'Error registering shop.');
    } finally {
      setSaving(false);
    }
  };

  const stepsMeta = [
    { num: 1, title: 'Shopkeeper Details' },
    { num: 2, title: 'Shop Information' },
    { num: 3, title: 'Physical Address' },
    { num: 4, title: 'Map Pinning' },
    { num: 5, title: 'Review & Submit' },
  ];

  if (!isSupabaseConfigured) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-[#1B241F] border border-[#303D34] text-[#F59E0B] flex items-center justify-center mx-auto shadow-xl">
          <Store className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-[#F5F7F5]">Shop Registration Offline</h2>
          <p className="text-xs text-[#A1ADA5] max-w-md mx-auto leading-relaxed">
            Shop registration is currently unavailable. Please verify your connection or sign in again.
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
            Please log in with your merchant email before registering a new shop, so your store is securely linked to your account.
          </p>
        </div>
        <Link
          href="/shopkeeper/login"
          className="inline-flex items-center gap-2 bg-[#22C55E] hover:bg-[#16A34A] text-[#101512] font-black px-6 py-3 rounded-xl transition shadow-lg shadow-[#22C55E]/20 text-xs sm:text-sm"
        >
          <span>Sign In to Continue</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="w-12 h-12 rounded-2xl bg-[#1B241F] border border-[#303D34] text-[#22C55E] flex items-center justify-center mx-auto shadow-lg shadow-[#22C55E]/15">
          <Store className="w-6 h-6" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#F5F7F5] tracking-tight">
          Register Your Local Shop
        </h1>
        <p className="text-xs text-[#A1ADA5] max-w-md mx-auto">
          Publish real recorded inventory to nearby customers and start using fast electronic billing.
        </p>
      </div>

      {/* 5-Step Progress Indicator */}
      <div className="bg-[#151C18] p-4 rounded-2xl border border-[#303D34] shadow-md">
        <div className="flex items-center justify-between">
          {stepsMeta.map((s, idx) => {
            const isCompleted = currentStep > s.num;
            const isCurrent = currentStep === s.num;

            return (
              <React.Fragment key={s.num}>
                <div className="flex flex-col items-center gap-1.5 flex-1">
                  <div
                    className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      isCompleted
                        ? 'bg-[#22C55E] text-[#101512] font-black'
                        : isCurrent
                        ? 'bg-[#232E27] text-[#34D399] border-2 border-[#22C55E]'
                        : 'bg-[#1B241F] text-[#A1ADA5] border border-[#303D34]'
                    }`}
                  >
                    {isCompleted ? <Check className="w-4 h-4" /> : s.num}
                  </div>
                  <span
                    className={`text-[10px] sm:text-[11px] font-semibold text-center hidden md:inline ${
                      isCurrent ? 'text-[#34D399]' : isCompleted ? 'text-[#F5F7F5]' : 'text-[#A1ADA5]'
                    }`}
                  >
                    {s.title}
                  </span>
                </div>

                {idx < stepsMeta.length - 1 && (
                  <div
                    className={`h-0.5 flex-1 transition-colors ${
                      currentStep > s.num ? 'bg-[#22C55E]' : 'bg-[#303D34]'
                    }`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {errorMsg && (
        <div className="bg-[#2D1515] border border-[#5C2424] text-[#EF4444] p-4 rounded-2xl text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Multi-Step Form Container */}
      <div className="bg-[#151C18] rounded-3xl border border-[#303D34] p-6 sm:p-8 shadow-2xl space-y-6">
        {/* Step 1: Shopkeeper Details */}
        {currentStep === 1 && (
          <div className="space-y-4 animate-fade-in text-xs">
            <div className="border-b border-[#303D34] pb-3">
              <h2 className="text-base font-bold text-[#F5F7F5] flex items-center gap-2">
                <User className="w-4 h-4 text-[#22C55E]" />
                <span>Step 1: Shopkeeper & Authorized Contact</span>
              </h2>
              <p className="text-[11px] text-[#A1ADA5]">
                Provide your primary contact information for account authorization.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[#A1ADA5] font-semibold mb-1">
                  Owner / Authorized Name *
                </label>
                <input
                  type="text"
                  required
                  value={ownerName}
                  onChange={e => setOwnerName(e.target.value)}
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full px-3.5 py-2.5 bg-[#1B241F] border border-[#303D34] rounded-xl text-xs sm:text-sm text-[#F5F7F5] outline-none focus:border-[#34D399]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#A1ADA5] font-semibold mb-1">
                    Contact Phone Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={contactPhone}
                    onChange={e => setContactPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full px-3.5 py-2.5 bg-[#1B241F] border border-[#303D34] rounded-xl text-xs sm:text-sm text-[#F5F7F5] outline-none focus:border-[#34D399]"
                  />
                </div>

                <div>
                  <label className="block text-[#A1ADA5] font-semibold mb-1">
                    Public Email Address
                  </label>
                  <input
                    type="email"
                    value={contactEmail}
                    onChange={e => setContactEmail(e.target.value)}
                    placeholder="contact@store.com"
                    className="w-full px-3.5 py-2.5 bg-[#1B241F] border border-[#303D34] rounded-xl text-xs sm:text-sm text-[#F5F7F5] outline-none focus:border-[#34D399]"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Shop Information */}
        {currentStep === 2 && (
          <div className="space-y-4 animate-fade-in text-xs">
            <div className="border-b border-[#303D34] pb-3">
              <h2 className="text-base font-bold text-[#F5F7F5] flex items-center gap-2">
                <Store className="w-4 h-4 text-[#22C55E]" />
                <span>Step 2: Shop Profile & Specialization</span>
              </h2>
              <p className="text-[11px] text-[#A1ADA5]">
                How your shop will be discovered by customers in search results.
              </p>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#A1ADA5] font-semibold mb-1">
                    Shop Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. City Hardware & Electricals"
                    className="w-full px-3.5 py-2.5 bg-[#1B241F] border border-[#303D34] rounded-xl text-xs sm:text-sm text-[#F5F7F5] outline-none focus:border-[#34D399]"
                  />
                </div>

                <div>
                  <label className="block text-[#A1ADA5] font-semibold mb-1">
                    Primary Category *
                  </label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#1B241F] border border-[#303D34] rounded-xl text-xs sm:text-sm text-[#F5F7F5] outline-none focus:border-[#34D399] cursor-pointer"
                  >
                    <option value="Electronics & Hardware" className="bg-[#1B241F]">Electronics & Hardware</option>
                    <option value="Stationery & Books" className="bg-[#1B241F]">Stationery & Books</option>
                    <option value="Groceries & Household" className="bg-[#1B241F]">Groceries & Household</option>
                    <option value="General Store" className="bg-[#1B241F]">General Store</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[#A1ADA5] font-semibold mb-1">
                  Shop Description
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Specializations, authorized dealerships, products stocked..."
                  className="w-full px-3.5 py-2 bg-[#1B241F] border border-[#303D34] rounded-xl text-xs sm:text-sm text-[#F5F7F5] outline-none focus:border-[#34D399]"
                />
              </div>

              <div>
                <label className="block text-[#A1ADA5] font-semibold mb-1">
                  Regular Business Hours
                </label>
                <input
                  type="text"
                  value={businessHours}
                  onChange={e => setBusinessHours(e.target.value)}
                  placeholder="9:00 AM - 9:30 PM (Mon-Sat)"
                  className="w-full px-3.5 py-2.5 bg-[#1B241F] border border-[#303D34] rounded-xl text-xs sm:text-sm text-[#F5F7F5] outline-none focus:border-[#34D399]"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Physical Address */}
        {currentStep === 3 && (
          <div className="space-y-4 animate-fade-in text-xs">
            <div className="border-b border-[#303D34] pb-3">
              <h2 className="text-base font-bold text-[#F5F7F5] flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#22C55E]" />
                <span>Step 3: Physical Shop Address</span>
              </h2>
              <p className="text-[11px] text-[#A1ADA5]">
                Customers will use this address for navigation and walking directions.
              </p>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#A1ADA5] font-semibold mb-1">
                    Door / Street Address *
                  </label>
                  <input
                    type="text"
                    required
                    value={addressLine}
                    onChange={e => setAddressLine(e.target.value)}
                    placeholder="Plot 42, 2nd Main Road"
                    className="w-full px-3.5 py-2.5 bg-[#1B241F] border border-[#303D34] rounded-xl text-xs sm:text-sm text-[#F5F7F5] outline-none focus:border-[#34D399]"
                  />
                </div>

                <div>
                  <label className="block text-[#A1ADA5] font-semibold mb-1">
                    Locality / Area *
                  </label>
                  <input
                    type="text"
                    required
                    value={locality}
                    onChange={e => setLocality(e.target.value)}
                    placeholder="Perungudi"
                    className="w-full px-3.5 py-2.5 bg-[#1B241F] border border-[#303D34] rounded-xl text-xs sm:text-sm text-[#F5F7F5] outline-none focus:border-[#34D399]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[#A1ADA5] font-semibold mb-1">City *</label>
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={e => setCity(e.target.value)}
                    className="w-full px-3 py-2 bg-[#1B241F] border border-[#303D34] rounded-xl text-xs text-[#F5F7F5] outline-none focus:border-[#34D399]"
                  />
                </div>

                <div>
                  <label className="block text-[#A1ADA5] font-semibold mb-1">State *</label>
                  <input
                    type="text"
                    required
                    value={state}
                    onChange={e => setState(e.target.value)}
                    className="w-full px-3 py-2 bg-[#1B241F] border border-[#303D34] rounded-xl text-xs text-[#F5F7F5] outline-none focus:border-[#34D399]"
                  />
                </div>

                <div>
                  <label className="block text-[#A1ADA5] font-semibold mb-1">Postal Code *</label>
                  <input
                    type="text"
                    required
                    value={postalCode}
                    onChange={e => setPostalCode(e.target.value)}
                    className="w-full px-3 py-2 bg-[#1B241F] border border-[#303D34] rounded-xl text-xs text-[#F5F7F5] outline-none focus:border-[#34D399]"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Map Location Selection */}
        {currentStep === 4 && (
          <div className="space-y-4 animate-fade-in text-xs">
            <div className="border-b border-[#303D34] pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-[#F5F7F5] flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[#22C55E]" />
                  <span>Step 4: Pin Exact Map Coordinates</span>
                </h2>
                <p className="text-[11px] text-[#A1ADA5]">
                  Click anywhere on the map to set your store location pin.
                </p>
              </div>

              <button
                type="button"
                onClick={handleUseCurrentLocation}
                className="px-3 py-1.5 rounded-xl bg-[#232E27] text-[#34D399] border border-[#303D34] font-semibold flex items-center gap-1.5 self-start sm:self-auto hover:bg-[#1B241F]"
              >
                <Compass className="w-3.5 h-3.5" />
                <span>Use My GPS Location</span>
              </button>
            </div>

            <LeafletMap
              center={[latitude, longitude]}
              zoom={14}
              markers={[
                {
                  lat: latitude,
                  lon: longitude,
                  title: name || 'Your New Shop',
                  description: `${addressLine || ''}, ${locality || ''}`,
                },
              ]}
              onLocationSelect={handleLocationSelect}
              height="260px"
            />

            <div className="p-3 bg-[#1B241F] rounded-xl border border-[#303D34] flex items-center justify-between font-mono text-[11px]">
              <span className="text-[#A1ADA5]">Pinned Coordinates:</span>
              <span className="text-[#34D399] font-bold">
                Lat: {latitude} | Lon: {longitude}
              </span>
            </div>
          </div>
        )}

        {/* Step 5: Review & Submit */}
        {currentStep === 5 && (
          <div className="space-y-4 animate-fade-in text-xs">
            <div className="border-b border-[#303D34] pb-3">
              <h2 className="text-base font-bold text-[#F5F7F5] flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#22C55E]" />
                <span>Step 5: Review Store Registration</span>
              </h2>
              <p className="text-[11px] text-[#A1ADA5]">
                Confirm your details before launching your LocoStock merchant account.
              </p>
            </div>

            <div className="bg-[#1B241F] rounded-2xl border border-[#303D34] p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <span className="text-[#A1ADA5] block text-[11px]">Store Name:</span>
                  <span className="font-extrabold text-[#F5F7F5] text-sm">{name}</span>
                </div>
                <div>
                  <span className="text-[#A1ADA5] block text-[11px]">Category:</span>
                  <span className="font-bold text-[#34D399]">{category}</span>
                </div>
                <div>
                  <span className="text-[#A1ADA5] block text-[11px]">Owner / Phone:</span>
                  <span className="font-medium text-[#F5F7F5]">{ownerName} ({contactPhone})</span>
                </div>
                <div>
                  <span className="text-[#A1ADA5] block text-[11px]">Operating Hours:</span>
                  <span className="font-medium text-[#F5F7F5]">{businessHours}</span>
                </div>
              </div>

              <div className="pt-3 border-t border-[#303D34]">
                <span className="text-[#A1ADA5] block text-[11px]">Store Address:</span>
                <span className="font-medium text-[#F5F7F5]">
                  {addressLine}, {locality}, {city}, {state} - {postalCode}
                </span>
                <span className="block text-[#34D399] font-mono text-[10px] mt-1">
                  Coordinates: {latitude}, {longitude}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Buttons (Back & Continue / Submit) */}
        <div className="pt-4 border-t border-[#303D34] flex items-center justify-between gap-3">
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={handleBack}
              className="px-4 py-2.5 rounded-xl bg-[#1B241F] hover:bg-[#232E27] text-[#A1ADA5] hover:text-[#F5F7F5] border border-[#303D34] font-bold text-xs flex items-center gap-1.5 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
          ) : (
            <Link
              href="/shopkeeper"
              className="text-xs text-[#A1ADA5] hover:text-[#F5F7F5] font-medium"
            >
              Cancel
            </Link>
          )}

          {currentStep < 5 ? (
            <button
              type="button"
              onClick={handleNext}
              className="px-6 py-2.5 rounded-xl bg-[#22C55E] hover:bg-[#16A34A] text-[#101512] font-black text-xs flex items-center gap-2 transition shadow-lg shadow-[#22C55E]/20"
            >
              <span>Continue</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-[#22C55E] hover:bg-[#16A34A] text-[#101512] font-black text-xs flex items-center gap-2 transition shadow-lg shadow-[#22C55E]/20"
            >
              <span>{saving ? 'Registering Shop...' : 'Confirm & Launch Store'}</span>
              <Check className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
