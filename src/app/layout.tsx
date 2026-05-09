import type { Metadata, Viewport } from 'next';
import { Inter, Caveat } from 'next/font/google';
import SplashWrapper from '@/components/ui/SplashWrapper';
import GoogleRedirectHandler from '@/components/ui/GoogleRedirectHandler';
import { Toaster } from 'sonner';
import './globals.css';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
});

// Handwritten script font — used for the capsule "letter" body so the message
// reads like a real love-letter inked by hand.
const caveat = Caveat({
  variable: '--font-caveat',
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  weight: ['400', '500', '600', '700'],
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
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Gao Social' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Gao Social',
    description: 'The world, not the feed.',
    images: ['/og-image.png'],
  },
  icons: {
    icon: [
      { url: '/favicon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: '/icons/pwa-192.png',
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
    <html lang="en" className={`${inter.variable} ${caveat.variable} h-full`}>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/icons/pwa-192.png" />
      </head>
      <body className="h-full bg-[#0a0b0f] text-[#f0f4ff] overflow-x-hidden antialiased">
        <SplashWrapper />
        {/* Picks up Google OAuth code if popup was blocked and Google sent the
            user back via full-page redirect (mobile-critical fallback). */}
        <GoogleRedirectHandler />
        {children}
        <Toaster
          position="top-center"
          theme="dark"
          richColors
          closeButton
          toastOptions={{
            style: {
              background: '#0f1117',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#f0f4ff',
            },
          }}
        />
      </body>
    </html>
  );
}
