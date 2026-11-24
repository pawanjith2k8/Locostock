'use client';

import React, { useState, useEffect } from 'react';
import { 
  Receipt, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Printer, 
  Search, 
  ShoppingBag,
  ArrowRight,
  Barcode
} from 'lucide-react';
import { getShopsByOwner, getProductsByShop, finalizeBill } from '@/lib/db';
import { isSupabaseConfigured } from '@/lib/supabaseClient';
import { Shop, Product, Invoice } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { useUser } from '@/context/UserContext';
import Link from 'next/link';

interface CartItem {
  product: Product;
  quantity: number;
}

export default function ShopkeeperBillingPage() {
  const { profile } = useUser();
  const [shop, setShop] = useState<Shop | null>(null);
  const [inventory, setInventory] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [productSearch, setProductSearch] = useState('');

  // Customer info
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [taxPercent, setTaxPercent] = useState<number>(0);
  const [discountAmount, setDiscountAmount] = useState<number>(0);

  // States
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [finalizedInvoice, setFinalizedInvoice] = useState<{
    invoice_number: string;
    final_total: number;
  } | null>(null);

  // Load shop & authorized inventory
  useEffect(() => {
    async function loadShopAndInventory() {
      if (!isSupabaseConfigured || !profile?.id) {
        setShop(null);
        setInventory([]);
        return;
      }
      const ownerShops = await getShopsByOwner(profile.id);
      if (ownerShops.length > 0) {
        const s = ownerShops[0];
        setShop(s);
        const prods = await getProductsByShop(s.id);
        setInventory(prods);
      }
    }
    loadShopAndInventory();
  }, [profile]);

  // Add product to bill
  const addToCart = (product: Product) => {
    setErrorMsg(null);
    if (product.stock_quantity <= 0) {
      setErrorMsg(`Cannot add "${product.name}" — product has 0 recorded stock.`);
      return;
    }

    const existingIndex = cart.findIndex(item => item.product.id === product.id);
    if (existingIndex >= 0) {
      const existing = cart[existingIndex];
      if (existing.quantity + 1 > product.stock_quantity) {
        setErrorMsg(`Cannot exceed available stock of ${product.stock_quantity} units.`);
        return;
      }
      const updated = [...cart];
      updated[existingIndex] = { ...existing, quantity: existing.quantity + 1 };
      setCart(updated);
    } else {
      setCart([...cart, { product, quantity: 1 }]);
    }
  };

  // Modify quantity
  const updateQuantity = (productId: string, qty: number) => {
    setErrorMsg(null);
    const item = cart.find(c => c.product.id === productId);
    if (!item) return;

    if (qty <= 0) {
      setCart(cart.filter(c => c.product.id !== productId));
      return;
    }

    if (qty > item.product.stock_quantity) {
      setErrorMsg(`Only ${item.product.stock_quantity} units available in inventory.`);
      return;
    }

    setCart(cart.map(c => (c.product.id === productId ? { ...c, quantity: qty } : c)));
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(c => c.product.id !== productId));
  };

  // Subtotals and totals
  const subtotal = cart.reduce((acc, item) => acc + item.product.price * item.quantity, 0);
  const tax = (subtotal * taxPercent) / 100;
  const finalTotal = Math.max(0, subtotal + tax - discountAmount);

  // Submit Bill
  const handleFinalizeBill = async () => {
    if (!shop) return;
    if (cart.length === 0) {
      setErrorMsg('Please add at least one product to generate a bill.');
      return;
    }

    if (!profile?.id) {
      setErrorMsg('Authenticated merchant session required to issue bills.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    // Generate unique idempotency key to prevent double submissions
    const idempotencyKey = `sale_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    try {
      const result = await finalizeBill({
        shop_id: shop.id,
        user_id: profile.id,
        customer_name: customerName.trim() || undefined,
        customer_phone: customerPhone.trim() || undefined,
        subtotal,
        tax,
        discount: discountAmount,
        final_total: finalTotal,
        idempotency_key: idempotencyKey,
        items: cart.map(item => ({
          product_id: item.product.id,
          quantity: item.quantity,
          unit_price: item.product.price,
        })),
      });

      if (result.success) {
        setFinalizedInvoice({
          invoice_number: result.invoice_number,
          final_total: finalTotal,
        });

        // Reset cart & refresh inventory to show updated stock
        setCart([]);
        setCustomerName('');
        setCustomerPhone('');
        const freshProds = await getProductsByShop(shop.id);
        setInventory(freshProds);
      }
    } catch (err: any) {
      console.error('Billing failed:', err);
      setErrorMsg(err.message || 'Billing transaction failed.');
    } finally {
      setSubmitting(false);
    }
  };

  // Filter shopkeeper's own inventory for fast barcode / search lookup
  const filteredInventory = inventory.filter(p => {
    if (!p.is_active) return false;
    if (productSearch) {
      const q = productSearch.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        (p.sku || '').toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    }
    return true;
  });

  if (!isSupabaseConfigured) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-[#1B241F] border border-[#303D34] text-[#F59E0B] flex items-center justify-center mx-auto shadow-xl">
          <Receipt className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-[#F5F7F5]">Supabase Service Not Configured</h2>
          <p className="text-xs text-[#A1ADA5] max-w-md mx-auto leading-relaxed">
            The POS billing terminal requires active Supabase credentials to execute atomic inventory transactions. Please configure your credentials in <code className="text-[#34D399] bg-[#101512] px-1.5 py-0.5 rounded">.env.local</code>.
          </p>
        </div>
        <Link
          href="/shopkeeper/login"
          className="inline-flex items-center gap-2 bg-[#232E27] hover:bg-[#303D34] text-[#F5F7F5] font-bold px-6 py-3 rounded-xl transition border border-[#303D34] text-xs sm:text-sm"
        >
          <span>View Auth Setup</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-[#1B241F] border border-[#303D34] text-[#34D399] flex items-center justify-center mx-auto shadow-xl">
          <Receipt className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-[#F5F7F5]">Merchant Sign-In Required</h2>
          <p className="text-xs text-[#A1ADA5] max-w-md mx-auto leading-relaxed">
            Please sign in to your merchant account to access the Point-of-Sale billing terminal.
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
          <Receipt className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-[#F5F7F5]">No Registered Shop Found</h2>
          <p className="text-xs text-[#A1ADA5] max-w-md mx-auto leading-relaxed">
            You must register a shop before issuing electronic bills and managing inventory.
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
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#F5F7F5] flex items-center gap-2">
            <Receipt className="w-5 h-5 text-[#22C55E]" />
            <span>Fast Billing Point-of-Sale (POS)</span>
          </h1>
          <p className="text-xs text-[#A1ADA5]">
            Finalized bills immediately deduct stock atomically and update customer discovery in real-time.
          </p>
        </div>

        {shop && (
          <div className="text-xs font-bold bg-[#132B1C] text-[#34D399] px-3.5 py-1.5 rounded-full border border-[#245836] self-start sm:self-auto">
            Terminal: {shop.name}
          </div>
        )}
      </div>

      {/* Invoice Success Modal / Banner */}
      {finalizedInvoice && (
        <div className="bg-[#132B1C] border border-[#245836] rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 text-[#F5F7F5] shadow-xl animate-fade-in">
          <div className="space-y-1">
            <div className="flex items-center gap-2 font-bold text-base text-[#34D399]">
              <CheckCircle2 className="w-5 h-5 text-[#22C55E]" />
              <span>Bill Finalized & Inventory Updated Successfully!</span>
            </div>
            <p className="text-xs text-[#A1ADA5]">
              Invoice #{finalizedInvoice.invoice_number} recorded. Available stock for billed items has been decremented across the platform.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => window.print()}
              className="px-4 py-2 bg-[#22C55E] hover:bg-[#16A34A] text-[#101512] rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow-lg shadow-[#22C55E]/20"
            >
              <Printer className="w-4 h-4" />
              <span>Print Invoice</span>
            </button>
            <button
              onClick={() => setFinalizedInvoice(null)}
              className="px-4 py-2 bg-[#1B241F] text-[#F5F7F5] border border-[#303D34] rounded-xl text-xs font-bold hover:bg-[#232E27] transition"
            >
              New Bill
            </button>
          </div>
        </div>
      )}

      {/* Error alert */}
      {errorMsg && (
        <div className="bg-[#2D1515] border border-[#5C2424] rounded-2xl p-4 flex items-center gap-3 text-[#EF4444] text-xs font-semibold">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 2-Column POS Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Authorized Inventory Selector (7 cols) */}
        <div className="lg:col-span-7 bg-[#151C18] rounded-3xl border border-[#303D34] p-6 space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#303D34] pb-3">
            <h2 className="text-sm font-bold text-[#F5F7F5] flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-[#22C55E]" />
              <span>Select Product from Your Store</span>
            </h2>

            {/* Product lookup / barcode search */}
            <div className="relative">
              <Search className="w-4 h-4 text-[#A1ADA5] absolute left-3 top-2.5" />
              <input
                type="text"
                value={productSearch}
                onChange={e => setProductSearch(e.target.value)}
                placeholder="Search name, barcode / SKU..."
                className="pl-9 pr-3 py-1.5 bg-[#1B241F] border border-[#303D34] rounded-xl text-xs font-medium text-[#F5F7F5] placeholder-[#A1ADA5]/60 outline-none focus:border-[#34D399] w-full sm:w-60"
              />
            </div>
          </div>

          {/* Product Items List */}
          <div className="max-h-[500px] overflow-y-auto space-y-2 pr-1 divide-y divide-[#303D34]">
            {filteredInventory.length === 0 ? (
              <div className="p-8 text-center text-[#A1ADA5] text-xs">
                No matching products found in your inventory.
              </div>
            ) : (
              filteredInventory.map(prod => {
                const inCart = cart.find(c => c.product.id === prod.id);
                const isOutOfStock = prod.stock_quantity <= 0;

                return (
                  <div
                    key={prod.id}
                    className="pt-2 pb-2 flex items-center justify-between gap-4 text-xs hover:bg-[#1B241F] p-2.5 rounded-2xl transition"
                  >
                    <div className="space-y-0.5">
                      <div className="font-bold text-[#F5F7F5] text-sm">{prod.name}</div>
                      <div className="text-[#A1ADA5] flex items-center gap-2 text-[11px]">
                        <span>{prod.category}</span>
                        {prod.sku && <span>• SKU: {prod.sku}</span>}
                        <span>• Price: <strong className="text-[#34D399]">{formatCurrency(prod.price)}</strong></span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <span className={`font-bold block text-xs ${isOutOfStock ? 'text-[#EF4444]' : 'text-[#34D399]'}`}>
                          {prod.stock_quantity} in stock
                        </span>
                        {inCart && (
                          <span className="text-[10px] text-[#A1ADA5] font-semibold">
                            ({inCart.quantity} in cart)
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => addToCart(prod)}
                        disabled={isOutOfStock}
                        className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1 transition text-xs ${
                          isOutOfStock
                            ? 'bg-[#1B241F] text-[#A1ADA5]/40 border border-[#303D34] cursor-not-allowed'
                            : 'bg-[#22C55E] hover:bg-[#16A34A] text-[#101512] shadow'
                        }`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Active Bill / Invoice Summary (5 cols) */}
        <div className="lg:col-span-5 bg-[#151C18] rounded-3xl border border-[#303D34] p-6 space-y-5 shadow-xl flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-[#303D34] pb-3">
              <h2 className="text-sm font-bold text-[#F5F7F5] flex items-center gap-2">
                <Receipt className="w-4 h-4 text-[#22C55E]" />
                <span>Invoice Cart ({cart.length})</span>
              </h2>
              {cart.length > 0 && (
                <button
                  onClick={() => setCart([])}
                  className="text-xs text-[#EF4444] hover:underline font-semibold"
                >
                  Clear Cart
                </button>
              )}
            </div>

            {/* Customer Details (Optional) */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="text-[#A1ADA5] font-semibold block mb-1">Customer Name</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  placeholder="e.g. Ramesh"
                  className="w-full px-2.5 py-1.5 bg-[#1B241F] border border-[#303D34] rounded-xl text-[#F5F7F5] outline-none focus:border-[#34D399]"
                />
              </div>
              <div>
                <label className="text-[#A1ADA5] font-semibold block mb-1">Phone Number</label>
                <input
                  type="text"
                  value={customerPhone}
                  onChange={e => setCustomerPhone(e.target.value)}
                  placeholder="e.g. 9876543210"
                  className="w-full px-2.5 py-1.5 bg-[#1B241F] border border-[#303D34] rounded-xl text-[#F5F7F5] outline-none focus:border-[#34D399]"
                />
              </div>
            </div>

            {/* Line items in Cart */}
            <div className="max-h-[260px] overflow-y-auto space-y-2 divide-y divide-[#303D34]">
              {cart.length === 0 ? (
                <div className="p-8 text-center text-[#A1ADA5] text-xs">
                  No products added yet. Click &ldquo;Add&rdquo; on items from the left to include them in this bill.
                </div>
              ) : (
                cart.map(item => (
                  <div key={item.product.id} className="pt-2 flex items-center justify-between gap-2 text-xs">
                    <div className="space-y-0.5 max-w-[160px]">
                      <div className="font-bold text-[#F5F7F5] line-clamp-1">{item.product.name}</div>
                      <div className="text-[#A1ADA5] text-[11px]">
                        {formatCurrency(item.product.price)} each
                      </div>
                    </div>

                    {/* Quantity controls */}
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                        className="w-6 h-6 rounded-lg bg-[#1B241F] hover:bg-[#232E27] border border-[#303D34] flex items-center justify-center font-bold text-[#F5F7F5]"
                      >
                        -
                      </button>
                      <span className="w-7 text-center font-bold text-[#F5F7F5]">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                        className="w-6 h-6 rounded-lg bg-[#1B241F] hover:bg-[#232E27] border border-[#303D34] flex items-center justify-center font-bold text-[#F5F7F5]"
                      >
                        +
                      </button>
                      <button
                        onClick={() => removeFromCart(item.product.id)}
                        className="text-[#A1ADA5] hover:text-[#EF4444] ml-1 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="text-right font-extrabold text-[#F5F7F5]">
                      {formatCurrency(item.product.price * item.quantity)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Totals & Confirm Sale Button */}
          <div className="space-y-3 pt-3 border-t border-[#303D34] text-xs">
            <div className="flex justify-between text-[#A1ADA5]">
              <span>Subtotal:</span>
              <span className="font-bold text-[#F5F7F5]">{formatCurrency(subtotal)}</span>
            </div>

            <div className="flex justify-between items-center text-[#A1ADA5]">
              <span>Tax (GST %):</span>
              <input
                type="number"
                min="0"
                max="100"
                value={taxPercent}
                onChange={e => setTaxPercent(Number(e.target.value))}
                className="w-16 px-2 py-0.5 text-right bg-[#1B241F] border border-[#303D34] rounded-lg text-xs text-[#F5F7F5] outline-none focus:border-[#34D399]"
              />
            </div>

            <div className="flex justify-between items-center text-[#A1ADA5]">
              <span>Discount (₹):</span>
              <input
                type="number"
                min="0"
                value={discountAmount}
                onChange={e => setDiscountAmount(Number(e.target.value))}
                className="w-20 px-2 py-0.5 text-right bg-[#1B241F] border border-[#303D34] rounded-lg text-xs text-[#F5F7F5] outline-none focus:border-[#34D399]"
              />
            </div>

            <div className="flex justify-between text-sm font-extrabold text-[#F5F7F5] pt-2 border-t border-[#303D34]">
              <span>Final Total:</span>
              <span className="text-[#34D399] text-base">{formatCurrency(finalTotal)}</span>
            </div>

            <button
              onClick={handleFinalizeBill}
              disabled={submitting || cart.length === 0}
              className={`w-full py-3.5 rounded-xl text-xs font-black transition flex items-center justify-center gap-2 shadow-xl ${
                submitting || cart.length === 0
                  ? 'bg-[#1B241F] text-[#A1ADA5]/40 border border-[#303D34] cursor-not-allowed'
                  : 'bg-[#22C55E] hover:bg-[#16A34A] text-[#101512] shadow-[#22C55E]/20'
              }`}
            >
              {submitting ? (
                <span>Deducting Stock & Generating Invoice...</span>
              ) : (
                <>
                  <span>Finalize Bill & Deduct Stock</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
