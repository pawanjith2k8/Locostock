'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Search, 
  MapPin, 
  Store, 
  ShoppingBag, 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  ArrowRight, 
  TrendingUp,
  Cpu,
  BookOpen,
  Apple,
  Wrench,
  Navigation,
  History,
  X,
  Compass,
  SlidersHorizontal
} from 'lucide-react';
import { useUser, PRESET_LOCATIONS } from '@/context/UserContext';
import { searchProducts } from '@/lib/db';
import { isSupabaseConfigured } from '@/lib/supabaseClient';
import { ProductSearchResult } from '@/types';
import { formatCurrency, formatTimeAgo } from '@/lib/utils';
import { getRecentSearches, addRecentSearch, clearRecentSearches, removeRecentSearch } from '@/lib/searchHistory';
import { AlertCircle } from 'lucide-react';

export default function CustomerLandingPage() {
  const router = useRouter();
  const { customerLocation, setCustomerLocation, radiusKm, setRadiusKm } = useUser();
  const [searchQuery, setSearchQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [featuredProducts, setFeaturedProducts] = useState<ProductSearchResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setRecentSearches(getRecentSearches());

    async function loadFeatured() {
      setLoading(true);
      try {
        const results = await searchProducts({
          customerLat: customerLocation.lat,
          customerLon: customerLocation.lon,
          radiusKm,
          onlyInStock: true,
          sortBy: 'relevance',
        });
        setFeaturedProducts(results.slice(0, 6));
      } catch (err) {
        console.error('Error loading featured products:', err);
      } finally {
        setLoading(false);
      }
    }
    loadFeatured();
  }, [customerLocation, radiusKm]);

  const handleGeolocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          setCustomerLocation({
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
            name: 'Current Location (GPS)',
          });
        },
        err => {
          alert('Could not retrieve browser GPS: ' + err.message);
        }
      );
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = searchQuery.trim();
    if (clean) {
      addRecentSearch(clean);
      router.push(`/search?q=${encodeURIComponent(clean)}`);
    } else {
      router.push('/search');
    }
  };

  const executeRecentSearch = (query: string) => {
    addRecentSearch(query);
    router.push(`/search?q=${encodeURIComponent(query)}`);
  };

  const handleRemoveRecent = (e: React.MouseEvent, query: string) => {
    e.stopPropagation();
    const updated = removeRecentSearch(query);
    setRecentSearches(updated);
  };

  const handleClearAllHistory = () => {
    clearRecentSearches();
    setRecentSearches([]);
  };

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-[#101512] text-[#F5F7F5] pt-10 pb-12 px-4 sm:px-6 lg:px-8 border-b border-[#303D34]">
        {/* Subtle decorative radial accent */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-[#22C55E]/5 blur-[120px] pointer-events-none rounded-full"></div>

        <div className="relative max-w-4xl mx-auto text-center space-y-4">
          {/* Subtle Tagline Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1B241F] border border-[#303D34] text-[#34D399] text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-[#22C55E]"></span>
            <span>Local Products. Real Shops.</span>
          </div>

          {!isSupabaseConfigured && (
            <div className="max-w-md mx-auto p-3 bg-[#231A14] border border-[#523419] rounded-xl text-xs text-[#FBBF24] flex items-center gap-2 justify-center font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 text-[#F59E0B]" />
              <span>Database not configured yet. Configure Supabase in .env.local to load live inventory.</span>
            </div>
          )}

          {/* Exact Hero Heading Required: "Find What You Need. Shop Locally." */}
          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-[#F5F7F5]">
            Find What You Need.{' '}
            <span className="text-[#34D399]">Shop Locally.</span>
          </h1>

          {/* Short Supporting Description */}
          <p className="text-xs sm:text-sm text-[#A1ADA5] max-w-xl mx-auto font-normal leading-relaxed">
            Discover real in-stock inventory recorded by neighborhood stores. Compare prices, check availability timestamps, and get directions before you step out.
          </p>

          {/* One Coherent Search Interface */}
          <form
            onSubmit={handleSearchSubmit}
            className="mt-6 bg-[#1B241F] rounded-2xl border border-[#303D34] p-1.5 shadow-2xl flex flex-col md:flex-row items-stretch md:items-center max-w-3xl mx-auto divide-y md:divide-y-0 md:divide-x divide-[#303D34] focus-within:border-[#34D399]/60 transition-colors"
          >
            {/* 1. Location Selector + Current GPS Button */}
            <div className="flex items-center gap-2 px-3 py-2.5 min-w-[200px]">
              <MapPin className="w-4 h-4 text-[#22C55E] shrink-0" />
              <select
                value={customerLocation.name}
                onChange={e => {
                  const loc = PRESET_LOCATIONS.find(l => l.name === e.target.value);
                  if (loc) setCustomerLocation(loc);
                }}
                className="bg-transparent text-xs font-semibold text-[#F5F7F5] outline-none w-full cursor-pointer border-0 p-0"
              >
                {PRESET_LOCATIONS.map(l => (
                  <option key={l.name} value={l.name} className="bg-[#1B241F] text-[#F5F7F5]">
                    {l.name}
                  </option>
                ))}
                {customerLocation.name === 'Current Location (GPS)' && (
                  <option value="Current Location (GPS)" className="bg-[#1B241F] text-[#F5F7F5]">
                    Current Location (GPS)
                  </option>
                )}
              </select>
              <button
                type="button"
                onClick={handleGeolocation}
                title="Use current GPS location"
                className="p-1 hover:bg-[#232E27] rounded-lg text-[#A1ADA5] hover:text-[#34D399] transition"
              >
                <Compass className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* 2. Product Search Field */}
            <div className="flex-1 flex items-center gap-2 px-3 py-2.5">
              <Search className="w-4 h-4 text-[#A1ADA5] shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder='Search "Arduino Uno", "Notebook", "Basmati"...'
                className="w-full bg-transparent outline-none text-xs sm:text-sm text-[#F5F7F5] placeholder-[#A1ADA5]/60 border-0 p-0"
              />
            </div>

            {/* 3. Radius Selector */}
            <div className="flex items-center gap-1.5 px-3 py-2.5 text-[#A1ADA5] text-xs">
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#22C55E]" />
              <span className="text-[11px] hidden sm:inline">Radius:</span>
              <select
                value={radiusKm}
                onChange={e => setRadiusKm(Number(e.target.value))}
                className="bg-transparent font-bold text-[#34D399] outline-none cursor-pointer border-0 p-0"
              >
                <option value={2} className="bg-[#1B241F] text-[#F5F7F5]">2 km</option>
                <option value={5} className="bg-[#1B241F] text-[#F5F7F5]">5 km</option>
                <option value={10} className="bg-[#1B241F] text-[#F5F7F5]">10 km</option>
                <option value={25} className="bg-[#1B241F] text-[#F5F7F5]">25 km</option>
                <option value={50} className="bg-[#1B241F] text-[#F5F7F5]">50 km</option>
              </select>
            </div>

            {/* 4. Search Button */}
            <div className="p-1">
              <button
                type="submit"
                className="w-full md:w-auto bg-[#22C55E] hover:bg-[#16A34A] text-[#101512] font-black px-5 py-2.5 rounded-xl transition flex items-center justify-center gap-2 text-xs sm:text-sm shadow-md"
              >
                <span>Search</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>

          {/* Quick Categories Bar */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-3">
            <span className="text-[11px] text-[#A1ADA5] font-medium mr-1">Browse categories:</span>
            <Link
              href="/search?category=Electronics%20%26%20Hardware"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1B241F] hover:bg-[#232E27] text-[11px] font-semibold text-[#F5F7F5] border border-[#303D34] hover:border-[#34D399]/40 transition"
            >
              <Cpu className="w-3 h-3 text-[#34D399]" />
              <span>Electronics & Hardware</span>
            </Link>
            <Link
              href="/search?category=Stationery%20%26%20Books"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1B241F] hover:bg-[#232E27] text-[11px] font-semibold text-[#F5F7F5] border border-[#303D34] hover:border-[#34D399]/40 transition"
            >
              <BookOpen className="w-3 h-3 text-[#34D399]" />
              <span>Stationery & Books</span>
            </Link>
            <Link
              href="/search?category=Groceries%20%26%20Household"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1B241F] hover:bg-[#232E27] text-[11px] font-semibold text-[#F5F7F5] border border-[#303D34] hover:border-[#34D399]/40 transition"
            >
              <Apple className="w-3 h-3 text-[#34D399]" />
              <span>Groceries & Household</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Clean Navigation Section: Search Products, Browse Shops, History */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link
            href="/search"
            className="bg-[#151C18] hover:bg-[#1B241F] p-4 rounded-2xl border border-[#303D34] hover:border-[#34D399]/40 transition flex items-center justify-between group shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#1B241F] border border-[#303D34] flex items-center justify-center text-[#22C55E] group-hover:bg-[#22C55E] group-hover:text-[#101512] transition-colors">
                <Search className="w-5 h-5" />
              </div>
              <div>
                <span className="font-bold text-sm text-[#F5F7F5] block">Search Products</span>
                <span className="text-[11px] text-[#A1ADA5]">Cross-shop inventory search</span>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-[#A1ADA5] group-hover:text-[#34D399] transition-colors" />
          </Link>

          <Link
            href="/shops"
            className="bg-[#151C18] hover:bg-[#1B241F] p-4 rounded-2xl border border-[#303D34] hover:border-[#34D399]/40 transition flex items-center justify-between group shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#1B241F] border border-[#303D34] flex items-center justify-center text-[#22C55E] group-hover:bg-[#22C55E] group-hover:text-[#101512] transition-colors">
                <Store className="w-5 h-5" />
              </div>
              <div>
                <span className="font-bold text-sm text-[#F5F7F5] block">Browse Shops</span>
                <span className="text-[11px] text-[#A1ADA5]">Nearby verified store directory</span>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-[#A1ADA5] group-hover:text-[#34D399] transition-colors" />
          </Link>

          <Link
            href="/history"
            className="bg-[#151C18] hover:bg-[#1B241F] p-4 rounded-2xl border border-[#303D34] hover:border-[#34D399]/40 transition flex items-center justify-between group shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#1B241F] border border-[#303D34] flex items-center justify-center text-[#22C55E] group-hover:bg-[#22C55E] group-hover:text-[#101512] transition-colors">
                <History className="w-5 h-5" />
              </div>
              <div>
                <span className="font-bold text-sm text-[#F5F7F5] block">Search History</span>
                <span className="text-[11px] text-[#A1ADA5]">Recent 1-tap query re-runs</span>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-[#A1ADA5] group-hover:text-[#34D399] transition-colors" />
          </Link>
        </div>
      </section>

      {/* Recent Searches Panel */}
      {recentSearches.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-[#151C18] p-4 sm:p-5 rounded-2xl border border-[#303D34] space-y-3">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 font-bold text-[#F5F7F5]">
                <Clock className="w-4 h-4 text-[#22C55E]" />
                <span>Recent Searches</span>
              </div>
              <button
                onClick={handleClearAllHistory}
                className="text-[11px] text-[#A1ADA5] hover:text-[#EF4444] transition font-medium"
              >
                Clear History
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {recentSearches.map(query => (
                <div
                  key={query}
                  onClick={() => executeRecentSearch(query)}
                  className="group flex items-center gap-2 bg-[#1B241F] hover:bg-[#232E27] px-3 py-1.5 rounded-xl border border-[#303D34] text-xs text-[#F5F7F5] cursor-pointer transition hover:border-[#34D399]/40 shadow-sm"
                >
                  <Search className="w-3.5 h-3.5 text-[#34D399]" />
                  <span>{query}</span>
                  <button
                    onClick={(e) => handleRemoveRecent(e, query)}
                    className="text-[#A1ADA5] hover:text-[#EF4444] p-0.5 ml-1 transition"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Live Available Products Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-[#F5F7F5] flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#22C55E]" />
              <span>Available in Real Nearby Shops</span>
            </h2>
            <p className="text-xs text-[#A1ADA5]">
              Real-time synchronized products within {radiusKm} km of {customerLocation.name}
            </p>
          </div>

          <Link
            href="/search"
            className="text-xs font-bold text-[#34D399] hover:underline inline-flex items-center gap-1 self-start sm:self-auto"
          >
            <span>View All Products</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(n => (
              <div key={n} className="bg-[#1B241F] rounded-2xl border border-[#303D34] h-64 animate-pulse p-4 space-y-3">
                <div className="h-32 bg-[#232E27] rounded-xl"></div>
                <div className="h-4 bg-[#232E27] rounded w-3/4"></div>
                <div className="h-4 bg-[#232E27] rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : featuredProducts.length === 0 ? (
          <div className="bg-[#151C18] p-8 rounded-2xl border border-[#303D34] text-center space-y-3">
            <Store className="w-10 h-10 text-[#A1ADA5] mx-auto" />
            <h3 className="text-sm font-bold text-[#F5F7F5]">
              {!isSupabaseConfigured ? 'Database Awaiting Configuration' : 'No listings in this radius'}
            </h3>
            <p className="text-xs text-[#A1ADA5] max-w-md mx-auto">
              {!isSupabaseConfigured
                ? 'Supabase credentials have not been configured yet. Connect your Supabase database in .env.local to discover real nearby stores and stock.'
                : `No registered shops have in-stock products within ${radiusKm} km of ${customerLocation.name}. Try expanding your search radius to 25 km or 50 km.`}
            </p>
            <Link
              href="/search"
              className="inline-block px-4 py-2 bg-[#22C55E] text-[#101512] rounded-xl text-xs font-bold hover:bg-[#16A34A] transition"
            >
              Explore Full Product Directory
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredProducts.map(({ product, shop, distanceKm }) => (
              <div
                key={`${product.id}-${shop.id}`}
                className="bg-[#1B241F] rounded-2xl border border-[#303D34] overflow-hidden shadow-lg hover:border-[#34D399]/40 transition flex flex-col justify-between group"
              >
                <div>
                  {/* Product Image */}
                  <div className="relative h-44 w-full bg-[#151C18] overflow-hidden">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[#A1ADA5]/40">
                        <ShoppingBag className="w-10 h-10" />
                      </div>
                    )}

                    {distanceKm !== undefined && (
                      <div className="absolute top-3 right-3 bg-[#101512]/90 backdrop-blur-md text-[#F5F7F5] text-[11px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 border border-[#303D34] shadow">
                        <Navigation className="w-3 h-3 text-[#34D399]" />
                        <span>{distanceKm} km away</span>
                      </div>
                    )}
                  </div>

                  {/* Body */}
                  <div className="p-5 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-[#34D399] uppercase tracking-wider text-[11px]">
                        {product.brand || product.category}
                      </span>
                      <span className="text-[11px] text-[#A1ADA5]">
                        SKU: {product.sku || 'N/A'}
                      </span>
                    </div>

                    <h3 className="font-bold text-[#F5F7F5] text-sm line-clamp-2 leading-snug">
                      {product.name}
                    </h3>

                    {/* Price & Availability */}
                    <div className="flex items-baseline justify-between pt-1">
                      <span className="text-xl font-extrabold text-[#F5F7F5]">
                        {formatCurrency(product.price)}
                      </span>

                      <span className="inline-flex items-center gap-1 text-xs font-bold text-[#34D399] bg-[#132B1C] px-2.5 py-1 rounded-full border border-[#245836]">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#22C55E]" />
                        <span>{product.stock_quantity} In Stock</span>
                      </span>
                    </div>

                    {/* Shop details */}
                    <div className="pt-3 border-t border-[#303D34]/70 flex items-start gap-2 text-xs text-[#A1ADA5]">
                      <Store className="w-4 h-4 text-[#22C55E] shrink-0 mt-0.5" />
                      <div>
                        <Link
                          href={`/shops/${shop.id}`}
                          className="font-bold text-[#F5F7F5] hover:text-[#34D399] line-clamp-1 transition"
                        >
                          {shop.name}
                        </Link>
                        <span className="text-[#A1ADA5] block text-[11px] line-clamp-1">
                          {shop.locality}, {shop.city}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="p-4 bg-[#151C18] border-t border-[#303D34] flex flex-wrap items-center justify-between gap-2">
                  <Link
                    href={`/shops/${shop.id}`}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 bg-[#1B241F] hover:bg-[#232E27] text-[#34D399] border border-[#303D34] hover:border-[#34D399]/40 px-3 py-2 rounded-xl text-xs font-bold transition"
                  >
                    <Store className="w-3.5 h-3.5" />
                    <span>View Shop Catalogue</span>
                  </Link>

                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${shop.latitude},${shop.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 bg-[#232E27] hover:bg-[#303D34] text-[#F5F7F5] px-3 py-2 rounded-xl border border-[#303D34] text-xs font-semibold transition"
                    title="Get Directions"
                  >
                    <Navigation className="w-3.5 h-3.5 text-[#22C55E]" />
                    <span className="hidden sm:inline">Directions</span>
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Shopkeeper Portal Banner */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-[#151C18] text-[#F5F7F5] rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6 border border-[#303D34] shadow-xl">
          <div className="space-y-1.5 max-w-xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-[#132B1C] text-[#34D399] text-xs font-bold border border-[#245836]">
              <Store className="w-3.5 h-3.5" />
              <span>For Neighborhood Store Owners</span>
            </span>
            <h2 className="text-lg sm:text-xl font-bold text-[#F5F7F5]">
              Publish Your Products & Bill with LocoStock
            </h2>
            <p className="text-xs text-[#A1ADA5]">
              Reach nearby customers actively searching for products. Every sale billed automatically synchronizes live availability in real time.
            </p>
          </div>

          <Link
            href="/shopkeeper"
            className="shrink-0 bg-[#22C55E] hover:bg-[#16A34A] text-[#101512] font-black px-5 py-2.5 rounded-xl transition text-xs shadow-md flex items-center gap-2"
          >
            <span>Open Shopkeeper Portal</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
