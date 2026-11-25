'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Package, 
  AlertTriangle, 
  CheckCircle2, 
  Receipt, 
  History, 
  ArrowRight, 
  Store,
  DollarSign,
  TrendingUp,
  PlusCircle,
  ExternalLink,
  MapPin,
  Clock
} from 'lucide-react';
import { getShopsByOwner, getProductsByShop, getInvoicesByShop, getStockMovementsByShop } from '@/lib/db';
import { isSupabaseConfigured } from '@/lib/supabaseClient';
import { Shop, Product, Invoice, StockMovement } from '@/types';
import { formatCurrency, formatTimeAgo } from '@/lib/utils';
import { useUser } from '@/context/UserContext';

export default function ShopkeeperDashboard() {
  const { profile } = useUser();
  const [shop, setShop] = useState<Shop | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboardData() {
      if (!isSupabaseConfigured || !profile?.id) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const ownerShops = await getShopsByOwner(profile.id);
        
        if (ownerShops.length > 0) {
          const currentShop = ownerShops[0];
          setShop(currentShop);

          const [pList, iList, mList] = await Promise.all([
            getProductsByShop(currentShop.id),
            getInvoicesByShop(currentShop.id),
            getStockMovementsByShop(currentShop.id),
          ]);

          setProducts(pList);
          setInvoices(iList);
          setMovements(mList);
        } else {
          setShop(null);
        }
      } catch (err) {
        console.error('Error loading dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadDashboardData();
  }, [profile]);

  if (loading) {
    return <div className="p-16 text-center text-[#A1ADA5] text-xs">Loading shopkeeper dashboard metrics...</div>;
  }

  // If backend service is unconfigured or offline
  if (!isSupabaseConfigured) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-[#1B241F] border border-[#303D34] text-[#F59E0B] flex items-center justify-center mx-auto shadow-xl">
          <Store className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-[#F5F7F5]">Store Portal Offline</h2>
          <p className="text-xs text-[#A1ADA5] max-w-md mx-auto leading-relaxed">
            The merchant portal is currently unable to establish a secure connection to the store network. Please try refreshing or sign in again.
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

  // If user is not authenticated
  if (!profile) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-[#1B241F] border border-[#303D34] text-[#34D399] flex items-center justify-center mx-auto shadow-xl">
          <Store className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-[#F5F7F5]">Merchant Sign-In Required</h2>
          <p className="text-xs text-[#A1ADA5] max-w-md mx-auto leading-relaxed">
            Please log in with your registered merchant email to manage your inventory, record sales, and monitor stock movements.
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

  // If shopkeeper has no registered shop, route to onboarding
  if (!shop) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-[#1B241F] border border-[#303D34] text-[#22C55E] flex items-center justify-center mx-auto shadow-xl">
          <Store className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-[#F5F7F5]">Welcome to LocoStock Merchant!</h2>
          <p className="text-xs text-[#A1ADA5] max-w-md mx-auto">
            You have not registered your local shop yet. Complete the 5-step onboarding to start listing products, managing inventory, and issuing bills.
          </p>
        </div>
        <Link
          href="/shopkeeper/onboarding"
          className="inline-flex items-center gap-2 bg-[#22C55E] hover:bg-[#16A34A] text-[#101512] font-black px-6 py-3 rounded-xl transition shadow-lg shadow-[#22C55E]/20 text-xs sm:text-sm"
        >
          <span>Start Shop Registration</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  // Real Database Metrics
  const totalListings = products.length;
  const lowStockCount = products.filter(p => p.stock_quantity > 0 && p.stock_quantity <= 5).length;
  const outOfStockCount = products.filter(p => p.stock_quantity === 0).length;
  const totalRevenue = invoices.reduce((acc, inv) => acc + Number(inv.final_total), 0);
  const totalInvoicesIssued = invoices.length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Banner with Shop summary & quick actions */}
      <div className="bg-[#151C18] text-[#F5F7F5] rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-2xl border border-[#303D34]">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#132B1C] text-[#34D399] text-xs font-bold border border-[#245836]">
            <Store className="w-3.5 h-3.5" />
            <span>Active Store Dashboard</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#F5F7F5]">
            {shop.name}
          </h1>
          <p className="text-xs text-[#A1ADA5] flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-[#22C55E]" />
            <span>{shop.address_line}, {shop.locality}, {shop.city}</span>
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/shopkeeper/billing"
            className="flex items-center gap-2 bg-[#22C55E] hover:bg-[#16A34A] text-[#101512] px-5 py-3 rounded-xl text-xs font-black transition shadow-lg shadow-[#22C55E]/20"
          >
            <Receipt className="w-4 h-4" />
            <span>Open Fast Billing (POS)</span>
          </Link>

          <Link
            href="/shopkeeper/inventory"
            className="flex items-center gap-2 bg-[#1B241F] hover:bg-[#232E27] text-[#34D399] border border-[#303D34] hover:border-[#34D399]/40 px-4 py-3 rounded-xl text-xs font-bold transition"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Manage Products</span>
          </Link>

          <Link
            href={`/shops/${shop.id}`}
            target="_blank"
            className="flex items-center gap-1.5 bg-[#1B241F] hover:bg-[#232E27] text-[#A1ADA5] hover:text-[#F5F7F5] px-3.5 py-3 rounded-xl text-xs font-medium border border-[#303D34] transition"
          >
            <span>Public View</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Real Statistics derived from DB */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-[#151C18] p-5 rounded-2xl border border-[#303D34] shadow-md space-y-2">
          <div className="flex items-center justify-between text-[#A1ADA5] text-xs font-semibold">
            <span>Total Listed Items</span>
            <Package className="w-4 h-4 text-[#34D399]" />
          </div>
          <div className="text-3xl font-extrabold text-[#F5F7F5] tracking-tight">{totalListings}</div>
          <p className="text-[11px] text-[#A1ADA5]">Active product listings in database</p>
        </div>

        <div className="bg-[#151C18] p-5 rounded-2xl border border-[#303D34] shadow-md space-y-2">
          <div className="flex items-center justify-between text-[#A1ADA5] text-xs font-semibold">
            <span>Low Stock Items (&le; 5)</span>
            <AlertTriangle className="w-4 h-4 text-[#F59E0B]" />
          </div>
          <div className="text-3xl font-extrabold text-[#F59E0B] tracking-tight">{lowStockCount}</div>
          <p className="text-[11px] text-[#A1ADA5]">Needs inventory re-order</p>
        </div>

        <div className="bg-[#151C18] p-5 rounded-2xl border border-[#303D34] shadow-md space-y-2">
          <div className="flex items-center justify-between text-[#A1ADA5] text-xs font-semibold">
            <span>Out of Stock (0 units)</span>
            <AlertTriangle className="w-4 h-4 text-[#EF4444]" />
          </div>
          <div className="text-3xl font-extrabold text-[#EF4444] tracking-tight">{outOfStockCount}</div>
          <p className="text-[11px] text-[#A1ADA5]">Hidden from in-stock searches</p>
        </div>

        <div className="bg-[#151C18] p-5 rounded-2xl border border-[#303D34] shadow-md space-y-2">
          <div className="flex items-center justify-between text-[#A1ADA5] text-xs font-semibold">
            <span>Total Recorded Sales</span>
            <DollarSign className="w-4 h-4 text-[#22C55E]" />
          </div>
          <div className="text-2xl font-extrabold text-[#34D399] tracking-tight">{formatCurrency(totalRevenue)}</div>
          <p className="text-[11px] text-[#A1ADA5]">Across {totalInvoicesIssued} finalized invoices</p>
        </div>
      </div>

      {/* Two Column Layout: Recent Sales & Low Stock Warnings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Invoices */}
        <div className="bg-[#151C18] p-6 rounded-3xl border border-[#303D34] shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-[#303D34] pb-3">
            <h2 className="text-base font-bold text-[#F5F7F5] flex items-center gap-2">
              <Receipt className="w-4 h-4 text-[#22C55E]" />
              <span>Recent Finalized Invoices</span>
            </h2>
            <Link
              href="/shopkeeper/history"
              className="text-xs font-bold text-[#34D399] hover:underline"
            >
              View All &rarr;
            </Link>
          </div>

          {invoices.length === 0 ? (
            <div className="p-8 text-center text-[#A1ADA5] text-xs">
              No bills recorded yet. Open Fast Billing to record your first sale.
            </div>
          ) : (
            <div className="divide-y divide-[#303D34]">
              {invoices.slice(0, 5).map(inv => (
                <div key={inv.id} className="py-3 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-[#F5F7F5] block font-mono">{inv.invoice_number}</span>
                    <span className="text-[#A1ADA5] text-[11px]">
                      {inv.customer_name ? `Customer: ${inv.customer_name}` : 'Walk-in'} • {formatTimeAgo(inv.created_at)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-[#F5F7F5] block text-sm">
                      {formatCurrency(inv.final_total)}
                    </span>
                    <span className="text-[10px] text-[#34D399] font-semibold">Stock Decremented</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Low Stock Alert List */}
        <div className="bg-[#151C18] p-6 rounded-3xl border border-[#303D34] shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-[#303D34] pb-3">
            <h2 className="text-base font-bold text-[#F5F7F5] flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#F59E0B]" />
              <span>Critical Inventory Alerts</span>
            </h2>
            <Link
              href="/shopkeeper/inventory"
              className="text-xs font-bold text-[#34D399] hover:underline"
            >
              Update Stock &rarr;
            </Link>
          </div>

          {products.filter(p => p.stock_quantity <= 5).length === 0 ? (
            <div className="p-8 text-center text-[#A1ADA5] text-xs flex flex-col items-center gap-2">
              <CheckCircle2 className="w-8 h-8 text-[#22C55E]" />
              <span>All active inventory items have healthy stock levels (&gt; 5 units).</span>
            </div>
          ) : (
            <div className="divide-y divide-[#303D34]">
              {products
                .filter(p => p.stock_quantity <= 5)
                .slice(0, 5)
                .map(prod => (
                  <div key={prod.id} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-[#F5F7F5] block">{prod.name}</span>
                      <span className="text-[#A1ADA5] text-[11px]">{prod.category} • SKU: {prod.sku || 'N/A'}</span>
                    </div>
                    <div className="text-right">
                      <span className={`font-bold block text-sm ${prod.stock_quantity === 0 ? 'text-[#EF4444]' : 'text-[#F59E0B]'}`}>
                        {prod.stock_quantity} left
                      </span>
                      <span className="text-[10px] text-[#A1ADA5]">
                        {prod.stock_quantity === 0 ? 'Out of stock' : 'Low stock'}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
