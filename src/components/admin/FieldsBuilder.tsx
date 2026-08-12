'use client';

// FieldsBuilder — visual editor for a template's fields_schema. Each
// row shows one field; you can add, remove, reorder, and edit its
// props inline without touching JSON.
//
// The parent still owns the fields_schema JSON text — this component
// converts to/from an in-memory FieldSpec[] and emits changes as an
// updated JSON string so the existing textarea + preview keep working.

import { useState } from 'react';
import { Plus, Trash2, ChevronUp, ChevronDown, Settings2 } from 'lucide-react';
import type { FieldSpec, FieldType } from '@/components/reveals/fields';

interface Props {
  value: FieldSpec[];
  onChange: (next: FieldSpec[]) => void;
  accent?: string;
}

const TYPE_LABELS: Record<FieldType, string> = {
  text: 'Text',
  textarea: 'Textarea',
  number: 'Number',
  color: 'Color',
  select: 'Select',
  toggle: 'Toggle',
  date: 'Date',
  image: 'Image upload',
};

const TYPE_ORDER: FieldType[] = ['text', 'textarea', 'number', 'color', 'select', 'toggle', 'date', 'image'];

export default function FieldsBuilder({ value, onChange, accent = '#ec4899' }: Props) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  const update = (i: number, patch: Partial<FieldSpec>) => {
    const next = value.map((f, idx) => idx === i ? { ...f, ...patch } : f);
    onChange(next);
  };

  const addField = () => {
    const nextKey = `field${value.length + 1}`;
    onChange([...value, { key: nextKey, type: 'text', label: 'New field' }]);
    setOpenIdx(value.length);
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
    if (openIdx === i) setOpenIdx(j);
    else if (openIdx === j) setOpenIdx(i);
  };

  const inputCls = 'w-full px-2.5 py-1.5 rounded-md border border-white/10 bg-black/30 text-white text-xs focus:outline-none';

  return (
    <div className="space-y-2">
      {value.length === 0 && (
        <div className="text-[11px] text-[#4a5068] text-center py-4 rounded-lg" style={{ background: 'rgba(0,0,0,0.2)', border: '1px dashed rgba(255,255,255,0.06)' }}>
          No fields yet — the sender will only see the default message textarea.
        </div>
      )}

      {value.map((f, i) => {
        const open = openIdx === i;
        return (
          <div key={i} className="rounded-lg overflow-hidden" style={{ background: 'rgba(0,0,0,0.3)', border: `1px solid ${open ? accent : 'rgba(255,255,255,0.06)'}` }}>
            {/* Summary row */}
            <div className="flex items-center gap-2 p-2">
              <div className="flex flex-col">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="text-[#4a5068] hover:text-white cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"><ChevronUp size={12} /></button>
                <button type="button" onClick={() => move(i, +1)} disabled={i === value.length - 1} className="text-[#4a5068] hover:text-white cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"><ChevronDown size={12} /></button>
              </div>
              <button type="button" onClick={() => setOpenIdx(open ? null : i)} className="flex-1 flex items-center gap-2 text-left cursor-pointer">
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.08)', color: '#a3adc3' }}>{TYPE_LABELS[f.type]}</span>
                <span className="text-xs font-semibold text-white truncate">{f.label || f.key}</span>
                <span className="text-[10px] text-[#4a5068]">{f.key}{f.required && ' *'}</span>
              </button>
              <button type="button" onClick={() => setOpenIdx(open ? null : i)} className="text-[#4a5068] hover:text-white cursor-pointer">
                <Settings2 size={13} />
              </button>
              <button type="button" onClick={() => remove(i)} className="text-[#f87171] hover:bg-[#f8717130] rounded p-1 cursor-pointer">
                <Trash2 size={12} />
              </button>
            </div>

            {open && (
              <div className="p-2 pt-1 space-y-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <div className="text-[10px] text-[#a3adc3] mb-0.5">Key (for {`{placeholder}`})</div>
                    <input value={f.key} onChange={e => update(i, { key: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') })} className={inputCls} />
                  </label>
                  <label className="block">
                    <div className="text-[10px] text-[#a3adc3] mb-0.5">Type</div>
                    <select value={f.type} onChange={e => update(i, { type: e.target.value as FieldType })} className={inputCls}>
                      {TYPE_ORDER.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
                    </select>
                  </label>
                  <label className="block col-span-2">
                    <div className="text-[10px] text-[#a3adc3] mb-0.5">Label (shown to sender)</div>
                    <input value={f.label} onChange={e => update(i, { label: e.target.value })} className={inputCls} />
                  </label>
                  <label className="block col-span-2">
                    <div className="text-[10px] text-[#a3adc3] mb-0.5">Hint (optional)</div>
                    <input value={f.hint ?? ''} onChange={e => update(i, { hint: e.target.value || undefined })} className={inputCls} />
                  </label>

                  {(f.type === 'text' || f.type === 'textarea') && (
                    <>
                      <label className="block col-span-2">
                        <div className="text-[10px] text-[#a3adc3] mb-0.5">Placeholder</div>
                        <input value={f.placeholder ?? ''} onChange={e => update(i, { placeholder: e.target.value || undefined })} className={inputCls} />
                      </label>
                      <label className="block">
                        <div className="text-[10px] text-[#a3adc3] mb-0.5">Max length</div>
                        <input type="number" min={1} value={f.maxLength ?? ''} onChange={e => update(i, { maxLength: e.target.value ? Number(e.target.value) : undefined })} className={inputCls} />
                      </label>
                      <label className="block">
                        <div className="text-[10px] text-[#a3adc3] mb-0.5">Default</div>
                        <input value={String(f.default ?? '')} onChange={e => update(i, { default: e.target.value })} className={inputCls} />
                      </label>
                    </>
                  )}

                  {f.type === 'number' && (
                    <>
                      <label className="block">
                        <div className="text-[10px] text-[#a3adc3] mb-0.5">Min</div>
                        <input type="number" value={f.min ?? ''} onChange={e => update(i, { min: e.target.value === '' ? undefined : Number(e.target.value) })} className={inputCls} />
                      </label>
                      <label className="block">
                        <div className="text-[10px] text-[#a3adc3] mb-0.5">Max</div>
                        <input type="number" value={f.max ?? ''} onChange={e => update(i, { max: e.target.value === '' ? undefined : Number(e.target.value) })} className={inputCls} />
                      </label>
                      <label className="block">
                        <div className="text-[10px] text-[#a3adc3] mb-0.5">Step</div>
                        <input type="number" value={f.step ?? 1} onChange={e => update(i, { step: Number(e.target.value) })} className={inputCls} />
                      </label>
                      <label className="block">
                        <div className="text-[10px] text-[#a3adc3] mb-0.5">Default</div>
                        <input type="number" value={typeof f.default === 'number' ? f.default : ''} onChange={e => update(i, { default: e.target.value === '' ? undefined : Number(e.target.value) })} className={inputCls} />
                      </label>
                    </>
                  )}

                  {f.type === 'color' && (
                    <label className="block col-span-2">
                      <div className="text-[10px] text-[#a3adc3] mb-0.5">Default</div>
                      <div className="flex gap-2">
                        <input type="color" value={String(f.default ?? '#ec4899')} onChange={e => update(i, { default: e.target.value })} className="w-9 h-8 rounded-md border border-white/10 bg-transparent cursor-pointer" />
                        <input value={String(f.default ?? '')} onChange={e => update(i, { default: e.target.value })} placeholder="#ec4899" className={inputCls} />
                      </div>
                    </label>
                  )}

                  {f.type === 'select' && (
                    <div className="col-span-2 space-y-1">
                      <div className="text-[10px] text-[#a3adc3]">Options (label → value)</div>
                      {(f.options ?? []).map((opt, oi) => (
                        <div key={oi} className="flex gap-1">
                          <input value={opt.label} placeholder="Label" onChange={e => {
                            const next = [...(f.options ?? [])];
                            next[oi] = { ...next[oi], label: e.target.value };
                            update(i, { options: next });
                          }} className={inputCls} />
                          <input value={opt.value} placeholder="value" onChange={e => {
                            const next = [...(f.options ?? [])];
                            next[oi] = { ...next[oi], value: e.target.value };
                            update(i, { options: next });
                          }} className={inputCls} />
                          <button type="button" onClick={() => update(i, { options: (f.options ?? []).filter((_, idx) => idx !== oi) })} className="text-[#f87171] hover:bg-[#f8717130] rounded px-1 cursor-pointer">
                            <Trash2 size={11} />
                          </button>
                        </div>
                      ))}
                      <button type="button" onClick={() => update(i, { options: [...(f.options ?? []), { label: 'Option', value: 'opt' + ((f.options?.length ?? 0) + 1) }] })} className="text-[10px] text-white/60 hover:text-white cursor-pointer flex items-center gap-1">
                        <Plus size={10} /> Add option
                      </button>
                    </div>
                  )}

                  <label className="col-span-2 flex items-center gap-2 cursor-pointer pt-1">
                    <input type="checkbox" checked={!!f.required} onChange={e => update(i, { required: e.target.checked || undefined })} />
                    <span className="text-[10px] text-[#a3adc3]">Required</span>
                  </label>
                </div>
              </div>
            )}
          </div>
        );
      })}

      <button type="button" onClick={addField} className="w-full flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold cursor-pointer" style={{ background: `${accent}15`, color: accent, border: `1px dashed ${accent}66` }}>
        <Plus size={12} /> Add field
      </button>
    </div>
  );
}
