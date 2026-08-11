'use client';

import { forwardRef } from 'react';
import { Star } from 'lucide-react';
import type { MovieGenre } from '@/lib/couple-art';

type Props = {
  name1: string;
  name2: string;
  posterUrl: string | null;
  title: string;
  tagline: string;
  genre: MovieGenre;
  rating: number;      // 0-10
  yearMet: string;     // "Since 2023" or year only
  runtime: string;     // e.g. "2h 03m together" or days-format
  /** Fires when the poster image finishes loading (or fails). Used by
   *  the builder to clear its "generating" state without preloading. */
  onImageLoad?: () => void;
  onImageError?: () => void;
};

const GENRE_META: Record<MovieGenre, { label: string; accent: string; palette: string }> = {
  romance:  { label: 'ROMANCE',  accent: '#f472b6', palette: 'linear-gradient(180deg, #d84875, #5f1a2e)' },
  action:   { label: 'ACTION',   accent: '#fbbf24', palette: 'linear-gradient(180deg, #b45309, #1a0a05)' },
  comedy:   { label: 'COMEDY',   accent: '#22d3ee', palette: 'linear-gradient(180deg, #059669, #052e22)' },
  horror:   { label: 'HORROR',   accent: '#f87171', palette: 'linear-gradient(180deg, #7f1d1d, #0a0a0a)' },
  scifi:    { label: 'SCI-FI',   accent: '#a78bfa', palette: 'linear-gradient(180deg, #4c1d95, #0a0a1a)' },
  drama:    { label: 'DRAMA',    accent: '#facc15', palette: 'linear-gradient(180deg, #57534e, #0a0908)' },
  musical:  { label: 'MUSICAL',  accent: '#f0abfc', palette: 'linear-gradient(180deg, #9d174d, #1a0a20)' },
};

/** IMDb-style movie poster of the couple. 2:3 aspect ratio, cinematic
 *  gradient overlay so the AI-generated art always reads through the
 *  bottom title block. Renders as a plain img + overlay so html2canvas
 *  can rasterize cleanly. */
export const MoviePoster = forwardRef<HTMLDivElement, Props>(function MoviePoster(
  { name1, name2, posterUrl, title, tagline, genre, rating, yearMet, runtime, onImageLoad, onImageError },
  ref,
) {
  const g = GENRE_META[genre] ?? GENRE_META.romance;

  return (
    <div
      ref={ref}
      className="relative rounded-2xl overflow-hidden select-none"
      style={{
        width: 380,
        aspectRatio: '2 / 3',
        background: g.palette,
        boxShadow: `0 30px 80px -15px ${g.accent}55, 0 0 0 1px rgba(255,255,255,0.06) inset`,
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Poster art. NO crossOrigin here — that used to cause spurious
          errors (cache poisoning + rare CORS quirks blocking otherwise-
          reachable Pollinations responses). html2canvas is called with
          useCORS: true separately at export time, which fetches fresh
          with CORS headers so the canvas doesn't get tainted. */}
      {posterUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={posterUrl}
          alt="poster"
          className="absolute inset-0 w-full h-full object-cover"
          draggable={false}
          onLoad={onImageLoad}
          onError={onImageError}
        />
      ) : (
        <div
          aria-hidden
          className="absolute inset-0 flex items-center justify-center text-8xl opacity-40"
        >
          🎬
        </div>
      )}

      {/* Dark gradient bottom + top for text legibility */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 22%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.85) 100%)',
        }}
      />

      {/* Top-left genre pill + rating */}
      <div className="absolute top-4 left-4 flex items-center gap-2">
        <span
          className="rounded-full px-2 py-0.5 text-[9px] font-black tracking-[0.15em]"
          style={{ background: g.accent, color: '#0a0a0a' }}
        >
          {g.label}
        </span>
      </div>

      {/* Top-right rating badge — IMDb-style */}
      <div
        className="absolute top-3 right-3 rounded px-2 py-1 flex items-center gap-1"
        style={{
          background: 'rgba(0,0,0,0.55)',
          border: `1px solid ${g.accent}45`,
          backdropFilter: 'blur(4px)',
        }}
      >
        <Star size={10} fill={g.accent} color={g.accent} />
        <span className="text-[11px] font-bold text-white tabular-nums">
          {rating.toFixed(1)}
        </span>
        <span className="text-[8px] text-white opacity-60">/10</span>
      </div>

      {/* Bottom credit block */}
      <div className="absolute left-0 right-0 bottom-0 p-4 pb-5">
        <div
          className="text-[9px] font-semibold tracking-[0.15em] uppercase mb-1"
          style={{ color: g.accent, textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}
        >
          A Gao Original
        </div>

        <h2
          className="text-[28px] font-black leading-none text-white mb-1"
          style={{ textShadow: '0 2px 12px rgba(0,0,0,0.9)', letterSpacing: '-0.02em' }}
        >
          {title || 'Our Story'}
        </h2>

        {tagline && (
          <p
            className="text-[11px] italic mb-2.5 text-white opacity-90"
            style={{ textShadow: '0 1px 6px rgba(0,0,0,0.9)' }}
          >
            &ldquo;{tagline}&rdquo;
          </p>
        )}

        <div className="flex items-center gap-1.5 flex-wrap text-[10px] text-white/95 mb-2">
          <span className="font-bold">STARRING</span>
          <span className="opacity-90">{name1 || 'Your name'}</span>
          <span className="opacity-60">·</span>
          <span className="opacity-90">{name2 || 'Partner name'}</span>
        </div>

        <div className="flex items-center gap-3 text-[9px] text-white/70">
          <span>{yearMet}</span>
          <span>·</span>
          <span>{runtime}</span>
          <span>·</span>
          <span>Rated PG-💕</span>
        </div>
      </div>
    </div>
  );
});
