import type { Metadata } from 'next';
import './globals.css';
import { UserProvider } from '@/context/UserContext';
import AppHeader from '@/components/AppHeader';

export const metadata: Metadata = {
  title: 'LocoStock — Local Products. Real Shops.',
  description: 'LocoStock: Real registered local shop product discovery, verified availability, and synchronized shopkeeper billing.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
          crossOrigin=""
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen flex flex-col bg-[#101512] text-[#F5F7F5] antialiased selection:bg-[#22C55E]/30 selection:text-[#34D399]">
        <UserProvider>
          <AppHeader />
          <main className="flex-1 pb-16">{children}</main>
        </UserProvider>
      </body>
    </html>
  );
}
