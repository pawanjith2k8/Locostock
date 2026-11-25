import { Shop, Product, Invoice, StockMovement, Profile, ProductSearchResult } from '@/types';
import { supabase, isSupabaseConfigured, getAuthRedirectUrl } from './supabaseClient';
import { calculateHaversineDistanceKm } from './utils';

// -------------------------------------------------------------
// AUTHENTICATION & PROFILES
// -------------------------------------------------------------
export async function getCurrentProfile(): Promise<Profile | null> {
  if (!isSupabaseConfigured || !supabase) {
    return null;
  }

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return null;

    let { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      // Auto-provision profile with shopkeeper role if authenticated by Supabase
      const newProfile: Profile = {
        id: user.id,
        email: user.email || '',
        full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Merchant',
        role: 'shopkeeper',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: inserted } = await supabase
        .from('profiles')
        .insert([newProfile])
        .select()
        .single();

      return inserted || newProfile;
    }

    return profile;
  } catch (err) {
    console.error('Error fetching current profile from Supabase:', err);
    return null;
  }
}

export async function sendShopkeeperOtp(email: string): Promise<{ success: boolean }> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Authentication service is currently offline. Please verify network configuration.');
  }

  const redirectUrl = getAuthRedirectUrl();

  try {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { 
        shouldCreateUser: true,
        emailRedirectTo: redirectUrl,
      },
    });

    if (error) {
      throw new Error(error.message || 'Failed to send verification email.');
    }

    return { success: true };
  } catch (err: any) {
    console.error('Auth OTP dispatch error:', err);
    if (err.message === 'Failed to fetch' || err.name === 'TypeError' || (err.message && err.message.toLowerCase().includes('fetch'))) {
      throw new Error('Unable to connect to authentication server. Please check your internet connection or try again shortly.');
    }
    throw err;
  }
}

export async function verifyShopkeeperOtp(email: string, token: string): Promise<{ success: boolean; profile: Profile }> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Authentication service is currently offline. Please verify network configuration.');
  }

  try {
    // Attempt verification with type 'email'
    let res = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    });

    // If type 'email' fails on a newly registered user, attempt type 'signup'
    if (res.error && (res.error.message.toLowerCase().includes('type') || res.error.message.toLowerCase().includes('invalid'))) {
      const signupRes = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'signup',
      });
      if (!signupRes.error) {
        res = signupRes;
      }
    }

    if (res.error) {
      throw new Error(res.error.message || 'Invalid or expired verification code.');
    }
    if (!res.data.user) {
      throw new Error('Verification failed: No authenticated user returned.');
    }

    let { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', res.data.user.id)
      .single();

    if (!profile) {
      const newProfile: Profile = {
        id: res.data.user.id,
        email: res.data.user.email || email,
        full_name: res.data.user.user_metadata?.full_name || email.split('@')[0],
        role: 'shopkeeper',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const { data: inserted, error: insertError } = await supabase
        .from('profiles')
        .insert([newProfile])
        .select()
        .single();

      if (insertError) {
        console.warn('Could not auto-create profile row:', insertError.message);
        profile = newProfile;
      } else {
        profile = inserted;
      }
    }

    return { success: true, profile };
  } catch (err: any) {
    console.error('OTP verification error:', err);
    if (err.message === 'Failed to fetch' || err.name === 'TypeError') {
      throw new Error('Unable to reach authentication server. Please check your network connection.');
    }
    throw err;
  }
}

export async function signOutShopkeeper(): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    await supabase.auth.signOut();
  }
}

