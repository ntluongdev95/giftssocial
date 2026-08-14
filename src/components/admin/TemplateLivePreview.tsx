'use client';

// TemplateLivePreview — 2-mode preview for the template editor:
//
//   1. INLINE (device frame) — shows the effects[] JSON via the
//      TemplateRenderer engine inside a Mobile/Tablet/Desktop chrome.
//      Used for data-driven templates where the effects are the source
//      of truth.
//
//   2. FULLSCREEN — when a template has a registered React component
//      (component_key matches a folder in src/components/reveals/[key]),
//      the "▶ Play fullscreen" button mounts the ACTUAL React component
//      over the whole viewport with a synthetic Kiss built from the
//      admin's sample answers. This matches the recipient experience
//      exactly.
//
// Controls:
//   • Device toggle (inline mode)
//   • ▶ Play fullscreen  (React templates only — mounts real component)
//   • ↻ Replay           (rewinds the effects timeline)

import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import TemplateRenderer from '@/components/reveals/TemplateRenderer';
import DynamicForm from '@/components/reveals/DynamicForm';
import { getTemplate } from '@/components/reveals/_registry';
import type { EffectSpec } from '@/components/reveals/_effects/_types';
import type { FieldSpec } from '@/components/reveals/fields';
import type { RevealKiss } from '@/components/reveals/_types';
import { initialDataFromSchema } from '@/components/reveals/fields';
import { RefreshCw, Smartphone, Tablet, Monitor, Play, Sparkles } from 'lucide-react';

interface Props {
  effects: EffectSpec[];
  fieldsSchema: FieldSpec[];
  accent?: string;
  /** DB template id — used to look up a registered React component in
   *  _registry.ts. When present + registered, the "▶ Play fullscreen"
   *  button appears and mounts the real component with a synthetic
   *  Kiss built from the sample answers. */
  templateId?: string;
  /** Template name — shown in the fullscreen preview banner. */
  templateName?: string;
}

type DeviceMode = 'mobile' | 'tablet' | 'desktop';

interface DeviceConfig {
  label: string;
  icon: React.ReactNode;
  aspect: string;
  maxWidth: number;
  chrome: 'phone' | 'tablet' | 'browser';
  hint: string;
}

const DEVICES: Record<DeviceMode, DeviceConfig> = {
  mobile:  { label: 'Mobile',  icon: <Smartphone size={12} />, aspect: '9 / 16',   maxWidth: 340, chrome: 'phone',   hint: '9:16' },
  tablet:  { label: 'Tablet',  icon: <Tablet    size={12} />, aspect: '3 / 4',    maxWidth: 480, chrome: 'tablet',  hint: '3:4'  },
  desktop: { label: 'Desktop', icon: <Monitor   size={12} />, aspect: '16 / 10',  maxWidth: 720, chrome: 'browser', hint: '16:10'},
};

// Fake message shown in the fullscreen preview when the admin hasn't
// added a "message" input to their fields_schema. Reveals typically
// use kiss.message, not a template_data field.
const SAMPLE_MESSAGE = 'This is a preview of your template — the sender\'s message from the Kiss appears here.';

