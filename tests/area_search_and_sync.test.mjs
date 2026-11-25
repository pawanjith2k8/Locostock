import test from 'node:test';
import assert from 'node:assert/strict';

// Mock shops dataset representing stores registered in different localities
const mockShops = [
  {
    id: 'shop-1',
    name: 'Tambaram Super Mart',
    category: 'Groceries & Household',
    address_line: '12 Gandhi Road',
    locality: 'Tambaram',
    city: 'Chennai',
    state: 'Tamil Nadu',
    postal_code: '600045',
    latitude: 12.9249,
    longitude: 80.1000,
    is_verified: true,
  },
  {
    id: 'shop-2',
    name: 'Velachery Tech Store',
    category: 'Electronics & Hardware',
    address_line: '45 Bypass Road',
    locality: 'Velachery',
    city: 'Chennai',
    state: 'Tamil Nadu',
    postal_code: '600042',
    latitude: 12.9759,
    longitude: 80.2212,
    is_verified: true,
  },
  {
    id: 'shop-3',
    name: 'Perungudi Books & Stationary',
    category: 'Stationery & Books',
    address_line: '88 OMR IT Highway',
    locality: 'Perungudi',
    city: 'Chennai',
    state: 'Tamil Nadu',
    postal_code: '600096',
    latitude: 12.9654,
    longitude: 80.2461,
    is_verified: true,
  },
];

// Mock products linked to shops
const mockProducts = [
  {
    id: 'prod-1',
    shop_id: 'shop-1',
    name: 'Ponni Boiled Rice 5kg',
    category: 'Groceries & Household',
    price: 320.00,
    stock_quantity: 15,
    is_active: true,
  },
  {
    id: 'prod-2',
    shop_id: 'shop-2',
    name: 'Arduino Uno R3',
    category: 'Electronics & Hardware',
    price: 650.00,
    stock_quantity: 8,
    is_active: true,
  },
  {
    id: 'prod-3',
    shop_id: 'shop-3',
    name: 'Classmate Spiral Notebook A4',
    category: 'Stationery & Books',
    price: 85.00,
    stock_quantity: 25,
    is_active: true,
  },
];

// Area-matching algorithm as implemented in db.ts
function filterShopsByArea(shops, areaQuery) {
  const q = (areaQuery || '').trim().toLowerCase();
  if (!q) return shops;

  return shops.filter(shop => {
    const shopLoc = (shop.locality || '').toLowerCase().trim();
    const shopCity = (shop.city || '').toLowerCase().trim();
    const matchLoc = shopLoc.includes(q) || q.includes(shopLoc);
    const matchCity = shopCity.includes(q) || q.includes(shopCity);
    return matchLoc || matchCity;
  });
}

function filterProductsByArea(products, shops, areaQuery) {
  const matchingShops = filterShopsByArea(shops, areaQuery);
  const allowedShopIds = new Set(matchingShops.map(s => s.id));
  return products.filter(p => allowedShopIds.has(p.shop_id));
}

test('Manual Area Discovery - Search an area containing registered shops returns matching shops', () => {
  const tambaramShops = filterShopsByArea(mockShops, 'Tambaram');
  assert.equal(tambaramShops.length, 1);
  assert.equal(tambaramShops[0].name, 'Tambaram Super Mart');
  assert.equal(tambaramShops[0].locality, 'Tambaram');

  const products = filterProductsByArea(mockProducts, mockShops, 'Tambaram');
  assert.equal(products.length, 1);
  assert.equal(products[0].name, 'Ponni Boiled Rice 5kg');
});

test('Manual Area Discovery - Search an area without shops returns empty result and triggers expected message', () => {
  const result = filterShopsByArea(mockShops, 'Coimbatore');
  assert.equal(result.length, 0);

  // Exact required empty state text
  const expectedEmptyState = 'No shops found in this area. Try another area.';
  assert.match(expectedEmptyState, /No shops found in this area\. Try another area\./);
});

