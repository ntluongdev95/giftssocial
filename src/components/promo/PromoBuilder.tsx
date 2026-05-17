'use client';

// Freeform "Promo Story" builder.
//
// 9:16 portrait canvas + a panel of draggable element types (text,
// sticker, image, button, gift card). Element positions are stored as
// percentages of the canvas, so the same JSON renders at any output
// size — preview thumb, notification card, full-screen story.
//
// Interactions:
//   • Click an element type → spawns one at canvas centre, selected
//   • Drag selected element to reposition
//   • Pinch (touch) or wheel (mouse) on the resize handle to size up
//   • Tap blank area to deselect
//
// Persistence: callers pass the elements array + setter; this component
// is purely controlled — no API calls of its own.

import { useEffect, useRef, useState } from 'react';
import { Type, Image as ImageIcon, Smile, Square, Gift, Trash2, RotateCw, Upload, Loader2, Copy } from 'lucide-react';
import { toast } from 'sonner';

// Element types in the schema. Add new ones here + extend `renderElement`.
export type ElementType = 'text' | 'image' | 'sticker' | 'button' | 'giftcard';

export interface PromoElement {
  id: string;
  type: ElementType;
  // Position + size in % of canvas (0..100)
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  z: number;
  // Per-type props
  text?: string;
  color?: string;
  fontWeight?: number;
  fontSize?: number;        // px at the reference canvas (540 wide)
  src?: string;             // image url
  emoji?: string;           // for stickers
  bgColor?: string;         // for buttons
  fontFamily?: string;
  fontStyle?: 'normal' | 'italic';
}

// Font family presets exposed in the editor. Values map directly to
// CSS font-family stacks. SCRIPT uses the Caveat web font loaded
// globally in app/layout.tsx as --font-caveat.
export const FONT_FAMILIES: { id: string; label: string; value: string }[] = [
  { id: 'sans',   label: 'Sans',   value: 'system-ui, -apple-system, "Helvetica Neue", sans-serif' },
  { id: 'serif',  label: 'Serif',  value: 'Georgia, "Times New Roman", serif' },
  { id: 'script', label: 'Script', value: 'var(--font-caveat), "Caveat", "Brush Script MT", cursive' },
  { id: 'mono',   label: 'Mono',   value: '"SF Mono", Menlo, Consolas, monospace' },
];

// Reference canvas dimensions. The runtime canvas is scaled to fit
// container; this is used for fontSize and similar pixel-perfect props.
const REF_W = 540;
const REF_H = 960;

