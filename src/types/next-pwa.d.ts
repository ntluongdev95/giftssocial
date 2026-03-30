declare module 'next-pwa' {
  import type { NextConfig } from 'next';

  interface PWAConfig {
    dest?: string;
    disable?: boolean;
    register?: boolean;
    skipWaiting?: boolean;
    runtimeCaching?: Array<{
      urlPattern: RegExp;
      handler: string;
      options?: Record<string, unknown>;
    }>;
    [key: string]: unknown;
  }

  export default function withPWAInit(config: PWAConfig): (nextConfig: NextConfig) => NextConfig;
}
