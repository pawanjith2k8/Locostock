'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { 
  Store, 
  MapPin, 
  Phone, 
  Mail, 
  Clock, 
  Navigation, 
  Search, 
  CheckCircle2, 
  AlertTriangle,
  ArrowLeft,
  Layers,
  ShieldCheck,
  ShoppingBag
} from 'lucide-react';
import { getShopById, getProductsByShop } from '@/lib/db';
import { isSupabaseConfigured } from '@/lib/supabaseClient';
import { Shop, Product } from '@/types';
import { formatCurrency, formatTimeAgo, isStaleStock, calculateHaversineDistanceKm } from '@/lib/utils';
import { useUser } from '@/context/UserContext';
import LeafletMap from '@/components/LeafletMap';

export default function ShopProfilePage() {
  const params = useParams();
  const shopId = params.id as string;
  const { customerLocation } = useUser();

  const [shop, setShop] = useState<Shop | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadShopAndProducts() {
      setLoading(true);
      try {
        const s = await getShopById(shopId);
        const p = await getProductsByShop(shopId);
        setShop(s);
        setProducts(p);
      } catch (err) {
        console.error('Error loading shop profile:', err);
      } finally {
        setLoading(false);
      }
    }
    if (shopId) {
      loadShopAndProducts();
    }
  }, [shopId]);

  if (loading) {
    return <div className="p-16 text-center text-[#A1ADA5] text-xs">Loading shop profile and live catalogue...</div>;
  }

  if (!shop) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-4">
        <Store className="w-12 h-12 text-[#A1ADA5] mx-auto" />
        <h2 className="text-xl font-bold text-[#F5F7F5]">
          {!isSupabaseConfigured ? 'Database Awaiting Configuration' : 'Shop Not Found'}
        </h2>
        <p className="text-xs text-[#A1ADA5]">
          {!isSupabaseConfigured
            ? 'Supabase database credentials have not been configured in .env.local yet.'
            : 'The shop you are looking for does not exist or has been removed.'}
        </p>
        <Link href="/shops" className="inline-block px-4 py-2 bg-[#22C55E] text-[#101512] rounded-xl text-xs font-bold hover:bg-[#16A34A] transition">
          Return to Shops Directory
        </Link>
      </div>
    );
  }

  const distanceKm = calculateHaversineDistanceKm(
    customerLocation.lat,
    customerLocation.lon,
    shop.latitude,
    shop.longitude
  );

  // Filter products within shop catalogue
  const filteredProducts = products.filter(p => {
    if (!p.is_active) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchName = p.name.toLowerCase().includes(q);
      const matchBrand = (p.brand || '').toLowerCase().includes(q);
      const matchSku = (p.sku || '').toLowerCase().includes(q);
      if (!matchName && !matchBrand && !matchSku) return false;
    }
    if (categoryFilter && p.category !== categoryFilter) return false;
    return true;
  });

  const uniqueCategories = Array.from(new Set(products.map(p => p.category)));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Back button */}
      <div>
        <Link
          href="/shops"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#A1ADA5] hover:text-[#34D399] transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Shops Directory</span>
        </Link>
      </div>

      {/* Shop Profile Hero Card */}
      <div className="bg-[#151C18] rounded-3xl border border-[#303D34] overflow-hidden shadow-2xl">
        <div className="p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-[#303D34]">
          <div className="space-y-3 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#132B1C] text-[#34D399] border border-[#245836]">
                {shop.category}
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#22C55E] bg-[#1B241F] px-2.5 py-0.5 rounded-full border border-[#303D34]">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Verified Local Merchant</span>
              </span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-[#F5F7F5]">
              {shop.name}
            </h1>

            <p className="text-[#A1ADA5] text-xs sm:text-sm leading-relaxed">
              {shop.description}
            </p>
          </div>

          {/* Quick Action Box */}
          <div className="bg-[#1B241F] p-5 rounded-2xl border border-[#303D34] shrink-0 space-y-3 min-w-[240px] shadow-lg">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#A1ADA5]">Distance from you:</span>
              <span className="font-bold text-[#34D399]">{distanceKm} km away</span>
            </div>

            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${shop.latitude},${shop.longitude}`}
              target="_blank"
              rel="noreferrer"
              className="w-full bg-[#22C55E] hover:bg-[#16A34A] text-[#101512] font-black py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 transition shadow-lg shadow-[#22C55E]/20"
            >
              <Navigation className="w-4 h-4" />
              <span>Get Directions</span>
            </a>
          </div>
        </div>

        {/* Contact & Hours Details Bar */}
        <div className="p-6 bg-[#101512] grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-[#A1ADA5]">
          <div className="flex items-start gap-2.5">
            <MapPin className="w-4 h-4 text-[#22C55E] shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block text-[#F5F7F5]">Shop Address</span>
              <span>{shop.address_line}, {shop.locality}, {shop.city} - {shop.postal_code}</span>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <Phone className="w-4 h-4 text-[#34D399] shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block text-[#F5F7F5]">Contact Number</span>
              <span>{shop.contact_phone || 'Not publicly listed'}</span>
              {shop.contact_email && <span className="block text-[#A1ADA5]/70">{shop.contact_email}</span>}
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <Clock className="w-4 h-4 text-[#A1ADA5] shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block text-[#F5F7F5]">Business Hours</span>
              <span>{shop.business_hours || 'Mon-Sat 9:00 AM - 9:30 PM'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Map Coordinates Preview */}
      <div className="bg-[#151C18] p-5 rounded-3xl border border-[#303D34] shadow-xl space-y-3">
        <h3 className="text-xs font-bold text-[#F5F7F5] flex items-center gap-2">
          <MapPin className="w-4 h-4 text-[#22C55E]" />
          <span>Interactive Map & Store Pin</span>
        </h3>
        <LeafletMap
          center={[shop.latitude, shop.longitude]}
          zoom={15}
          markers={[
            {
              lat: shop.latitude,
              lon: shop.longitude,
              title: shop.name,
              description: `${shop.address_line}<br/><a href="https://www.google.com/maps/dir/?api=1&destination=${shop.latitude},${shop.longitude}" target="_blank" style="color: #34D399; font-weight: 700; text-decoration: underline;">Open Google Maps &rarr;</a>`,
            },
          ]}
          height="240px"
        />
      </div>

      {/* Shop Product Catalogue Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-[#F5F7F5]">
              Shop Product Catalogue ({filteredProducts.length})
            </h2>
            <p className="text-xs text-[#A1ADA5]">
              Real-time recorded stock currently listed by {shop.name}.
            </p>
          </div>

          {/* Catalogue search and filter */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 text-[#A1ADA5] absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search in this catalogue..."
                className="pl-9 pr-3 py-1.5 bg-[#1B241F] border border-[#303D34] rounded-xl text-xs font-medium text-[#F5F7F5] placeholder-[#A1ADA5]/60 outline-none focus:border-[#34D399]"
              />
            </div>

            {uniqueCategories.length > 1 && (
              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                className="px-3 py-1.5 bg-[#1B241F] border border-[#303D34] rounded-xl text-xs font-medium text-[#F5F7F5] outline-none focus:border-[#34D399] cursor-pointer"
              >
                <option value="" className="bg-[#1B241F]">All Categories</option>
                {uniqueCategories.map(c => (
                  <option key={c} value={c} className="bg-[#1B241F]">
                    {c}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Product Cards */}
        {filteredProducts.length === 0 ? (
          <div className="bg-[#151C18] p-12 rounded-3xl border border-[#303D34] text-center space-y-2">
            <ShoppingBag className="w-10 h-10 text-[#A1ADA5] mx-auto" />
            <h3 className="text-base font-bold text-[#F5F7F5]">No products matching filter</h3>
            <p className="text-xs text-[#A1ADA5]">
              {products.length === 0
                ? 'This shopkeeper has not published any active items yet.'
                : 'Try clearing your search query or category filter.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts.map(product => {
              const stale = isStaleStock(product.last_inventory_update);
              const isOutOfStock = product.stock_quantity <= 0;
              const isLowStock = product.stock_quantity > 0 && product.stock_quantity <= 5;

              return (
                <div
                  key={product.id}
                  className="bg-[#1B241F] rounded-2xl border border-[#303D34] overflow-hidden shadow-xl hover:border-[#34D399]/40 transition flex flex-col justify-between group"
                >
                  <div>
                    {/* Image */}
                    <div className="h-44 w-full bg-[#151C18] overflow-hidden relative">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[#A1ADA5]/40">
                          <Layers className="w-10 h-10" />
                        </div>
                      )}
                    </div>

                    <div className="p-5 space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-[#34D399] uppercase tracking-wider text-[11px]">
                          {product.category}
                        </span>
                        {product.sku && (
                          <span className="text-[#A1ADA5] text-[11px]">SKU: {product.sku}</span>
                        )}
                      </div>

                      <h3 className="font-bold text-[#F5F7F5] line-clamp-2 text-sm leading-snug">
                        {product.name}
                      </h3>

                      <p className="text-xs text-[#A1ADA5] line-clamp-2">
                        {product.description}
                      </p>

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

                      <div className="flex items-center gap-1.5 text-[11px] text-[#A1ADA5] pt-1">
                        <Clock className="w-3.5 h-3.5 text-[#34D399] shrink-0" />
                        <span>Last updated: {formatTimeAgo(product.last_inventory_update)}</span>
                        {stale && <span className="text-[#F59E0B] font-medium ml-auto">(Stale)</span>}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