export function PromoBuilder({
  elements,
  onChange,
  backgroundColor,
  backgroundImage,
  backgroundGradientTo,
}: {
  elements: PromoElement[];
  onChange: (next: PromoElement[]) => void;
  backgroundColor: string;
  backgroundImage?: string | null;
  backgroundGradientTo?: string | null;
}) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [size, setSize] = useState({ w: REF_W, h: REF_H });

  // Observe canvas size so we can convert pointer coords to %.
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      setSize({ w: rect.width, h: rect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Spawn a new element at the canvas centre. Defaults vary by type.
  const addElement = (type: ElementType) => {
    const id = `el_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const base: PromoElement = {
      id, type,
      x: 30, y: 40,    // centred-ish (top-left at 30,40 → width 40 → centred)
      w: 40, h: 12,
      rotation: 0,
      z: elements.length,
    };
    let el: PromoElement;
    switch (type) {
      case 'text':
        el = { ...base, w: 60, h: 14, x: 20, y: 30, text: 'Your headline', color: '#1a1a2e', fontSize: 44, fontWeight: 800 };
        break;
      case 'sticker':
        el = { ...base, w: 20, h: 12, x: 40, y: 35, emoji: '✨' };
        break;
      case 'image':
        el = { ...base, w: 60, h: 35, x: 20, y: 25, src: '' };
        break;
      case 'button':
        el = { ...base, w: 45, h: 9, x: 27, y: 80, text: 'Claim now', color: '#ffffff', bgColor: '#c41e3a', fontSize: 22, fontWeight: 700 };
        break;
      case 'giftcard':
        el = { ...base, w: 70, h: 30, x: 15, y: 55 };
        break;
    }
    onChange([...elements, el]);
    setSelectedId(id);
  };

  const updateElement = (id: string, patch: Partial<PromoElement>) => {
    onChange(elements.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  };

  const removeElement = (id: string) => {
    onChange(elements.filter((e) => e.id !== id));
    setSelectedId(null);
  };

  // ── Pointer drag — single source of truth for element move + resize ──
  const dragRef = useRef<{ id: string; mode: 'move' | 'resize'; startX: number; startY: number; startEl: PromoElement } | null>(null);

  const beginDrag = (e: React.PointerEvent, id: string, mode: 'move' | 'resize') => {
    e.preventDefault();
    e.stopPropagation();
    const el = elements.find((x) => x.id === id);
    if (!el) return;
    setSelectedId(id);
    dragRef.current = { id, mode, startX: e.clientX, startY: e.clientY, startEl: { ...el } };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const continueDrag = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = ((e.clientX - d.startX) / size.w) * 100;
    const dy = ((e.clientY - d.startY) / size.h) * 100;
    if (d.mode === 'move') {
      updateElement(d.id, {
        x: clamp(d.startEl.x + dx, 0, 100 - d.startEl.w),
        y: clamp(d.startEl.y + dy, 0, 100 - d.startEl.h),
      });
    } else {
      // Resize from bottom-right corner — proportional to drag delta.
      updateElement(d.id, {
        w: clamp(d.startEl.w + dx, 6, 100 - d.startEl.x),
        h: clamp(d.startEl.h + dy, 6, 100 - d.startEl.y),
      });
    }
  };

  const endDrag = (e: React.PointerEvent) => {
    if (dragRef.current) {
      try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* */ }
    }
    dragRef.current = null;
  };

  const selectedEl = elements.find((e) => e.id === selectedId) || null;

  // Canvas background — either an image, a gradient, or a solid colour.
  const canvasBg = (() => {
    if (backgroundImage) {
      return {
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      };
    }
    if (backgroundGradientTo) {
      return {
        background: `linear-gradient(160deg, ${backgroundColor}, ${backgroundGradientTo})`,
      };
    }
    return { background: backgroundColor };
  })();

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-full">
      {/* ── Canvas ────────────────────────────────────────────────────────
           Canvas width = min(column width, column height × 9/16) so the
           9:16 box always fits whichever axis is the binding constraint
           — no internal scroll on either mobile or desktop. The parent
           sets containerType: size so 100cqw/100cqh resolve to the
           column's actual dimensions. */}
      <div
        className="flex-1 flex items-center justify-center min-h-0"
        style={{ containerType: 'size' }}
      >
        <div
          className="relative shadow-2xl overflow-hidden"
          style={{
            aspectRatio: '9 / 16',
            width: 'min(100cqw, calc(100cqh * 9 / 16))',
            height: 'auto',
            borderRadius: '24px',
            flexShrink: 0,
            ...canvasBg,
          }}
          ref={canvasRef}
          onPointerMove={continueDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedId(null); }}
        >
          {elements.map((el) => (
            <ElementOnCanvas
              key={el.id}
              el={el}
              selected={selectedId === el.id}
              onPointerDown={(e) => beginDrag(e, el.id, 'move')}
              onResizeStart={(e) => beginDrag(e, el.id, 'resize')}
              onDelete={() => removeElement(el.id)}
              onRotate={() => updateElement(el.id, { rotation: (el.rotation || 0) + 15 })}
              onDuplicate={() => {
                const dup: PromoElement = {
                  ...el,
                  id: `el_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                  x: Math.min(el.x + 4, 100 - el.w),
                  y: Math.min(el.y + 4, 100 - el.h),
                  z: elements.length,
                };
                onChange([...elements, dup]);
                setSelectedId(dup.id);
              }}
              canvasSize={size}
            />
          ))}
        </div>
      </div>

      {/* ── Tool panel ──────────────────────────────────────────────────── */}
      <div className="lg:w-[280px] flex flex-col gap-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#4a5068]">Add element</p>
        <div className="grid grid-cols-3 lg:grid-cols-2 gap-2">
          <ToolButton icon={<Type size={18} />} label="Text" onClick={() => addElement('text')} />
          <ToolButton icon={<Smile size={18} />} label="Sticker" onClick={() => addElement('sticker')} />
          <ToolButton icon={<ImageIcon size={18} />} label="Image" onClick={() => addElement('image')} />
          <ToolButton icon={<Square size={18} />} label="Button" onClick={() => addElement('button')} />
          <ToolButton icon={<Gift size={18} />} label="Gift card" onClick={() => addElement('giftcard')} />
        </div>

        {/* Selection editor */}
        {selectedEl && (
          <div
            className="rounded-2xl p-3 space-y-3"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#00d4ff]">
                Edit {selectedEl.type}
              </p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => updateElement(selectedEl.id, { rotation: (selectedEl.rotation || 0) + 15 })}
                  aria-label="Rotate"
                  className="h-7 w-7 flex items-center justify-center rounded-md cursor-pointer hover:bg-white/5"
                >
                  <RotateCw size={14} className="text-[#a3adc3]" />
                </button>
                <button
                  type="button"
                  onClick={() => removeElement(selectedEl.id)}
                  aria-label="Delete"
                  className="h-7 w-7 flex items-center justify-center rounded-md cursor-pointer hover:bg-red-500/10"
                >
                  <Trash2 size={14} className="text-[#f87171]" />
                </button>
              </div>
            </div>

            <ElementEditor
              element={selectedEl}
              onChange={(patch) => updateElement(selectedEl.id, patch)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Single element rendered on the canvas ───────────────────────────────
function ElementOnCanvas({
  el, selected, onPointerDown, onResizeStart, onDelete, onRotate, onDuplicate, canvasSize,
}: {
  el: PromoElement;
  selected: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onResizeStart: (e: React.PointerEvent) => void;
  onDelete: () => void;
  onRotate: () => void;
  onDuplicate: () => void;
  canvasSize: { w: number; h: number };
}) {
  // fontSize stored in REF coords; scale to live canvas.
  const scale = canvasSize.w / REF_W;
  const fontSize = (el.fontSize || 20) * scale;

  let inner: React.ReactNode = null;
  if (el.type === 'text') {
    inner = (
      <span
        className="leading-tight select-none"
        style={{
          color: el.color || '#1a1a2e',
          fontWeight: el.fontWeight || 700,
          fontStyle: el.fontStyle || 'normal',
          fontSize,
          fontFamily: el.fontFamily || 'system-ui, sans-serif',
          textAlign: 'center',
          width: '100%',
          display: 'block',
        }}
      >
        {el.text || 'Text'}
      </span>
    );
  } else if (el.type === 'sticker') {
    inner = (
      <span className="select-none" style={{ fontSize: fontSize * 1.6 }} aria-hidden>
        {el.emoji || '✨'}
      </span>
    );
  } else if (el.type === 'image') {
    inner = el.src ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={el.src} alt="" className="h-full w-full object-cover rounded-xl" draggable={false} />
    ) : (
      <div className="h-full w-full rounded-xl flex items-center justify-center text-[11px] text-white/70"
        style={{ background: 'rgba(0,0,0,0.25)', border: '1px dashed rgba(255,255,255,0.4)' }}
      >
        Image — paste URL
      </div>
    );
  } else if (el.type === 'button') {
    inner = (
      <button
        type="button"
        className="h-full w-full rounded-full font-bold select-none cursor-grab"
        style={{
          background: el.bgColor || '#c41e3a',
          color: el.color || 'white',
          fontWeight: el.fontWeight || 700,
          fontStyle: el.fontStyle || 'normal',
          fontFamily: el.fontFamily || 'system-ui, sans-serif',
          fontSize,
        }}
      >
        {el.text || 'Tap me'}
      </button>
    );
  } else if (el.type === 'giftcard') {
    inner = (
      <div
        className="h-full w-full rounded-2xl flex items-center justify-center text-white text-center text-[12px] font-bold select-none"
        style={{
          background: 'linear-gradient(135deg, #00d4ff, #a78bfa)',
          boxShadow: '0 12px 24px -10px rgba(0,212,255,0.6)',
        }}
      >
        🎁 Gift card preview
      </div>
    );
  }

  return (
    <div
      className="absolute touch-none cursor-grab active:cursor-grabbing"
      style={{
        left: `${el.x}%`,
        top: `${el.y}%`,
        width: `${el.w}%`,
        height: `${el.h}%`,
        transform: `rotate(${el.rotation || 0}deg)`,
        zIndex: el.z + 10,
        outline: selected ? '2px solid #00d4ff' : 'none',
        outlineOffset: '2px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onPointerDown={onPointerDown}
    >
      {inner}
      {selected && (
        <>
          {/* Floating quick-action toolbar — above element, top-right.
              Stops pointer events so it doesn't trigger drag. */}
          <div
            className="absolute flex items-center gap-1 rounded-lg px-1 py-1"
            style={{
              top: '-36px',
              right: '0px',
              background: 'rgba(20,22,31,0.92)',
              border: '1px solid rgba(255,255,255,0.12)',
              boxShadow: '0 6px 16px -6px rgba(0,0,0,0.6)',
              backdropFilter: 'blur(6px)',
              zIndex: 1000,
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={onDuplicate}
              aria-label="Duplicate"
              title="Sao chép"
              className="h-7 w-7 flex items-center justify-center rounded cursor-pointer hover:bg-white/10"
            >
              <Copy size={13} className="text-[#a3adc3]" />
            </button>
            <button
              type="button"
              onClick={onRotate}
              aria-label="Rotate"
              title="Xoay 15°"
              className="h-7 w-7 flex items-center justify-center rounded cursor-pointer hover:bg-white/10"
            >
              <RotateCw size={13} className="text-[#a3adc3]" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              aria-label="Delete"
              title="Xoá"
              className="h-7 w-7 flex items-center justify-center rounded cursor-pointer hover:bg-red-500/15"
            >
              <Trash2 size={13} className="text-[#f87171]" />
            </button>
          </div>

          {/* Resize handle — bottom-right corner */}
          <button
            type="button"
            className="absolute -bottom-1.5 -right-1.5 h-4 w-4 rounded-full cursor-nwse-resize touch-none"
            style={{ background: '#00d4ff', border: '2px solid white', boxShadow: '0 1px 4px rgba(0,0,0,0.4)' }}
            aria-label="Resize"
            onPointerDown={onResizeStart}
          />
        </>
      )}
    </div>
  );
}

// ─── Per-type editor controls ────────────────────────────────────────────
function ElementEditor({
  element, onChange,
}: { element: PromoElement; onChange: (patch: Partial<PromoElement>) => void }) {
  if (element.type === 'text' || element.type === 'button') {
    const isBold = (element.fontWeight || 700) >= 700;
    const isItalic = element.fontStyle === 'italic';
    // Match current font to one of our presets by exact value, else 'sans'.
    const currentFamilyId = FONT_FAMILIES.find((f) => f.value === element.fontFamily)?.id || 'sans';
    return (
      <div className="space-y-2">
        <Field label="Text">
          <input
            type="text"
            value={element.text || ''}
            onChange={(e) => onChange({ text: e.target.value })}
            className="w-full rounded-lg px-3 py-2 text-sm" style={inputStyle}
          />
        </Field>

        {/* Font family + style row */}
        <Field label="Font">
          <div className="flex items-center gap-1.5">
            <select
              value={currentFamilyId}
              onChange={(e) => {
                const next = FONT_FAMILIES.find((f) => f.id === e.target.value);
                if (next) onChange({ fontFamily: next.value });
              }}
              className="flex-1 rounded-lg px-2 py-1.5 text-xs cursor-pointer"
              style={inputStyle}
            >
              {FONT_FAMILIES.map((f) => (
                <option key={f.id} value={f.id} style={{ fontFamily: f.value, background: '#14161f', color: '#f0f4ff' }}>
                  {f.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => onChange({ fontWeight: isBold ? 400 : 800 })}
              aria-pressed={isBold}
              title="Bold"
              className="h-8 w-8 flex items-center justify-center rounded-md cursor-pointer text-xs font-bold"
              style={{
                background: isBold ? 'rgba(0,212,255,0.18)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${isBold ? 'rgba(0,212,255,0.45)' : 'rgba(255,255,255,0.08)'}`,
                color: isBold ? '#00d4ff' : '#a3adc3',
              }}
            >
              B
            </button>
            <button
              type="button"
              onClick={() => onChange({ fontStyle: isItalic ? 'normal' : 'italic' })}
              aria-pressed={isItalic}
              title="Italic"
              className="h-8 w-8 flex items-center justify-center rounded-md cursor-pointer text-xs italic"
              style={{
                background: isItalic ? 'rgba(0,212,255,0.18)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${isItalic ? 'rgba(0,212,255,0.45)' : 'rgba(255,255,255,0.08)'}`,
                color: isItalic ? '#00d4ff' : '#a3adc3',
                fontFamily: 'Georgia, serif',
                fontWeight: 600,
              }}
            >
              I
            </button>
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-2">
          <Field label="Color">
            <input type="color" value={element.color || '#1a1a2e'}
              onChange={(e) => onChange({ color: e.target.value })}
              className="h-9 w-full cursor-pointer rounded-lg"
            />
          </Field>
          <Field label="Size">
            <input type="number" min={10} max={240}
              value={element.fontSize || 24}
              onChange={(e) => onChange({ fontSize: Number(e.target.value) })}
              className="w-full rounded-lg px-3 py-2 text-sm" style={inputStyle}
            />
          </Field>
        </div>
        {element.type === 'button' && (
          <Field label="Button colour">
            <input type="color" value={element.bgColor || '#c41e3a'}
              onChange={(e) => onChange({ bgColor: e.target.value })}
              className="h-9 w-full cursor-pointer rounded-lg"
            />
          </Field>
        )}
      </div>
    );
  }
  if (element.type === 'sticker') {
    return (
      <Field label="Emoji">
        <input type="text" value={element.emoji || ''}
          onChange={(e) => onChange({ emoji: e.target.value.slice(0, 4) })}
          className="w-full rounded-lg px-3 py-2 text-center text-2xl" style={inputStyle}
          placeholder="✨"
        />
      </Field>
    );
  }
  if (element.type === 'image') {
    return <ImageElementEditor element={element} onChange={onChange} />;
  }
  if (element.type === 'giftcard') {
    return (
      <p className="text-[11px] text-[#a3adc3]">
        Gift card auto-fills with the template you attach to this promo on Save.
      </p>
    );
  }
  return null;
}

// ─── Image element editor — upload + paste URL ──────────────────────────
// Self-contained: posts to /api/v1/upload (same endpoint other surfaces
// use) and writes the returned url back via `onChange({ src })`.
function ImageElementEditor({
  element, onChange,
}: { element: PromoElement; onChange: (patch: Partial<PromoElement>) => void }) {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Chỉ chấp nhận file ảnh');
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/v1/upload', { method: 'POST', body: fd, credentials: 'same-origin' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || 'Upload failed');
      const url = json.data?.url as string | undefined;
      if (!url) throw new Error('Upload did not return a URL');
      onChange({ src: url });
      toast.success('Đã cập nhật ảnh');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Field label={element.src ? 'Image — change or update' : 'Image — upload or paste URL'}>
        <div className="flex flex-col gap-2">
          {element.src && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={element.src}
              alt=""
              className="w-full h-24 object-cover rounded-lg"
              style={{ border: '1px solid rgba(255,255,255,0.08)' }}
            />
          )}
          <label
            className={`flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold ${uploading ? 'opacity-60' : 'cursor-pointer'}`}
            style={{
              background: 'rgba(0,212,255,0.08)',
              border: '1px solid rgba(0,212,255,0.25)',
              color: '#00d4ff',
            }}
          >
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            <span>{uploading ? 'Đang upload…' : element.src ? 'Đổi ảnh khác' : 'Upload ảnh'}</span>
            <input type="file" accept="image/*" onChange={handleUpload} disabled={uploading} className="hidden" />
          </label>
          <input
            type="url"
            value={element.src || ''}
            onChange={(e) => onChange({ src: e.target.value })}
            className="w-full rounded-lg px-3 py-2 text-xs"
            style={inputStyle}
            placeholder="Hoặc dán URL: /images/..."
          />
          {element.src && (
            <button
              type="button"
              onClick={() => onChange({ src: '' })}
              className="text-[10px] text-red-300 cursor-pointer self-start"
            >
              Xoá ảnh
            </button>
          )}
        </div>
      </Field>
    </div>
  );
}

// ─── Small UI helpers ───────────────────────────────────────────────────
function ToolButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      type="button"
      className="flex flex-col items-center gap-1 rounded-2xl py-3 cursor-pointer transition-colors"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      <span className="text-[#00d4ff]">{icon}</span>
      <span className="text-[10px] font-semibold text-[#a3adc3]">{label}</span>
    </button>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline gap-2 mb-1">
        <label className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#4a5068]">{label}</label>
        {hint && <span className="text-[9px] text-[#4a5068]">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.06)',
  color: '#f0f4ff',
};

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}
