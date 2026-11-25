'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { 
  Store, 
  MapPin, 
  Phone, 
  Clock, 
  Navigation, 
  Search, 
  ChevronRight, 
  Building, 
  Map as MapIcon,
  X
} from 'lucide-react';
import { useUser } from '@/context/UserContext';
import { searchShops } from '@/lib/db';
import { isSupabaseConfigured } from '@/lib/supabaseClient';
import { Shop } from '@/types';
import LeafletMap from '@/components/LeafletMap';

function ShopsDirectoryContent() {
  const searchParams = useSearchParams();
  const areaParam = searchParams.get('area') || '';

  const { customerArea, setCustomerArea } = useUser();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [area, setArea] = useState(areaParam || customerArea || '');
  const [shops, setShops] = useState<Array<{ shop: Shop; distanceKm?: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [showMap, setShowMap] = useState(false);

  useEffect(() => {
    if (areaParam !== undefined && areaParam !== '') {
      setArea(areaParam);
    }
  }, [areaParam]);

  useEffect(() => {
    async function loadShops() {
      setLoading(true);
      if (area.trim() && area.trim() !== customerArea) {
        setCustomerArea(area.trim());
      }
      try {
        const results = await searchShops({
          query,
          category: category || undefined,
          area: area.trim() || undefined,
        });
        setShops(results);
      } catch (err) {
        console.error('Error loading shops:', err);
      } finally {
        setLoading(false);
      }
    }
    loadShops();
  }, [query, category, area]);

  const mapMarkers = shops.map(s => ({
    lat: s.shop.latitude,
    lon: s.shop.longitude,
    title: s.shop.name,
    description: `${s.shop.locality} | ${s.shop.category}<br/><a href="https://www.google.com/maps/dir/?api=1&destination=${s.shop.latitude},${s.shop.longitude}" target="_blank" style="color: #34D399; font-weight: 700; text-decoration: underline;">Directions &rarr;</a>`,
  }));

  const categories = ['Electronics & Hardware', 'Stationery & Books', 'Groceries & Household'];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Title & Stats */}
      <div className="bg-[#151C18] p-5 sm:p-6 rounded-3xl border border-[#303D34] shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-[#F5F7F5] flex items-center gap-2">
              <Store className="w-5 h-5 text-[#22C55E]" />
              <span>Verified Local Shops</span>
            </h1>
            <p className="text-xs text-[#A1ADA5]">
              {area ? (
                <>
                  Showing verified neighborhood retailers operating in{' '}
                  <span className="font-bold text-[#34D399]">{area}</span>
                </>
              ) : (
                'Browse public profiles, opening hours, contact details, and catalogues across neighborhoods'
              )}
            </p>
          </div>

          <button
            onClick={() => setShowMap(!showMap)}
            className="self-start md:self-auto px-4 py-2 rounded-xl text-xs font-bold bg-[#1B241F] hover:bg-[#232E27] text-[#34D399] border border-[#303D34] transition flex items-center gap-1.5"
          >
            <MapIcon className="w-3.5 h-3.5" />
            <span>{showMap ? 'Hide Map View' : 'Explore on Map'}</span>
          </button>
        </div>

        {/* Filter bar: Query, Area, Category */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-2">
          {/* Shop name or keyword */}
          <div className="md:col-span-5 relative">
            <Search className="w-4 h-4 text-[#A1ADA5] absolute left-3.5 top-3.5" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search shops by name..."
              className="w-full pl-10 pr-4 py-2.5 bg-[#1B241F] border border-[#303D34] rounded-xl text-xs sm:text-sm font-medium text-[#F5F7F5] placeholder-[#A1ADA5]/60 outline-none focus:border-[#34D399] transition"
            />
          </div>

          {/* Manual Area filter */}
          <div className="md:col-span-4 relative">
            <MapPin className="w-4 h-4 text-[#22C55E] absolute left-3.5 top-3.5" />
            <input
              type="text"
              value={area}
              onChange={e => setArea(e.target.value)}
              placeholder="Filter by area (e.g. Tambaram)..."
              className="w-full pl-10 pr-8 py-2.5 bg-[#1B241F] border border-[#303D34] rounded-xl text-xs sm:text-sm font-medium text-[#F5F7F5] placeholder-[#A1ADA5]/60 outline-none focus:border-[#34D399] transition"
            />
            {area && (
              <button
                type="button"
                onClick={() => setArea('')}
                className="absolute right-2.5 top-3 text-[#A1ADA5] hover:text-[#F5F7F5]"
                title="Clear area filter"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Category filter */}
          <div className="md:col-span-3">
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full px-3 py-2.5 bg-[#1B241F] border border-[#303D34] rounded-xl text-xs sm:text-sm font-medium text-[#F5F7F5] outline-none focus:border-[#34D399] transition cursor-pointer"
            >
              <option value="" className="bg-[#1B241F] text-[#F5F7F5]">All Categories</option>
              {categories.map(c => (
                <option key={c} value={c} className="bg-[#1B241F] text-[#F5F7F5]">
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Map if toggled */}
      {showMap && (
        <div className="bg-[#151C18] p-4 rounded-3xl border border-[#303D34] shadow-xl space-y-2">
          <LeafletMap
            center={[12.9759, 80.2212]}
            zoom={12}
            markers={mapMarkers}
            height="420px"
          />
        </div>
      )}

      {/* Shops Grid */}
      {loading ? (
        <div className="p-16 text-center text-[#A1ADA5] text-xs">Loading verified neighborhood shops...</div>
      ) : shops.length === 0 ? (
        <div className="bg-[#151C18] p-12 rounded-3xl border border-[#303D34] text-center space-y-3">
          <Building className="w-12 h-12 text-[#A1ADA5] mx-auto" />
          <h3 className="text-base font-bold text-[#F5F7F5]">
            {!isSupabaseConfigured
              ? 'Database Awaiting Configuration'
              : area
              ? 'No shops found in this area. Try another area.'
              : 'No shops found'}
          </h3>
          <p className="text-xs text-[#A1ADA5] max-w-sm mx-auto">
            {!isSupabaseConfigured
              ? 'Supabase database credentials have not been configured in .env.local yet. Once configured, registered local shops will appear here.'
              : area
              ? `No registered stores match "${area}". Try another locality like Tambaram, Velachery, or Perungudi.`
              : 'No registered shops match your search criteria. Try clearing your query or filters.'}
          </p>
          {area && (
            <button
              onClick={() => {
                setQuery('');
                setCategory('');
                setArea('');
              }}
              className="px-4 py-2 bg-[#22C55E] text-[#101512] rounded-xl text-xs font-bold hover:bg-[#16A34A] transition"
            >
              Clear Filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {shops.map(({ shop, distanceKm }) => (
            <div
              key={shop.id}
              className="bg-[#1B241F] rounded-2xl border border-[#303D34] overflow-hidden shadow-xl hover:border-[#34D399]/40 transition flex flex-col justify-between group"
            >
              <div className="p-6 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#132B1C] text-[#34D399] border border-[#245836] mb-2">
                      {shop.category}
                    </span>
                    <h3 className="text-lg font-bold text-[#F5F7F5] leading-tight group-hover:text-[#34D399] transition-colors">
                      {shop.name}
                    </h3>
                  </div>

                  {distanceKm !== undefined && (
                    <div className="shrink-0 bg-[#101512] text-[#F5F7F5] text-[11px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 border border-[#303D34]">
                      <Navigation className="w-3 h-3 text-[#34D399]" />
                      <span>{distanceKm} km</span>
                    </div>
                  )}
                </div>

                <p className="text-xs text-[#A1ADA5] line-clamp-2 leading-relaxed">
                  {shop.description || 'Verified local neighborhood retailer.'}
                </p>

                <div className="space-y-2 text-xs text-[#A1ADA5] pt-3 border-t border-[#303D34]">
                  <div className="flex items-start gap-2">
                    <MapPin className="w-3.5 h-3.5 text-[#22C55E] shrink-0 mt-0.5" />
                    <span>{shop.address_line}, {shop.locality}, {shop.city} - {shop.postal_code}</span>
                  </div>

                  {shop.contact_phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-[#34D399] shrink-0" />
                      <span>{shop.contact_phone}</span>
                    </div>
                  )}

                  {shop.business_hours && (
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-[#A1ADA5] shrink-0" />
                      <span>{shop.business_hours}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="p-4 bg-[#151C18] border-t border-[#303D34] flex items-center justify-between gap-2">
                <Link
                  href={`/shops/${shop.id}`}
                  className="flex items-center gap-1 text-xs font-bold text-[#34D399] hover:underline"
                >
                  <span>View Products & Profile</span>
                  <ChevronRight className="w-4 h-4" />
                </Link>

                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${shop.latitude},${shop.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 bg-[#232E27] hover:bg-[#303D34] text-[#F5F7F5] px-3 py-1.5 rounded-lg border border-[#303D34] text-xs font-semibold shadow-sm transition"
                >
                  <Navigation className="w-3.5 h-3.5 text-[#22C55E]" />
                  <span>Directions</span>
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ShopsDirectoryPage() {
  return (
    <Suspense fallback={<div className="p-16 text-center text-[#A1ADA5] text-xs">Loading shops directory...</div>}>
      <ShopsDirectoryContent />
    </Suspense>
  );
}
