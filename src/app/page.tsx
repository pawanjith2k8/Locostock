'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Search, 
  MapPin, 
  Store, 
  ShoppingBag, 
  ArrowRight, 
  CheckCircle2, 
  Navigation, 
  History, 
  TrendingUp, 
  Cpu, 
  BookOpen, 
  Apple, 
  Clock, 
  X,
  AlertCircle
} from 'lucide-react';
import { useUser } from '@/context/UserContext';
import { searchProducts, searchShops } from '@/lib/db';
import { isSupabaseConfigured } from '@/lib/supabaseClient';
import { ProductSearchResult, Shop } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { getRecentSearches, addRecentSearch, clearRecentSearches, removeRecentSearch } from '@/lib/searchHistory';

export default function CustomerLandingPage() {
  const router = useRouter();
  const { customerArea, setCustomerArea } = useUser();

  const [areaInput, setAreaInput] = useState(customerArea || '');
  const [productQuery, setProductQuery] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const [searchedArea, setSearchedArea] = useState<string>(customerArea || '');
  const [matchingShops, setMatchingShops] = useState<Array<{ shop: Shop; distanceKm?: number }>>([]);
  const [featuredProducts, setFeaturedProducts] = useState<ProductSearchResult[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Sync areaInput with customerArea from context
  useEffect(() => {
    if (customerArea && !areaInput) {
      setAreaInput(customerArea);
      setSearchedArea(customerArea);
    }
  }, [customerArea]);

  // Load directory data (shops and products) matching the searched area
  useEffect(() => {
    setRecentSearches(getRecentSearches());

    async function loadDirectoryData() {
      setLoading(true);
      try {
        const [shopsResult, productsResult] = await Promise.all([
          searchShops({
            area: searchedArea || undefined,
          }),
          searchProducts({
            area: searchedArea || undefined,
            onlyInStock: true,
            sortBy: 'relevance',
          }),
        ]);
        setMatchingShops(shopsResult);
        setFeaturedProducts(productsResult);
      } catch (err) {
        console.error('Error loading discovery directory:', err);
      } finally {
        setLoading(false);
      }
    }

    loadDirectoryData();
  }, [searchedArea]);

  const handleAreaSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanArea = areaInput.trim();
    const cleanProd = productQuery.trim();

    if (!cleanArea && !cleanProd) {
      setValidationError('Please enter an area name to search (e.g., Tambaram, Velachery, Perungudi).');
      return;
    }

    setValidationError(null);

    if (cleanArea) {
      setCustomerArea(cleanArea);
      setSearchedArea(cleanArea);
      addRecentSearch(cleanArea);
    }

    if (cleanProd) {
      addRecentSearch(cleanProd);
      router.push(`/search?q=${encodeURIComponent(cleanProd)}${cleanArea ? `&area=${encodeURIComponent(cleanArea)}` : ''}`);
    }
  };

  const handleSelectQuickArea = (areaName: string) => {
    setAreaInput(areaName);
    setCustomerArea(areaName);
    setSearchedArea(areaName);
    setValidationError(null);
    addRecentSearch(areaName);
  };

  const handleClearArea = () => {
    setAreaInput('');
    setCustomerArea('');
    setSearchedArea('');
    setValidationError(null);
  };

  const executeRecentSearch = (query: string) => {
    addRecentSearch(query);
    setAreaInput(query);
    setCustomerArea(query);
    setSearchedArea(query);
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

          {/* Hero Heading */}
          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-[#F5F7F5]">
            Find What You Need.{' '}
            <span className="text-[#34D399]">Shop Locally.</span>
          </h1>

          {/* Short Supporting Description */}
          <p className="text-xs sm:text-sm text-[#A1ADA5] max-w-xl mx-auto font-normal leading-relaxed">
            Enter your neighborhood or area to discover verified physical stores and real-time in-stock products. No GPS tracking required.
          </p>

          {/* Manual Area-Based Search Interface */}
          <form
            onSubmit={handleAreaSearchSubmit}
            className="mt-6 bg-[#1B241F] rounded-2xl border border-[#303D34] p-1.5 shadow-2xl flex flex-col md:flex-row items-stretch md:items-center max-w-3xl mx-auto divide-y md:divide-y-0 md:divide-x divide-[#303D34] focus-within:border-[#34D399]/60 transition-colors"
          >
            {/* 1. Manual Area Input */}
            <div className="flex items-center gap-2 px-3 py-2.5 min-w-[240px] flex-1">
              <MapPin className="w-4 h-4 text-[#22C55E] shrink-0" />
              <input
                type="text"
                value={areaInput}
                onChange={e => {
                  setAreaInput(e.target.value);
                  if (validationError) setValidationError(null);
                }}
                placeholder="Enter area (e.g. Tambaram, Velachery)..."
                className="w-full bg-transparent outline-none text-xs sm:text-sm text-[#F5F7F5] placeholder-[#A1ADA5]/60 border-0 p-0 font-medium"
              />
              {areaInput && (
                <button
                  type="button"
                  onClick={handleClearArea}
                  className="text-[#A1ADA5] hover:text-[#F5F7F5] p-1 text-xs"
                  title="Clear area"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* 2. Optional Product Keyword */}
            <div className="flex-1 flex items-center gap-2 px-3 py-2.5">
              <Search className="w-4 h-4 text-[#A1ADA5] shrink-0" />
              <input
                type="text"
                value={productQuery}
                onChange={e => setProductQuery(e.target.value)}
                placeholder='Product (e.g. "Arduino", "Notebook")...'
                className="w-full bg-transparent outline-none text-xs sm:text-sm text-[#F5F7F5] placeholder-[#A1ADA5]/60 border-0 p-0"
              />
            </div>

            {/* 3. Search Button */}
            <div className="p-1">
              <button
                type="submit"
                className="w-full md:w-auto bg-[#22C55E] hover:bg-[#16A34A] text-[#101512] font-black px-6 py-2.5 rounded-xl transition flex items-center justify-center gap-2 text-xs sm:text-sm shadow-md"
              >
                <span>Search</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>

          {/* Validation Error Message */}
          {validationError && (
            <div className="max-w-md mx-auto p-2.5 bg-[#2A1515] border border-[#7F1D1D] rounded-xl text-xs text-[#F87171] flex items-center gap-2 justify-center font-semibold animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0 text-[#EF4444]" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Quick Area Filter Pills */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            <span className="text-[11px] text-[#A1ADA5] font-medium mr-1">Popular areas:</span>
            {['Tambaram', 'Velachery', 'Perungudi', 'Thoraipakkam', 'Adyar'].map(locName => (
              <button
                key={locName}
                type="button"
                onClick={() => handleSelectQuickArea(locName)}
                className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-semibold border transition ${
                  searchedArea.toLowerCase() === locName.toLowerCase()
                    ? 'bg-[#22C55E] text-[#101512] border-[#22C55E] font-bold shadow-sm'
                    : 'bg-[#1B241F] hover:bg-[#232E27] text-[#F5F7F5] border-[#303D34] hover:border-[#34D399]/40'
                }`}
              >
                <MapPin className="w-3 h-3 text-[#34D399]" />
                <span>{locName}</span>
              </button>
            ))}
          </div>

          {/* Quick Categories Bar */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            <span className="text-[11px] text-[#A1ADA5] font-medium mr-1">Browse categories:</span>
            <Link
              href={`/search?category=Electronics%20%26%20Hardware${searchedArea ? `&area=${encodeURIComponent(searchedArea)}` : ''}`}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1B241F] hover:bg-[#232E27] text-[11px] font-semibold text-[#F5F7F5] border border-[#303D34] hover:border-[#34D399]/40 transition"
            >
              <Cpu className="w-3 h-3 text-[#34D399]" />
              <span>Electronics & Hardware</span>
            </Link>
            <Link
              href={`/search?category=Stationery%20%26%20Books${searchedArea ? `&area=${encodeURIComponent(searchedArea)}` : ''}`}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1B241F] hover:bg-[#232E27] text-[11px] font-semibold text-[#F5F7F5] border border-[#303D34] hover:border-[#34D399]/40 transition"
            >
              <BookOpen className="w-3 h-3 text-[#34D399]" />
              <span>Stationery & Books</span>
            </Link>
            <Link
              href={`/search?category=Groceries%20%26%20Household${searchedArea ? `&area=${encodeURIComponent(searchedArea)}` : ''}`}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1B241F] hover:bg-[#232E27] text-[11px] font-semibold text-[#F5F7F5] border border-[#303D34] hover:border-[#34D399]/40 transition"
            >
              <Apple className="w-3 h-3 text-[#34D399]" />
              <span>Groceries & Household</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Navigation Shortcuts: Search Products, Browse Shops, History */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link
            href={searchedArea ? `/search?area=${encodeURIComponent(searchedArea)}` : '/search'}
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
            href={searchedArea ? `/shops?area=${encodeURIComponent(searchedArea)}` : '/shops'}
            className="bg-[#151C18] hover:bg-[#1B241F] p-4 rounded-2xl border border-[#303D34] hover:border-[#34D399]/40 transition flex items-center justify-between group shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#1B241F] border border-[#303D34] flex items-center justify-center text-[#22C55E] group-hover:bg-[#22C55E] group-hover:text-[#101512] transition-colors">
                <Store className="w-5 h-5" />
              </div>
              <div>
                <span className="font-bold text-sm text-[#F5F7F5] block">Browse Shops</span>
                <span className="text-[11px] text-[#A1ADA5]">Verified physical store directory</span>
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

      {/* Section: Matching Shops in Area */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-[#F5F7F5] flex items-center gap-2">
              <Store className="w-4 h-4 text-[#22C55E]" />
              <span>
                {searchedArea ? `Registered Shops in ${searchedArea}` : 'Registered Local Shops'}
              </span>
            </h2>
            <p className="text-xs text-[#A1ADA5]">
              {searchedArea
                ? `Physical stores operating in ${searchedArea}`
                : 'Browse neighborhood stores or enter your locality above'}
            </p>
          </div>

          <Link
            href={searchedArea ? `/shops?area=${encodeURIComponent(searchedArea)}` : '/shops'}
            className="text-xs font-bold text-[#34D399] hover:underline inline-flex items-center gap-1 self-start sm:self-auto"
          >
            <span>Browse All Shops</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(n => (
              <div key={n} className="bg-[#1B241F] rounded-2xl border border-[#303D34] h-44 animate-pulse p-4 space-y-3">
                <div className="h-6 bg-[#232E27] rounded w-1/3"></div>
                <div className="h-4 bg-[#232E27] rounded w-3/4"></div>
                <div className="h-4 bg-[#232E27] rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : matchingShops.length === 0 ? (
          <div className="bg-[#151C18] p-8 rounded-2xl border border-[#303D34] text-center space-y-3">
            <Store className="w-10 h-10 text-[#A1ADA5] mx-auto" />
            <h3 className="text-sm font-bold text-[#F5F7F5]">
              {searchedArea
                ? 'No shops found in this area. Try another area.'
                : !isSupabaseConfigured
                ? 'Database Awaiting Configuration'
                : 'No shops registered yet'}
            </h3>
            <p className="text-xs text-[#A1ADA5] max-w-md mx-auto">
              {searchedArea
                ? `No registered stores currently match "${searchedArea}". Try checking the spelling or searching another locality like Velachery, Tambaram, or Perungudi.`
                : !isSupabaseConfigured
                ? 'Supabase credentials have not been configured yet in .env.local.'
                : 'Enter your area or neighborhood above to discover registered local shops.'}
            </p>
            {searchedArea && (
              <button
                type="button"
                onClick={handleClearArea}
                className="inline-block px-4 py-2 bg-[#232E27] text-[#34D399] border border-[#303D34] rounded-xl text-xs font-bold hover:bg-[#1B241F] transition"
              >
                Clear Area Filter
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {matchingShops.slice(0, 6).map(({ shop, distanceKm }) => (
              <div
                key={shop.id}
                className="bg-[#1B241F] rounded-2xl border border-[#303D34] p-5 shadow-lg hover:border-[#34D399]/40 transition flex flex-col justify-between group space-y-4"
              >
                <div>
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#132B1C] text-[#34D399] border border-[#245836]">
                      {shop.category}
                    </span>
                    {distanceKm !== undefined && (
                      <span className="text-[11px] text-[#A1ADA5]">{distanceKm} km away</span>
                    )}
                  </div>
                  <h3 className="font-bold text-[#F5F7F5] text-base group-hover:text-[#34D399] transition">
                    <Link href={`/shops/${shop.id}`}>{shop.name}</Link>
                  </h3>
                  <p className="text-xs text-[#A1ADA5] line-clamp-2 mt-1">
                    {shop.description || 'Verified local retailer.'}
                  </p>
                  <div className="pt-3 border-t border-[#303D34]/70 flex items-start gap-2 text-xs text-[#A1ADA5] mt-3">
                    <MapPin className="w-3.5 h-3.5 text-[#22C55E] shrink-0 mt-0.5" />
                    <span>{shop.address_line}, {shop.locality}, {shop.city}</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#303D34] flex items-center justify-between gap-2">
                  <Link
                    href={`/shops/${shop.id}`}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-[#34D399] hover:underline"
                  >
                    <span>View Catalogue</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>

                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${shop.latitude},${shop.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 bg-[#232E27] hover:bg-[#303D34] text-[#F5F7F5] px-2.5 py-1 rounded-lg border border-[#303D34] text-xs font-semibold transition"
                    title="Get Directions"
                  >
                    <Navigation className="w-3.5 h-3.5 text-[#22C55E]" />
                    <span>Directions</span>
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Section: Live Available Products */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-[#F5F7F5] flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#22C55E]" />
              <span>
                {searchedArea ? `Available In-Stock Products in ${searchedArea}` : 'Available Products in Local Shops'}
              </span>
            </h2>
            <p className="text-xs text-[#A1ADA5]">
              Real-time synchronized products recorded by local store owners
            </p>
          </div>

          <Link
            href={searchedArea ? `/search?area=${encodeURIComponent(searchedArea)}` : '/search'}
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
            <ShoppingBag className="w-10 h-10 text-[#A1ADA5] mx-auto" />
            <h3 className="text-sm font-bold text-[#F5F7F5]">
              {searchedArea
                ? 'No shops found in this area. Try another area.'
                : !isSupabaseConfigured
                ? 'Database Awaiting Configuration'
                : 'No in-stock products found'}
            </h3>
            <p className="text-xs text-[#A1ADA5] max-w-md mx-auto">
              {searchedArea
                ? `No products are currently available in "${searchedArea}". Try searching another area.`
                : 'Products added by registered shopkeepers will appear here in real time.'}
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
            {featuredProducts.slice(0, 6).map(({ product, shop, distanceKm }) => (
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

                    <div className="absolute top-3 right-3 bg-[#101512]/90 backdrop-blur-md text-[#F5F7F5] text-[11px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 border border-[#303D34] shadow">
                      <MapPin className="w-3 h-3 text-[#34D399]" />
                      <span>{shop.locality}</span>
                    </div>
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