export default function TemplateLivePreview({
  effects, fieldsSchema, accent = '#ec4899',
  templateId, templateName,
}: Props) {
  const [data, setData] = useState<Record<string, unknown>>(() => initialDataFromSchema(fieldsSchema));
  const [playKey, setPlayKey] = useState(0);
  const [device, setDevice] = useState<DeviceMode>('mobile');
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => { setData(initialDataFromSchema(fieldsSchema)); }, [fieldsSchema]);
  // Close fullscreen on ESC
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFullscreen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreen]);

  const cfg = DEVICES[device];

  // Is this template backed by a registered React component?
  const registeredTpl = templateId ? getTemplate(templateId) : undefined;

  // Synthetic Kiss for the fullscreen preview — mirrors the shape the
  // real reveal sees, seeded with the admin's form inputs. template_data
  // is JSON-serialised so parseKissData() inside the reveal works.
  const syntheticKiss: RevealKiss = useMemo(() => ({
    id: 'admin-preview',
    sender_id: 'admin',
    sender_name: 'You (admin)',
    sender_avatar: undefined,
    receiver_id: 'preview',
    receiver_name: (typeof data.name === 'string' && data.name) ? data.name as string : 'Preview',
    receiver_avatar: undefined,
    message: SAMPLE_MESSAGE,
    emoji: '💌',
    template_id: templateId ?? null,
    template_data: JSON.stringify(data),
    created_at: new Date().toISOString(),
  }), [data, templateId]);

  return (
    <div className="space-y-3">
      {fieldsSchema.length > 0 && (
        <div className="rounded-lg p-3" style={{ background: 'rgba(0,0,0,0.4)', border: `1px solid ${accent}30` }}>
          <div className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: accent }}>
            Sample answers
          </div>
          <DynamicForm schema={fieldsSchema} data={data} onChange={setData} accent={accent} />
        </div>
      )}

      {/* ─── Fullscreen preview button — headline when template has a
             registered React component. ────────────────────────── */}
      {registeredTpl && (
        <button
          onClick={() => setFullscreen(true)}
          className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold cursor-pointer transition-all hover:scale-[1.02]"
          style={{
            background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
            color: '#fff',
            boxShadow: `0 6px 24px ${accent}55, 0 0 0 1px ${accent}66 inset`,
          }}
        >
          <Play size={16} fill="#fff" />
          Play fullscreen preview
          <span className="text-[10px] font-normal opacity-80 ml-1">
            (mounts the real React component)
          </span>
        </button>
      )}

      {/* ─── Device toggle + replay ─────────────────────────── */}
      <div className="flex items-center justify-between gap-2">
        <div className="rounded-full flex text-[10px] font-semibold p-0.5" style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.06)' }}>
          {(Object.keys(DEVICES) as DeviceMode[]).map(k => {
            const d = DEVICES[k];
            const on = device === k;
            return (
              <button
                key={k}
                onClick={() => setDevice(k)}
                className="px-2.5 py-1 rounded-full cursor-pointer transition-all flex items-center gap-1"
                style={on
                  ? { background: 'linear-gradient(135deg, #a855f7, #ec4899)', color: 'white', boxShadow: '0 1px 8px rgba(168,85,247,0.4)' }
                  : { background: 'transparent', color: '#a3adc3' }}
                title={`${d.label} · ${d.hint}`}
              >
                {d.icon}
                <span className="hidden sm:inline">{d.label}</span>
              </button>
            );
          })}
        </div>
        <button
          onClick={() => setPlayKey(k => k + 1)}
          className="flex items-center gap-1 text-[10px] font-semibold text-white/70 hover:text-white cursor-pointer"
        >
          <RefreshCw size={11} /> Replay
        </button>
      </div>

      {/* ─── Device frame — inline preview ──────────────────── */}
      <DeviceFrame chrome={cfg.chrome} maxWidth={cfg.maxWidth} accent={accent}>
        <div
          key={playKey}
          className="relative w-full overflow-hidden"
          style={{ aspectRatio: cfg.aspect, background: '#000' }}
        >
          {registeredTpl ? (
            // React templates can't be miniaturised (they use fixed inset-0),
            // so the inline frame shows a static "click Preview" placeholder.
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6" style={{
              background: `radial-gradient(ellipse at center, ${accent}22 0%, #050510 60%, #000 100%)`,
            }}>
              <Sparkles size={28} style={{ color: accent }} className="mb-2 opacity-80" />
              <div className="text-sm font-bold text-white/90">React template</div>
              <div className="text-[11px] text-[#7a8299] mt-1 max-w-[220px] leading-relaxed">
                This template uses a custom React component. Click <b className="text-white">Play fullscreen preview</b> above to see it play.
              </div>
              <div className="text-[9px] font-mono text-[#4a5068] mt-2 px-2 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.05)' }}>
                {registeredTpl.id}
              </div>
            </div>
          ) : effects.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center text-xs text-[#4a5068] text-center px-6">
              No effects yet — add some below to see the reveal play.
            </div>
          ) : (
            <TemplateRenderer effects={effects} data={data} />
          )}
        </div>
      </DeviceFrame>

      {/* ─── FULLSCREEN portal — mounts the actual React component so
             admin sees exactly what the recipient will see. ───── */}
      {fullscreen && registeredTpl && typeof document !== 'undefined' && createPortal(
        <FullscreenPreview
          templateName={templateName ?? registeredTpl.name}
          accent={accent}
          onClose={() => setFullscreen(false)}
        >
          <registeredTpl.Component
            kiss={syntheticKiss}
            currentUserId="admin"
            onClose={() => setFullscreen(false)}
          />
        </FullscreenPreview>,
        document.body,
      )}
    </div>
  );
}

