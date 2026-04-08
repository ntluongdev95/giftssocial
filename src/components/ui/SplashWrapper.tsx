'use client';

import dynamic from 'next/dynamic';

const SplashScreen = dynamic(() => import('@/components/ui/SplashScreen'), {
  ssr: false,
});

export default function SplashWrapper() {
  return <SplashScreen />;
}
