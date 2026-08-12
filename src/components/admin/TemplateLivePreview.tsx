'use client';

// TemplateLivePreview — mounts TemplateRenderer inside a device-chrome
// preview so the admin can see effects[] JSON play in the size + frame
// the recipient will actually experience.
//
// Controls:
//   • Device toggle:   Mobile | Tablet | Desktop  (each has aspect + chrome)
//   • "With intro"     — Meet-and-hug plays first, then the effects
//   • Replay           — rewind + restart the whole flow

import { useState, useEffect } from 'react';
import TemplateRenderer from '@/components/reveals/TemplateRenderer';
import DynamicForm from '@/components/reveals/DynamicForm';
import MeetAndHugScene from '@/components/reveals/_shared/MeetAndHugScene';
import type { EffectSpec } from '@/components/reveals/_effects/_types';
import type { FieldSpec } from '@/components/reveals/fields';
import { initialDataFromSchema } from '@/components/reveals/fields';
import { RefreshCw, Smartphone, Tablet, Monitor } from 'lucide-react';

interface Props {
  effects: EffectSpec[];
  fieldsSchema: FieldSpec[];
  accent?: string;
}

type DeviceMode = 'mobile' | 'tablet' | 'desktop';

interface DeviceConfig {
  label: string;
  icon: React.ReactNode;
  aspect: string;      // CSS aspect-ratio
  maxWidth: number;    // px cap so the frame stays realistic on wide screens
  chrome: 'phone' | 'tablet' | 'browser';
  hint: string;
}

const DEVICES: Record<DeviceMode, DeviceConfig> = {
  mobile:  { label: 'Mobile',  icon: <Smartphone size={12} />, aspect: '9 / 16',   maxWidth: 340, chrome: 'phone',   hint: '9:16' },
  tablet:  { label: 'Tablet',  icon: <Tablet    size={12} />, aspect: '3 / 4',    maxWidth: 480, chrome: 'tablet',  hint: '3:4'  },
  desktop: { label: 'Desktop', icon: <Monitor   size={12} />, aspect: '16 / 10',  maxWidth: 720, chrome: 'browser', hint: '16:10'},
};

export default function TemplateLivePreview({ effects, fieldsSchema, accent = '#ec4899' }: Props) {
  const [data, setData] = useState<Record<string, unknown>>(() => initialDataFromSchema(fieldsSchema));
  const [playKey, setPlayKey] = useState(0);
  const [withIntro, setWithIntro] = useState(false);
  const [phase, setPhase] = useState<'meet' | 'reveal'>('meet');
  const [device, setDevice] = useState<DeviceMode>('mobile');

  useEffect(() => { setData(initialDataFromSchema(fieldsSchema)); }, [fieldsSchema]);
  useEffect(() => { setPhase(withIntro ? 'meet' : 'reveal'); }, [playKey, withIntro]);

  const cfg = DEVICES[device];

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

      {/* Device segmented control */}
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
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-[10px] font-semibold cursor-pointer text-white/70 hover:text-white" title="Play the meet-and-hug intro before the reveal, like the recipient sees it">
            <input
              type="checkbox"
              checked={withIntro}
              onChange={e => { setWithIntro(e.target.checked); setPlayKey(k => k + 1); }}
              className="cursor-pointer accent-pink-500"
            />
            With intro
          </label>
          <button
            onClick={() => setPlayKey(k => k + 1)}
            className="flex items-center gap-1 text-[10px] font-semibold text-white/70 hover:text-white cursor-pointer"
          >
            <RefreshCw size={11} /> Replay
          </button>
        </div>
      </div>

      {/* Device frame — chrome depends on the mode */}
      <DeviceFrame chrome={cfg.chrome} maxWidth={cfg.maxWidth} accent={accent}>
        <div
          key={playKey}
          className="relative w-full overflow-hidden"
          style={{
            aspectRatio: cfg.aspect,
            background: withIntro && phase === 'meet'
              ? 'radial-gradient(ellipse at center, #08091a 0%, #03050e 55%, #000005 100%)'
              : '#000',
          }}
        >
          {effects.length === 0 && phase === 'reveal' ? (
            <div className="absolute inset-0 flex items-center justify-center text-xs text-[#4a5068] text-center px-6">
              No effects yet — add some below to see the reveal play.
            </div>
          ) : phase === 'meet' ? (
            <MeetAndHugScene
              sender={{ name: 'You' }}
              receiver={{ name: (data.name as string) || 'Them' }}
              senderAccent={accent}
              onComplete={() => setPhase('reveal')}
            />
          ) : (
            <TemplateRenderer effects={effects} data={data} />
          )}

          {withIntro && (
            <div className="absolute top-2 left-2 text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded backdrop-blur pointer-events-none" style={{ background: 'rgba(0,0,0,0.6)', color: '#fff' }}>
              {phase === 'meet' ? '1 · Meet & hug' : '2 · Reveal'}
            </div>
          )}
        </div>
      </DeviceFrame>
    </div>
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
        {/* Notch pill */}
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
        {/* Camera dot */}
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
      {/* Browser toolbar */}
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
