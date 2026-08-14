'use client';

// DynamicForm — walks a template's fields_schema and renders an input
// for each field. Values are collected into a single `data` object
// that the parent stores as the kiss's template_data.
//
// Supported input types (8): text, textarea, number, color, select,
// toggle, date, image. Image uploads go to /api/v1/upload (R2) and
// store the returned URL as the field value — effects can reference
// it via {key} placeholder substitution.

import { useRef, useState } from 'react';
import { Upload, X, Loader2, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import type { FieldSpec } from './fields';

interface Props {
  schema: FieldSpec[];
  data: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  accent?: string;
}

export default function DynamicForm({ schema, data, onChange, accent = '#ec4899' }: Props) {
  if (!schema?.length) return null;

  const setField = (key: string, value: unknown) => {
    onChange({ ...data, [key]: value });
  };

  return (
    <div className="space-y-4">
      {schema.map(field => {
        const v = data[field.key] ?? field.default ?? '';
        const inputBase = 'w-full px-3 py-2 rounded-lg border border-white/10 bg-black/30 text-white placeholder-white/40 focus:outline-none focus:ring-2';
        const ringStyle = { boxShadow: `0 0 0 0 ${accent}` };

        return (
          <label key={field.key} className="block">
            <div className="text-sm font-medium text-white/80 mb-1.5 flex items-center gap-1.5">
              {field.label}
              {field.required && <span style={{ color: accent }}>*</span>}
            </div>

            {field.type === 'text' && (
              <input
                type="text"
                value={String(v)}
                onChange={e => setField(field.key, e.target.value)}
                placeholder={field.placeholder}
                maxLength={field.maxLength}
                className={inputBase}
                style={ringStyle}
              />
            )}

            {field.type === 'textarea' && (
              <textarea
                value={String(v)}
                onChange={e => setField(field.key, e.target.value)}
                placeholder={field.placeholder}
                maxLength={field.maxLength}
                rows={3}
                className={`${inputBase} resize-none`}
                style={ringStyle}
              />
            )}

            {field.type === 'number' && (
              <input
                type="number"
                value={v === '' ? '' : Number(v)}
                onChange={e => setField(field.key, e.target.value === '' ? '' : Number(e.target.value))}
                min={field.min}
                max={field.max}
                step={field.step ?? 1}
                placeholder={field.placeholder}
                className={inputBase}
                style={ringStyle}
              />
            )}

            {field.type === 'color' && (
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={String(v || '#ec4899')}
                  onChange={e => setField(field.key, e.target.value)}
                  className="w-12 h-10 rounded-lg border border-white/10 bg-transparent cursor-pointer"
                />
                <input
                  type="text"
                  value={String(v)}
                  onChange={e => setField(field.key, e.target.value)}
                  placeholder="#ec4899"
                  maxLength={7}
                  className={`${inputBase} flex-1`}
                  style={ringStyle}
                />
              </div>
            )}

            {field.type === 'select' && field.options && (
              <select
                value={String(v)}
                onChange={e => setField(field.key, e.target.value)}
                className={inputBase}
                style={ringStyle}
              >
                <option value="">— pick one —</option>
                {field.options.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            )}

            {field.type === 'toggle' && (
              <button
                type="button"
                onClick={() => setField(field.key, !v)}
                className={`relative w-12 h-6 rounded-full transition-colors cursor-pointer ${v ? '' : 'bg-white/20'}`}
                style={v ? { background: accent } : undefined}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${v ? 'translate-x-[26px]' : 'translate-x-0.5'}`}
                />
              </button>
            )}

            {field.type === 'date' && (
              <input
                type="date"
                value={String(v)}
                onChange={e => setField(field.key, e.target.value)}
                className={inputBase}
                style={ringStyle}
              />
            )}

            {field.type === 'image' && (
              <ImageInput
                value={typeof v === 'string' ? v : ''}
                onChange={url => setField(field.key, url)}
                accent={accent}
              />
            )}

            {field.type === 'audio-url' && (
              <div>
                <input
                  type="url"
                  value={String(v)}
                  onChange={e => setField(field.key, e.target.value)}
                  placeholder="https://youtu.be/… · https://open.spotify.com/… · direct .mp3 link"
                  maxLength={500}
                  className={inputBase}
                  style={ringStyle}
                />
                <div className="text-[10px] text-white/50 mt-1 leading-relaxed">
                  Paste a link — YouTube, Spotify, SoundCloud, or a direct MP3.
                  Recipient sees a play button; music plays when they tap.
                </div>
              </div>
            )}

            {field.type === 'password' && (
              <div>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={String(v)}
                  onChange={e => setField(field.key, e.target.value.replace(/\D/g, '').slice(0, 8))}
                  placeholder="e.g. 1412 (an anniversary date, their favorite number…)"
                  className={`${inputBase} tracking-widest font-mono`}
                  style={ringStyle}
                />
                <div className="text-[10px] text-white/50 mt-1 leading-relaxed">
                  Recipient must enter this exact number to unlock the reveal.
                  Pick something they&apos;ll know but nobody else would guess.
                </div>
              </div>
            )}

            {field.hint && <div className="text-xs text-white/50 mt-1">{field.hint}</div>}
          </label>
        );
      })}
    </div>
  );
}

// ── ImageInput — R2 upload + preview, used by field type "image" ─────
function ImageInput({ value, onChange, accent }: { value: string; onChange: (url: string) => void; accent: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/v1/upload', { method: 'POST', credentials: 'same-origin', body: fd });
      const json = await res.json();
      if (!res.ok || !json.data?.url) throw new Error(json.error?.message || 'Upload failed');
      onChange(json.data.url as string);
      toast.success('Uploaded');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) upload(file);
        }}
        className="hidden"
      />

      {value ? (
        <div className="relative rounded-lg overflow-hidden group h-32 w-32" style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="upload" className="w-full h-full object-cover" />
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 flex items-center justify-center gap-1.5">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="rounded-md px-2.5 py-1.5 text-[10px] font-semibold cursor-pointer disabled:opacity-40"
              style={{ background: accent, color: '#fff' }}
            >
              {uploading ? <Loader2 size={11} className="animate-spin" /> : 'Replace'}
            </button>
            <button
              type="button"
              onClick={() => onChange('')}
              className="rounded-md px-2 py-1.5 text-[10px] font-semibold cursor-pointer text-[#f87171] bg-black/60 hover:bg-[#f8717120]"
            >
              <X size={11} />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="h-32 w-32 rounded-lg flex flex-col items-center justify-center gap-1 cursor-pointer disabled:opacity-40"
          style={{ background: `${accent}0d`, border: `1px dashed ${accent}66` }}
        >
          {uploading ? (
            <>
              <Loader2 size={18} className="animate-spin" style={{ color: accent }} />
              <span className="text-[10px] font-semibold" style={{ color: accent }}>Uploading…</span>
            </>
          ) : (
            <>
              <div className="flex items-center gap-1" style={{ color: accent }}>
                <Upload size={14} /> <ImageIcon size={14} />
              </div>
              <span className="text-[10px] font-semibold" style={{ color: accent }}>Upload photo</span>
            </>
          )}
        </button>
      )}
    </div>
  );
}
