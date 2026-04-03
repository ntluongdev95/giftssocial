'use client';

import { useMapStore } from '@/stores/mapStore';
import { useLandmarkStore } from '@/stores/landmarkStore';
import { useFriendStore } from '@/stores/friendStore';
import { useDeveloperStore } from '@/stores/developerStore';
import { ENTITY_MARKER_CONFIG } from '@/styles/tokens';
import type { EntityType } from '@/types';

const ENTITY_LAYERS: { key: EntityType; icon: string }[] = [
  { key: 'people', icon: '●' },
  { key: 'business', icon: '■' },
  { key: 'event', icon: '▲' },
  { key: 'offer', icon: '◆' },
  { key: 'profile', icon: '👤' },
  { key: 'agent', icon: '⬡' },
  { key: 'circle', icon: '⦿' },
];

const SPECIAL_LAYERS = [
  // { key: 'landmarks', icon: '🏛', label: 'Landmarks', color: '#fbbf24' }, // TODO: re-enable later
  { key: 'friends', icon: '👥', label: 'Friends', color: '#00d4ff' },
  { key: 'gifts', icon: '🎁', label: 'Gifts', color: '#ec4899' },
  { key: 'developers', icon: '💻', label: 'Developers', color: '#34d399' },
];

export default function LayerFilterPanel() {
  const { activeLayers, toggleLayer, viewMode } = useMapStore();
  const { showOnMap: showLandmarks, toggleShowOnMap: toggleLandmarks } = useLandmarkStore();
  const { showOnMap: showFriends, toggleShowOnMap: toggleFriends } = useFriendStore();
  const { showOnMap: showDevs, toggleShowOnMap: toggleDevs } = useDeveloperStore();

  const specialState: Record<string, { active: boolean; toggle: () => void }> = {
    landmarks: { active: showLandmarks, toggle: toggleLandmarks },
    friends: { active: showFriends, toggle: toggleFriends },
    gifts: { active: activeLayers.has('gift'), toggle: () => toggleLayer('gift') },
    developers: { active: showDevs, toggle: toggleDevs },
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

      {/* Landmarks — 3D only */}
      {viewMode === '3d' && (() => {
        const active = activeLayers.has('landmark');
        return (
          <button
            onClick={() => toggleLayer('landmark')}
            className="flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium transition-all duration-200 cursor-pointer"
            style={active ? {
              background: 'rgba(255,255,255,0.95)',
              border: '1px solid #fbbf24',
              color: '#0a0b0f',
              boxShadow: '0 0 12px rgba(251,191,36,0.5), 0 2px 8px rgba(0,0,0,0.3)',
            } : {
              background: 'rgba(10,11,15,0.6)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.4)',
            }}
          >
            <span style={{ fontSize: '10px' }}>🏛</span>
            <span style={{ fontWeight: active ? 700 : 500 }}>Landmarks</span>
          </button>
        );
      })()}

      {/* Separator */}
      <div className="shrink-0 w-px my-0.5" style={{ background: 'rgba(255,255,255,0.08)' }} />

      {/* Special layers (landmarks, friends, developers) */}
      {SPECIAL_LAYERS.map(({ key, icon, label, color }) => {
        const { active, toggle } = specialState[key];
        // Only show landmarks toggle in 3D mode
        if (key === 'landmarks' && viewMode !== '3d') return null;
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
