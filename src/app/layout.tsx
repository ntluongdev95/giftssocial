import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import SplashScreen from '@/components/ui/SplashScreen';
import './globals.css';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Gao Social — Map-First Social Platform',
    template: '%s | Gao Social',
  },
  description: 'Discover people, businesses, and events on a live world map. Connect, act, and explore — not scroll. The world, not the feed.',
  keywords: ['social network', 'map', 'discover', 'events', 'businesses', 'signals', 'real-time', 'location', 'PWA'],
  manifest: '/manifest.json',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://app.gao.social'),
  openGraph: {
    title: 'Gao Social — Map-First Social Platform',
    description: 'Discover people, businesses, and events on a live world map.',
    siteName: 'Gao Social',
    type: 'website',
    locale: 'en_US',
    images: [{ url: '/icons/icon-512.png', width: 512, height: 512, alt: 'Gao Social' }],
  },
  twitter: {
    card: 'summary',
    title: 'Gao Social',
    description: 'The world, not the feed.',
    images: ['/icons/icon-512.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Gao Social',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#0a0b0f',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className="h-full bg-[#0a0b0f] text-[#f0f4ff] overflow-x-hidden antialiased">
        <SplashScreen />
        {children}
      </body>
    </html>
  );
}
