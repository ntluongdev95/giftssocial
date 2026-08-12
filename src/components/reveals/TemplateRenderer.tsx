'use client';

// TemplateRenderer — walks a template's `effects` JSON and mounts the
// matching primitives from the effect registry.
//
// Timing: each effect can specify `at` (delay ms) and `duration` (ms).
// When `at` elapses, the effect is mounted. If `duration` is set, the
// effect is unmounted after that. Effects with no `duration` play for
// the entire reveal.
//
// Placeholders like {name} in effect params are resolved against
// `data` (kiss.template_data merged with fields_schema defaults).

import { useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { EFFECT_REGISTRY } from './_effects/registry';
import type { EffectSpec } from './_effects/_types';

interface Props {
  effects: EffectSpec[];
  data: Record<string, unknown>;
  /** z-index base. Rendered inside a positioned parent (TemplateShell reveal phase). */
  className?: string;
}

interface ActiveEffect {
  key: string;
  spec: EffectSpec;
}

export default function TemplateRenderer({ effects, data, className }: Props) {
  const [active, setActive] = useState<ActiveEffect[]>([]);

  useEffect(() => {
    // Schedule each effect: mount at `at`, unmount after `duration`.
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    setActive([]);

    effects.forEach((spec, idx) => {
      const delay = typeof spec.at === 'number' ? spec.at : 0;
      const key = `${spec.type}-${idx}`;

      timeouts.push(setTimeout(() => {
        setActive(prev => [...prev, { key, spec }]);

        if (typeof spec.duration === 'number' && spec.duration > 0) {
          timeouts.push(setTimeout(() => {
            setActive(prev => prev.filter(e => e.key !== key));
          }, spec.duration));
        }
      }, delay));
    });

    return () => timeouts.forEach(clearTimeout);
  }, [effects]);

  return (
    <div className={`absolute inset-0 ${className ?? ''}`}>
      <AnimatePresence>
        {active.map(({ key, spec }) => {
          const Component = EFFECT_REGISTRY[spec.type];
          if (!Component) {
            if (process.env.NODE_ENV !== 'production') {
              console.warn(`[TemplateRenderer] Unknown effect type: ${spec.type}`);
            }
            return null;
          }
          // Strip renderer-only fields; forward the rest as props.
          const { type: _type, at: _at, duration: _duration, ...params } = spec;
          void _type; void _at; void _duration;
          return <Component key={key} data={data} {...params} />;
        })}
      </AnimatePresence>
    </div>
  );
}
