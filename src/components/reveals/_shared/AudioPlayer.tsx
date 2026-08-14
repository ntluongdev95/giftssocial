'use client';

// AudioPlayer — mounts an appropriate player for whatever music URL
// the sender pasted into an `audio-url` field. Browsers block autoplay
// without user interaction, so we render a compact "▶ Play" pill in
// the top-left; on tap the real player mounts + starts.
//
// URL detection (order matters — earlier patterns win):
//   YouTube    → embedded iframe (YouTube's player, chrome hidden)
//   Spotify    → embedded iframe (Spotify's compact player)
//   SoundCloud → embedded iframe (widget)
//   Direct .mp3 / .ogg / .wav / .m4a  → native <audio autoplay>
//   Anything else → new-tab link fallback
//
// The play button sits at top-left with a subtle backdrop so it never
// competes with a template's hero content in the center.

import { useState } from 'react';
import { Play, Pause, ExternalLink } from 'lucide-react';

type Kind = 'youtube' | 'spotify' | 'soundcloud' | 'audio' | 'unknown';

function detect(url: string): { kind: Kind; embedUrl?: string } {
  const u = url.trim();
  if (!u) return { kind: 'unknown' };
  try {
    const parsed = new URL(u);
    const host = parsed.hostname.replace(/^www\./, '');

    // YouTube: youtu.be/VIDEOID | youtube.com/watch?v=VIDEOID | youtube.com/embed/VIDEOID
    if (host === 'youtu.be') {
      const id = parsed.pathname.slice(1).split(/[/?]/)[0];
      if (id) return { kind: 'youtube', embedUrl: `https://www.youtube.com/embed/${id}?autoplay=1&modestbranding=1&rel=0` };
    }
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      const id = parsed.searchParams.get('v') || parsed.pathname.match(/\/embed\/([^/?]+)/)?.[1];
      if (id) return { kind: 'youtube', embedUrl: `https://www.youtube.com/embed/${id}?autoplay=1&modestbranding=1&rel=0` };
    }

    // Spotify: open.spotify.com/track/ID | /playlist/ID | /album/ID
    if (host === 'open.spotify.com') {
      const m = parsed.pathname.match(/\/(track|playlist|album|episode)\/([^/?]+)/);
      if (m) return { kind: 'spotify', embedUrl: `https://open.spotify.com/embed/${m[1]}/${m[2]}?utm_source=generator&autoplay=1` };
    }

    // SoundCloud: soundcloud.com/user/track — widget needs the full URL as ?url=
    if (host === 'soundcloud.com') {
      return {
        kind: 'soundcloud',
        embedUrl: `https://w.soundcloud.com/player/?url=${encodeURIComponent(u)}&auto_play=true&hide_related=true&show_comments=false&show_user=false&show_reposts=false&visual=false`,
      };
    }

    // Direct audio file
    if (/\.(mp3|ogg|wav|m4a|aac)(\?.*)?$/i.test(parsed.pathname)) {
      return { kind: 'audio', embedUrl: u };
    }
  } catch {
    // Not a valid URL — fall through to unknown
  }
  return { kind: 'unknown' };
}

interface Props {
  url: string;
  accent?: string;
  /** Force auto-mount (skip the tap-to-play gate). Only respected for
   *  direct <audio> — YouTube/Spotify still need user gesture. */
  autoStart?: boolean;
}

export default function AudioPlayer({ url, accent = '#ec4899', autoStart = false }: Props) {
  const { kind, embedUrl } = detect(url);
  const [playing, setPlaying] = useState(autoStart);

  if (!url) return null;

  // Fallback: open in new tab (rare — unknown host)
  if (kind === 'unknown' || !embedUrl) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute top-4 left-4 z-40 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold backdrop-blur cursor-pointer"
        style={{ background: 'rgba(0,0,0,0.55)', color: '#fff', border: `1px solid ${accent}55` }}
      >
        <ExternalLink size={12} /> Open music
      </a>
    );
  }

  // Not playing yet — show tap-to-play pill
  if (!playing) {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); setPlaying(true); }}
        className="absolute top-4 left-4 z-40 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold backdrop-blur cursor-pointer transition-transform hover:scale-105"
        style={{
          background: 'rgba(0,0,0,0.6)',
          color: '#fff',
          border: `1px solid ${accent}66`,
          boxShadow: `0 4px 16px ${accent}33`,
        }}
        title="Play music"
      >
        <Play size={12} fill="#fff" />
        <span>Play music</span>
        {kind === 'youtube' && <span className="text-[9px] opacity-70">· YouTube</span>}
        {kind === 'spotify' && <span className="text-[9px] opacity-70">· Spotify</span>}
        {kind === 'soundcloud' && <span className="text-[9px] opacity-70">· SoundCloud</span>}
      </button>
    );
  }

  // Playing — mount the actual player. Native <audio> for direct files
  // (playback UI stays subtle); iframe for streaming services.
  if (kind === 'audio') {
    return (
      <div
        className="absolute top-4 left-4 z-40 flex items-center gap-2 rounded-full px-3 py-1.5 backdrop-blur"
        style={{ background: 'rgba(0,0,0,0.6)', border: `1px solid ${accent}66` }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => setPlaying(false)}
          className="cursor-pointer text-white/80 hover:text-white"
          title="Pause music"
        >
          <Pause size={12} fill="#fff" />
        </button>
        <span className="text-[10px] text-white/70 uppercase tracking-wider">♫ Playing</span>
        <audio
          src={embedUrl}
          autoPlay
          loop
          style={{ display: 'none' }}
          onError={() => setPlaying(false)}
        />
      </div>
    );
  }

  // YouTube / Spotify / SoundCloud — iframe. Positioned as a small
  // widget in the corner, click-through friendly (doesn't cover reveal).
  return (
    <div
      className="absolute top-4 left-4 z-40 rounded-xl overflow-hidden backdrop-blur"
      style={{
        background: 'rgba(0,0,0,0.55)',
        border: `1px solid ${accent}55`,
        boxShadow: `0 8px 24px rgba(0,0,0,0.5)`,
        width: kind === 'youtube' ? 280 : 300,
        height: kind === 'youtube' ? 158 : kind === 'spotify' ? 80 : 120,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <iframe
        src={embedUrl}
        title="Music player"
        width="100%"
        height="100%"
        allow="autoplay; encrypted-media"
        style={{ border: 0, display: 'block' }}
      />
      <button
        onClick={() => setPlaying(false)}
        className="absolute top-1 right-1 h-5 w-5 rounded-full text-white/80 flex items-center justify-center cursor-pointer text-[10px] font-bold"
        style={{ background: 'rgba(0,0,0,0.7)' }}
        title="Hide player"
      >
        ×
      </button>
    </div>
  );
}
