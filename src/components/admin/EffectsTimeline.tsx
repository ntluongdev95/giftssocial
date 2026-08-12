'use client';

// EffectsTimeline — visual editor for a template's effects[]. Each row
// is one effect; picker at the bottom adds new ones from EFFECT_META.
// Params are edited via lightweight inputs matched to the effect type.

import { useState } from 'react';
import { Plus, Trash2, ChevronUp, ChevronDown, Clock } from 'lucide-react';
import type { EffectSpec } from '@/components/reveals/_effects/_types';
import { EFFECT_META } from '@/components/reveals/_effects/registry';

interface Props {
  value: EffectSpec[];
  onChange: (next: EffectSpec[]) => void;
  accent?: string;
}

// Default params seeded when the admin adds a new effect. Keeps rows
// meaningful before the admin edits them.
const DEFAULT_PARAMS: Record<string, Partial<EffectSpec>> = {
  'bg-gradient':    { from: '#1e1b4b', to: '#000000', angle: 135 },
  'particle-rain':  { emoji: '🌸', count: 60, speed: 'normal' },
  'balloon-float':  { count: 16 },
  'text-flash':     { text: 'Hello {name}!', color: '#ffffff', size: 48, at: 1500 },
  'text-fade':      { text: 'A gentle message', color: '#ffffff', size: 22, at: 3000 },
  'confetti-burst': { count: 120, at: 2000, duration: 2000 },
  'photo-hero':     { src: '{photo}', frame: 'polaroid', size: 260, tilt: -4, caption: '', at: 1200 },
};

