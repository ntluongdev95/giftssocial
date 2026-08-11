'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { X, ChevronLeft, ChevronRight, MapPin, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { HashtagText } from '@/components/HashtagText';
import type { StoryDTO } from '@/hooks/useStories';
import { StoryViewersSheet } from './StoryViewersSheet';

type Props = {
  groups: StoryDTO[][];          // outer: per-author group; inner: stories
  startGroupIdx: number;
  myUserId?: string | null;
  onClose: () => void;
};

const PHOTO_DURATION_MS = 5000;

/** Fullscreen swipe viewer. Vertical = next/prev author. Horizontal arrows
 * (or tap edges) = next/prev story within the current author's group. */
export function StoryViewer({ groups, startGroupIdx, myUserId, onClose }: Props) {
  const [groupIdx, setGroupIdx] = useState(startGroupIdx);
  const [storyIdx, setStoryIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [viewersOpen, setViewersOpen] = useState(false);

  const current = groups[groupIdx];
  const story = current?.[storyIdx];
  const isOwn = !!myUserId && !!story && story.author_id === myUserId;

  const goNextStory = useCallback(() => {
    setProgress(0);
    if (!current) return;
    if (storyIdx < current.length - 1) {
      setStoryIdx(storyIdx + 1);
      return;
    }
    if (groupIdx < groups.length - 1) {
      setGroupIdx(groupIdx + 1);
      setStoryIdx(0);
      return;
    }
    onClose();
  }, [current, groupIdx, groups.length, onClose, storyIdx]);

  const goPrevStory = useCallback(() => {
    setProgress(0);
    if (storyIdx > 0) {
      setStoryIdx(storyIdx - 1);
      return;
    }
    if (groupIdx > 0) {
      setGroupIdx(groupIdx - 1);
      // Jump to last story in the previous group
      setStoryIdx(groups[groupIdx - 1].length - 1);
      return;
    }
  }, [groupIdx, groups, storyIdx]);

  // Record view (fire-and-forget) when story actually loads.
  useEffect(() => {
    if (!story) return;
    const ctrl = new AbortController();
    fetch(`/api/v1/stories/${story.id}/view`, {
      method: 'POST',
      credentials: 'same-origin',
      signal: ctrl.signal,
    }).catch(() => {});
    return () => ctrl.abort();
  }, [story]);

  // Progress timer — pause when finger is down OR the viewers sheet is up
  useEffect(() => {
    if (!story || paused || viewersOpen) return;
    const started = Date.now();
    const id = setInterval(() => {
      const elapsed = Date.now() - started;
      const pct = Math.min(100, (elapsed / PHOTO_DURATION_MS) * 100);
      setProgress(pct);
      if (pct >= 100) {
        clearInterval(id);
        goNextStory();
      }
    }, 50);
    return () => clearInterval(id);
  }, [story?.id, paused, viewersOpen, goNextStory, story]);

  // Keyboard arrows
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goNextStory();
      else if (e.key === 'ArrowLeft') goPrevStory();
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goNextStory, goPrevStory, onClose]);

  if (!story) return null;

  const timeLeft = formatRemaining(story.expires_at);

  // Portal to document.body so the viewer escapes any parent stacking
  // context (e.g. /world mounts StoriesRail inside a z-30 div, which would
  // otherwise cap z-300 below the page's own bottom UI bars).
  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-300 bg-[#0a0b0f] flex items-center justify-center"
        onMouseDown={() => setPaused(true)}
        onMouseUp={() => setPaused(false)}
        onTouchStart={() => setPaused(true)}
        onTouchEnd={() => setPaused(false)}
      >
        {/* Image */}
        <div className="relative w-full h-full max-w-md mx-auto flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={story.media_url}
            alt={story.caption || ''}
            className="max-h-full max-w-full object-contain select-none"
            draggable={false}
          />

          {/* Top progress bars — one per story in current group.
              Respect notch / safe area on mobile. z-10 keeps them above the
              tap zones that come later in the DOM. */}
          <div
            className="absolute left-2 right-2 flex gap-1 z-10"
            style={{ top: 'calc(env(safe-area-inset-top, 0px) + 8px)' }}
          >
            {current.map((_, i) => (
              <div
                key={i}
                className="h-0.5 flex-1 rounded-full overflow-hidden"
                style={{ background: 'rgba(255,255,255,0.25)' }}
              >
                <div
                  className="h-full bg-white"
                  style={{
                    width: i < storyIdx ? '100%' : i === storyIdx ? `${progress}%` : '0%',
                    transition: 'width 50ms linear',
                  }}
                />
              </div>
            ))}
          </div>

          {/* Author header — below the progress bars, also safe-area aware.
              z-10 so the X button isn't swallowed by the prev/next tap zones. */}
          <div
            className="absolute left-3 right-3 flex items-center gap-3 z-10"
            style={{ top: 'calc(env(safe-area-inset-top, 0px) + 24px)' }}
          >
            <div className="h-9 w-9 rounded-full overflow-hidden bg-[#1a1d27] shrink-0">
              {story.author_avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={story.author_avatar} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-xs text-[#a3adc3]">
                  {(story.author_name || '?').charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1 text-white">
              <div className="text-sm font-semibold truncate">
                {story.author_name || story.author_username || 'User'}
              </div>
              <div className="text-[10px] text-white/70 truncate">
                {story.place_name || ''} {timeLeft ? `· ⏱ ${timeLeft}` : ''}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-full cursor-pointer hover:bg-white/10"
              aria-label="Close"
            >
              <X size={18} className="text-white" />
            </button>
          </div>

          {/* Tap zones — no buttons, just invisible halves */}
          <button
            onClick={goPrevStory}
            className="absolute left-0 top-0 bottom-0 w-1/3 cursor-pointer"
            aria-label="Previous"
          />
          <button
            onClick={goNextStory}
            className="absolute right-0 top-0 bottom-0 w-1/3 cursor-pointer"
            aria-label="Next"
          />

          {/* Caption + business CTA — lifted above the iOS home indicator
              and Safari URL bar so nothing clips off-screen. z-10 keeps
              the Book/viewers buttons clickable over the tap zones. */}
          <div
            className="absolute left-3 right-3 flex flex-col gap-3 z-10"
            style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)' }}
          >
            {/* Author-only: tap to see who watched. Shown above the caption
                so it stays prominent even with long captions. */}
            {isOwn && (
              <button
                onClick={() => setViewersOpen(true)}
                className="self-start flex items-center gap-1.5 rounded-full px-3 py-1.5 cursor-pointer backdrop-blur-md"
                style={{ background: 'rgba(0,0,0,0.55)', color: 'white' }}
              >
                <Eye size={14} className="text-white" />
                <span className="text-xs font-semibold">
                  {story.view_count} {story.view_count === 1 ? 'viewer' : 'viewers'}
                </span>
              </button>
            )}
            {story.caption && (
              <div className="text-sm text-white drop-shadow-md">
                <HashtagText
                  text={story.caption}
                  tagClassName="text-[#ec4899] hover:underline cursor-pointer"
                />
              </div>
            )}

            {/* CTA button — appears when the story carries an external
                link (Gao Gift card shares, etc). Gold gradient so it
                pops off the story media without competing with the
                pink hashtag colour used above. */}
            {story.link_url && (
              <a
                href={story.link_url}
                target={/^https?:\/\//.test(story.link_url) && !story.link_url.startsWith(typeof window !== 'undefined' ? window.location.origin : '') ? '_blank' : undefined}
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 rounded-2xl py-3 px-4 text-sm font-bold no-underline transition-transform active:scale-[0.98]"
                style={{
                  background: 'linear-gradient(135deg, #d4af37 0%, #f2d97a 50%, #d4af37 100%)',
                  color: '#0a0a0a',
                  boxShadow: '0 12px 30px -8px rgba(212,175,55,0.55)',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <span>{story.link_label || 'Khám phá now'}</span>
                <span aria-hidden>→</span>
              </a>
            )}
            {story.business_id && story.business_display_name && (
              <Link
                href={`/businesses/${story.business_id}`}
                className="flex items-center gap-2 rounded-xl px-3 py-2.5 backdrop-blur-md"
                style={{
                  background: 'rgba(0,212,255,0.15)',
                  border: '1px solid rgba(0,212,255,0.4)',
                }}
              >
                {story.business_cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={story.business_cover}
                    alt=""
                    className="h-9 w-9 rounded-lg object-cover shrink-0"
                  />
                ) : (
                  <div
                    className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(0,212,255,0.2)' }}
                  >
                    <MapPin size={14} className="text-[#00d4ff]" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-white truncate">
                    {story.business_display_name}
                  </div>
                  {story.business_city && (
                    <div className="text-[10px] text-white/70 truncate">{story.business_city}</div>
                  )}
                </div>
              </Link>
            )}
          </div>

          {/* Desktop arrows */}
          <button
            onClick={goPrevStory}
            className="hidden md:flex absolute -left-12 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full items-center justify-center cursor-pointer"
            style={{ background: 'rgba(255,255,255,0.08)' }}
          >
            <ChevronLeft size={20} className="text-white" />
          </button>
          <button
            onClick={goNextStory}
            className="hidden md:flex absolute -right-12 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full items-center justify-center cursor-pointer"
            style={{ background: 'rgba(255,255,255,0.08)' }}
          >
            <ChevronRight size={20} className="text-white" />
          </button>
        </div>

        {/* Author-only viewers sheet */}
        <StoryViewersSheet
          storyId={isOwn ? story.id : null}
          open={viewersOpen}
          onClose={() => setViewersOpen(false)}
        />
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}

function formatRemaining(expiresAtIso: string): string {
  const ms = new Date(expiresAtIso).getTime() - Date.now();
  if (ms <= 0) return '';
  const h = Math.floor(ms / 3600_000);
  if (h >= 1) return `${h}h left`;
  const m = Math.floor(ms / 60_000);
  return `${m}m left`;
}
