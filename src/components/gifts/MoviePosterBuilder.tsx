'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Loader2, RefreshCw, Share2, Sparkles, X, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { MoviePoster } from './MoviePoster';
import { MOVIE_GENRES, moviePosterUrl, type MovieGenre } from '@/lib/couple-art';

type Props = {
  open: boolean;
  onClose: () => void;
};

function todayISO() { return new Date().toISOString().slice(0, 10); }
function currentYear() { return String(new Date().getFullYear()); }

/** Poster-side builder — different from CoupleCardBuilder because the
 *  output is a portrait-format movie poster, not an ID card. Uses the
 *  same Pollinations backend but with a genre-specific prompt template
 *  so each pick renders a visibly different look. */
export function MoviePosterBuilder({ open, onClose }: Props) {
  const [name1, setName1] = useState('');
  const [name2, setName2] = useState('');
  const [genre, setGenre] = useState<MovieGenre>('romance');
  const [title, setTitle] = useState('');
  const [tagline, setTagline] = useState('');
  const [year, setYear] = useState(currentYear());
  const [days, setDays] = useState(0);
  const [rating, setRating] = useState(9.8);
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);

  const posterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setYear(currentYear());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Free any pending blob URL when the component unmounts.
  useEffect(() => {
    return () => {
      if (posterUrl?.startsWith('blob:')) URL.revokeObjectURL(posterUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pick a suggested title based on the genre if user hasn't set one
  const suggestedTitle = useMemo(() => {
    if (!name1 || !name2) return 'Our Story';
    switch (genre) {
      case 'romance': return `${name1} & ${name2}`;
      case 'action':  return `${name1} & ${name2}: Rise`;
      case 'comedy':  return `The ${name1} & ${name2} Show`;
      case 'horror':  return `The Curse of ${name1} & ${name2}`;
      case 'scifi':   return `${name1} × ${name2}: Timeline`;
      case 'drama':   return `The Life of ${name1} and ${name2}`;
      case 'musical': return `${name1} + ${name2}: A Musical`;
    }
  }, [name1, name2, genre]);

  // Pull a suggested tagline from the selected genre's pool
  const suggestedTagline = useMemo(() => {
    const g = MOVIE_GENRES.find(m => m.id === genre);
    if (!g) return '';
    const idx = ((name1.length + name2.length) % g.taglineHints.length);
    return g.taglineHints[idx];
  }, [genre, name1, name2]);

  async function generatePoster() {
    if (!name1 || !name2) {
      toast.error('Enter both names first');
      return;
    }
    setGenerating(true);
    const url = moviePosterUrl({ name1, name2, genre });

    // Fetch → blob → object URL pattern. Beats setting the src directly
    // for two reasons:
    //   1) We can distinguish a real network / CDN failure (fetch throws)
    //      from a browser cache/CORS quirk (image onerror fires spurious).
    //   2) Blob URLs are same-origin, so the display <img> never touches
    //      CORS — and html2canvas at download time reads a same-origin
    //      resource, no taint risk.
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 120_000);
      const r = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (!r.ok) {
        throw new Error(`Pollinations returned HTTP ${r.status}`);
      }
      const blob = await r.blob();
      const blobUrl = URL.createObjectURL(blob);
      // Free the previous blob URL to avoid leaking memory across regenerates.
      if (posterUrl?.startsWith('blob:')) URL.revokeObjectURL(posterUrl);
      setPosterUrl(blobUrl);
      // onImageLoad on the <img> below will clear `generating` when paint completes.
    } catch (e) {
      console.error('[MoviePoster generate]', e);
      setGenerating(false);
      const msg =
        e instanceof Error && e.name === 'AbortError'
          ? 'Generation timed out after 2 min — Flux is under heavy load, retry in a moment.'
          : e instanceof Error
            ? `Poster generation failed: ${e.message}`
            : 'Poster generation failed — check your connection or try another genre.';
      toast.error(msg);
    }
  }

  async function download() {
    if (!posterRef.current) return;
    setExporting(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(posterRef.current, {
        backgroundColor: null, scale: 3, useCORS: true,
      });
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `gao-movie-poster-${(name1 || 'us').toLowerCase().replace(/\W+/g, '-')}.png`;
      a.click();
      toast.success('Poster downloaded');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Download failed');
    } finally {
      setExporting(false);
    }
  }

  async function share() {
    if (!posterRef.current) return;
    setExporting(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(posterRef.current, {
        backgroundColor: null, scale: 3, useCORS: true,
      });
      if (navigator.share && canvas.toBlob) {
        canvas.toBlob(async blob => {
          if (!blob) return;
          const file = new File([blob], 'gao-movie-poster.png', { type: 'image/png' });
          try {
            await navigator.share({
              files: [file],
              title: title || 'Our movie',
              text: `${name1} & ${name2} — a Gao Original 🎬`,
            });
          } catch { /* cancelled */ }
        });
      } else {
        await download();
      }
    } finally {
      setExporting(false);
    }
  }

  const runtime = days > 0 ? `${days.toLocaleString()} days together` : `A lifetime`;
  const finalTitle = title || suggestedTitle;
  const finalTagline = tagline || suggestedTagline;

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-500 flex items-center justify-center p-4"
          style={{ background: 'rgba(5,6,10,0.88)', backdropFilter: 'blur(8px)' }}
        >
          <motion.div
            initial={{ scale: 0.94, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.94, opacity: 0 }}
            transition={{ type: 'spring', damping: 22, stiffness: 220 }}
            className="w-full max-w-5xl max-h-[92vh] overflow-y-auto rounded-3xl"
            style={{
              background: 'linear-gradient(180deg, #0f1117, #0a0b0f)',
              border: '1px solid rgba(255,255,255,0.06)',
              boxShadow: '0 40px 90px -20px rgba(0,0,0,0.6)',
            }}
          >
            <div
              className="flex items-center justify-between px-5 py-4 sticky top-0 z-10"
              style={{
                background: 'rgba(10,11,15,0.9)',
                backdropFilter: 'blur(8px)',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
              }}
            >
              <div className="flex items-center gap-2">
                <span className="text-xl">🎬</span>
                <div>
                  <h2 className="text-base font-bold text-white">Couple movie poster</h2>
                  <p className="text-[10px] text-[#4a5068]">A poster of your love story — IMDb-ready</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="h-8 w-8 rounded-lg flex items-center justify-center cursor-pointer text-[#4a5068] hover:text-white"
                style={{ background: 'rgba(255,255,255,0.05)' }}
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-5 lg:p-8">
              {/* Form */}
              <div className="space-y-4 order-2 lg:order-1">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Your name">
                    <input
                      type="text"
                      value={name1}
                      onChange={e => setName1(e.target.value.slice(0, 32))}
                      placeholder="Nt Luong"
                      className="w-full rounded-lg px-3 py-2 text-sm bg-transparent text-white outline-none"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                    />
                  </Field>
                  <Field label="Partner name">
                    <input
                      type="text"
                      value={name2}
                      onChange={e => setName2(e.target.value.slice(0, 32))}
                      placeholder="Minh Anh"
                      className="w-full rounded-lg px-3 py-2 text-sm bg-transparent text-white outline-none"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                    />
                  </Field>
                </div>

                {/* Genre grid */}
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-[#4a5068] font-semibold mb-1.5 block">
                    Genre — drives art style
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {MOVIE_GENRES.map(g => {
                      const active = genre === g.id;
                      return (
                        <button
                          key={g.id}
                          onClick={() => setGenre(g.id)}
                          className="rounded-lg py-2 flex flex-col items-center gap-0.5 cursor-pointer transition-transform hover:scale-[1.02]"
                          style={{
                            background: active
                              ? 'linear-gradient(135deg, rgba(168,85,247,0.15), rgba(236,72,153,0.1))'
                              : 'rgba(255,255,255,0.04)',
                            border: `1px solid ${active ? '#ec4899' : 'rgba(255,255,255,0.06)'}`,
                          }}
                        >
                          <span className="text-base">{g.emoji}</span>
                          <span className="text-[9px] font-semibold" style={{ color: active ? '#fff' : '#a3adc3' }}>
                            {g.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Generate button */}
                <button
                  onClick={generatePoster}
                  disabled={generating || !name1 || !name2}
                  className="w-full rounded-lg py-3 text-sm font-bold cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                  style={{ background: 'linear-gradient(135deg, #a855f7, #ec4899)', color: 'white' }}
                >
                  {generating ? (
                    <><Loader2 size={14} className="animate-spin" /> Generating poster art (~10s)...</>
                  ) : posterUrl ? (
                    <><RefreshCw size={14} /> Regenerate {MOVIE_GENRES.find(m => m.id === genre)?.label.toLowerCase()} poster</>
                  ) : (
                    <><Wand2 size={14} /> Generate {MOVIE_GENRES.find(m => m.id === genre)?.label.toLowerCase()} poster</>
                  )}
                </button>

                {/* Title + tagline */}
                <div className="grid grid-cols-1 gap-3">
                  <Field label="Movie title">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={title}
                        onChange={e => setTitle(e.target.value.slice(0, 60))}
                        placeholder={suggestedTitle}
                        className="flex-1 rounded-lg px-3 py-2 text-sm bg-transparent text-white outline-none"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                      />
                      <button
                        onClick={() => setTitle(suggestedTitle)}
                        title="Use suggested"
                        className="h-9 w-9 rounded-lg flex items-center justify-center cursor-pointer text-[#a3adc3] shrink-0"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                      >
                        <Sparkles size={12} />
                      </button>
                    </div>
                  </Field>
                  <Field label="Tagline">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={tagline}
                        onChange={e => setTagline(e.target.value.slice(0, 80))}
                        placeholder={suggestedTagline}
                        className="flex-1 rounded-lg px-3 py-2 text-sm bg-transparent text-white outline-none"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                      />
                      <button
                        onClick={() => setTagline(suggestedTagline)}
                        title="Use suggested"
                        className="h-9 w-9 rounded-lg flex items-center justify-center cursor-pointer text-[#a3adc3] shrink-0"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                      >
                        <Sparkles size={12} />
                      </button>
                    </div>
                  </Field>
                </div>

                {/* Meta row */}
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Since">
                    <input
                      type="text"
                      value={year}
                      onChange={e => setYear(e.target.value.slice(0, 8))}
                      placeholder="2023"
                      className="w-full rounded-lg px-3 py-2 text-sm bg-transparent text-white outline-none tabular-nums"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                    />
                  </Field>
                  <Field label="Days">
                    <input
                      type="number"
                      min={0}
                      value={days}
                      onChange={e => setDays(Math.max(0, Number(e.target.value) || 0))}
                      className="w-full rounded-lg px-3 py-2 text-sm bg-transparent text-white outline-none tabular-nums"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                    />
                  </Field>
                  <Field label={`Rating ${rating.toFixed(1)}`}>
                    <input
                      type="range"
                      min={0}
                      max={10}
                      step={0.1}
                      value={rating}
                      onChange={e => setRating(Number(e.target.value))}
                      className="w-full"
                    />
                  </Field>
                </div>

                <p className="text-[10px] text-[#4a5068] italic">
                  Uses Pollinations Flux for poster art — generation is free. Cache is by names + genre.
                </p>
              </div>

              {/* Preview */}
              <div className="order-1 lg:order-2 flex flex-col items-center">
                <div className="text-[10px] uppercase tracking-wider text-[#4a5068] font-semibold mb-3">
                  Live preview
                </div>
                <div className="lg:sticky lg:top-6 flex flex-col items-center gap-4">
                  <div className="relative">
                    <MoviePoster
                      ref={posterRef}
                      name1={name1}
                      name2={name2}
                      posterUrl={posterUrl}
                      title={finalTitle}
                      tagline={finalTagline}
                      genre={genre}
                      rating={rating}
                      yearMet={year ? `Since ${year}` : 'A love story'}
                      runtime={runtime}
                      onImageLoad={() => {
                        setGenerating(false);
                        toast.success('Poster ready');
                      }}
                      onImageError={() => {
                        setGenerating(false);
                        toast.error('Poster art failed to load — try another genre or retry');
                      }}
                    />
                    {generating && (
                      <div
                        className="absolute inset-0 rounded-2xl flex items-center justify-center flex-col gap-2 pointer-events-none"
                        style={{
                          background: 'rgba(5,6,10,0.7)',
                          backdropFilter: 'blur(4px)',
                        }}
                      >
                        <Loader2 size={28} className="animate-spin text-white" />
                        <span className="text-xs text-white font-semibold">
                          Flux is painting your poster…
                        </span>
                        <span className="text-[10px] text-white/60">
                          ~10-60s for first gen
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={share}
                      disabled={exporting}
                      className="flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold cursor-pointer disabled:opacity-50"
                      style={{ background: 'rgba(255,255,255,0.08)', color: 'white', border: '1px solid rgba(255,255,255,0.12)' }}
                    >
                      {exporting ? <Loader2 size={12} className="animate-spin" /> : <Share2 size={12} />}
                      Share
                    </button>
                    <button
                      onClick={download}
                      disabled={exporting}
                      className="flex items-center gap-1.5 rounded-full px-5 py-2 text-xs font-bold cursor-pointer disabled:opacity-50"
                      style={{
                        background: 'linear-gradient(135deg, #a855f7, #ec4899)',
                        color: 'white',
                        boxShadow: '0 8px 24px -8px rgba(168,85,247,0.5)',
                      }}
                    >
                      {exporting ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                      Download PNG
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-wider text-[#4a5068] font-semibold mb-1.5 block">
        {label}
      </label>
      {children}
    </div>
  );
}
