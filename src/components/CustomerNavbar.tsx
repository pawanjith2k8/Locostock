'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUser } from '@/context/UserContext';
import { 
  Store, 
  Search, 
  MapPin, 
  ShoppingBag, 
  ArrowRightLeft,
  Clock
} from 'lucide-react';

export default function CustomerNavbar() {
  const pathname = usePathname();
  const { customerArea, setCustomerArea, switchRole } = useUser();
  const [navAreaInput, setNavAreaInput] = React.useState(customerArea || '');

  React.useEffect(() => {
    setNavAreaInput(customerArea || '');
  }, [customerArea]);

  const handleNavAreaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCustomerArea(navAreaInput);
  };

  return (
    <header className="sticky top-0 z-50 bg-[#101512]/95 backdrop-blur-md border-b border-[#303D34]">
      {/* Top micro bar with App Switcher & Status */}
      <div className="bg-[#151C18] text-[#F5F7F5] px-4 py-1.5 text-xs flex flex-wrap items-center justify-between gap-2 border-b border-[#303D34]/70">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-[#22C55E] shadow-[0_0_8px_rgba(34,197,94,0.8)] animate-pulse"></span>
          <span className="font-bold tracking-wider text-[#F5F7F5] uppercase text-[10px]">LOCOSTOCK CUSTOMER APP</span>
          <span className="text-[#303D34]">|</span>
          <span className="text-[#34D399] font-medium hidden sm:inline text-[11px]">Local Products. Real Shops.</span>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/shopkeeper"
            onClick={() => switchRole('shopkeeper')}
            className="flex items-center gap-1.5 bg-[#232E27] hover:bg-[#1B241F] text-[#34D399] border border-[#303D34] hover:border-[#34D399]/50 px-2.5 py-0.5 rounded-lg transition-all text-xs font-semibold shadow-sm"
          >
            <ArrowRightLeft className="w-3.5 h-3.5 text-[#22C55E]" />
            <span>Shopkeeper Portal</span>
          </Link>
        </div>
      </div>

      {/* Main Nav Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16 gap-3">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#22C55E] to-[#15803D] flex items-center justify-center text-[#101512] font-black shadow-md shadow-[#22C55E]/15 group-hover:scale-105 transition-transform">
              <ShoppingBag className="w-5 h-5 text-[#101512]" />
            </div>
            <div>
              <span className="text-lg sm:text-xl font-extrabold tracking-tight text-[#F5F7F5]">
                Loco<span className="text-[#34D399]">Stock</span>
              </span>
              <span className="hidden sm:block text-[10px] tracking-wide text-[#A1ADA5] font-medium -mt-0.5">
                Local Products. Real Shops.
              </span>
            </div>
          </Link>

          {/* Manual Area Search Input Pill */}
          <div className="hidden lg:flex items-center gap-2 bg-[#1B241F] hover:bg-[#232E27] px-3 py-1.5 rounded-full border border-[#303D34] text-xs transition">
            <MapPin className="w-3.5 h-3.5 text-[#22C55E] shrink-0" />
            <form onSubmit={handleNavAreaSubmit} className="flex items-center gap-1.5">
              <span className="text-[#A1ADA5] text-[11px] font-medium">Area:</span>
              <input
                type="text"
                value={navAreaInput}
                onChange={e => setNavAreaInput(e.target.value)}
                placeholder="Enter area (e.g. Tambaram)..."
                className="bg-transparent font-medium text-[#F5F7F5] outline-none text-xs w-44 placeholder-[#A1ADA5]/60"
              />
              {navAreaInput.trim() !== customerArea && (
                <button
                  type="submit"
                  className="text-[10px] bg-[#22C55E] text-[#101512] font-bold px-2 py-0.5 rounded hover:bg-[#16A34A] transition"
                >
                  Set
                </button>
              )}
            </form>
            {customerArea && (
              <button
                type="button"
                onClick={() => {
                  setNavAreaInput('');
                  setCustomerArea('');
                }}
                title="Clear area filter"
                className="text-[#A1ADA5] hover:text-[#F5F7F5] text-xs px-1"
              >
                ×
              </button>
            )}
          </div>

          {/* Navigation Links */}
          <nav className="flex items-center gap-1 sm:gap-2">
            <Link
              href="/search"
              className={`flex items-center gap-1.5 px-3 py-1.5 sm:py-2 rounded-xl text-xs font-semibold transition ${
                pathname === '/search'
                  ? 'bg-[#232E27] text-[#34D399] border border-[#303D34]'
                  : 'text-[#A1ADA5] hover:text-[#F5F7F5] hover:bg-[#1B241F]'
              }`}
            >
              <Search className="w-3.5 h-3.5 text-[#22C55E]" />
              <span className="hidden sm:inline">Search Products</span>
            </Link>

            <Link
              href="/shops"
              className={`flex items-center gap-1.5 px-3 py-1.5 sm:py-2 rounded-xl text-xs font-semibold transition ${
                pathname === '/shops'
                  ? 'bg-[#232E27] text-[#34D399] border border-[#303D34]'
                  : 'text-[#A1ADA5] hover:text-[#F5F7F5] hover:bg-[#1B241F]'
              }`}
            >
              <Store className="w-3.5 h-3.5 text-[#22C55E]" />
              <span className="hidden sm:inline">Browse Shops</span>
            </Link>

            <Link
              href="/history"
              className={`flex items-center gap-1.5 px-3 py-1.5 sm:py-2 rounded-xl text-xs font-semibold transition ${
                pathname === '/history'
                  ? 'bg-[#232E27] text-[#34D399] border border-[#303D34]'
                  : 'text-[#A1ADA5] hover:text-[#F5F7F5] hover:bg-[#1B241F]'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-[#A1ADA5]" />
              <span className="hidden sm:inline">History</span>
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
