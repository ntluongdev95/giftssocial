import type { NextConfig } from 'next';
import withPWAInit from 'next-pwa';
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';

if (process.env.NODE_ENV === 'development') {
  initOpenNextCloudflareForDev();
}

const withPWA = withPWAInit({
  dest: 'public',
  disable: true, // Disabled: next-pwa v5 does not support Turbopack; stale SW causes white-screen crashes
  register: true,
  skipWaiting: true,
  fallbacks: {
    document: '/offline',
  },
  runtimeCaching: [
    {
      urlPattern: /^https?.*\/v1\/.*/i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'api-cache',
        expiration: {
          maxEntries: 200,
          maxAgeSeconds: 5 * 60,
        },
        networkTimeoutSeconds: 10,
      },
    },
    {
      urlPattern: /\/(?:icons\/|favicon|apple-touch-icon|og-image|splash)/i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'logo-assets',
        networkTimeoutSeconds: 3,
        expiration: {
          maxEntries: 20,
          maxAgeSeconds: 86400,
        },
      },
    },
    {
      // Function urlPattern is accepted at runtime (workbox) but not in
      // next-pwa's type; cast keeps the function without weakening runtime.
      urlPattern: (({ url }: { url: URL }) =>
        /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i.test(url.pathname) &&
        !/\/(?:icons\/|favicon|apple-touch-icon|og-image|splash)/i.test(url.pathname)) as unknown as RegExp,
      handler: 'CacheFirst',
      options: {
        cacheName: 'image-cache',
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 30 * 24 * 60 * 60,
        },
      },
    },
    {
      urlPattern: /^https:\/\/api\.maptiler\.com\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'map-tile-cache',
        expiration: {
          maxEntries: 500,
          maxAgeSeconds: 7 * 24 * 60 * 60,
        },
      },
    },
    {
      urlPattern: /\.(?:mp3|ogg|wav)$/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'audio-cache',
        expiration: {
          maxEntries: 20,
          maxAgeSeconds: 30 * 24 * 60 * 60,
        },
      },
    },
    {
      urlPattern: /\.(?:js|css|woff2?)$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'static-cache',
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 30 * 24 * 60 * 60,
        },
      },
    },
  ],
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  bundlePagesRouterDependencies: true,
  turbopack: {},
  typescript: { tsconfigPath: './tsconfig.build.json' },
  async headers() {
    const noCache = [{ key: 'Cache-Control', value: 'no-cache' }];
    return [
      { source: '/icons/(.*)',            headers: noCache },
      { source: '/favicon.png',           headers: noCache },
      { source: '/apple-touch-icon.png',  headers: noCache },
      { source: '/og-image.png',          headers: noCache },
      { source: '/splash-screen.png',     headers: noCache },
    ];
  },
};

export default withPWA(nextConfig);
