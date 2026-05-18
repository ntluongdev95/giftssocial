'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useBusinessStories } from '@/hooks/useStories';
import { useAuthStore, selectUserId } from '@/stores/auth-store';
import { StoryViewer } from './StoryViewer';

type Props = {
  businessId: string;
};

/** Compact banner shown above the business detail body: cluster of avatar
 * thumbs + "X stories live now". Tap any → fullscreen viewer scoped to
 * this venue. */
export function StoryStack({ businessId }: Props) {
  const { items, count, isLoading, refresh } = useBusinessStories(businessId);
  const myUserId = useAuthStore(selectUserId);
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  if (isLoading) {
    return (
      <div className="rounded-2xl p-3 flex items-center gap-2"
        style={{ background: 'rgba(0,212,255,0.04)', border: '1px solid rgba(0,212,255,0.1)' }}>
        <Loader2 size={14} className="animate-spin text-[#00d4ff]" />
        <span className="text-xs text-[#a3adc3]">Loading stories...</span>
      </div>
    );
  }

  if (count === 0) return null;

  // Show up to 5 thumbnails — the rest collapses into a "+N" pill.
  const visible = items.slice(0, 5);
  const overflow = count > 5 ? count - 5 : 0;

  return (
    <>
      <div
        className="rounded-2xl p-3"
        style={{
          background: 'linear-gradient(135deg, rgba(0,212,255,0.08), rgba(168,85,247,0.05))',
          border: '1px solid rgba(0,212,255,0.2)',
        }}
      >
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-semibold text-[#00d4ff]">
            🔴 {count} {count === 1 ? 'story' : 'stories'} live now
          </span>
        </div>
        <div className="flex gap-2">
          {visible.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setOpenIdx(i)}
              className="shrink-0 cursor-pointer"
              aria-label={`Story by ${s.author_name ?? 'user'}`}
            >
              <div
                className="h-12 w-12 rounded-xl overflow-hidden"
                style={{
                  padding: 2,
                  background: 'linear-gradient(135deg, #00d4ff, #a855f7)',
                }}
              >
                <div className="h-full w-full rounded-lg overflow-hidden bg-[#1a1d27]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={s.thumbnail_url || s.media_url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </div>
              </div>
            </button>
          ))}
          {overflow > 0 && (
            <button
              onClick={() => setOpenIdx(visible.length)}
              className="shrink-0 h-12 w-12 rounded-xl flex items-center justify-center cursor-pointer"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <span className="text-xs font-semibold text-white">+{overflow}</span>
            </button>
          )}
        </div>
      </div>

      {openIdx != null && (
        <StoryViewer
          groups={[items]}      // Single group: all stories at this biz
          startGroupIdx={0}
          myUserId={myUserId ?? null}
          onClose={() => {
            setOpenIdx(null);
            refresh();
          }}
        />
      )}
    </>
  );
}
