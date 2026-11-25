'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  History, 
  Receipt, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Printer, 
  Calendar,
  CheckCircle2,
  X,
  Store,
  ArrowRight
} from 'lucide-react';
import { getShopsByOwner, getInvoicesByShop, getStockMovementsByShop } from '@/lib/db';
import { isSupabaseConfigured } from '@/lib/supabaseClient';
import { Shop, Invoice, StockMovement } from '@/types';
import { formatCurrency, formatTimeAgo } from '@/lib/utils';
import { useUser } from '@/context/UserContext';

export default function ShopkeeperHistoryPage() {
  const { profile } = useUser();
  const [shop, setShop] = useState<Shop | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [activeTab, setActiveTab] = useState<'invoices' | 'movements'>('invoices');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadHistory() {
      if (!isSupabaseConfigured || !profile?.id) {
        setLoading(false);
        setShop(null);
        setInvoices([]);
        setMovements([]);
        return;
      }
      setLoading(true);
      try {
        const ownerShops = await getShopsByOwner(profile.id);
        if (ownerShops.length > 0) {
          const s = ownerShops[0];
          setShop(s);
          const [invList, movList] = await Promise.all([
            getInvoicesByShop(s.id),
            getStockMovementsByShop(s.id),
          ]);
          setInvoices(invList);
          setMovements(movList);
        } else {
          setShop(null);
          setInvoices([]);
          setMovements([]);
        }
      } catch (err) {
        console.error('Error loading history:', err);
      } finally {
        setLoading(false);
      }
    }
    loadHistory();
  }, [profile]);

  if (!isSupabaseConfigured) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-[#1B241F] border border-[#303D34] text-[#F59E0B] flex items-center justify-center mx-auto shadow-xl">
          <History className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-[#F5F7F5]">Sales History Offline</h2>
          <p className="text-xs text-[#A1ADA5] max-w-md mx-auto leading-relaxed">
            Sales history is currently unavailable. Please verify your connection or sign in again.
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
          <History className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-[#F5F7F5]">Merchant Sign-In Required</h2>
          <p className="text-xs text-[#A1ADA5] max-w-md mx-auto leading-relaxed">
            Please sign in to your merchant account to access sales transactions and stock audit logs.
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

  if (!shop) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-[#1B241F] border border-[#303D34] text-[#22C55E] flex items-center justify-center mx-auto shadow-xl">
          <Store className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-[#F5F7F5]">No Registered Shop Found</h2>
          <p className="text-xs text-[#A1ADA5] max-w-md mx-auto leading-relaxed">
            You must register a shop before viewing audit logs and invoices.
          </p>
        </div>
        <Link
          href="/shopkeeper/onboarding"
          className="inline-flex items-center gap-2 bg-[#22C55E] hover:bg-[#16A34A] text-[#101512] font-black px-6 py-3 rounded-xl transition shadow-lg shadow-[#22C55E]/20 text-xs sm:text-sm"
        >
          <span>Register a New Shop</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-[#F5F7F5] flex items-center gap-2">
          <History className="w-5 h-5 text-[#22C55E]" />
          <span>Sales & Stock Movement Audit Log</span>
        </h1>
        <p className="text-xs text-[#A1ADA5]">
          Auditable records of finalized bills, stock-ins, customer returns, and inventory adjustments.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[#303D34]">
        <button
          onClick={() => setActiveTab('invoices')}
          className={`flex items-center gap-2 pb-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition ${
            activeTab === 'invoices'
              ? 'border-[#22C55E] text-[#34D399]'
              : 'border-transparent text-[#A1ADA5] hover:text-[#F5F7F5]'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>Invoices & Sales ({invoices.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('movements')}
          className={`flex items-center gap-2 pb-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition ${
            activeTab === 'movements'
              ? 'border-[#22C55E] text-[#34D399]'
              : 'border-transparent text-[#A1ADA5] hover:text-[#F5F7F5]'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Stock Movement Audit ({movements.length})</span>
        </button>
      </div>

      {/* Tab 1: Invoices */}
      {activeTab === 'invoices' && (
        <div className="bg-[#151C18] rounded-3xl border border-[#303D34] shadow-xl overflow-hidden">
          {loading ? (
            <div className="p-16 text-center text-[#A1ADA5] text-xs">Loading sales invoices...</div>
          ) : invoices.length === 0 ? (
            <div className="p-12 text-center text-[#A1ADA5] text-xs">
              No bills recorded yet. Use Fast Billing to issue your first invoice.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#101512] border-b border-[#303D34] text-[#A1ADA5] font-semibold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Invoice #</th>
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Items Count</th>
                    <th className="py-3 px-4">Total Amount</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#303D34] font-medium text-[#F5F7F5]">
                  {invoices.map(inv => (
                    <tr key={inv.id} className="hover:bg-[#1B241F] transition">
                      <td className="py-3.5 px-4 font-mono font-bold text-[#F5F7F5]">
                        {inv.invoice_number}
                      </td>
                      <td className="py-3.5 px-4 text-[#A1ADA5]">
                        {new Date(inv.created_at).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4">
                        {inv.customer_name ? (
                          <div>
                            <span className="font-semibold block">{inv.customer_name}</span>
                            <span className="text-[11px] text-[#A1ADA5]">{inv.customer_phone || ''}</span>
                          </div>
                        ) : (
                          <span className="text-[#A1ADA5] italic">Walk-in</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-[#A1ADA5]">
                        {inv.items?.length || 1} line items
                      </td>
                      <td className="py-3.5 px-4 font-extrabold text-[#34D399] text-sm">
                        {formatCurrency(inv.final_total)}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => setSelectedInvoice(inv)}
                          className="px-3 py-1.5 rounded-lg bg-[#232E27] text-[#34D399] hover:bg-[#1B241F] border border-[#303D34] hover:border-[#34D399]/40 transition font-bold"
                        >
                          View Receipt
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Stock Movements Audit Log */}
      {activeTab === 'movements' && (
        <div className="bg-[#151C18] rounded-3xl border border-[#303D34] shadow-xl overflow-hidden">
          {loading ? (
            <div className="p-16 text-center text-[#A1ADA5] text-xs">Loading movements...</div>
          ) : movements.length === 0 ? (
            <div className="p-12 text-center text-[#A1ADA5] text-xs">
              No stock movements recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#101512] border-b border-[#303D34] text-[#A1ADA5] font-semibold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Product Name</th>
                    <th className="py-3 px-4">Change Amount</th>
                    <th className="py-3 px-4">Stock After</th>
                    <th className="py-3 px-4">Reason</th>
                    <th className="py-3 px-4">Audit Reference</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#303D34] font-medium text-[#F5F7F5]">
                  {movements.map(mov => (
                    <tr key={mov.id} className="hover:bg-[#1B241F] transition">
                      <td className="py-3.5 px-4 text-[#A1ADA5] font-mono text-[11px]">
                        {new Date(mov.created_at).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-[#F5F7F5]">
                        {mov.product_name || 'Item'}
                      </td>
                      <td className="py-3.5 px-4">
                        {mov.change_amount < 0 ? (
                          <span className="font-bold text-[#EF4444] flex items-center gap-1">
                            <ArrowDownLeft className="w-3.5 h-3.5" />
                            <span>{mov.change_amount}</span>
                          </span>
                        ) : (
                          <span className="font-bold text-[#34D399] flex items-center gap-1">
                            <ArrowUpRight className="w-3.5 h-3.5" />
                            <span>+{mov.change_amount}</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-[#F5F7F5]">
                        {mov.quantity_after} units
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#1B241F] text-[#34D399] border border-[#303D34]">
                          {mov.reason}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-[#A1ADA5] text-[11px]">
                        {mov.notes || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Invoice Details Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 bg-[#101512]/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#151C18] rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-[#303D34] space-y-5 animate-scale-up text-xs">
            <div className="border-b border-[#303D34] pb-3 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-[#F5F7F5] text-lg">LocoStock Tax Invoice</h3>
                <span className="text-xs text-[#34D399] font-mono font-bold">{selectedInvoice.invoice_number}</span>
              </div>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="text-[#A1ADA5] hover:text-[#F5F7F5] p-1 bg-[#1B241F] rounded-lg border border-[#303D34]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1 text-[#A1ADA5] text-xs">
              <div><strong className="text-[#F5F7F5]">Store:</strong> {shop?.name}</div>
              <div><strong className="text-[#F5F7F5]">Date:</strong> {new Date(selectedInvoice.created_at).toLocaleString()}</div>
              <div><strong className="text-[#F5F7F5]">Customer:</strong> {selectedInvoice.customer_name || 'Walk-in'} ({selectedInvoice.customer_phone || 'N/A'})</div>
            </div>

            <div className="border rounded-2xl border-[#303D34] overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-[#101512] border-b border-[#303D34] font-semibold text-[#A1ADA5]">
                  <tr>
                    <th className="py-2.5 px-3">Item</th>
                    <th className="py-2.5 px-3">Qty</th>
                    <th className="py-2.5 px-3">Price</th>
                    <th className="py-2.5 px-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#303D34] font-medium text-[#F5F7F5]">
                  {selectedInvoice.items?.map(it => (
                    <tr key={it.id}>
                      <td className="py-2.5 px-3">{it.product_name}</td>
                      <td className="py-2.5 px-3">{it.quantity}</td>
                      <td className="py-2.5 px-3">{formatCurrency(it.unit_price)}</td>
                      <td className="py-2.5 px-3 text-right font-extrabold text-[#34D399]">{formatCurrency(it.line_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-1.5 text-xs text-right text-[#A1ADA5] border-t border-[#303D34] pt-3">
              <div>Subtotal: <strong className="text-[#F5F7F5]">{formatCurrency(selectedInvoice.subtotal)}</strong></div>
              <div>Tax (GST): <strong className="text-[#F5F7F5]">{formatCurrency(selectedInvoice.tax)}</strong></div>
              <div>Discount: <strong className="text-[#EF4444]">-{formatCurrency(selectedInvoice.discount)}</strong></div>
              <div className="text-base font-extrabold text-[#34D399] pt-1">
                Final Total: {formatCurrency(selectedInvoice.final_total)}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-[#22C55E] hover:bg-[#16A34A] text-[#101512] rounded-xl text-xs font-black flex items-center gap-1.5 shadow-lg shadow-[#22C55E]/20"
              >
                <Printer className="w-4 h-4" />
                <span>Print Receipt</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