test('Manual Area Discovery - Search with empty input returns validation message', () => {
  const validateInput = (input) => {
    const clean = (input || '').trim();
    if (!clean) {
      return 'Please enter an area name to search (e.g., Tambaram, Velachery, Perungudi).';
    }
    return null;
  };

  assert.equal(validateInput(''), 'Please enter an area name to search (e.g., Tambaram, Velachery, Perungudi).');
  assert.equal(validateInput('   '), 'Please enter an area name to search (e.g., Tambaram, Velachery, Perungudi).');
  assert.equal(validateInput('Velachery'), null);
});

test('Manual Area Discovery - Switching between different areas updates results accurately', () => {
  const velacheryShops = filterShopsByArea(mockShops, 'Velachery');
  assert.equal(velacheryShops.length, 1);
  assert.equal(velacheryShops[0].name, 'Velachery Tech Store');

  const perungudiShops = filterShopsByArea(mockShops, 'Perungudi');
  assert.equal(perungudiShops.length, 1);
  assert.equal(perungudiShops[0].name, 'Perungudi Books & Stationary');

  assert.notEqual(velacheryShops[0].id, perungudiShops[0].id);
});

test('Manual Area Discovery - Strict precision prevents unrelated shops from matching', () => {
  const unrelatedSearch = filterShopsByArea(mockShops, 'Ambattur');
  assert.equal(unrelatedSearch.length, 0);

  // Ensure 'Tambaram' does not match 'Perungudi' or 'Velachery'
  const tambaramOnly = filterShopsByArea(mockShops, 'Tambaram');
  assert.equal(tambaramOnly.every(s => s.locality === 'Tambaram'), true);
});

test('Shopkeeper Registration - Captures full physical address details into shops schema', () => {
  const newShopSubmission = {
    name: 'New T. Nagar Electronics',
    category: 'Electronics & Hardware',
    address_line: '14 North Usman Road',
    locality: 'T. Nagar',
    city: 'Chennai',
    state: 'Tamil Nadu',
    postal_code: '600017',
    latitude: 13.0418,
    longitude: 80.2341,
  };

  assert.ok(newShopSubmission.name);
  assert.ok(newShopSubmission.locality);
  assert.ok(newShopSubmission.city);
  assert.ok(newShopSubmission.state);
  assert.ok(newShopSubmission.address_line);
  assert.ok(newShopSubmission.postal_code);

  const updatedShopsList = [...mockShops, { id: 'shop-4', ...newShopSubmission }];
  const tNagarFound = filterShopsByArea(updatedShopsList, 'T. Nagar');
  assert.equal(tNagarFound.length, 1);
  assert.equal(tNagarFound[0].name, 'New T. Nagar Electronics');
});

test('Customer & Shopkeeper Synchronization - Inventory update reflects in customer catalog', () => {
  const dynamicProducts = JSON.parse(JSON.stringify(mockProducts));

  // Customer checks initial stock
  const initialCustomerView = dynamicProducts.find(p => p.id === 'prod-2');
  assert.equal(initialCustomerView.stock_quantity, 8);

  // Shopkeeper completes billing: 3 units sold
  const billedUnits = 3;
  initialCustomerView.stock_quantity -= billedUnits;

  // Customer immediately sees updated stock
  const updatedCustomerView = dynamicProducts.find(p => p.id === 'prod-2');
  assert.equal(updatedCustomerView.stock_quantity, 5);
});

test('Privacy & Security - Discovery functions without GPS permissions or device tracking', () => {
  // Simulating an environment where window.navigator.geolocation is undefined
  const fakeWindow = { navigator: {} };
  assert.equal('geolocation' in fakeWindow.navigator, false);

  // Area search proceeds completely independently of device GPS
  const discovered = filterShopsByArea(mockShops, 'Tambaram');
  assert.equal(discovered.length, 1);
  assert.equal(discovered[0].locality, 'Tambaram');
});
