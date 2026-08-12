'use client';

// AssetUploader — thin wrapper around POST /api/v1/upload for the admin
// template editor. Supports both images (thumbnails, effect assets) and
// short videos (preview_video). Shows the current asset with a swap /
// remove control, or a drop zone if nothing is set yet.

import { useRef, useState } from 'react';
import { Upload, X, Loader2, Image as ImageIcon, Film } from 'lucide-react';
import { toast } from 'sonner';

type Kind = 'image' | 'video';

interface Props {
  value: string | null | undefined;
  onChange: (url: string | null) => void;
  kind?: Kind;
  label?: string;
  hint?: string;
  accent?: string;
  aspect?: string;  // CSS aspect-ratio for the preview frame
}

const ACCEPT: Record<Kind, string> = {
  image: 'image/jpeg,image/png,image/webp,image/gif',
  video: 'video/mp4,video/webm,video/quicktime',
};

export default function AssetUploader({
  value,
  onChange,
  kind = 'image',
  label,
  hint,
  accent = '#ec4899',
  aspect = '1 / 1',
}: Props) {
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

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) upload(file);
  };

  const Icon = kind === 'video' ? Film : ImageIcon;

  return (
    <div>
      {label && <div className="text-xs text-[#a3adc3] mb-1">{label}</div>}

      <input ref={inputRef} type="file" accept={ACCEPT[kind]} onChange={onPick} className="hidden" />

      {value ? (
        <div className="relative rounded-lg overflow-hidden group" style={{ aspectRatio: aspect, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}>
          {kind === 'video' ? (
            <video src={value} muted loop autoPlay playsInline className="w-full h-full object-cover" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="asset" className="w-full h-full object-cover" />
          )}
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="rounded-md px-2.5 py-1.5 text-xs font-semibold cursor-pointer disabled:opacity-40"
              style={{ background: accent, color: '#fff' }}
            >
              {uploading ? <Loader2 size={12} className="animate-spin" /> : 'Replace'}
            </button>
            <button
              type="button"
              onClick={() => onChange(null)}
              className="rounded-md px-2.5 py-1.5 text-xs font-semibold cursor-pointer text-[#f87171] bg-black/60 hover:bg-[#f8717120]"
            >
              <X size={12} />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-full rounded-lg flex flex-col items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40"
          style={{ aspectRatio: aspect, background: `${accent}0d`, border: `1px dashed ${accent}66` }}
        >
          {uploading ? (
            <>
              <Loader2 size={20} className="animate-spin" style={{ color: accent }} />
              <span className="text-[10px] font-semibold" style={{ color: accent }}>Uploading…</span>
            </>
          ) : (
            <>
              <div className="flex items-center gap-1" style={{ color: accent }}>
                <Upload size={16} /> <Icon size={16} />
              </div>
              <span className="text-[10px] font-semibold" style={{ color: accent }}>
                Upload {kind === 'video' ? 'video (mp4)' : 'image'}
              </span>
            </>
          )}
        </button>
      )}

      {hint && <div className="text-[10px] text-[#4a5068] mt-1">{hint}</div>}
    </div>
  );
}