// -------------------------------------------------------------
// SHOPS
// -------------------------------------------------------------
export async function getAllShops(): Promise<Shop[]> {
  if (!isSupabaseConfigured || !supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from('shops')
    .select('*')
    .order('name');

  if (error) {
    console.error('Error fetching shops from Supabase:', error);
    return [];
  }
  return data || [];
}

export async function getShopById(id: string): Promise<Shop | null> {
  if (!isSupabaseConfigured || !supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from('shops')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error(`Error fetching shop ${id} from Supabase:`, error);
    return null;
  }
  return data || null;
}

export async function getShopsByOwner(ownerId: string): Promise<Shop[]> {
  if (!isSupabaseConfigured || !supabase || !ownerId) {
    return [];
  }

  const { data, error } = await supabase
    .from('shops')
    .select('*')
    .eq('owner_id', ownerId);

  if (error) {
    console.error(`Error fetching shops for owner ${ownerId}:`, error);
    return [];
  }
  return data || [];
}

export async function createOrUpdateShop(shopData: Partial<Shop> & { name: string; owner_id: string }): Promise<Shop> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase database is not configured yet. Please configure credentials in .env.local.');
  }

  if (shopData.id) {
    const { data, error } = await supabase
      .from('shops')
      .update(shopData)
      .eq('id', shopData.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } else {
    const { data, error } = await supabase
      .from('shops')
      .insert([shopData])
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}

// -------------------------------------------------------------
// PRODUCTS & INVENTORY
// -------------------------------------------------------------
export async function getProductsByShop(shopId: string): Promise<Product[]> {
  if (!isSupabaseConfigured || !supabase || !shopId) {
    return [];
  }

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('shop_id', shopId)
    .order('name');

  if (error) {
    console.error(`Error fetching products for shop ${shopId}:`, error);
    return [];
  }
  return data || [];
}

export async function getProductById(productId: string): Promise<Product | null> {
  if (!isSupabaseConfigured || !supabase || !productId) {
    return null;
  }

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', productId)
    .single();

  if (error) {
    console.error(`Error fetching product ${productId}:`, error);
    return null;
  }
  return data || null;
}

export async function adjustStock(
  productId: string,
  changeAmount: number,
  reason: 'stock_in' | 'damaged' | 'return' | 'adjustment',
  notes?: string
): Promise<{
  success: boolean;
  product_id: string;
  quantity_before: number;
  change_amount: number;
  quantity_after: number;
  movement_id: string;
}> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase database is not configured yet. Please configure credentials in .env.local.');
  }

  const { data, error } = await supabase.rpc('adjust_stock_atomic', {
    p_product_id: productId,
    p_change_amount: changeAmount,
    p_reason: reason,
    p_notes: notes || null,
  });

  if (error) {
    throw new Error(error.message || 'Stock adjustment failed in Supabase');
  }

  return data;
}

export async function saveProduct(productData: Partial<Product> & { shop_id: string; name: string; price: number; stock_quantity: number }): Promise<Product> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase database is not configured yet. Please configure credentials in .env.local.');
  }

  const now = new Date().toISOString();

  if (productData.id) {
    const { data: existing } = await supabase
      .from('products')
      .select('*')
      .eq('id', productData.id)
      .single();

    const prevQty = existing ? existing.stock_quantity : 0;
    const targetQty = productData.stock_quantity;
    const qtyDiff = targetQty - prevQty;

    // First update general product metadata (name, price, etc.)
    const { data, error } = await supabase
      .from('products')
      .update({
        shop_id: productData.shop_id,
        name: productData.name,
        description: productData.description,
        category: productData.category,
        brand: productData.brand,
        sku: productData.sku,
        price: productData.price,
        image_url: productData.image_url,
        is_active: productData.is_active,
        updated_at: now,
      })
      .eq('id', productData.id)
      .select()
      .single();

    if (error) throw error;

    // If stock changed, adjust stock atomically via adjust_stock_atomic
    if (existing && qtyDiff !== 0) {
      await adjustStock(
        data.id,
        qtyDiff,
        qtyDiff > 0 ? 'stock_in' : 'adjustment',
        'Manual inventory adjustment from product manager'
      );
      const refreshed = await getProductById(data.id);
      return refreshed || data;
    }

    return data;
  } else {
    const initialQty = productData.stock_quantity;
    const { data, error } = await supabase
      .from('products')
      .insert([{
        ...productData,
        stock_quantity: 0, // Initial zero stock before atomic adjustment
        last_inventory_update: now,
        created_at: now,
        updated_at: now,
      }])
      .select()
      .single();

    if (error) throw error;

    if (initialQty > 0) {
      await adjustStock(
        data.id,
        initialQty,
        'stock_in',
        'Initial stock entry'
      );
      const refreshed = await getProductById(data.id);
      return refreshed || data;
    }

    return data;
  }
}

