'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import CustomerNavbar from './CustomerNavbar';
import ShopkeeperNavbar from './ShopkeeperNavbar';

export default function AppHeader() {
  const pathname = usePathname();
  const isShopkeeperRoute = pathname.startsWith('/shopkeeper');

  return isShopkeeperRoute ? <ShopkeeperNavbar /> : <CustomerNavbar />;
}
