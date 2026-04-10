'use client';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <div
        className="flex h-16 w-16 items-center justify-center rounded-full"
        style={{ background: 'rgba(239,68,68,0.1)' }}
      >
        <span className="text-3xl">⚠️</span>
      </div>
      <h2 className="text-lg font-bold text-[#f0f4ff]">Something went wrong</h2>
      <p className="max-w-xs text-sm text-[#4a5068]">
        {error?.message || 'An unexpected error occurred.'}
      </p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="rounded-xl bg-[#00d4ff] px-6 py-2.5 text-sm font-semibold text-[#0a0b0f] cursor-pointer"
        >
          Try Again
        </button>
        <button
          onClick={() => window.location.href = '/world'}
          className="rounded-xl px-6 py-2.5 text-sm font-medium cursor-pointer"
          style={{ background: 'rgba(24,28,36,0.5)', border: '1px solid rgba(255,255,255,0.05)', color: '#a3adc3' }}
        >
          Go Home
        </button>
      </div>
    </div>
  );
}