export default function EffectsTimeline({ value, onChange, accent = '#ec4899' }: Props) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const update = (i: number, patch: Partial<EffectSpec>) => {
    onChange(value.map((e, idx) => idx === i ? { ...e, ...patch } : e));
  };

  const remove = (i: number) => {
    onChange(value.filter((_, idx) => idx !== i));
    if (openIdx === i) setOpenIdx(null);
  };

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  const addEffect = (type: string) => {
    const defaults = DEFAULT_PARAMS[type] ?? {};
    onChange([...value, { type, ...defaults }]);
    setPickerOpen(false);
    setOpenIdx(value.length);
  };

  const inputCls = 'w-full px-2.5 py-1.5 rounded-md border border-white/10 bg-black/30 text-white text-xs focus:outline-none';

  return (
    <div className="space-y-2">
      {value.length === 0 && (
        <div className="text-[11px] text-[#4a5068] text-center py-4 rounded-lg" style={{ background: 'rgba(0,0,0,0.2)', border: '1px dashed rgba(255,255,255,0.06)' }}>
          No effects yet — add one below to build the reveal.
        </div>
      )}

      {value.map((eff, i) => {
        const meta = EFFECT_META.find(m => m.type === eff.type);
        const open = openIdx === i;
        return (
          <div key={i} className="rounded-lg overflow-hidden" style={{ background: 'rgba(0,0,0,0.3)', border: `1px solid ${open ? accent : 'rgba(255,255,255,0.06)'}` }}>
            <div className="flex items-center gap-2 p-2">
              <div className="flex flex-col">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="text-[#4a5068] hover:text-white cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"><ChevronUp size={12} /></button>
                <button type="button" onClick={() => move(i, +1)} disabled={i === value.length - 1} className="text-[#4a5068] hover:text-white cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"><ChevronDown size={12} /></button>
              </div>
              <button type="button" onClick={() => setOpenIdx(open ? null : i)} className="flex-1 flex items-center gap-2 text-left cursor-pointer">
                <span className="text-base">{meta?.emoji ?? '⚙️'}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-white truncate">{meta?.label ?? eff.type}</div>
                  <div className="text-[10px] text-[#4a5068] flex items-center gap-1"><Clock size={9} /> {eff.at ?? 0}ms {eff.duration ? `· ${eff.duration}ms` : '· persist'}</div>
                </div>
              </button>
              <button type="button" onClick={() => remove(i)} className="text-[#f87171] hover:bg-[#f8717130] rounded p-1 cursor-pointer">
                <Trash2 size={12} />
              </button>
            </div>

            {open && (
              <div className="p-2 pt-1 space-y-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <div className="text-[10px] text-[#a3adc3] mb-0.5">Start delay (ms)</div>
                    <input type="number" min={0} value={typeof eff.at === 'number' ? eff.at : 0} onChange={e => update(i, { at: Number(e.target.value) })} className={inputCls} />
                  </label>
                  <label className="block">
                    <div className="text-[10px] text-[#a3adc3] mb-0.5">Duration (ms, blank = persist)</div>
                    <input type="number" min={0} value={typeof eff.duration === 'number' ? eff.duration : ''} onChange={e => update(i, { duration: e.target.value === '' ? undefined : Number(e.target.value) })} className={inputCls} />
                  </label>
                </div>

                <EffectParams eff={eff} onChange={p => update(i, p)} inputCls={inputCls} />
              </div>
            )}
          </div>
        );
      })}

      {pickerOpen ? (
        <div className="rounded-lg p-2 space-y-1" style={{ background: 'rgba(0,0,0,0.4)', border: `1px solid ${accent}` }}>
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#a3adc3] px-1 py-1">Pick an effect</div>
          {EFFECT_META.map(m => (
            <button key={m.type} type="button" onClick={() => addEffect(m.type)} className="w-full flex items-center gap-2 p-2 rounded hover:bg-white/5 cursor-pointer text-left">
              <span className="text-lg">{m.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-white">{m.label}</div>
                <div className="text-[10px] text-[#4a5068]">{m.description}</div>
              </div>
            </button>
          ))}
          <button type="button" onClick={() => setPickerOpen(false)} className="w-full text-[10px] text-[#4a5068] hover:text-white py-1 cursor-pointer">Cancel</button>
        </div>
      ) : (
        <button type="button" onClick={() => setPickerOpen(true)} className="w-full flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold cursor-pointer" style={{ background: `${accent}15`, color: accent, border: `1px dashed ${accent}66` }}>
          <Plus size={12} /> Add effect
        </button>
      )}
    </div>
  );
}

// Renders type-specific parameter inputs. Reads/writes the effect's
// arbitrary key/value bag while leaving `type`, `at`, `duration` to the
// parent form.
function EffectParams({ eff, onChange, inputCls }: {
  eff: EffectSpec;
  onChange: (patch: Partial<EffectSpec>) => void;
  inputCls: string;
}) {
  switch (eff.type) {
    case 'bg-gradient':
      return (
        <div className="grid grid-cols-3 gap-2">
          <label className="block">
            <div className="text-[10px] text-[#a3adc3] mb-0.5">From</div>
            <div className="flex gap-1">
              <input type="color" value={String(eff.from ?? '#000000')} onChange={e => onChange({ from: e.target.value })} className="w-8 h-7 rounded border border-white/10 cursor-pointer" />
              <input value={String(eff.from ?? '')} onChange={e => onChange({ from: e.target.value })} className={inputCls} />
            </div>
          </label>
          <label className="block">
            <div className="text-[10px] text-[#a3adc3] mb-0.5">To</div>
            <div className="flex gap-1">
              <input type="color" value={String(eff.to ?? '#000000')} onChange={e => onChange({ to: e.target.value })} className="w-8 h-7 rounded border border-white/10 cursor-pointer" />
              <input value={String(eff.to ?? '')} onChange={e => onChange({ to: e.target.value })} className={inputCls} />
            </div>
          </label>
          <label className="block">
            <div className="text-[10px] text-[#a3adc3] mb-0.5">Angle°</div>
            <input type="number" min={0} max={360} value={Number(eff.angle ?? 135)} onChange={e => onChange({ angle: Number(e.target.value) })} className={inputCls} />
          </label>
        </div>
      );
    case 'particle-rain':
      return (
        <div className="grid grid-cols-3 gap-2">
          <label className="block">
            <div className="text-[10px] text-[#a3adc3] mb-0.5">Emoji</div>
            <input value={String(eff.emoji ?? '')} onChange={e => onChange({ emoji: e.target.value })} className={inputCls} />
          </label>
          <label className="block">
            <div className="text-[10px] text-[#a3adc3] mb-0.5">Count</div>
            <input type="number" min={1} max={500} value={Number(eff.count ?? 60)} onChange={e => onChange({ count: Number(e.target.value) })} className={inputCls} />
          </label>
          <label className="block">
            <div className="text-[10px] text-[#a3adc3] mb-0.5">Speed</div>
            <select value={String(eff.speed ?? 'normal')} onChange={e => onChange({ speed: e.target.value })} className={inputCls}>
              <option value="slow">Slow</option>
              <option value="normal">Normal</option>
              <option value="fast">Fast</option>
            </select>
          </label>
        </div>
      );
    case 'balloon-float':
      return (
        <label className="block">
          <div className="text-[10px] text-[#a3adc3] mb-0.5">Count</div>
          <input type="number" min={1} max={80} value={Number(eff.count ?? 16)} onChange={e => onChange({ count: Number(e.target.value) })} className={inputCls} />
        </label>
      );
    case 'text-flash':
    case 'text-fade':
      return (
        <div className="grid grid-cols-3 gap-2">
          <label className="block col-span-3">
            <div className="text-[10px] text-[#a3adc3] mb-0.5">Text (use {`{key}`} for fields)</div>
            <input value={String(eff.text ?? '')} onChange={e => onChange({ text: e.target.value })} className={inputCls} />
          </label>
          <label className="block col-span-1">
            <div className="text-[10px] text-[#a3adc3] mb-0.5">Color</div>
            <div className="flex gap-1">
              <input type="color" value={String(eff.color ?? '#ffffff')} onChange={e => onChange({ color: e.target.value })} className="w-8 h-7 rounded border border-white/10 cursor-pointer" />
              <input value={String(eff.color ?? '')} onChange={e => onChange({ color: e.target.value })} className={inputCls} />
            </div>
          </label>
          <label className="block col-span-1">
            <div className="text-[10px] text-[#a3adc3] mb-0.5">Size (px)</div>
            <input type="number" min={12} max={120} value={Number(eff.size ?? (eff.type === 'text-flash' ? 48 : 22))} onChange={e => onChange({ size: Number(e.target.value) })} className={inputCls} />
          </label>
          {eff.type === 'text-fade' && (
            <label className="col-span-1 flex items-center gap-2 cursor-pointer pt-4">
              <input type="checkbox" checked={!!eff.italic} onChange={e => onChange({ italic: e.target.checked })} />
              <span className="text-[10px] text-[#a3adc3]">Italic</span>
            </label>
          )}
        </div>
      );
    case 'confetti-burst':
      return (
        <label className="block">
          <div className="text-[10px] text-[#a3adc3] mb-0.5">Count</div>
          <input type="number" min={10} max={500} value={Number(eff.count ?? 120)} onChange={e => onChange({ count: Number(e.target.value) })} className={inputCls} />
        </label>
      );
    case 'photo-hero':
      return (
        <div className="grid grid-cols-2 gap-2">
          <label className="block col-span-2">
            <div className="text-[10px] text-[#a3adc3] mb-0.5">Photo source (use {'{field_key}'} to reference an image field)</div>
            <input value={String(eff.src ?? '')} placeholder="{photo}" onChange={e => onChange({ src: e.target.value })} className={`${inputCls} font-mono`} />
          </label>
          <label className="block">
            <div className="text-[10px] text-[#a3adc3] mb-0.5">Frame</div>
            <select value={String(eff.frame ?? 'polaroid')} onChange={e => onChange({ frame: e.target.value })} className={inputCls}>
              <option value="polaroid">Polaroid</option>
              <option value="card">Card</option>
            </select>
          </label>
          <label className="block">
            <div className="text-[10px] text-[#a3adc3] mb-0.5">Size (px)</div>
            <input type="number" min={100} max={500} value={Number(eff.size ?? 260)} onChange={e => onChange({ size: Number(e.target.value) })} className={inputCls} />
          </label>
          <label className="block">
            <div className="text-[10px] text-[#a3adc3] mb-0.5">Tilt (°)</div>
            <input type="number" min={-30} max={30} value={Number(eff.tilt ?? -4)} onChange={e => onChange({ tilt: Number(e.target.value) })} className={inputCls} />
          </label>
          <label className="block">
            <div className="text-[10px] text-[#a3adc3] mb-0.5">Caption (optional)</div>
            <input value={String(eff.caption ?? '')} placeholder="e.g. Us in Da Lat 💕" onChange={e => onChange({ caption: e.target.value })} className={inputCls} />
          </label>
        </div>
      );
    default:
      return <div className="text-[10px] text-[#4a5068]">No editor for this type.</div>;
  }
}
