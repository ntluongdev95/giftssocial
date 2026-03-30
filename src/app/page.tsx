'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const done = localStorage.getItem('gao_onboarding_done');
    if (done === 'true') {
      router.replace('/world');
    } else {
      router.replace('/onboarding');
    }
  }, [router]);

  // Loading while redirecting
  return (
    <div className="flex h-full items-center justify-center bg-[#0a0b0f]">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#111318] border-t-[#00d4ff]" />
    </div>
  );
}
