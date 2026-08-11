'use client';

import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Image as ImageIcon, Loader2, Camera, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { localDateKey } from '@/lib/streaks';

type Props = {
  open: boolean;
  streakId: string;
  streakTitle: string;
  streakIcon: string;
  /** Optional — show the author's avatar in the compose header so it
   *  reads like "you're posting AS this person". */
  authorName?: string | null;
  authorAvatar?: string | null;
  /** Called after the tick is POSTed. Caller should refresh the SWR cache. */
  onTicked: (state: 'pending' | 'confirmed') => void;
  onClose: () => void;
};

/** FB-status-compose-style tick modal:
 *   - Header with author avatar + streak title
 *   - Big "How did it go?" textarea up top
 *   - Big photo preview / dashed dropzone below
 *   - Single primary Submit button
 *
 *  The visual hierarchy mirrors Facebook's "What's on your mind?" composer
 *  so users intuitively know how to interact. Photo is required by the
 *  caller (proof streaks); we soft-block submit until one is attached. */
export function TickPhotoModal({
  open,
  streakId,
  streakTitle,
  streakIcon,
  authorName,
  authorAvatar,
  onTicked,
  onClose,
}: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  function pick(f: File | null) {
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      toast.error('Image only');
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      toast.error('Image too large (max 10MB)');
      return;
    }
    setFile(f);
    setPreviewUrl(prev => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(f);
    });
  }

  function reset() {
    setFile(null);
    setPreviewUrl(prev => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setNote('');
  }

  async function submit() {
    if (!file) {
      toast.error('Attach a photo first');
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const up = await fetch('/api/v1/upload', {
        method: 'POST',
        body: fd,
        credentials: 'same-origin',
      });
      if (!up.ok) {
        const err = await up.json().catch(() => null);
        throw new Error(err?.error?.message || 'Upload failed');
      }
      const upJson = (await up.json()) as { data: { url: string } };

      const res = await fetch(`/api/v1/streaks/${streakId}/tick`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          date: localDateKey(),
          note,
          photo_url: upJson.data.url,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error?.message || 'Tick failed');
      }
      const json = (await res.json()) as { data: { confirmation_state: 'pending' | 'confirmed' } };
      const state = json.data.confirmation_state;
      toast.success(
        state === 'pending'
          ? 'Posted — waiting for peer approval'
          : `🔥 Day logged for ${streakTitle}`,
      );
      onTicked(state);
      reset();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;
  if (typeof document === 'undefined') return null;

  const placeholder = authorName
    ? `How did it go, ${authorName.split(' ')[0]}?`
    : 'How did it go?';

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-260 flex items-end justify-center lg:items-center lg:p-6"
        style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      >
        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 30, stiffness: 280 }}
          className="w-full lg:max-w-2xl lg:min-w-140 max-h-[92vh] overflow-y-auto rounded-t-3xl lg:rounded-3xl flex flex-col"
          style={{
            background: '#0a0b0f',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 20px 60px -10px rgba(0,0,0,0.6)',
          }}
        >
          {/* Sticky header */}
          <div
            className="flex items-center gap-3 px-5 py-4 sticky top-0 z-10"
            style={{
              background: '#0a0b0f',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
            }}
          >
            <button onClick={onClose} className="p-1 rounded-full cursor-pointer hover:bg-white/10">
              <X size={20} className="text-white" />
            </button>
            <div className="flex-1 text-center">
              <div className="text-sm font-bold text-white">New tick</div>
              <div className="text-[10px] text-[#4a5068] flex items-center justify-center gap-1">
                <span>{streakIcon}</span>
                <span className="truncate max-w-64">{streakTitle}</span>
              </div>
            </div>
            <div className="w-7" />
          </div>

          <div className="px-5 lg:px-6 py-5 space-y-4">
            {/* Author identity strip — FB style */}
            <div className="flex items-center gap-3">
              {authorAvatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={authorAvatar}
                  alt=""
                  className="h-11 w-11 rounded-full object-cover shrink-0"
                />
              ) : (
                <div
                  className="h-11 w-11 rounded-full flex items-center justify-center text-sm font-medium text-[#a3adc3] shrink-0"
                  style={{ background: 'rgba(255,255,255,0.06)' }}
                >
                  {(authorName || '?').charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-white truncate">
                  {authorName || 'You'}
                </div>
                <div
                  className="inline-flex items-center gap-1 mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-medium"
                  style={{
                    background: 'rgba(0,212,255,0.1)',
                    color: '#00d4ff',
                    border: '1px solid rgba(0,212,255,0.2)',
                  }}
                >
                  <Sparkles size={10} />
                  <span>Logging a tick</span>
                </div>
              </div>
            </div>

            {/* Note — FB-style big textarea */}
            <textarea
              value={note}
              onChange={e => setNote(e.target.value.slice(0, 280))}
              placeholder={placeholder}
              rows={3}
              autoFocus
              className="w-full bg-transparent text-lg lg:text-xl text-white outline-none resize-none placeholder:text-[#4a5068] leading-snug"
            />
            <div className="text-[10px] text-[#4a5068] text-right -mt-2">
              {note.length}/280
            </div>

            {/* Photo: dropzone or preview */}
            {!previewUrl ? (
              <button
                onClick={() => fileRef.current?.click()}
                className="flex flex-col items-center justify-center w-full rounded-2xl cursor-pointer transition-colors hover:bg-white/2"
                style={{
                  height: 220,
                  background: 'rgba(0,212,255,0.03)',
                  border: '1.5px dashed rgba(0,212,255,0.3)',
                }}
              >
                <ImageIcon size={32} className="text-[#00d4ff] mb-2" />
                <span className="text-sm text-white font-medium">Add a photo</span>
                <span className="text-[10px] text-[#4a5068] mt-1">Required — buddies see this to verify</span>
              </button>
            ) : (
              <div
                className="relative rounded-2xl overflow-hidden bg-black flex items-center justify-center"
                style={{ minHeight: '40vh', maxHeight: '55vh' }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt=""
                  className="max-w-full max-h-[55vh] w-auto h-auto object-contain"
                />
                <button
                  onClick={() => {
                    setFile(null);
                    setPreviewUrl(prev => {
                      if (prev) URL.revokeObjectURL(prev);
                      return null;
                    });
                  }}
                  className="absolute top-3 right-3 h-8 w-8 rounded-full flex items-center justify-center cursor-pointer backdrop-blur-md transition-colors hover:bg-black/70"
                  style={{ background: 'rgba(0,0,0,0.55)', color: 'white' }}
                  aria-label="Remove photo"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            {/* Add-to-post toolbar — FB-style row of action chips */}
            <div
              className="flex items-center justify-between rounded-2xl px-3 py-2"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.05)',
              }}
            >
              <span className="text-xs text-[#a3adc3] pl-1">Add to your tick</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => fileRef.current?.click()}
                  className="h-8 w-8 rounded-full flex items-center justify-center cursor-pointer hover:bg-white/5 transition-colors"
                  aria-label="Choose photo"
                  title="Choose from library"
                >
                  <ImageIcon size={16} className="text-[#34d399]" />
                </button>
                <button
                  onClick={() => cameraRef.current?.click()}
                  className="h-8 w-8 rounded-full flex items-center justify-center cursor-pointer hover:bg-white/5 transition-colors"
                  aria-label="Open camera"
                  title="Take a photo"
                >
                  <Camera size={16} className="text-[#fbbf24]" />
                </button>
              </div>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => pick(e.target.files?.[0] ?? null)}
            />
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={e => pick(e.target.files?.[0] ?? null)}
            />

            {/* Submit button — full width, prominent */}
            <button
              onClick={submit}
              disabled={!file || submitting}
              className="w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold cursor-pointer disabled:opacity-40 transition-transform active:scale-[0.99]"
              style={{
                background: file
                  ? 'linear-gradient(135deg, #00d4ff, #a855f7)'
                  : 'rgba(255,255,255,0.05)',
                color: file ? '#0a0b0f' : '#4a5068',
                boxShadow: file ? '0 8px 25px -8px rgba(0,212,255,0.5)' : 'none',
              }}
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Posting...
                </>
              ) : (
                <>🔥 Post tick</>
              )}
            </button>

            <p className="text-[10px] text-[#4a5068] text-center -mt-1">
              Buddies will see this photo and vote to confirm your tick.
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}