// -------------------------------------------------------------
// STOCK MOVEMENTS
// -------------------------------------------------------------
export async function recordStockMovement(movement: Omit<StockMovement, 'id' | 'created_at'>): Promise<StockMovement> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase database is not configured yet. Please configure credentials in .env.local.');
  }

  // If manual stock adjustment, execute securely through adjust_stock_atomic
  if (movement.reason !== 'sale') {
    const res = await adjustStock(
      movement.product_id,
      movement.change_amount,
      movement.reason,
      movement.notes
    );
    return {
      id: res.movement_id,
      product_id: movement.product_id,
      shop_id: movement.shop_id,
      change_amount: movement.change_amount,
      quantity_after: res.quantity_after,
      reason: movement.reason,
      created_by: movement.created_by,
      notes: movement.notes,
      created_at: new Date().toISOString(),
    };
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('stock_movements')
    .insert([{ ...movement, created_at: now }])
    .select()
    .single();

  if (error) {
    console.error('Error writing stock movement to Supabase:', error);
    throw error;
  }

  return data;
}

export async function getStockMovementsByShop(shopId: string): Promise<StockMovement[]> {
  if (!isSupabaseConfigured || !supabase || !shopId) {
    return [];
  }

  const { data, error } = await supabase
    .from('stock_movements')
    .select('*, products(name)')
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error(`Error fetching stock movements for shop ${shopId}:`, error);
    return [];
  }

  return (data || []).map((item: any) => ({
    ...item,
    product_name: item.products?.name,
  }));
}

// -------------------------------------------------------------
// ATOMIC BILLING & SALES
// -------------------------------------------------------------
export interface FinalizeBillParams {
  shop_id: string;
  user_id: string;
  customer_name?: string;
  customer_phone?: string;
  subtotal: number;
  tax: number;
  discount: number;
  final_total: number;
  idempotency_key: string;
  items: Array<{
    product_id: string;
    quantity: number;
    unit_price: number;
  }>;
}

export async function finalizeBill(params: FinalizeBillParams): Promise<{ success: boolean; invoice_id: string; invoice_number: string; idempotent_replay?: boolean }> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase database is not configured yet. Please configure credentials in .env.local.');
  }

  const { data, error } = await supabase.rpc('finalize_bill_atomic', {
    p_shop_id: params.shop_id,
    p_user_id: params.user_id,
    p_customer_name: params.customer_name || '',
    p_customer_phone: params.customer_phone || '',
    p_subtotal: params.subtotal,
    p_tax: params.tax,
    p_discount: params.discount,
    p_final_total: params.final_total,
    p_idempotency_key: params.idempotency_key,
    p_items: params.items,
  });

  if (error) {
    throw new Error(error.message || 'Transaction failed in Supabase');
  }

  return data;
}

export async function getInvoicesByShop(shopId: string): Promise<Invoice[]> {
  if (!isSupabaseConfigured || !supabase || !shopId) {
    return [];
  }

  const { data, error } = await supabase
    .from('invoices')
    .select('*, invoice_items(*)')
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error(`Error fetching invoices for shop ${shopId}:`, error);
    return [];
  }

  return (data || []).map((inv: any) => ({
    ...inv,
    items: inv.invoice_items,
  }));
}

// -------------------------------------------------------------
// SEARCH & DISCOVERY (CUSTOMER APP)
// -------------------------------------------------------------
export interface ProductSearchParams {
  query?: string;
  category?: string;
  area?: string;
  customerLat?: number;
  customerLon?: number;
  radiusKm?: number;
  minPrice?: number;
  maxPrice?: number;
  onlyInStock?: boolean;
  sortBy?: 'relevance' | 'distance' | 'price_low' | 'price_high';
}