// ── Fullscreen portal wrapper ─────────────────────────────────────────
// Top-of-viewport banner tells admin they're in preview mode + gives an
// obvious Exit button (in addition to the reveal's own X + ESC).
function FullscreenPreview({
  templateName, accent, onClose, children,
}: {
  templateName: string; accent: string; onClose: () => void; children: React.ReactNode;
}) {
  return (
    <>
      {/* Top preview banner — z above the reveal's z-[200] shell */}
      <div
        className="fixed top-0 inset-x-0 z-[400] flex items-center justify-center gap-3 py-2 px-4 pointer-events-none"
      >
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-bold text-white backdrop-blur pointer-events-auto"
          style={{
            background: `linear-gradient(135deg, ${accent}dd, ${accent}88)`,
            boxShadow: `0 4px 16px ${accent}66`,
          }}
        >
          <Sparkles size={12} />
          <span>Preview · {templateName}</span>
          <span className="text-[9px] opacity-80 uppercase tracking-widest hidden sm:inline">esc to exit</span>
          <button
            onClick={onClose}
            className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-semibold cursor-pointer"
            style={{ background: 'rgba(0,0,0,0.35)' }}
          >
            ✕ Exit
          </button>
        </div>
      </div>
      {children}
    </>
  );
}

// ── Device chrome wrapper ────────────────────────────────────────────
function DeviceFrame({ chrome, maxWidth, accent, children }: {
  chrome: 'phone' | 'tablet' | 'browser';
  maxWidth: number;
  accent: string;
  children: React.ReactNode;
}) {
  if (chrome === 'phone') {
    return (
      <div
        className="mx-auto"
        style={{
          maxWidth,
          padding: '10px',
          borderRadius: '32px',
          background: 'linear-gradient(180deg, #1f2228, #0d0f14)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: `0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px ${accent}25, 0 0 40px ${accent}15`,
        }}
      >
        <div className="mx-auto mb-2 h-1 w-16 rounded-full" style={{ background: 'rgba(255,255,255,0.1)' }} />
        <div className="rounded-2xl overflow-hidden">{children}</div>
      </div>
    );
  }

  if (chrome === 'tablet') {
    return (
      <div
        className="mx-auto"
        style={{
          maxWidth,
          padding: '14px',
          borderRadius: '24px',
          background: 'linear-gradient(180deg, #1a1d24, #0a0c11)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: `0 24px 60px rgba(0,0,0,0.55), 0 0 0 1px ${accent}20, 0 0 40px ${accent}12`,
        }}
      >
        <div className="flex justify-center mb-2">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }} />
        </div>
        <div className="rounded-xl overflow-hidden">{children}</div>
      </div>
    );
  }

  // browser
  return (
    <div
      className="mx-auto"
      style={{
        maxWidth,
        borderRadius: '12px',
        background: '#0d0f14',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: `0 20px 60px rgba(0,0,0,0.55), 0 0 0 1px ${accent}20, 0 0 40px ${accent}12`,
        overflow: 'hidden',
      }}
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ background: 'linear-gradient(180deg, #1a1d24, #14171d)', borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#ff5f57' }} />
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#ffbd2e' }} />
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#28c840' }} />
        </div>
        <div className="flex-1 mx-2 rounded px-2 py-0.5 text-[9px] font-mono text-[#7a8299] truncate" style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.05)' }}>
          gao.social/kiss/preview
        </div>
      </div>
      {children}
    </div>
  );
}
