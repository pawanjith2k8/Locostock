'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  History, 
  Search, 
  Trash2, 
  ArrowRight, 
  X, 
  ArrowLeft,
  Sparkles,
  ShoppingBag
} from 'lucide-react';
import { getRecentSearches, removeRecentSearch, clearRecentSearches, addRecentSearch } from '@/lib/searchHistory';

export default function SearchHistoryPage() {
  const router = useRouter();
  const [searches, setSearches] = useState<string[]>([]);

  useEffect(() => {
    setSearches(getRecentSearches());
  }, []);

  const handleSearchClick = (query: string) => {
    addRecentSearch(query);
    router.push(`/search?q=${encodeURIComponent(query)}`);
  };

  const handleRemove = (e: React.MouseEvent, query: string) => {
    e.stopPropagation();
    const updated = removeRecentSearch(query);
    setSearches(updated);
  };

  const handleClearAll = () => {
    clearRecentSearches();
    setSearches([]);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Back button */}
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#A1ADA5] hover:text-[#34D399] transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Discovery Home</span>
        </Link>
      </div>

      {/* Header Card */}
      <div className="bg-[#151C18] p-6 sm:p-8 rounded-3xl border border-[#303D34] shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#132B1C] text-[#34D399] text-xs font-bold border border-[#245836]">
            <History className="w-3.5 h-3.5" />
            <span>Search History</span>
          </div>
          <h1 className="text-2xl font-extrabold text-[#F5F7F5] tracking-tight">
            Recent Product Searches
          </h1>
          <p className="text-xs text-[#A1ADA5]">
            Quickly re-run previous searches across registered neighborhood stores. (Stored locally up to 10 queries)
          </p>
        </div>

        {searches.length > 0 && (
          <button
            onClick={handleClearAll}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#1B241F] hover:bg-[#2D1515] text-[#EF4444] border border-[#303D34] hover:border-[#5C2424] rounded-xl text-xs font-bold transition self-start sm:self-auto shadow-sm"
          >
            <Trash2 className="w-4 h-4" />
            <span>Clear All History</span>
          </button>
        )}
      </div>

      {/* History Items List */}
      {searches.length === 0 ? (
        <div className="bg-[#151C18] p-12 rounded-3xl border border-[#303D34] text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-[#1B241F] border border-[#303D34] text-[#A1ADA5] flex items-center justify-center mx-auto">
            <History className="w-8 h-8 text-[#A1ADA5]" />
          </div>
          <h3 className="text-lg font-bold text-[#F5F7F5]">No Recent Searches</h3>
          <p className="text-xs text-[#A1ADA5] max-w-sm mx-auto">
            Your recent search keywords will be saved here automatically for 1-tap re-queries.
          </p>
          <Link
            href="/search"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#22C55E] text-[#101512] rounded-xl text-xs font-black hover:bg-[#16A34A] transition shadow-lg shadow-[#22C55E]/20"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Start Searching Products</span>
          </Link>
        </div>
      ) : (
        <div className="bg-[#151C18] rounded-3xl border border-[#303D34] overflow-hidden shadow-xl divide-y divide-[#303D34]">
          {searches.map((q, idx) => (
            <div
              key={q}
              onClick={() => handleSearchClick(q)}
              className="p-4 sm:p-5 flex items-center justify-between hover:bg-[#1B241F] transition cursor-pointer group"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-9 h-9 rounded-xl bg-[#1B241F] border border-[#303D34] flex items-center justify-center text-[#34D399] group-hover:bg-[#22C55E] group-hover:text-[#101512] transition-colors">
                  <Search className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-sm text-[#F5F7F5] group-hover:text-[#34D399] transition-colors">
                    {q}
                  </span>
                  <span className="block text-[10px] text-[#A1ADA5]">
                    Click to search nearby shops
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={(e) => handleRemove(e, q)}
                  title="Remove this search"
                  className="p-2 text-[#A1ADA5] hover:text-[#EF4444] rounded-lg hover:bg-[#232E27] transition"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="w-8 h-8 rounded-lg bg-[#232E27] flex items-center justify-center text-[#A1ADA5] group-hover:text-[#34D399] transition-colors">
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
