'use client';

import { useMapStore } from '@/stores/mapStore';
import { ENTITY_MARKER_CONFIG } from '@/styles/tokens';
import type { EntityType } from '@/types';

const LAYERS: { key: EntityType; icon: string }[] = [
  { key: 'people', icon: '●' },
  { key: 'business', icon: '■' },
  { key: 'event', icon: '▲' },
  { key: 'offer', icon: '◆' },
  { key: 'proof', icon: '🛡' },
  { key: 'agent', icon: '⬡' },
  { key: 'alert', icon: '⊙' },
  { key: 'circle', icon: '⦿' },
  { key: 'profile', icon: '👤' },
];

export default function LayerFilterPanel() {
  const { activeLayers, toggleLayer } = useMapStore();

  return (
    <div className="flex gap-1.5 overflow-x-auto px-4 lg:px-6 py-1.5 scrollbar-hide">
      {LAYERS.map(({ key, icon }) => {
        const config = ENTITY_MARKER_CONFIG[key];
        const active = activeLayers.has(key);

        return (
          <button
            key={key}
            onClick={() => toggleLayer(key)}
            className="flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium transition-all duration-200"
            style={active ? {
              background: `rgba(255,255,255,0.95)`,
              border: `1px solid ${config.color}`,
              color: '#0a0b0f',
              boxShadow: `0 0 12px ${config.color}50, 0 2px 8px rgba(0,0,0,0.3)`,
            } : {
              background: 'rgba(10,11,15,0.6)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.4)',
            }}
          >
            <span style={{ fontSize: '8px', color: config.color }}>{icon}</span>
            <span style={{ fontWeight: active ? 700 : 500 }}>{config.label}</span>
          </button>
        );
      })}
    </div>
  );
}