export async function searchProducts(params: ProductSearchParams): Promise<ProductSearchResult[]> {
  if (!isSupabaseConfigured || !supabase) {
    return [];
  }

  const allShops = await getAllShops();
  if (allShops.length === 0) return [];

  const shopMap = new Map(allShops.map(s => [s.id, s]));

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('is_active', true);

  if (error || !data) {
    console.error('Error querying products from Supabase:', error);
    return [];
  }

  const products: Product[] = data;
  const q = (params.query || '').trim().toLowerCase();
  const areaQuery = (params.area || '').trim().toLowerCase();

  let results = products
    .filter(prod => {
      const shop = shopMap.get(prod.shop_id);
      if (!shop) return false;

      // Area-based filtering: Match shop locality or city
      if (areaQuery) {
        const shopLoc = (shop.locality || '').toLowerCase().trim();
        const shopCity = (shop.city || '').toLowerCase().trim();
        const matchLoc = shopLoc.includes(areaQuery) || areaQuery.includes(shopLoc);
        const matchCity = shopCity.includes(areaQuery) || areaQuery.includes(shopCity);
        if (!matchLoc && !matchCity) return false;
      }

      if (q) {
        const matchName = prod.name.toLowerCase().includes(q);
        const matchBrand = (prod.brand || '').toLowerCase().includes(q);
        const matchCat = prod.category.toLowerCase().includes(q);
        const matchDesc = (prod.description || '').toLowerCase().includes(q);
        if (!matchName && !matchBrand && !matchCat && !matchDesc) return false;
      }

      if (params.category && prod.category !== params.category) {
        return false;
      }

      if (params.onlyInStock !== false && prod.stock_quantity <= 0) {
        return false;
      }

      if (params.minPrice !== undefined && prod.price < params.minPrice) return false;
      if (params.maxPrice !== undefined && prod.price > params.maxPrice) return false;

      return true;
    })
    .map(prod => {
      const shop = shopMap.get(prod.shop_id);
      let distanceKm: number | undefined;
      if (shop && params.customerLat !== undefined && params.customerLon !== undefined) {
        distanceKm = calculateHaversineDistanceKm(
          params.customerLat,
          params.customerLon,
          shop.latitude,
          shop.longitude
        );
      }
      return {
        product: prod,
        shop: shop!,
        distanceKm,
      };
    })
    .filter(res => Boolean(res.shop));

  if (params.radiusKm && params.customerLat !== undefined && params.customerLon !== undefined) {
    results = results.filter(r => r.distanceKm !== undefined && r.distanceKm <= params.radiusKm!);
  }

  results.sort((a, b) => {
    if (params.sortBy === 'distance') {
      if (a.distanceKm === undefined) return 1;
      if (b.distanceKm === undefined) return -1;
      return a.distanceKm - b.distanceKm;
    }
    if (params.sortBy === 'price_low') return a.product.price - b.product.price;
    if (params.sortBy === 'price_high') return b.product.price - a.product.price;
    return 0;
  });

  return results;
}

export async function searchShops(params: {
  query?: string;
  category?: string;
  area?: string;
  customerLat?: number;
  customerLon?: number;
  radiusKm?: number;
}): Promise<Array<{ shop: Shop; distanceKm?: number }>> {
  if (!isSupabaseConfigured || !supabase) {
    return [];
  }

  const allShops = await getAllShops();
  const q = (params.query || '').trim().toLowerCase();
  const areaQuery = (params.area || '').trim().toLowerCase();

  let results = allShops.filter(shop => {
    // Area-based filtering: Match shop locality or city
    if (areaQuery) {
      const shopLoc = (shop.locality || '').toLowerCase().trim();
      const shopCity = (shop.city || '').toLowerCase().trim();
      const matchLoc = shopLoc.includes(areaQuery) || areaQuery.includes(shopLoc);
      const matchCity = shopCity.includes(areaQuery) || areaQuery.includes(shopCity);
      if (!matchLoc && !matchCity) return false;
    }

    if (q) {
      const matchName = shop.name.toLowerCase().includes(q);
      const matchCat = shop.category.toLowerCase().includes(q);
      const matchLoc = shop.locality.toLowerCase().includes(q);
      const matchCity = shop.city.toLowerCase().includes(q);
      if (!matchName && !matchCat && !matchLoc && !matchCity) return false;
    }
    if (params.category && shop.category !== params.category) return false;
    return true;
  }).map(shop => {
    let distanceKm: number | undefined;
    if (params.customerLat !== undefined && params.customerLon !== undefined) {
      distanceKm = calculateHaversineDistanceKm(
        params.customerLat,
        params.customerLon,
        shop.latitude,
        shop.longitude
      );
    }
    return {
      shop,
      distanceKm,
    };
  });

  if (params.radiusKm && params.customerLat !== undefined && params.customerLon !== undefined) {
    results = results.filter(r => r.distanceKm !== undefined && r.distanceKm <= params.radiusKm!);
  }

  results.sort((a, b) => {
    if (a.distanceKm !== undefined && b.distanceKm !== undefined) {
      return a.distanceKm - b.distanceKm;
    }
    return a.shop.name.localeCompare(b.shop.name);
  });

  return results;
}
