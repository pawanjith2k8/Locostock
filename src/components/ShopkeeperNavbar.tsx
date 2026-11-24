'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUser } from '@/context/UserContext';
import { 
  Receipt, 
  Package, 
  Store, 
  History, 
  LayoutDashboard, 
  ArrowRightLeft,
  Building2,
  LogIn
} from 'lucide-react';

export default function ShopkeeperNavbar() {
  const pathname = usePathname();
  const { switchRole, profile } = useUser();

  return (
    <header className="sticky top-0 z-50 bg-[#101512] border-b border-[#303D34] text-[#F5F7F5] shadow-xl">
      {/* Top Bar with switch back to customer */}
      <div className="bg-[#151C18] px-4 py-1.5 text-xs flex flex-wrap items-center justify-between gap-2 border-b border-[#303D34]/70">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-[#22C55E] shadow-[0_0_8px_rgba(34,197,94,0.7)]"></span>
          <span className="font-semibold tracking-wider text-[#F5F7F5] uppercase text-[11px]">LOCOSTOCK SHOPKEEPER PORTAL</span>
          <span className="text-[#303D34]">|</span>
          <span className="text-[#A1ADA5] text-[11px] hidden sm:inline">Point-of-Sale, Inventory Synchronization & Audits</span>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/"
            onClick={() => switchRole('customer')}
            className="flex items-center gap-1.5 bg-[#232E27] hover:bg-[#1B241F] text-[#34D399] px-3 py-1 rounded-lg transition-all text-xs font-semibold border border-[#303D34] hover:border-[#34D399]/40"
          >
            <ArrowRightLeft className="w-3.5 h-3.5 text-[#22C55E]" />
            <span>Customer Discovery App</span>
          </Link>
        </div>
      </div>

      {/* Main Shopkeeper Navigation */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo & Portal title */}
          <Link href="/shopkeeper" className="flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-xl bg-[#232E27] border border-[#303D34] flex items-center justify-center text-[#22C55E] font-bold shadow-md shadow-[#22C55E]/10 group-hover:border-[#34D399]/50 transition-colors">
              <Store className="w-5 h-5 text-[#22C55E]" />
            </div>
            <div>
              <span className="text-lg font-extrabold text-[#F5F7F5] tracking-tight">
                Loco<span className="text-[#34D399]">Stock</span>
                <span className="text-[#34D399] font-bold text-[10px] ml-1.5 px-2 py-0.5 rounded-full bg-[#132B1C] border border-[#245836]">
                  MERCHANT
                </span>
              </span>
              <span className="block text-[10px] text-[#A1ADA5] font-medium -mt-0.5">
                Local Products. Real Shops.
              </span>
            </div>
          </Link>

          {/* Nav links */}
          <nav className="flex items-center gap-1 sm:gap-2">
            <Link
              href="/shopkeeper"
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition ${
                pathname === '/shopkeeper'
                  ? 'bg-[#232E27] text-[#34D399] border border-[#303D34]'
                  : 'text-[#A1ADA5] hover:text-[#F5F7F5] hover:bg-[#1B241F]'
              }`}
            >
              <LayoutDashboard className="w-4 h-4 text-[#22C55E]" />
              <span className="hidden sm:inline">Dashboard</span>
            </Link>

            <Link
              href="/shopkeeper/billing"
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-sm ${
                pathname === '/shopkeeper/billing'
                  ? 'bg-[#22C55E] text-[#101512] shadow-[#22C55E]/20'
                  : 'text-[#34D399] bg-[#132B1C] hover:bg-[#232E27] border border-[#245836]'
              }`}
            >
              <Receipt className="w-4 h-4" />
              <span>Fast Billing POS</span>
            </Link>

            <Link
              href="/shopkeeper/inventory"
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition ${
                pathname === '/shopkeeper/inventory'
                  ? 'bg-[#232E27] text-[#34D399] border border-[#303D34]'
                  : 'text-[#A1ADA5] hover:text-[#F5F7F5] hover:bg-[#1B241F]'
              }`}
            >
              <Package className="w-4 h-4 text-[#22C55E]" />
              <span className="hidden sm:inline">Inventory</span>
            </Link>

            <Link
              href="/shopkeeper/history"
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition ${
                pathname === '/shopkeeper/history'
                  ? 'bg-[#232E27] text-[#34D399] border border-[#303D34]'
                  : 'text-[#A1ADA5] hover:text-[#F5F7F5] hover:bg-[#1B241F]'
              }`}
            >
              <History className="w-4 h-4 text-[#22C55E]" />
              <span className="hidden md:inline">Sales & Audits</span>
            </Link>

            <Link
              href="/shopkeeper/shop"
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition ${
                pathname === '/shopkeeper/shop'
                  ? 'bg-[#232E27] text-[#34D399] border border-[#303D34]'
                  : 'text-[#A1ADA5] hover:text-[#F5F7F5] hover:bg-[#1B241F]'
              }`}
            >
              <Building2 className="w-4 h-4 text-[#22C55E]" />
              <span className="hidden md:inline">Store Profile</span>
            </Link>

            <Link
              href="/shopkeeper/login"
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition ${
                pathname === '/shopkeeper/login'
                  ? 'bg-[#232E27] text-[#34D399] border border-[#303D34]'
                  : 'text-[#A1ADA5] hover:text-[#F5F7F5] hover:bg-[#1B241F]'
              }`}
            >
              <LogIn className="w-4 h-4 text-[#A1ADA5]" />
              <span className="hidden lg:inline">Auth</span>
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
