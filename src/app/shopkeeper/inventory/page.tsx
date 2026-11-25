'use client';

import React, { useState, useEffect } from 'react';
import { 
  Package, 
  Plus, 
  Edit3, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  Layers, 
  Search,
  Filter,
  DollarSign,
  TrendingDown
} from 'lucide-react';
import { getShopsByOwner, getProductsByShop, saveProduct } from '@/lib/db';
import { isSupabaseConfigured } from '@/lib/supabaseClient';
import { Shop, Product } from '@/types';
import { formatCurrency, formatTimeAgo } from '@/lib/utils';
import { useUser } from '@/context/UserContext';
import Link from 'next/link';
import { ArrowRight, Store } from 'lucide-react';

export default function ShopkeeperInventoryPage() {
  const { profile } = useUser();
  const [shop, setShop] = useState<Shop | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [loading, setLoading] = useState(true);

  // Modal for Add / Edit
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  useEffect(() => {
    async function loadShopAndProducts() {
      if (!isSupabaseConfigured || !profile?.id) {
        setLoading(false);
        setShop(null);
        setProducts([]);
        return;
      }
      setLoading(true);
      try {
        const ownerShops = await getShopsByOwner(profile.id);
        if (ownerShops.length > 0) {
          const s = ownerShops[0];
          setShop(s);
          const p = await getProductsByShop(s.id);
          setProducts(p);
        } else {
          setShop(null);
          setProducts([]);
        }
      } catch (err) {
        console.error('Error loading inventory:', err);
      } finally {
        setLoading(false);
      }
    }
    loadShopAndProducts();
  }, [profile]);

  const handleOpenAdd = () => {
    setEditingProduct({
      name: '',
      description: '',
      category: 'Electronics & Hardware',
      brand: '',
      sku: '',
      price: 0,
      stock_quantity: 0,
      image_url: '',
      is_active: true,
    });
    setModalError(null);
    setShowModal(true);
  };

  const handleOpenEdit = (prod: Product) => {
    setEditingProduct({ ...prod });
    setModalError(null);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shop || !editingProduct) return;

    if (!editingProduct.name?.trim()) {
      setModalError('Product name is required');
      return;
    }
    if (editingProduct.price === undefined || editingProduct.price < 0) {
      setModalError('Valid non-negative price is required');
      return;
    }
    if (editingProduct.stock_quantity === undefined || editingProduct.stock_quantity < 0) {
      setModalError('Stock quantity cannot be negative');
      return;
    }

    setSaving(true);
    setModalError(null);

    try {
      await saveProduct({
        ...editingProduct,
        shop_id: shop.id,
        name: editingProduct.name.trim(),
        price: Number(editingProduct.price),
        stock_quantity: Math.floor(Number(editingProduct.stock_quantity)),
      } as any);

      // Refresh list
      const updated = await getProductsByShop(shop.id);
      setProducts(updated);
      setShowModal(false);
      setEditingProduct(null);
    } catch (err: any) {
      setModalError(err.message || 'Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  const filteredProducts = products.filter(p => {
    if (categoryFilter && p.category !== categoryFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        (p.brand || '').toLowerCase().includes(q) ||
        (p.sku || '').toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const categories = ['Electronics & Hardware', 'Stationery & Books', 'Groceries & Household', 'General Store'];

  if (!isSupabaseConfigured) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-[#1B241F] border border-[#303D34] text-[#F59E0B] flex items-center justify-center mx-auto shadow-xl">
          <Package className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-[#F5F7F5]">Inventory Service Offline</h2>
          <p className="text-xs text-[#A1ADA5] max-w-md mx-auto leading-relaxed">
            Inventory management is currently unable to reach the stock network. Please verify your connection or sign in again.
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
          <Package className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-[#F5F7F5]">Merchant Sign-In Required</h2>
          <p className="text-xs text-[#A1ADA5] max-w-md mx-auto leading-relaxed">
            Please sign in to your merchant account to manage your store inventory and product listings.
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
            You must register a shop before managing product inventory and prices.
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#F5F7F5] flex items-center gap-2">
            <Package className="w-5 h-5 text-[#22C55E]" />
            <span>Product & Inventory Management</span>
          </h1>
          <p className="text-xs text-[#A1ADA5]">
            Add products, update selling prices, and adjust stock quantities. Changes reflect instantly in Customer search.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-2 bg-[#22C55E] hover:bg-[#16A34A] text-[#101512] font-black px-4 py-2.5 rounded-xl text-xs transition shadow-lg shadow-[#22C55E]/20 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Product</span>
        </button>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-[#151C18] p-4 rounded-2xl border border-[#303D34] shadow-md flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full sm:max-w-md">
          <Search className="w-4 h-4 text-[#A1ADA5] absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search inventory by name, SKU, or brand..."
            className="w-full pl-9 pr-3 py-2 bg-[#1B241F] border border-[#303D34] rounded-xl text-xs font-medium text-[#F5F7F5] placeholder-[#A1ADA5]/60 outline-none focus:border-[#34D399]"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 bg-[#1B241F] border border-[#303D34] rounded-xl text-xs font-medium text-[#F5F7F5] outline-none focus:border-[#34D399] cursor-pointer"
          >
            <option value="">All Categories</option>
            {categories.map(c => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <span className="text-[11px] text-[#A1ADA5] shrink-0 font-medium">
            {filteredProducts.length} of {products.length} items
          </span>
        </div>
      </div>

      {/* Inventory Table (Responsive) */}
      <div className="bg-[#151C18] rounded-3xl border border-[#303D34] shadow-xl overflow-hidden">
        {loading ? (
          <div className="p-16 text-center text-[#A1ADA5] text-xs">Loading shop inventory records...</div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Package className="w-10 h-10 text-[#A1ADA5] mx-auto" />
            <h3 className="text-sm font-bold text-[#F5F7F5]">No products found</h3>
            <p className="text-xs text-[#A1ADA5] max-w-xs mx-auto">
              You haven&apos;t added any products matching your filter yet.
            </p>
            <button
              onClick={handleOpenAdd}
              className="px-4 py-2 bg-[#22C55E] text-[#101512] rounded-xl text-xs font-bold hover:bg-[#16A34A] transition"
            >
              Add First Product
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#101512] border-b border-[#303D34] text-[#A1ADA5] font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Product Details</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">SKU / Code</th>
                  <th className="py-3 px-4">Listed Price</th>
                  <th className="py-3 px-4">Available Stock</th>
                  <th className="py-3 px-4">Last Modified</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#303D34] font-medium text-[#F5F7F5]">
                {filteredProducts.map(p => {
                  const isOutOfStock = p.stock_quantity <= 0;
                  const isLowStock = p.stock_quantity > 0 && p.stock_quantity <= 5;

                  return (
                    <tr key={p.id} className="hover:bg-[#1B241F] transition">
                      <td className="py-3.5 px-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-[#1B241F] border border-[#303D34] overflow-hidden shrink-0 flex items-center justify-center">
                          {p.image_url ? (
                            <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                          ) : (
                            <Layers className="w-5 h-5 text-[#A1ADA5]/40" />
                          )}
                        </div>
                        <div>
                          <span className="font-bold block text-[#F5F7F5]">{p.name}</span>
                          {p.brand && <span className="text-[#A1ADA5] text-[11px]">{p.brand}</span>}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-[#A1ADA5]">{p.category}</td>

                      <td className="py-3.5 px-4 font-mono text-[11px] text-[#A1ADA5]">
                        {p.sku || '—'}
                      </td>

                      <td className="py-3.5 px-4 font-extrabold text-[#F5F7F5]">
                        {formatCurrency(p.price)}
                      </td>

                      <td className="py-3.5 px-4">
                        {isOutOfStock ? (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#EF4444] bg-[#2D1515] px-2.5 py-0.5 rounded-full border border-[#5C2424]">
                            <AlertTriangle className="w-3 h-3" />
                            <span>0 units (Out of stock)</span>
                          </span>
                        ) : isLowStock ? (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#F59E0B] bg-[#2D2210] px-2.5 py-0.5 rounded-full border border-[#5C4318]">
                            <AlertTriangle className="w-3 h-3" />
                            <span>{p.stock_quantity} units (Low)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#34D399] bg-[#132B1C] px-2.5 py-0.5 rounded-full border border-[#245836]">
                            <CheckCircle2 className="w-3 h-3 text-[#22C55E]" />
                            <span>{p.stock_quantity} units</span>
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-[#A1ADA5] text-[11px]">
                        {formatTimeAgo(p.last_inventory_update)}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleOpenEdit(p)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#232E27] hover:bg-[#1B241F] text-[#34D399] border border-[#303D34] hover:border-[#34D399]/40 transition font-bold"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-[#22C55E]" />
                          <span>Edit / Stock</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Product Modal */}
      {showModal && editingProduct && (
        <div className="fixed inset-0 z-50 bg-[#101512]/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#151C18] rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-[#303D34] space-y-5 animate-scale-up text-xs">
            <div className="flex items-center justify-between border-b border-[#303D34] pb-3">
              <h2 className="text-base font-bold text-[#F5F7F5]">
                {editingProduct.id ? 'Edit Product & Stock Level' : 'Add New Product Listing'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-[#A1ADA5] hover:text-[#F5F7F5] p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="bg-[#2D1515] border border-[#5C2424] text-[#EF4444] p-3 rounded-xl text-xs font-semibold">
                {modalError}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-[#A1ADA5] font-semibold mb-1">Product Name *</label>
                <input
                  type="text"
                  required
                  value={editingProduct.name || ''}
                  onChange={e => setEditingProduct({ ...editingProduct, name: e.target.value })}
                  placeholder="e.g. Arduino Uno R3 Board"
                  className="w-full px-3 py-2 bg-[#1B241F] border border-[#303D34] rounded-xl text-[#F5F7F5] outline-none focus:border-[#34D399]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#A1ADA5] font-semibold mb-1">Category *</label>
                  <select
                    value={editingProduct.category || 'Electronics & Hardware'}
                    onChange={e => setEditingProduct({ ...editingProduct, category: e.target.value })}
                    className="w-full px-3 py-2 bg-[#1B241F] border border-[#303D34] rounded-xl text-[#F5F7F5] outline-none focus:border-[#34D399] cursor-pointer"
                  >
                    <option value="Electronics & Hardware" className="bg-[#1B241F]">Electronics & Hardware</option>
                    <option value="Stationery & Books" className="bg-[#1B241F]">Stationery & Books</option>
                    <option value="Groceries & Household" className="bg-[#1B241F]">Groceries & Household</option>
                    <option value="General Store" className="bg-[#1B241F]">General Store</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[#A1ADA5] font-semibold mb-1">Brand</label>
                  <input
                    type="text"
                    value={editingProduct.brand || ''}
                    onChange={e => setEditingProduct({ ...editingProduct, brand: e.target.value })}
                    placeholder="e.g. Casio, Soldron"
                    className="w-full px-3 py-2 bg-[#1B241F] border border-[#303D34] rounded-xl text-[#F5F7F5] outline-none focus:border-[#34D399]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[#A1ADA5] font-semibold mb-1">Selling Price (₹) *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={editingProduct.price ?? ''}
                    onChange={e => setEditingProduct({ ...editingProduct, price: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-[#1B241F] border border-[#303D34] rounded-xl text-[#F5F7F5] outline-none focus:border-[#34D399]"
                  />
                </div>

                <div>
                  <label className="block text-[#A1ADA5] font-semibold mb-1">Stock Quantity *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={editingProduct.stock_quantity ?? ''}
                    onChange={e => setEditingProduct({ ...editingProduct, stock_quantity: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-[#1B241F] border border-[#303D34] rounded-xl text-[#F5F7F5] outline-none focus:border-[#34D399]"
                  />
                </div>

                <div>
                  <label className="block text-[#A1ADA5] font-semibold mb-1">SKU / Code</label>
                  <input
                    type="text"
                    value={editingProduct.sku || ''}
                    onChange={e => setEditingProduct({ ...editingProduct, sku: e.target.value })}
                    placeholder="e.g. ARD-01"
                    className="w-full px-3 py-2 bg-[#1B241F] border border-[#303D34] rounded-xl text-[#F5F7F5] outline-none focus:border-[#34D399]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#A1ADA5] font-semibold mb-1">Description</label>
                <textarea
                  rows={2}
                  value={editingProduct.description || ''}
                  onChange={e => setEditingProduct({ ...editingProduct, description: e.target.value })}
                  placeholder="Details, warranty, specifications..."
                  className="w-full px-3 py-2 bg-[#1B241F] border border-[#303D34] rounded-xl text-[#F5F7F5] outline-none focus:border-[#34D399]"
                />
              </div>

              <div>
                <label className="block text-[#A1ADA5] font-semibold mb-1">Image URL</label>
                <input
                  type="url"
                  value={editingProduct.image_url || ''}
                  onChange={e => setEditingProduct({ ...editingProduct, image_url: e.target.value })}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full px-3 py-2 bg-[#1B241F] border border-[#303D34] rounded-xl text-[#F5F7F5] outline-none focus:border-[#34D399]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#303D34]">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-[#A1ADA5] hover:text-[#F5F7F5] font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-[#22C55E] hover:bg-[#16A34A] text-[#101512] font-black transition shadow-lg shadow-[#22C55E]/20"
                >
                  {saving ? 'Saving...' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
