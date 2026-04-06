'use client';

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center" style={{ background: '#0a0b0f' }}>
      <div className="mb-6">
        <div className="h-20 w-20 mx-auto rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.1), rgba(99,102,241,0.1))', border: '1px solid rgba(0,212,255,0.15)' }}>
          <span className="text-4xl">🌐</span>
        </div>
      </div>

      <h1 className="text-2xl font-bold text-white mb-2">You&apos;re Offline</h1>
      <p className="text-sm text-[#4a5068] max-w-xs mb-6">
        No internet connection. Check your connection and try again — the world is waiting for you.
      </p>

      <button
        onClick={() => window.location.reload()}
        className="rounded-xl px-6 py-3 text-sm font-semibold cursor-pointer"
        style={{ background: 'rgba(0,212,255,0.15)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.2)' }}
      >
        Try Again
      </button>

      <div className="mt-12 flex items-center gap-2">
        <div className="h-5 w-5 rounded-full" style={{ background: 'linear-gradient(135deg, #00d4ff, #6366f1)' }} />
        <span className="text-xs font-semibold text-[#2d3548]">Gao Social</span>
      </div>
    </div>
  );
}
