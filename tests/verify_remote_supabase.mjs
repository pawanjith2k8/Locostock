import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

// Load .env.local
const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/);
  if (match) {
    env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '');
  }
});

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log(`Connecting to Supabase at: ${url}`);
console.log(`Key available: ${Boolean(key)} (length: ${key ? key.length : 0})`);

const supabase = createClient(url, key, {
  auth: { persistSession: false }
});

async function runCheck() {
  const results = {};
  
  // 1. Check shops
  try {
    const { data, error, count } = await supabase.from('shops').select('*', { count: 'exact' }).limit(5);
    if (error) {
      results.shops = { status: 'ERROR', message: error.message, code: error.code };
    } else {
      results.shops = { status: 'OK', count: count ?? data?.length, sampleRows: data?.length };
    }
  } catch (e) {
    results.shops = { status: 'EXCEPTION', message: e.message };
  }

  // 2. Check products
  try {
    const { data, error, count } = await supabase.from('products').select('*', { count: 'exact' }).limit(5);
    if (error) {
      results.products = { status: 'ERROR', message: error.message, code: error.code };
    } else {
      results.products = { status: 'OK', count: count ?? data?.length, sampleRows: data?.length };
    }
  } catch (e) {
    results.products = { status: 'EXCEPTION', message: e.message };
  }

  // 3. Check profiles
  try {
    const { data, error } = await supabase.from('profiles').select('id, role').limit(2);
    if (error) {
      results.profiles = { status: 'ERROR', message: error.message, code: error.code };
    } else {
      results.profiles = { status: 'OK', count: data?.length };
    }
  } catch (e) {
    results.profiles = { status: 'EXCEPTION', message: e.message };
  }

  // 4. Check invoices
  try {
    const { data, error } = await supabase.from('invoices').select('id, invoice_number').limit(2);
    if (error) {
      results.invoices = { status: 'ERROR', message: error.message, code: error.code };
    } else {
      results.invoices = { status: 'OK', count: data?.length };
    }
  } catch (e) {
    results.invoices = { status: 'EXCEPTION', message: e.message };
  }

  // 5. Check customer_orders (PayPal)
  try {
    const { data, error } = await supabase.from('customer_orders').select('id').limit(2);
    if (error) {
      results.customer_orders = { status: 'ERROR', message: error.message, code: error.code };
    } else {
      results.customer_orders = { status: 'OK', count: data?.length };
    }
  } catch (e) {
    results.customer_orders = { status: 'EXCEPTION', message: e.message };
  }

  console.log('--- SUPABASE AUDIT RESULT ---');
  console.log(JSON.stringify(results, null, 2));
}

runCheck();
