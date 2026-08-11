'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Film, Loader2, RefreshCw } from 'lucide-react';

type Props = {
  streakId: string;
  initialUrl: string | null;
  initialStatus: 'pending' | 'generating' | 'ready' | 'failed' | null;
  /** Fires after a successful generation so the page can refresh its
   *  SWR cache and PetCharacter picks up the new URL. */
  onReady?: (url: string) => void;
};

/** Button + status pill that drives Stable Video Diffusion generation
 *  for a couple streak's bond pet. Click "Make it alive" → polls the
 *  server (up to 90s) → SWR refresh on the parent side. */
export function PetVideoControl({ streakId, initialUrl, initialStatus, onReady }: Props) {
  const [status, setStatus] = useState<'idle' | 'running' | 'ready' | 'failed'>(
    initialUrl ? 'ready' : (initialStatus === 'generating' ? 'running' : 'idle'),
  );
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const tickRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (status !== 'running') {
      if (tickRef.current) clearInterval(tickRef.current);
      tickRef.current = null;
      return;
    }
    setElapsed(0);
    tickRef.current = setInterval(() => setElapsed(n => n + 1), 1000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [status]);

  async function run(force = false) {
    setStatus('running');
    setError(null);
    try {
      const r = await fetch(`/api/v1/streaks/${streakId}/pet-video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ force }),
      });
      const j = await r.json();
      if (!r.ok) {
        const code = j?.error?.code;
        const msg = j?.error?.message ?? `Generation failed (${r.status})`;
        if (code === 'ai_not_configured') {
          setError('Set REPLICATE_API_TOKEN in .env.local to enable live videos.');
        } else if (code === 'timeout') {
          setError('Generation took too long — try again, it should be faster next attempt.');
        } else {
          setError(msg);
        }
        setStatus('failed');
        return;
      }
      const url = j?.data?.url as string | undefined;
      if (!url) {
        setError('Generation succeeded but no video URL came back.');
        setStatus('failed');
        return;
      }
      setStatus('ready');
      onReady?.(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
      setStatus('failed');
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        {status === 'ready' ? (
          <button
            type="button"
            onClick={() => run(true)}
            className="rounded-full px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            style={{
              background: 'rgba(168,85,247,0.12)',
              color: '#c4b5fd',
              border: '1px solid rgba(168,85,247,0.3)',
            }}
            title="Generate a new clip"
          >
            <RefreshCw size={11} />
            Regenerate live video
          </button>
        ) : (
          <button
            type="button"
            onClick={() => run(false)}
            disabled={status === 'running'}
            className="rounded-full px-4 py-2 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            style={{
              background: 'linear-gradient(135deg, #ec4899, #a855f7)',
              color: '#0a0b0f',
              boxShadow: '0 8px 24px -8px rgba(236,72,153,0.5)',
            }}
          >
            {status === 'running' ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                Bringing your dog to life… {elapsed}s
              </>
            ) : (
              <>
                <Film size={12} />
                Make my dog come alive
              </>
            )}
          </button>
        )}

        {status === 'running' && (
          <motion.span
            className="text-[10px] text-[#a3adc3]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            ~60-90s — Stable Video Diffusion is animating your breed photo.
          </motion.span>
        )}
        {status === 'ready' && !error && (
          <span className="text-[10px] text-emerald-400 font-semibold">
            ✓ Live video active
          </span>
        )}
      </div>

      {error && (
        <p className="text-xs text-rose-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
