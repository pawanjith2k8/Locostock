export type UserRole = 'customer' | 'shopkeeper';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface Shop {
  id: string;
  owner_id: string;
  name: string;
  category: string;
  description: string;
  contact_phone: string;
  contact_email: string;
  address_line: string;
  locality: string;
  city: string;
  state: string;
  postal_code: string;
  latitude: number;
  longitude: number;
  business_hours?: string;
  is_verified?: boolean;
  is_archived?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  shop_id: string;
  name: string;
  description: string;
  category: string;
  brand?: string;
  sku?: string;
  price: number;
  stock_quantity: number;
  image_url?: string;
  is_active: boolean;
  last_inventory_update: string;
  created_at: string;
  updated_at: string;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  created_at: string;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  shop_id: string;
  created_by: string;
  customer_name?: string;
  customer_phone?: string;
  subtotal: number;
  tax: number;
  discount: number;
  final_total: number;
  idempotency_key?: string;
  created_at: string;
  items?: InvoiceItem[];
}

export interface StockMovement {
  id: string;
  product_id: string;
  shop_id: string;
  change_amount: number;
  quantity_after: number;
  reason: 'sale' | 'stock_in' | 'damaged' | 'return' | 'adjustment';
  reference_invoice_id?: string;
  created_by: string;
  notes?: string;
  created_at: string;
  product_name?: string;
}

export interface ProductSearchResult {
  product: Product;
  shop: Shop;
  distanceKm?: number;
}
