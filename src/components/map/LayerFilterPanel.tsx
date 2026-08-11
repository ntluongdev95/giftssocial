'use client';

import { useMapStore } from '@/stores/mapStore';
import { useFriendStore } from '@/stores/friendStore';
import { useGiftsPopupStore } from '@/stores/giftsPopupStore';
import { ENTITY_MARKER_CONFIG } from '@/styles/tokens';
import type { EntityType } from '@/types';

// Only three chips remain on the map's top filter bar per product
// decision: People, Friends, Gifts. Other layers stay implemented in
// the stores / renderers but are no longer surfaced as chips here.
const ENTITY_LAYERS: { key: EntityType; icon: string }[] = [
  { key: 'people', icon: '●' },
];

const SPECIAL_LAYERS = [
  { key: 'friends', icon: '👥', label: 'Friends', color: '#00d4ff' },
  { key: 'gifts', icon: '🎁', label: 'Gifts', color: '#ec4899' },
];

export default function LayerFilterPanel() {
  const { activeLayers, toggleLayer } = useMapStore();
  const { showOnMap: showFriends, toggleShowOnMap: toggleFriends } = useFriendStore();
  const openGiftsPopup = useGiftsPopupStore((s) => s.openPopup);

  const specialState: Record<string, { active: boolean; toggle: () => void }> = {
    friends: { active: showFriends, toggle: toggleFriends },
    // Gifts chip opens the unified GiftsPopup (Kiss form + Templates
    // in tabs). Also ensures the gift map layer is on so existing
    // kiss markers show behind the popup.
    gifts: {
      active: activeLayers.has('gift'),
      toggle: () => {
        if (!activeLayers.has('gift')) toggleLayer('gift');
        openGiftsPopup('kiss');
      },
    },
  };

  return (
    <div className="flex gap-1.5 overflow-x-auto px-4 lg:px-6 py-1.5 scrollbar-hide" style={{ paddingRight: '2rem' }}>
      {/* Entity layers */}
      {ENTITY_LAYERS.map(({ key, icon }) => {
        const config = ENTITY_MARKER_CONFIG[key];
        if (!config) return null;
        const active = activeLayers.has(key);
        return (
          <button
            key={key}
            onClick={() => toggleLayer(key)}
            className="flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium transition-all duration-200 cursor-pointer"
            style={active ? {
              background: 'rgba(255,255,255,0.95)',
              border: `1px solid ${config.color}`,
              color: '#0a0b0f',
              boxShadow: `0 0 12px ${config.color}50, 0 2px 8px rgba(0,0,0,0.3)`,
            } : {
              background: 'rgba(10,11,15,0.6)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.4)',
            }}
          >
            <span style={{ fontSize: '8px', color: active ? config.color : undefined }}>{icon}</span>
            <span style={{ fontWeight: active ? 700 : 500 }}>{config.label}</span>
          </button>
        );
      })}

      {/* Separator between People (entity) and Friends/Gifts (special) */}
      <div className="shrink-0 w-px my-0.5" style={{ background: 'rgba(255,255,255,0.08)' }} />

      {/* Special layers — Friends + Gifts only */}
      {SPECIAL_LAYERS.map(({ key, icon, label, color }) => {
        const { active, toggle } = specialState[key];
        return (
          <button
            key={key}
            onClick={toggle}
            className="flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium transition-all duration-200 cursor-pointer"
            style={active ? {
              background: 'rgba(255,255,255,0.95)',
              border: `1px solid ${color}`,
              color: '#0a0b0f',
              boxShadow: `0 0 12px ${color}50, 0 2px 8px rgba(0,0,0,0.3)`,
            } : {
              background: 'rgba(10,11,15,0.6)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.4)',
            }}
          >
            <span style={{ fontSize: '8px' }}>{icon}</span>
            <span style={{ fontWeight: active ? 700 : 500 }}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
