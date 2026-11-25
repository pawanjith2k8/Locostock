'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { 
  Search, 
  MapPin, 
  Navigation, 
  Clock, 
  SlidersHorizontal, 
  CheckCircle2, 
  AlertTriangle,
  Store,
  Layers,
  Map as MapIcon,
  List,
  ChevronDown,
  X,
  ExternalLink
} from 'lucide-react';
import { useUser } from '@/context/UserContext';
import { searchProducts } from '@/lib/db';
import { isSupabaseConfigured } from '@/lib/supabaseClient';
import { ProductSearchResult } from '@/types';
import { formatCurrency, formatTimeAgo, isStaleStock } from '@/lib/utils';
import { addRecentSearch } from '@/lib/searchHistory';
import LeafletMap from '@/components/LeafletMap';

function SearchPageContent() {
  const searchParams = useSearchParams();
  const queryParam = searchParams.get('q') || '';
  const categoryParam = searchParams.get('category') || '';
  const areaParam = searchParams.get('area') || '';

  const { customerArea, setCustomerArea, customerLocation, radiusKm, setRadiusKm } = useUser();

  const [query, setQuery] = useState(queryParam);
  const [category, setCategory] = useState(categoryParam);
  const [area, setArea] = useState(areaParam || customerArea || '');
  const [minPrice, setMinPrice] = useState<number | undefined>(undefined);
  const [maxPrice, setMaxPrice] = useState<number | undefined>(undefined);
  const [sortBy, setSortBy] = useState<'relevance' | 'distance' | 'price_low' | 'price_high'>('relevance');
  const [onlyInStock, setOnlyInStock] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  const [results, setResults] = useState<ProductSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);

  useEffect(() => {
    if (queryParam !== undefined) setQuery(queryParam);
    if (categoryParam !== undefined) setCategory(categoryParam);
    if (areaParam !== undefined && areaParam !== '') setArea(areaParam);
  }, [queryParam, categoryParam, areaParam]);

  // Execute database search
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      if (query.trim()) {
        addRecentSearch(query.trim());
      }
      if (area.trim() && area.trim() !== customerArea) {
        setCustomerArea(area.trim());
      }
      try {
        const data = await searchProducts({
          query,
          category: category || undefined,
          area: area.trim() || undefined,
          minPrice,
          maxPrice,
          onlyInStock,
          sortBy,
        });
        setResults(data);
      } catch (err) {
        console.error('Error fetching search results:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [query, category, area, minPrice, maxPrice, onlyInStock, sortBy]);

  const categories = ['Electronics & Hardware', 'Stationery & Books', 'Groceries & Household'];

  // Map markers
  const mapMarkers = results.map(r => ({
    lat: r.shop.latitude,
    lon: r.shop.longitude,
    title: `${r.product.name} @ ${r.shop.name}`,
    description: `Price: ${formatCurrency(r.product.price)} | Stock: ${r.product.stock_quantity} available<br/><a href="https://www.google.com/maps/dir/?api=1&destination=${r.shop.latitude},${r.shop.longitude}" target="_blank" style="color: #34D399; font-weight: 700; text-decoration: underline;">Get Directions &rarr;</a>`,
  }));

  const activeFiltersCount = (category ? 1 : 0) + (minPrice !== undefined || maxPrice !== undefined ? 1 : 0) + (onlyInStock ? 1 : 0) + (radiusKm !== 10 ? 1 : 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Search Header Bar */}
      <div className="bg-[#151C18] p-5 sm:p-6 rounded-3xl border border-[#303D34] shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-[#F5F7F5] flex items-center gap-2">
              <Search className="w-5 h-5 text-[#22C55E]" />
              <span>Product Discovery</span>
            </h1>
            <p className="text-xs text-[#A1ADA5]">
              {area ? (
                <>
                  Showing real in-stock inventory registered in{' '}
                  <span className="font-bold text-[#34D399]">{area}</span>
                </>
              ) : (
                'Real recorded physical shop inventory across neighborhoods'
              )}
            </p>
          </div>

          {/* List / Map view toggle */}
          <div className="flex items-center gap-1 bg-[#1B241F] p-1 rounded-xl self-start md:self-auto border border-[#303D34]">
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                viewMode === 'list'
                  ? 'bg-[#22C55E] text-[#101512] shadow-sm'
                  : 'text-[#A1ADA5] hover:text-[#F5F7F5]'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>List View</span>
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                viewMode === 'map'
                  ? 'bg-[#22C55E] text-[#101512] shadow-sm'
                  : 'text-[#A1ADA5] hover:text-[#F5F7F5]'
              }`}
            >
              <MapIcon className="w-3.5 h-3.5" />
              <span>Map View</span>
            </button>
          </div>
        </div>

        {/* Search input & primary controls */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-2">
          {/* Query input */}
          <div className="md:col-span-4 relative">
            <Search className="w-4 h-4 text-[#A1ADA5] absolute left-3.5 top-3.5" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search product, brand, SKU..."
              className="w-full pl-10 pr-4 py-2.5 bg-[#1B241F] border border-[#303D34] rounded-xl text-xs sm:text-sm font-medium text-[#F5F7F5] placeholder-[#A1ADA5]/60 outline-none focus:border-[#34D399] transition"
            />
          </div>

          {/* Area manual input */}
          <div className="md:col-span-3 relative">
            <MapPin className="w-4 h-4 text-[#22C55E] absolute left-3.5 top-3.5" />
            <input
              type="text"
              value={area}
              onChange={e => setArea(e.target.value)}
              placeholder="Area (e.g. Tambaram)..."
              className="w-full pl-10 pr-8 py-2.5 bg-[#1B241F] border border-[#303D34] rounded-xl text-xs sm:text-sm font-medium text-[#F5F7F5] placeholder-[#A1ADA5]/60 outline-none focus:border-[#34D399] transition"
            />
            {area && (
              <button
                type="button"
                onClick={() => setArea('')}
                className="absolute right-2.5 top-3 text-[#A1ADA5] hover:text-[#F5F7F5]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Category Selector */}
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

          {/* Sort By */}
          <div className="md:col-span-2">
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="w-full px-3 py-2.5 bg-[#1B241F] border border-[#303D34] rounded-xl text-xs sm:text-sm font-medium text-[#F5F7F5] outline-none focus:border-[#34D399] transition cursor-pointer"
            >
              <option value="relevance" className="bg-[#1B241F] text-[#F5F7F5]">Sort: Relevance</option>
              <option value="price_low" className="bg-[#1B241F] text-[#F5F7F5]">Sort: Price Low</option>
              <option value="price_high" className="bg-[#1B241F] text-[#F5F7F5]">Sort: Price High</option>
            </select>
          </div>

          {/* Filter toggle button */}
          <div className="md:col-span-1 flex items-center">
            <button
              onClick={() => setShowFiltersPanel(!showFiltersPanel)}
              className={`w-full py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                showFiltersPanel || activeFiltersCount > 1
                  ? 'bg-[#232E27] border-[#34D399] text-[#34D399]'
                  : 'bg-[#1B241F] border-[#303D34] text-[#A1ADA5] hover:text-[#F5F7F5]'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span className="md:hidden">Filters ({activeFiltersCount})</span>
            </button>
          </div>
        </div>

        {/* Collapsible Advanced Filters Panel */}
        {showFiltersPanel && (
          <div className="p-4 bg-[#1B241F] rounded-2xl border border-[#303D34] grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs animate-fade-in">
            {/* Price Range */}
            <div>
              <label className="block text-[#A1ADA5] font-semibold mb-1.5">Price Range (₹)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  value={minPrice ?? ''}
                  onChange={e => setMinPrice(e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full px-2.5 py-1.5 bg-[#151C18] border border-[#303D34] rounded-lg text-xs text-[#F5F7F5] outline-none focus:border-[#34D399]"
                />
                <span className="text-[#303D34]">-</span>
                <input
                  type="number"
                  placeholder="Max"
                  value={maxPrice ?? ''}
                  onChange={e => setMaxPrice(e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full px-2.5 py-1.5 bg-[#151C18] border border-[#303D34] rounded-lg text-xs text-[#F5F7F5] outline-none focus:border-[#34D399]"
                />
              </div>
            </div>

            {/* Radius Control */}
            <div>
              <label className="block text-[#A1ADA5] font-semibold mb-1.5">Distance Radius</label>
              <select
                value={radiusKm}
                onChange={e => setRadiusKm(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 bg-[#151C18] border border-[#303D34] rounded-lg text-xs text-[#F5F7F5] outline-none focus:border-[#34D399] cursor-pointer"
              >
                <option value={2} className="bg-[#151C18]">Within 2 km</option>
                <option value={5} className="bg-[#151C18]">Within 5 km</option>
                <option value={10} className="bg-[#151C18]">Within 10 km</option>
                <option value={25} className="bg-[#151C18]">Within 25 km</option>
                <option value={50} className="bg-[#151C18]">Within 50 km</option>
              </select>
            </div>

            {/* In-Stock Filter & Reset */}
            <div className="flex flex-col justify-end gap-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={onlyInStock}
                  onChange={e => setOnlyInStock(e.target.checked)}
                  className="rounded border-[#303D34] text-[#22C55E] focus:ring-[#22C55E] w-4 h-4 bg-[#151C18]"
                />
                <span className="font-medium text-[#F5F7F5]">In-stock only (Qty &gt; 0)</span>
              </label>

              <button
                onClick={() => {
                  setQuery('');
                  setCategory('');
                  setMinPrice(undefined);
                  setMaxPrice(undefined);
                  setOnlyInStock(true);
                  setRadiusKm(10);
                }}
                className="text-[11px] text-[#A1ADA5] hover:text-[#EF4444] text-left underline font-medium"
              >
                Reset All Filters
              </button>
            </div>
          </div>
        )}

        {/* Results summary bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[#A1ADA5] pt-2 border-t border-[#303D34]">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#F5F7F5]">{results.length}</span>
            <span>registered product listings found</span>
          </div>

          {category && (
            <span className="inline-flex items-center gap-1 bg-[#232E27] text-[#34D399] px-2.5 py-0.5 rounded-full border border-[#303D34] text-[11px]">
              Category: {category}
              <X className="w-3 h-3 cursor-pointer hover:text-[#EF4444]" onClick={() => setCategory('')} />
            </span>
          )}
        </div>
      </div>

      {/* Main Results View (Map or List) */}
      {viewMode === 'map' ? (
        <div className="space-y-4">
          <LeafletMap
            center={[customerLocation.lat, customerLocation.lon]}
            zoom={13}
            markers={mapMarkers}
            height="520px"
          />
          <div className="flex items-center justify-between text-xs text-[#A1ADA5] px-2">
            <span>Click any emerald pin to view shop name, price, stock, and directions link.</span>
            <button
              onClick={() => setViewMode('list')}
              className="text-[#34D399] font-bold hover:underline"
            >
              Back to List View &rarr;
            </button>
          </div>
        </div>
      ) : (
        <div>
          {loading ? (
            <div className="p-16 text-center text-[#A1ADA5] text-xs">
              <div className="w-8 h-8 border-2 border-[#22C55E] border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
              <span>Searching real local shop inventory...</span>
            </div>
          ) : results.length === 0 ? (
            <div className="bg-[#151C18] p-12 rounded-3xl border border-[#303D34] text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-[#1B241F] border border-[#303D34] text-[#A1ADA5] flex items-center justify-center mx-auto">
                <Search className="w-8 h-8 text-[#A1ADA5]" />
              </div>
              <h3 className="text-lg font-bold text-[#F5F7F5]">
                {!isSupabaseConfigured
                  ? 'Database Awaiting Configuration'
                  : area
                  ? 'No shops found in this area. Try another area.'
                  : 'No matching products found'}
              </h3>
              <p className="text-xs text-[#A1ADA5] max-w-md mx-auto">
                {!isSupabaseConfigured
                  ? 'Supabase database credentials have not been configured in .env.local yet. Once configured, real shop inventories will be searchable here.'
                  : area
                  ? `No verified stores or products match "${area}". Try searching another area like Tambaram, Velachery, or Perungudi.`
                  : query
                  ? `No verified listings match "${query}". Try searching a different keyword or category.`
                  : 'No products are currently available. Try clearing your filters or changing the area.'}
              </p>
              {isSupabaseConfigured && (
                <button
                  onClick={() => {
                    setQuery('');
                    setCategory('');
                    setArea('');
                  }}
                  className="px-5 py-2.5 bg-[#22C55E] text-[#101512] rounded-xl text-xs font-bold hover:bg-[#16A34A] transition shadow-lg shadow-[#22C55E]/20"
                >
                  Clear Area & Search Filters
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {results.map(({ product, shop, distanceKm }) => {
                const stale = isStaleStock(product.last_inventory_update);
                const isOutOfStock = product.stock_quantity <= 0;
                const isLowStock = product.stock_quantity > 0 && product.stock_quantity <= 5;

                return (
                  <div
                    key={`${product.id}-${shop.id}`}
                    className="bg-[#1B241F] rounded-2xl border border-[#303D34] overflow-hidden shadow-xl hover:border-[#34D399]/40 transition flex flex-col justify-between group"
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
                            <Layers className="w-12 h-12" />
                          </div>
                        )}

                        {/* Distance Badge */}
                        {distanceKm !== undefined && (
                          <div className="absolute top-3 right-3 bg-[#101512]/90 backdrop-blur-md text-[#F5F7F5] text-[11px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 border border-[#303D34] shadow">
                            <Navigation className="w-3 h-3 text-[#34D399]" />
                            <span>{distanceKm} km away · {shop.locality}</span>
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="p-5 space-y-3">
                        {/* Brand & Category */}
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-[#34D399] uppercase tracking-wider text-[11px]">
                            {product.brand || product.category}
                          </span>
                          <span className="text-[11px] text-[#A1ADA5]">
                            SKU: {product.sku || 'N/A'}
                          </span>
                        </div>

                        {/* Product Name */}
                        <h3 className="font-bold text-[#F5F7F5] text-sm line-clamp-2 leading-snug">
                          {product.name}
                        </h3>

                        {/* Price & Availability Badge */}
                        <div className="flex items-baseline justify-between pt-1">
                          <span className="text-2xl font-extrabold text-[#F5F7F5] tracking-tight">
                            {formatCurrency(product.price)}
                          </span>

                          {isOutOfStock ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#EF4444] bg-[#2D1515] px-2.5 py-1 rounded-full border border-[#5C2424]">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              <span>Out of Stock</span>
                            </span>
                          ) : isLowStock ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#F59E0B] bg-[#2D2210] px-2.5 py-1 rounded-full border border-[#5C4318]">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              <span>{product.stock_quantity} Left (Low)</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#34D399] bg-[#132B1C] px-2.5 py-1 rounded-full border border-[#245836]">
                              <CheckCircle2 className="w-3.5 h-3.5 text-[#22C55E]" />
                              <span>{product.stock_quantity} In Stock</span>
                            </span>
                          )}
                        </div>

                        {/* Freshness Timestamp */}
                        <div className="flex items-center gap-1.5 text-[11px] text-[#A1ADA5] pt-1">
                          <Clock className="w-3.5 h-3.5 text-[#34D399] shrink-0" />
                          <span>Last verified: {formatTimeAgo(product.last_inventory_update)}</span>
                          {stale && (
                            <span className="text-[#F59E0B] font-medium ml-auto" title="Inventory not updated in 48 hours">
                              (May vary)
                            </span>
                          )}
                        </div>

                        {/* Shop snippet */}
                        <div className="pt-3 border-t border-[#303D34]/70 flex items-start gap-2.5 text-xs text-[#A1ADA5]">
                          <Store className="w-4 h-4 text-[#22C55E] shrink-0 mt-0.5" />
                          <div>
                            <Link
                              href={`/shops/${shop.id}`}
                              className="font-bold text-[#F5F7F5] hover:text-[#34D399] line-clamp-1 transition"
                            >
                              {shop.name}
                            </Link>
                            <span className="text-[#A1ADA5] block text-[11px] line-clamp-1">
                              {shop.address_line}, {shop.locality}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Actions footer */}
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
                        className="flex items-center gap-1 bg-[#232E27] hover:bg-[#303D34] text-[#F5F7F5] px-2.5 py-2 rounded-xl border border-[#303D34] text-xs font-semibold shadow-sm transition"
                        title="Get Directions"
                      >
                        <Navigation className="w-3.5 h-3.5 text-[#22C55E]" />
                        <span className="hidden sm:inline">Directions</span>
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-[#A1ADA5] text-xs">Loading search...</div>}>
      <SearchPageContent />
    </Suspense>
  );
}
