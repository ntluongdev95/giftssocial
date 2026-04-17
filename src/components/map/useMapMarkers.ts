'use client';

import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import useSWR from 'swr';
import maplibregl from 'maplibre-gl';
import { escapeHtml } from '@/lib/sanitize';
import type { Signal, Agent, Friend, Developer, Profile, Business, Event, Circle, MapUser, EntityType, TrustLevel, MarkerState } from '@/types';
import { ENTITY_MARKER_CONFIG, AGENT_COLORS } from '@/styles/tokens';
import { useMapStore } from '@/stores/mapStore';
import { useFriendStore } from '@/stores/friendStore';
import { useDeveloperStore } from '@/stores/developerStore';
import { useAuthStore } from '@/stores/auth-store';
import { parseUTC } from '@/lib/date';
import { useLandmarkStore, type Landmark } from '@/stores/landmarkStore';

const unlockedFetcher = (url: string) => fetch(url, {
  cache: 'no-store',
  headers: { Authorization: `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('access_token') || '' : ''}` },
}).then(r => r.json());

// ─── SVG Marker Generators ───────────────────────────────────────────────

function svgCircle(color: string, size = 28): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 2}" fill="${color}" stroke="#0a0b0f" stroke-width="2"/>
  </svg>`;
}

function svgSquare(color: string, size = 28): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="2" width="${size - 4}" height="${size - 4}" rx="4" fill="${color}" stroke="#0a0b0f" stroke-width="2"/>
  </svg>`;
}

function svgTriangle(color: string, size = 28): string {
  const mid = size / 2;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <polygon points="${mid},3 ${size - 3},${size - 3} 3,${size - 3}" fill="${color}" stroke="#0a0b0f" stroke-width="2"/>
  </svg>`;
}

function svgDiamond(color: string, size = 28): string {
  const mid = size / 2;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <polygon points="${mid},2 ${size - 2},${mid} ${mid},${size - 2} 2,${mid}" fill="${color}" stroke="#0a0b0f" stroke-width="2"/>
  </svg>`;
}

function svgShield(color: string, size = 28): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <path d="M${size / 2} 2 L${size - 3} ${size * 0.35} L${size - 3} ${size * 0.65} Q${size / 2} ${size - 2} ${size / 2} ${size - 2} Q${size / 2} ${size - 2} 3 ${size * 0.65} L3 ${size * 0.35} Z" fill="${color}" stroke="#0a0b0f" stroke-width="2"/>
  </svg>`;
}

function svgHexagon(color: string, size = 32): string {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 2;
  const pts = Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
  }).join(' ');
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <polygon points="${pts}" fill="${color}" stroke="#0a0b0f" stroke-width="2"/>
  </svg>`;
}

function svgCluster(color: string, size = 28): string {
  const cx = size / 2;
  const cy = size / 2;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <circle cx="${cx}" cy="${cy}" r="${size / 2 - 2}" fill="none" stroke="${color}" stroke-width="2"/>
    <circle cx="${cx}" cy="${cy}" r="${size / 2 - 6}" fill="${color}" opacity="0.4"/>
    <circle cx="${cx}" cy="${cy}" r="${size / 2 - 10}" fill="${color}"/>
  </svg>`;
}

const SVG_GENERATORS: Record<string, (color: string, size?: number) => string> = {
  circle: svgCircle,
  square: svgSquare,
  triangle: svgTriangle,
  diamond: svgDiamond,
  shield: svgShield,
  hexagon: svgHexagon,
  pulse: svgCircle,
  cluster: svgCluster,
};

function verifiedBadge(): string {
  return `<svg width="12" height="12" viewBox="0 0 12 12" style="position:absolute;top:-2px;right:-2px;">
    <circle cx="6" cy="6" r="6" fill="#3B82F6"/>
    <path d="M3.5 6L5.5 8L8.5 4.5" stroke="white" stroke-width="1.5" fill="none" stroke-linecap="round"/>
  </svg>`;
}

// ─── CSS for marker states ────────────────────────────────────────────────

const MARKER_STYLES = `
  .gao-marker { position: relative; cursor: pointer; transition: transform 0.2s, opacity 0.2s; opacity: 1 !important; }
  .maplibregl-marker { opacity: 1 !important; filter: none !important; }
  .gao-marker.state-selected { transform: scale(1.25); filter: drop-shadow(0 0 6px rgba(0,212,255,0.6)); }
  .gao-marker.state-suppressed { opacity: 0.5; }
  .gao-marker.state-live::after {
    content: ''; position: absolute; inset: -6px; border-radius: 50%;
    border: 2px solid currentColor; animation: gao-pulse 2s ease-out infinite;
  }
  .gao-marker.state-executing::after {
    content: ''; position: absolute; inset: -4px; border-radius: 50%;
    border: 2px dashed #a78bfa; animation: gao-spin 1.5s linear infinite;
  }
  @keyframes gao-pulse {
    0% { transform: scale(1); opacity: 0.8; }
    100% { transform: scale(1.8); opacity: 0; }
  }
  @keyframes gao-spin { to { transform: rotate(360deg); } }

  /* Friend markers */
  .gao-friend-marker {
    display: flex; flex-direction: column; align-items: center; gap: 2px;
    cursor: pointer; transition: transform 0.2s;
    filter: drop-shadow(0 2px 6px rgba(0,0,0,0.5));
  }
  .gao-friend-marker:hover { transform: scale(1.15); }
  .gao-friend-avatar {
    width: 36px; height: 36px; border-radius: 50%;
    border: 2.5px solid #00d4ff; background: #111318;
    display: flex; align-items: center; justify-content: center;
    font-size: 13px; font-weight: 700; color: #00d4ff;
    box-shadow: 0 0 12px rgba(0,212,255,0.4);
    position: relative;
  }
  .gao-friend-avatar img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; }
  .gao-friend-online {
    position: absolute; bottom: -1px; right: -1px;
    width: 10px; height: 10px; border-radius: 50%;
    background: #34d399; border: 2px solid #0a0b0f;
    box-shadow: 0 0 6px rgba(52,211,153,0.6);
  }
  .gao-friend-name {
    background: rgba(10,11,15,0.85); backdrop-filter: blur(8px);
    border: 1px solid rgba(0,212,255,0.2); border-radius: 6px;
    padding: 1px 6px; font-size: 10px; font-weight: 600;
    color: #f0f4ff; white-space: nowrap; max-width: 80px;
    overflow: hidden; text-overflow: ellipsis; text-align: center;
  }

  /* Landmark popup */
  .gao-landmark-popup .maplibregl-popup-content {
    background: rgba(10,11,15,0.92) !important;
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255,255,255,0.08) !important;
    border-radius: 10px !important;
    padding: 8px 12px !important;
    box-shadow: 0 4px 16px rgba(0,0,0,0.5) !important;
  }
  .gao-landmark-popup .maplibregl-popup-tip {
    border-top-color: rgba(10,11,15,0.92) !important;
  }
`;

let stylesInjected = false;
function injectStyles() {
  if (stylesInjected || typeof document === 'undefined') return;
  const style = document.createElement('style');
  style.textContent = MARKER_STYLES;
  document.head.appendChild(style);
  stylesInjected = true;
}

// ─── Create marker element ────────────────────────────────────────────────

function createMarkerElement(
  entityType: EntityType,
  state: MarkerState,
  verified: boolean,
  agentType?: string
): HTMLDivElement {
  const config = ENTITY_MARKER_CONFIG[entityType];
  let color = config.color;

  if (entityType === 'agent' && agentType) {
    color = AGENT_COLORS[agentType as keyof typeof AGENT_COLORS] || color;
  }

  const generator = SVG_GENERATORS[config.shape] || svgCircle;
  const size = entityType === 'agent' ? 32 : 28;
  const svgString = generator(color, size);

  const el = document.createElement('div');
  el.className = `gao-marker state-${state}`;
  el.style.color = color;
  el.innerHTML = svgString + (verified ? verifiedBadge() : '');

  return el;
}

// ─── Friend marker element ───────────────────────────────────────────────

function createFriendMarkerElement(friend: Friend): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'gao-friend-marker';

  const initials = friend.display_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  el.innerHTML = `
    <div class="gao-friend-avatar">
      ${friend.avatar_url
        ? `<img src="${friend.avatar_url}" alt="${escapeHtml(friend.display_name)}" />`
        : initials
      }
      ${friend.is_online ? '<div class="gao-friend-online"></div>' : ''}
    </div>
    <div class="gao-friend-name">${escapeHtml(friend.display_name)}</div>
  `;

  return el;
}

// ─── Developer marker element ────────────────────────────────────────────

function createDeveloperMarkerElement(dev: Developer): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'gao-friend-marker'; // reuse friend marker base styles

  const initials = dev.display_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const borderColor = dev.is_available ? '#34d399' : '#a78bfa';

  el.innerHTML = `
    <div class="gao-friend-avatar" style="border-color:${borderColor};box-shadow:0 0 12px ${borderColor}44;">
      ${dev.avatar_url
        ? `<img src="${dev.avatar_url}" alt="${escapeHtml(dev.display_name)}" />`
        : initials
      }
      ${dev.is_available ? '<div class="gao-friend-online" style="background:#34d399;"></div>' : ''}
    </div>
    <div class="gao-friend-name" style="border-color:${borderColor}33;">
      ${dev.display_name.split(' ')[0]}
      <span style="font-size:8px;opacity:0.5;margin-left:2px">💻</span>
    </div>
  `;

  return el;
}

// ─── Profile marker element ─────────────────────────────────────────────

function createProfileMarkerElement(profile: Profile): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'gao-friend-marker';

  const initial = profile.headline.charAt(0).toUpperCase();
  const borderColor = profile.available ? '#3B82F6' : '#4a5068';

  el.innerHTML = `
    <div class="gao-friend-avatar" style="border-color:${borderColor};box-shadow:0 0 12px ${borderColor}44;font-size:14px;">
      ${initial}
      ${profile.available ? '<div class="gao-friend-online" style="background:#3B82F6;box-shadow:0 0 6px rgba(59,130,246,0.6);"></div>' : ''}
    </div>
    <div class="gao-friend-name" style="border-color:${borderColor}33;">
      ${profile.headline.split(' ').slice(0, 2).join(' ')}
    </div>
  `;

  return el;
}

// ─── Landmark-specific silhouette SVGs ───────────────────────────────────
// Each landmark gets a unique recognizable silhouette icon

const LANDMARK_SVGS: Record<string, string> = {
  // Eiffel Tower — iconic lattice shape
  lm_eiffel: `<svg viewBox="0 0 40 56" fill="none"><path d="M20 0L17 12H23L20 0Z" fill="#fbbf24"/><path d="M15 16L8 52H14L17 28H23L26 52H32L25 16H15Z" fill="#fbbf24"/><path d="M12 36H28" stroke="#0a0b0f" stroke-width="1.5"/><path d="M14 24H26" stroke="#0a0b0f" stroke-width="1"/><rect x="6" y="52" width="28" height="4" rx="1" fill="#fbbf24"/></svg>`,
  // Burj Khalifa — sleek spire
  lm_burj: `<svg viewBox="0 0 32 60" fill="none"><path d="M16 0L15 20H17L16 0Z" fill="#00d4ff"/><path d="M13 20L11 56H21L19 20H13Z" fill="#00d4ff"/><path d="M14 12H18M13 24H19M12 36H20M11 48H21" stroke="#0a0b0f" stroke-width="0.8"/><rect x="9" y="56" width="14" height="4" rx="1" fill="#00d4ff"/></svg>`,
  // Statue of Liberty — torch + crown
  lm_liberty: `<svg viewBox="0 0 40 56" fill="none"><circle cx="20" cy="10" r="5" fill="#38bdf8"/><path d="M17 6L15 2M20 5V1M23 6L25 2" stroke="#fbbf24" stroke-width="1.5" stroke-linecap="round"/><path d="M18 15V40H22V15" fill="#38bdf8"/><path d="M10 40L15 38V32L10 40Z" fill="#38bdf8"/><path d="M30 40L25 38V32L30 40Z" fill="#38bdf8"/><path d="M12 8L8 4" stroke="#fbbf24" stroke-width="2" stroke-linecap="round"/><circle cx="7" cy="3" r="2" fill="#fbbf24"/><rect x="14" y="40" width="12" height="6" rx="1" fill="#38bdf8"/><rect x="10" y="46" width="20" height="4" rx="1" fill="#38bdf8"/><rect x="8" y="50" width="24" height="6" rx="1" fill="#38bdf8"/></svg>`,
  // Colosseum — arched facade
  lm_colosseum: `<svg viewBox="0 0 56 40" fill="none"><ellipse cx="28" cy="30" rx="26" ry="10" fill="#f87171" opacity="0.3"/><path d="M4 16C4 8 14 2 28 2S52 8 52 16V30C52 34 42 38 28 38S4 34 4 30V16Z" fill="#f87171"/><path d="M10 12H18M22 12H30M34 12H42" stroke="#0a0b0f" stroke-width="1"/><path d="M8 20H16M20 20H28M32 20H40M44 20H50" stroke="#0a0b0f" stroke-width="1"/><path d="M10 28H18M22 28H30M34 28H42" stroke="#0a0b0f" stroke-width="0.8"/></svg>`,
  // Taj Mahal — dome + minarets
  lm_taj: `<svg viewBox="0 0 48 48" fill="none"><path d="M24 4C20 4 16 12 16 18H32C32 12 28 4 24 4Z" fill="white"/><circle cx="24" cy="6" r="2" fill="#fbbf24"/><rect x="14" y="18" width="20" height="20" rx="2" fill="white"/><path d="M20 38V28C20 26 22 24 24 24S28 26 28 28V38" fill="#e5e7eb"/><rect x="6" y="12" width="4" height="28" rx="1" fill="white"/><rect x="38" y="12" width="4" height="28" rx="1" fill="white"/><rect x="5" y="10" width="6" height="3" rx="1" fill="white"/><rect x="37" y="10" width="6" height="3" rx="1" fill="white"/><rect x="8" y="38" width="32" height="4" rx="1" fill="white"/><rect x="4" y="42" width="40" height="4" rx="1" fill="#e5e7eb"/></svg>`,
  // Big Ben — clock tower
  lm_bigben: `<svg viewBox="0 0 28 56" fill="none"><rect x="8" y="8" width="12" height="44" rx="1" fill="#fbbf24"/><path d="M6 8H22L18 2H10L6 8Z" fill="#fbbf24"/><circle cx="14" cy="20" r="5" fill="#0a0b0f" stroke="#fbbf24" stroke-width="1"/><path d="M14 16V20L17 21" stroke="#fbbf24" stroke-width="1" stroke-linecap="round"/><path d="M10 30H18M10 36H18M10 42H18" stroke="#0a0b0f" stroke-width="0.8"/><rect x="6" y="52" width="16" height="4" rx="1" fill="#fbbf24"/></svg>`,
  // Sydney Opera House — sail shapes
  lm_opera: `<svg viewBox="0 0 56 36" fill="none"><path d="M10 32C10 32 12 8 22 8C26 8 26 32 26 32" fill="white"/><path d="M18 32C18 32 21 4 30 4C34 4 33 32 33 32" fill="white"/><path d="M26 32C26 32 30 10 38 10C42 10 40 32 40 32" fill="white"/><path d="M34 32C34 32 37 14 44 14C48 14 46 32 46 32" fill="white"/><rect x="4" y="32" width="48" height="4" rx="2" fill="#a3adc3"/></svg>`,
  // Great Pyramid
  lm_pyramid: `<svg viewBox="0 0 56 44" fill="none"><path d="M28 2L4 42H52L28 2Z" fill="#fbbf24"/><path d="M28 2L28 42" stroke="#0a0b0f" stroke-width="0.5" opacity="0.3"/><path d="M28 2L52 42" stroke="#d4a017" stroke-width="0.5"/><rect x="2" y="40" width="52" height="4" fill="#fbbf24" opacity="0.5"/></svg>`,
  // Golden Gate Bridge
  lm_golden_gate: `<svg viewBox="0 0 64 40" fill="none"><path d="M0 36H64" stroke="#f87171" stroke-width="3"/><rect x="12" y="4" width="4" height="32" rx="1" fill="#f87171"/><rect x="48" y="4" width="4" height="32" rx="1" fill="#f87171"/><path d="M14 6C14 6 24 14 32 14S50 6 50 6" stroke="#f87171" stroke-width="1.5" fill="none"/><path d="M14 4H50" stroke="#f87171" stroke-width="1.5"/><path d="M20 14V36M26 17V36M32 18V36M38 17V36M44 14V36" stroke="#f87171" stroke-width="0.6"/></svg>`,
  // Tokyo Skytree
  lm_skytree: `<svg viewBox="0 0 24 60" fill="none"><path d="M12 0L11 8H13L12 0Z" fill="#a78bfa"/><path d="M10 8L9 24H15L14 8H10Z" fill="#a78bfa"/><path d="M9 24L7 56H17L15 24H9Z" fill="#a78bfa"/><circle cx="12" cy="18" r="3" fill="#0a0b0f" stroke="#a78bfa" stroke-width="0.8"/><path d="M8 32H16M7 40H17M7 48H17" stroke="#0a0b0f" stroke-width="0.5"/><rect x="5" y="56" width="14" height="4" rx="1" fill="#a78bfa"/></svg>`,
};

// Fallback silhouettes by type
const LANDMARK_TYPE_SVGS: Record<string, string> = {
  tower: `<svg viewBox="0 0 32 56" fill="none"><path d="M16 0L14 16H18L16 0Z" fill="currentColor"/><path d="M12 16L8 52H12L14 28H18L20 52H24L20 16H12Z" fill="currentColor"/><rect x="6" y="52" width="20" height="4" rx="1" fill="currentColor"/></svg>`,
  building: `<svg viewBox="0 0 32 52" fill="none"><path d="M16 0L15 10H17Z" fill="currentColor"/><rect x="10" y="10" width="12" height="38" rx="1" fill="currentColor"/><path d="M13 16H15M17 16H19M13 22H15M17 22H19M13 28H15M17 28H19M13 34H15M17 34H19M13 40H15M17 40H19" stroke="#0a0b0f" stroke-width="0.8"/><rect x="8" y="48" width="16" height="4" rx="1" fill="currentColor"/></svg>`,
  monument: `<svg viewBox="0 0 40 48" fill="none"><path d="M20 2L6 44H34Z" fill="currentColor" opacity="0.8"/><path d="M20 2L20 44" stroke="#0a0b0f" stroke-width="0.5"/><rect x="4" y="44" width="32" height="4" rx="1" fill="currentColor"/></svg>`,
  bridge: `<svg viewBox="0 0 56 32" fill="none"><path d="M0 28H56" stroke="currentColor" stroke-width="3"/><rect x="10" y="4" width="3" height="24" fill="currentColor"/><rect x="43" y="4" width="3" height="24" fill="currentColor"/><path d="M12 6C12 6 22 14 28 14S44 6 44 6" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>`,
  temple: `<svg viewBox="0 0 40 44" fill="none"><path d="M20 2L4 14H36Z" fill="currentColor"/><rect x="8" y="14" width="4" height="24" fill="currentColor"/><rect x="16" y="14" width="4" height="24" fill="currentColor"/><rect x="24" y="14" width="4" height="24" fill="currentColor"/><rect x="28" y="14" width="4" height="24" fill="currentColor"/><rect x="4" y="38" width="32" height="4" rx="1" fill="currentColor"/></svg>`,
  palace: `<svg viewBox="0 0 44 44" fill="none"><path d="M22 2C18 2 14 10 14 16H30C30 10 26 2 22 2Z" fill="currentColor"/><rect x="10" y="16" width="24" height="24" rx="1" fill="currentColor"/><path d="M18 40V30C18 28 20 26 22 26S26 28 26 30V40" fill="#0a0b0f"/><rect x="8" y="40" width="28" height="4" rx="1" fill="currentColor"/></svg>`,
  statue: `<svg viewBox="0 0 32 48" fill="none"><circle cx="16" cy="8" r="4" fill="currentColor"/><path d="M14 12V32H18V12" fill="currentColor"/><path d="M8 32H24" stroke="currentColor" stroke-width="2"/><rect x="12" y="32" width="8" height="4" fill="currentColor"/><rect x="10" y="36" width="12" height="4" rx="1" fill="currentColor"/><rect x="8" y="40" width="16" height="4" rx="1" fill="currentColor"/></svg>`,
  wonder: `<svg viewBox="0 0 40 40" fill="none"><path d="M20 2L24 14H36L26 22L30 36L20 28L10 36L14 22L4 14H16Z" fill="currentColor"/></svg>`,
};

const LANDMARK_COLORS: Record<string, string> = {
  tower: '#fbbf24', building: '#00d4ff', monument: '#f87171', bridge: '#f87171',
  temple: '#34d399', palace: '#f472b6', statue: '#38bdf8', wonder: '#fbbf24',
};

function createLandmarkMarkerElement(lm: Landmark): HTMLDivElement {
  const color = LANDMARK_COLORS[lm.type] || '#00d4ff';

  const el = document.createElement('div');
  el.style.cssText = `
    position:relative;
    display:flex;align-items:center;gap:4px;
    cursor:pointer;transition:transform 0.15s;
    background:rgba(10,11,15,0.85);backdrop-filter:blur(6px);
    border:1px solid ${color}35;border-radius:8px;
    padding:3px 8px 3px 4px;
    box-shadow:0 2px 8px rgba(0,0,0,0.4), 0 0 12px ${color}20;
    font-family:Inter,system-ui,sans-serif;
    white-space:nowrap;
  `;

  // Tooltip (CSS only, no MapLibre Popup)
  el.innerHTML = `
    <span style="font-size:14px;line-height:1;">${lm.icon}</span>
    <span style="font-size:9px;font-weight:600;color:${color};max-width:70px;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(lm.name)}</span>
    <div class="gao-lm-tip" style="
      position:absolute;bottom:calc(100% + 6px);left:50%;transform:translateX(-50%);
      background:rgba(10,11,15,0.95);border:1px solid ${color}25;border-radius:8px;
      padding:6px 10px;white-space:nowrap;pointer-events:none;
      opacity:0;transition:opacity 0.15s;
      box-shadow:0 4px 12px rgba(0,0,0,0.5);
      font-family:Inter,system-ui,sans-serif;
    ">
      <div style="font-size:11px;font-weight:700;color:white;">${escapeHtml(lm.name)}</div>
      <div style="font-size:9px;color:#a3adc3;">${lm.city}, ${lm.country}${lm.height ? ` · ${lm.height}m` : ''}</div>
    </div>
  `;

  el.onmouseenter = () => {
    el.style.transform = 'scale(1.1)';
    const tip = el.querySelector('.gao-lm-tip') as HTMLElement;
    if (tip) tip.style.opacity = '1';
  };
  el.onmouseleave = () => {
    el.style.transform = 'scale(1)';
    const tip = el.querySelector('.gao-lm-tip') as HTMLElement;
    if (tip) tip.style.opacity = '0';
  };

  return el;
}

// ─── Signal → EntityType mapping ──────────────────────────────────────────

const SIGNAL_TYPE_CONFIG: Record<string, { entity: EntityType; emoji: string; color: string; label: string }> = {
  presence: { entity: 'people', emoji: '📍', color: '#3B82F6', label: "I'm Here" },
  intent:   { entity: 'people', emoji: '🔍', color: '#a78bfa', label: 'Need' },
  offer:    { entity: 'offer',  emoji: '🏷', color: '#fbbf24', label: 'Offer' },
  event:    { entity: 'event',  emoji: '🎉', color: '#f87171', label: 'Event' },
  update:   { entity: 'people', emoji: '📣', color: '#00d4ff', label: 'Update' },
  proof:    { entity: 'proof',  emoji: '🛡', color: '#f0f4ff', label: 'Proof' },
};

function signalToEntityType(type: string): EntityType {
  return SIGNAL_TYPE_CONFIG[type]?.entity || 'people';
}

// Create a compact signal icon marker
function createSignalMarkerElement(signal: Signal): HTMLDivElement {
  const cfg = SIGNAL_TYPE_CONFIG[signal.type] || SIGNAL_TYPE_CONFIG.presence;
  const isLive = (parseUTC(signal.created_at)?.getTime() ?? 0) > Date.now() - 30 * 60 * 1000;

  const el = document.createElement('div');
  el.className = 'gao-marker' + (isLive ? ' state-live' : '');
  el.style.cssText = `
    width:32px;height:32px;border-radius:50%;
    display:flex;align-items:center;justify-content:center;
    background:rgba(10,11,15,0.9);
    border:2px solid ${cfg.color};
    box-shadow:0 0 10px ${cfg.color}40, 0 2px 6px rgba(0,0,0,0.4);
    cursor:pointer;transition:transform 0.15s;
    font-size:15px;line-height:1;
  `;
  el.textContent = cfg.emoji;

  el.onmouseenter = () => { el.style.filter = `drop-shadow(0 0 8px ${cfg.color}80)`; };
  el.onmouseleave = () => { el.style.filter = 'none'; };

  return el;
}

// ─── Image marker (business, event) ──────────────────────────────────────

function createImageMarkerElement(iconSrc: string, _borderColor: string, title: string, isLive = false): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'gao-marker' + (isLive ? ' state-live' : '');
  el.style.cssText = `
    width:32px;height:32px;
    cursor:pointer;
    background:transparent;
    border:none;
    display:flex;align-items:center;justify-content:center;
  `;

  const img = document.createElement('img');
  img.src = iconSrc;
  img.alt = title;
  img.style.cssText = 'width:28px;height:28px;object-fit:contain;';
  el.appendChild(img);

  return el;
}

// ─── Hook ─────────────────────────────────────────────────────────────────

export function useMapMarkers(
  map: maplibregl.Map | null,
  signals: Signal[],
  agents: Agent[],
  profiles: Profile[] = [],
  businesses: Business[] = [],
  events: Event[] = [],
  circles: Circle[] = [],
  mapUsers: MapUser[] = []
) {
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const [styleVersion, setStyleVersion] = useState(0);
  const { activeLayers, setSelectedMarker, addMarker, removeMarker } =
    useMapStore();
  const { friends, showOnMap: showFriendsOnMap } = useFriendStore();
  const { developers, showOnMap: showDevsOnMap } = useDeveloperStore();
  const { landmarks, showOnMap: showLandmarksOnMap } = useLandmarkStore();
  const isAuthed = useAuthStore((s) => s.isAuthed);
  const viewMode = useMapStore((s) => s.viewMode);

  // Paint-your-map: which venues has the current user unlocked (checked in)?
  const { data: unlockedData } = useSWR<{ data: { businesses: { id: string; verified: boolean }[]; events: { id: string; verified: boolean }[] } }>(
    isAuthed ? '/api/v1/me/unlocked' : null,
    unlockedFetcher,
  );
  const unlockedBusinessIds = useMemo(
    () => new Set((unlockedData?.data?.businesses || []).map(b => b.id)),
    [unlockedData],
  );
  const unlockedEventIds = useMemo(
    () => new Set((unlockedData?.data?.events || []).map(e => e.id)),
    [unlockedData],
  );

  useEffect(() => {
    injectStyles();
  }, []);

  // Sync DOM markers (2D only — 3D uses GeoJSON layers)
  useEffect(() => {
    if (!map) return;
    const isGlobe = useMapStore.getState().viewMode === '3d';
    if (isGlobe) return; // Skip — globe mode uses GeoJSON layers instead

    const currentIds = new Set<string>();

    // Add / update signal markers
    for (const signal of signals) {
      const entityType = signalToEntityType(signal.type);

      if (!activeLayers.has(entityType)) {
        // Remove if layer hidden
        const existing = markersRef.current.get(signal.id);
        if (existing) {
          existing.remove();
          markersRef.current.delete(signal.id);
          removeMarker(signal.id);
        }
        continue;
      }

      currentIds.add(signal.id);

      if (markersRef.current.has(signal.id)) continue;

      const isLive = signal.status === 'active' && (parseUTC(signal.created_at)?.getTime() ?? 0) > Date.now() - 30 * 60 * 1000;
      const state: MarkerState = signal.status === 'suppressed' ? 'suppressed' : isLive ? 'live' : 'default';

      const el = createSignalMarkerElement(signal);
      el.addEventListener('click', () => setSelectedMarker(signal.id));

      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat(signal.location.coordinates as [number, number])
        .addTo(map);

      markersRef.current.set(signal.id, marker);
      addMarker({
        id: signal.id,
        entity_type: entityType,
        lat: signal.location.coordinates[1],
        lng: signal.location.coordinates[0],
        title: signal.title,
        state,
        metadata: { type: signal.type, category: signal.category, author_id: signal.owner_id },
      });
    }

    // Add / update agent markers
    for (const agent of agents) {
      if (!activeLayers.has('agent') || !agent.location || !agent.map_visible) {
        const existing = markersRef.current.get(agent.id);
        if (existing) {
          existing.remove();
          markersRef.current.delete(agent.id);
          removeMarker(agent.id);
        }
        continue;
      }

      currentIds.add(agent.id);

      if (markersRef.current.has(agent.id)) continue;

      const state: MarkerState =
        agent.status === 'executing' ? 'executing' : 'default';

      const el = createMarkerElement('agent', state, agent.verified, agent.type);

      el.addEventListener('click', () => setSelectedMarker(agent.id));

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat(agent.location.coordinates as [number, number])
        .addTo(map);

      markersRef.current.set(agent.id, marker);
      addMarker({
        id: agent.id,
        entity_type: 'agent',
        lat: agent.location.coordinates[1],
        lng: agent.location.coordinates[0],
        title: agent.name,
        state,
        trust_level: agent.trust_level,
      });
    }

    // Add / update friend markers
    if (showFriendsOnMap) {
      for (const friend of friends) {
        // Skip friends not sharing location
        if (friend.location_sharing === 'off' || !friend.location) continue;

        currentIds.add(friend.id);
        if (markersRef.current.has(friend.id)) continue;

        const el = createFriendMarkerElement(friend);

        el.addEventListener('click', () => setSelectedMarker(friend.id));

        const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat(friend.location.coordinates as [number, number])
          .addTo(map);

        markersRef.current.set(friend.id, marker);
        addMarker({
          id: friend.id,
          entity_type: 'friend',
          lat: friend.location.coordinates[1],
          lng: friend.location.coordinates[0],
          title: friend.display_name,
          state: friend.is_online ? 'live' : 'default',
          trust_level: friend.trust_level,
          metadata: { gao_domain: friend.gao_domain, is_online: friend.is_online, avatar_url: friend.avatar_url, trust_score: friend.trust_score, last_seen_at: friend.last_seen_at },
        });
      }
    } else {
      // Remove all friend markers when toggled off
      for (const friend of friends) {
        const existing = markersRef.current.get(friend.id);
        if (existing) {
          existing.remove();
          markersRef.current.delete(friend.id);
          removeMarker(friend.id);
        }
      }
    }

    // Add / update developer markers
    if (showDevsOnMap) {
      for (const dev of developers) {
        if (!dev.location) continue;
        currentIds.add(dev.id);
        if (markersRef.current.has(dev.id)) continue;

        const el = createDeveloperMarkerElement(dev);
        el.addEventListener('click', () => setSelectedMarker(dev.id));

        const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat(dev.location.coordinates as [number, number])
          .addTo(map);

        markersRef.current.set(dev.id, marker);
        addMarker({
          id: dev.id,
          entity_type: 'developer',
          lat: dev.location.coordinates[1],
          lng: dev.location.coordinates[0],
          title: dev.display_name,
          state: dev.is_available ? 'live' : 'default',
          trust_level: dev.trust_level,
          metadata: { title: dev.title, is_available: dev.is_available },
        });
      }
    } else {
      for (const dev of developers) {
        const existing = markersRef.current.get(dev.id);
        if (existing) { existing.remove(); markersRef.current.delete(dev.id); removeMarker(dev.id); }
      }
    }

    // Add / update profile markers
    if (activeLayers.has('profile')) {
      for (const profile of profiles) {
        if (!profile.location) continue;
        const pid = profile._id;
        currentIds.add(pid);
        if (markersRef.current.has(pid)) continue;

        const el = createProfileMarkerElement(profile);
        el.addEventListener('click', () => setSelectedMarker(pid));

        const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat(profile.location.coordinates as [number, number])
          .addTo(map);

        markersRef.current.set(pid, marker);
        addMarker({
          id: pid,
          entity_type: 'profile',
          lat: profile.location.coordinates[1],
          lng: profile.location.coordinates[0],
          title: profile.headline,
          state: profile.available ? 'live' : 'default',
          metadata: { industry: profile.industry, city: profile.city, skills: profile.skills },
        });
      }
    } else {
      for (const profile of profiles) {
        const existing = markersRef.current.get(profile._id);
        if (existing) { existing.remove(); markersRef.current.delete(profile._id); removeMarker(profile._id); }
      }
    }

    // User, business, event markers handled via GeoJSON cluster layers (separate useEffects below)

    // Add / update circle markers
    if (activeLayers.has('circle')) {
      for (const circle of circles) {
        if (!circle.location_lat || !circle.location_lng) continue;
        const cid = circle.id;
        currentIds.add(cid);
        if (markersRef.current.has(cid)) continue;

        const el = createMarkerElement('circle', 'default', circle.trust_score >= 60);
        el.addEventListener('click', () => setSelectedMarker(cid));

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([circle.location_lng, circle.location_lat])
          .addTo(map);

        markersRef.current.set(cid, marker);
        addMarker({
          id: cid, entity_type: 'circle',
          lat: circle.location_lat, lng: circle.location_lng,
          title: circle.name, state: 'default',
          metadata: { category: circle.category, member_count: circle.member_count },
        });
      }
    } else {
      for (const circle of circles) {
        const existing = markersRef.current.get(circle.id);
        if (existing) { existing.remove(); markersRef.current.delete(circle.id); removeMarker(circle.id); }
      }
    }

    // Add / update landmark markers (only in globe/3D mode or always)
    if (showLandmarksOnMap) {
      for (const lm of landmarks) {
        currentIds.add(lm.id);
        if (markersRef.current.has(lm.id)) continue;

        const el = createLandmarkMarkerElement(lm);

        // Tooltip handled by CSS inside the element — no MapLibre Popup

        const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat([lm.lng, lm.lat])
          .addTo(map);

        markersRef.current.set(lm.id, marker);
      }
    } else {
      for (const lm of landmarks) {
        const existing = markersRef.current.get(lm.id);
        if (existing) { existing.remove(); markersRef.current.delete(lm.id); }
      }
    }

    // Remove stale signal/agent markers only — keep friends, developers, landmarks
    for (const [id, marker] of markersRef.current) {
      if (!currentIds.has(id) && !id.startsWith('friend_') && !id.startsWith('dev_') && !id.startsWith('lm_') && !id.startsWith('biz_') && !id.startsWith('evt_') && !id.startsWith('profile_') && !id.startsWith('circle_')) {
        marker.remove();
        markersRef.current.delete(id);
        removeMarker(id);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, signals, agents, profiles, businesses, events, circles, mapUsers, friends, showFriendsOnMap, developers, showDevsOnMap, landmarks, showLandmarksOnMap, activeLayers, setSelectedMarker, addMarker, removeMarker, styleVersion]);

  // ── User cluster layer (GeoJSON native clustering — Google Maps style) ──
  const clusterLayersReady = useRef(false);
  const CLUSTER_SRC = 'gao-users-cluster';
  const CLUSTER_LAYERS = ['gao-user-cluster-ring', 'gao-user-clusters', 'gao-user-cluster-count', 'gao-user-single', 'gao-user-reason-badge', 'gao-user-label'];

  // Helper: remove cluster layers + source
  const removeClusterLayers = useCallback(() => {
    if (!map) return;
    for (const id of CLUSTER_LAYERS) {
      try { if (map.getLayer(id)) map.removeLayer(id); } catch {}
    }
    try { if (map.getSource(CLUSTER_SRC)) map.removeSource(CLUSTER_SRC); } catch {}
    clusterLayersReady.current = false;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  useEffect(() => {
    if (!map) return;
    const isGlobe = useMapStore.getState().viewMode === '3d';
    if (isGlobe) { removeClusterLayers(); return; }

    const showPeople = activeLayers.has('people');

    // Build GeoJSON from mapUsers (skip users with profiles)
    const profileUserIds = new Set(profiles.map(p => p.user_id));
    const features: GeoJSON.Feature[] = mapUsers
      .filter(u => u.location_lat && u.location_lng && !profileUserIds.has(u.id))
      .map(u => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [u.location_lng, u.location_lat] },
        properties: {
          id: u.id,
          name: u.display_name || u.username || 'User',
          avatar: u.avatar_url || '',
          city: u.city || '',
          trust_level: u.trust_level || 'new',
          visibility_reason: u.visibility_reason || 'public',
          shared_event_id: u.shared_event_id || '',
          shared_circle_id: u.shared_circle_id || '',
        },
      }));

    const geo: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: showPeople ? features : [] };

    // Update existing source data, or create fresh
    const existingSrc = map.getSource(CLUSTER_SRC) as maplibregl.GeoJSONSource | undefined;
    if (existingSrc && clusterLayersReady.current) {
      existingSrc.setData(geo);
      return; // layers + handlers already exist
    }

    // Clean stale layers if source exists but layers were lost (style change)
    if (existingSrc && !clusterLayersReady.current) {
      removeClusterLayers();
    }

    map.addSource(CLUSTER_SRC, {
      type: 'geojson',
      data: geo,
      cluster: true,
      clusterMaxZoom: 15,
      clusterRadius: 60,
    });

    // Generate person-icon cluster images for 2D (same as globe)
    const clusterSizes2D = [
      { name: 'gao-cluster-2d-sm', radius: 18, color: '#3B82F6', ringColor: 'rgba(59,130,246,0.2)' },
      { name: 'gao-cluster-2d-md', radius: 24, color: '#6366F1', ringColor: 'rgba(99,102,241,0.2)' },
      { name: 'gao-cluster-2d-lg', radius: 30, color: '#A855F7', ringColor: 'rgba(168,85,247,0.2)' },
      { name: 'gao-cluster-2d-xl', radius: 36, color: '#EC4899', ringColor: 'rgba(236,72,153,0.2)' },
    ];
    for (const cfg of clusterSizes2D) {
      if (!map.hasImage(cfg.name)) {
        const s = (cfg.radius + 6) * 2;
        const c = document.createElement('canvas'); c.width = s; c.height = s;
        const ctx = c.getContext('2d')!;
        const cx = s / 2, cy = s / 2;
        // Outer ring
        ctx.beginPath(); ctx.arc(cx, cy, cfg.radius + 4, 0, Math.PI * 2);
        ctx.strokeStyle = cfg.ringColor; ctx.lineWidth = 4; ctx.stroke();
        // Solid circle
        ctx.beginPath(); ctx.arc(cx, cy, cfg.radius, 0, Math.PI * 2);
        ctx.fillStyle = cfg.color; ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 2.5; ctx.stroke();
        // Person icon silhouette
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        const sc = cfg.radius / 24;
        ctx.beginPath(); ctx.arc(cx, cy - 4 * sc, 5 * sc, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(cx, cy + 6 * sc, 7 * sc, 5 * sc, 0, Math.PI, 0, true); ctx.fill();
        map.addImage(cfg.name, ctx.getImageData(0, 0, s, s), { pixelRatio: 2 });
      }
    }

    // Cluster — person icon (replaces plain circle)
    map.addLayer({
      id: 'gao-user-cluster-ring',
      type: 'symbol',
      source: CLUSTER_SRC,
      filter: ['has', 'point_count'],
      layout: {
        'icon-image': ['step', ['get', 'point_count'], 'gao-cluster-2d-sm', 10, 'gao-cluster-2d-md', 50, 'gao-cluster-2d-lg', 100, 'gao-cluster-2d-xl'],
        'icon-allow-overlap': true,
        'icon-anchor': 'center',
        'icon-pitch-alignment': 'viewport',
        'icon-rotation-alignment': 'viewport',
      },
    });

    // Keep circle layers for click hit area (invisible — icon renders on top)
    map.addLayer({
      id: 'gao-user-clusters',
      type: 'circle',
      source: CLUSTER_SRC,
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': 'transparent',
        'circle-radius': ['step', ['get', 'point_count'], 22, 10, 30, 50, 38, 100, 44],
      },
    });

    // Cluster count label
    map.addLayer({
      id: 'gao-user-cluster-count',
      type: 'symbol',
      source: CLUSTER_SRC,
      filter: ['has', 'point_count'],
      layout: {
        'text-field': '{point_count_abbreviated}',
        'text-size': ['step', ['get', 'point_count'], 11, 10, 13, 100, 15],
        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
        'text-allow-overlap': true,
        'text-offset': [0, 0.8],
        'text-pitch-alignment': 'viewport',
        'text-rotation-alignment': 'viewport',
      },
      paint: { 'text-color': '#ffffff', 'text-halo-color': 'rgba(0,0,0,0.3)', 'text-halo-width': 1 },
    });

    // Single user — person icon (reuse globe image)
    if (!map.hasImage('gao-user-dot')) {
      const s = 28;
      const c = document.createElement('canvas'); c.width = s; c.height = s;
      const ctx = c.getContext('2d')!;
      const cx = s / 2, cy = s / 2;
      ctx.beginPath(); ctx.arc(cx, cy, 11, 0, Math.PI * 2);
      ctx.fillStyle = '#3B82F6'; ctx.fill();
      ctx.strokeStyle = '#0a0b0f'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath(); ctx.arc(cx, cy - 2, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx, cy + 3, 3.5, 2.5, 0, Math.PI, 0, true); ctx.fill();
      map.addImage('gao-user-dot', ctx.getImageData(0, 0, s, s), { pixelRatio: 2 });
    }

    map.addLayer({
      id: 'gao-user-single',
      type: 'symbol',
      source: CLUSTER_SRC,
      filter: ['!', ['has', 'point_count']],
      layout: {
        'icon-image': 'gao-user-dot',
        'icon-allow-overlap': true,
        'icon-size': ['interpolate', ['linear'], ['zoom'], 8, 0.6, 14, 1, 18, 1.4],
        'icon-anchor': 'center',
        'icon-pitch-alignment': 'viewport',
        'icon-rotation-alignment': 'viewport',
      },
    });

    // Visibility-reason badge overlay (friend / circle / event) on single markers.
    const makeBadge = (name: string, color: string, letter: string) => {
      if (map.hasImage(name)) return;
      const s = 18;
      const c = document.createElement('canvas'); c.width = s; c.height = s;
      const ctx = c.getContext('2d')!;
      const cx = s / 2, cy = s / 2;
      ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI * 2);
      ctx.fillStyle = color; ctx.fill();
      ctx.strokeStyle = '#0a0b0f'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(letter, cx, cy);
      map.addImage(name, ctx.getImageData(0, 0, s, s), { pixelRatio: 2 });
    };
    makeBadge('gao-reason-event', '#A855F7', 'E');
    makeBadge('gao-reason-circle', '#00C2E0', 'C');
    makeBadge('gao-reason-friend', '#34d399', 'F');

    map.addLayer({
      id: 'gao-user-reason-badge',
      type: 'symbol',
      source: CLUSTER_SRC,
      filter: ['all',
        ['!', ['has', 'point_count']],
        ['in', ['get', 'visibility_reason'], ['literal', ['friend', 'circle', 'event']]],
      ],
      layout: {
        'icon-image': ['match', ['get', 'visibility_reason'],
          'event', 'gao-reason-event',
          'circle', 'gao-reason-circle',
          'friend', 'gao-reason-friend',
          '',
        ],
        'icon-allow-overlap': true,
        'icon-offset': [9, -9],
        'icon-anchor': 'center',
        'icon-size': ['interpolate', ['linear'], ['zoom'], 8, 0.7, 14, 1, 18, 1.2],
        'icon-pitch-alignment': 'viewport',
        'icon-rotation-alignment': 'viewport',
      },
    });

    // Single user name label (show only at higher zoom)
    map.addLayer({
      id: 'gao-user-label',
      type: 'symbol',
      source: CLUSTER_SRC,
      filter: ['!', ['has', 'point_count']],
      minzoom: 12,
      layout: {
        'text-field': ['get', 'name'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 12, 9, 16, 11],
        'text-offset': [0, 1.4],
        'text-anchor': 'top',
        'text-max-width': 8,
        'text-font': ['Open Sans Semibold', 'Arial Unicode MS Regular'],
        'text-allow-overlap': false,
        'text-pitch-alignment': 'viewport',
        'text-rotation-alignment': 'viewport',
      },
      paint: {
        'text-color': '#e2e8f0',
        'text-halo-color': 'rgba(10,11,15,0.9)',
        'text-halo-width': 1.5,
      },
    });

    // ── Cluster click → show popup with full user list ──
    const handleClusterClick = async (e: maplibregl.MapMouseEvent & { features?: maplibregl.GeoJSONFeature[] }) => {
      // Query both circle + count layers at click point
      const hitFeatures = map.queryRenderedFeatures(e.point, { layers: ['gao-user-clusters', 'gao-user-cluster-count'] });
      const feature = hitFeatures[0];
      if (!feature || !feature.properties?.cluster_id) return;

      const clusterId = feature.properties.cluster_id as number;
      const totalCount = (feature.properties.point_count || 0) as number;
      const coords = (feature.geometry as GeoJSON.Point).coordinates.slice() as [number, number];
      const src = map.getSource(CLUSTER_SRC) as maplibregl.GeoJSONSource;

      try {
        // MapLibre v5: Promise-based API
        const leaves = await src.getClusterLeaves(clusterId, Math.max(totalCount, 500), 0);
        if (!leaves || leaves.length === 0) return;

        // Dispatch to React — no MapLibre popup, pure React rendering
        const users = leaves.map(leaf => {
          const p = leaf.properties || {};
          const g = leaf.geometry as GeoJSON.Point;
          return {
            id: p.id as string,
            name: (p.name || 'User') as string,
            avatar: (p.avatar || '') as string,
            city: (p.city || '') as string,
            trust_level: (p.trust_level || 'new') as string,
            visibility_reason: (p.visibility_reason || 'public') as string,
            shared_event_id: (p.shared_event_id || '') as string,
            shared_circle_id: (p.shared_circle_id || '') as string,
            lat: g.coordinates[1], lng: g.coordinates[0],
          };
        });
        window.dispatchEvent(new CustomEvent('gao-cluster-click', { detail: { users, count: totalCount, coords } }));
      } catch (err) {
        console.error('[Cluster] Failed to get leaves:', err);
      }
    };

    // Register on both circle and count label layers
    map.on('click', 'gao-user-clusters', handleClusterClick);
    map.on('click', 'gao-user-cluster-count', handleClusterClick);

    // Single user click
    map.on('click', 'gao-user-single', (e) => {
      const feature = e.features?.[0];
      if (!feature) return;
      const props = feature.properties || {};
      const geo = feature.geometry as GeoJSON.Point;
      addMarker({ id: `user_${props.id}`, entity_type: 'people', lat: geo.coordinates[1], lng: geo.coordinates[0], title: props.name || 'User', state: 'default', metadata: { city: props.city, userId: props.id } });
      setSelectedMarker(`user_${props.id}`);
    });

    // Cursor
    for (const layer of ['gao-user-clusters', 'gao-user-cluster-count', 'gao-user-single']) {
      map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = ''; });
    }

    clusterLayersReady.current = true;

    return undefined;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, mapUsers, profiles, activeLayers, styleVersion, removeClusterLayers]);

  // ── 2D clustered sources for business + event ─────────────────────────
  const ENTITY_CLUSTER_CFG: Record<string, { emoji: string; color: string; radius: number }> = {
    business: { emoji: '🏪', color: '#22C55E', radius: 50 },
    event:    { emoji: '🎉', color: '#EF4444', radius: 50 },
  };
  const entityClusterReady = useRef<Set<string>>(new Set());

  const removeEntityClusterLayers = useCallback((t: string) => {
    if (!map) return;
    const layers = [`gao-2d-${t}-ring`, `gao-2d-${t}-clusters`, `gao-2d-${t}-count`, `gao-2d-${t}-single`, `gao-2d-${t}-label`];
    for (const id of layers) { try { if (map.getLayer(id)) map.removeLayer(id); } catch {} }
    try { if (map.getSource(`gao-2d-${t}-src`)) map.removeSource(`gao-2d-${t}-src`); } catch {}
    entityClusterReady.current.delete(t);
  }, [map]);

  // Business cluster
  useEffect(() => {
    if (!map) return;
    if (useMapStore.getState().viewMode === '3d') { removeEntityClusterLayers('business'); return; }

    const t = 'business';
    const cfg = ENTITY_CLUSTER_CFG[t];
    const srcId = `gao-2d-${t}-src`;
    const show = activeLayers.has(t);

    const features: GeoJSON.Feature[] = businesses
      .filter(b => b.location_lat && b.location_lng)
      .map(b => ({ type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: [b.location_lng, b.location_lat] }, properties: { id: b.id, name: b.name, city: b.city || '', category: b.category || '', unlocked: unlockedBusinessIds.has(b.id) ? 1 : 0 } }));
    const geo: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: show ? features : [] };

    const existingSrc = map.getSource(srcId) as maplibregl.GeoJSONSource | undefined;
    if (existingSrc && entityClusterReady.current.has(t)) { existingSrc.setData(geo); return; }
    if (existingSrc && !entityClusterReady.current.has(t)) removeEntityClusterLayers(t);

    // Icon images
    const dotImg = `gao-2d-${t}-dot`;
    if (!map.hasImage(dotImg)) {
      const sz = 48; const cnv = document.createElement('canvas'); cnv.width = sz; cnv.height = sz;
      const ct = cnv.getContext('2d')!;
      ct.beginPath(); ct.arc(sz/2, sz/2, sz/2-3, 0, Math.PI*2); ct.fillStyle = cfg.color; ct.fill(); ct.strokeStyle = '#fff'; ct.lineWidth = 2; ct.stroke();
      ct.font = '22px serif'; ct.textAlign = 'center'; ct.textBaseline = 'middle'; ct.fillText(cfg.emoji, sz/2, sz/2+1);
      map.addImage(dotImg, ct.getImageData(0, 0, sz, sz), { pixelRatio: 2 });
    }
    const clImg = `gao-2d-${t}-cluster`;
    if (!map.hasImage(clImg)) {
      const sz = 64; const cnv = document.createElement('canvas'); cnv.width = sz; cnv.height = sz;
      const ct = cnv.getContext('2d')!;
      ct.beginPath(); ct.arc(sz/2, sz/2, sz/2-2, 0, Math.PI*2); ct.strokeStyle = cfg.color+'40'; ct.lineWidth = 3; ct.stroke();
      ct.beginPath(); ct.arc(sz/2, sz/2, sz/2-6, 0, Math.PI*2); ct.fillStyle = cfg.color; ct.fill(); ct.strokeStyle = 'rgba(255,255,255,0.3)'; ct.lineWidth = 2; ct.stroke();
      ct.font = '24px serif'; ct.textAlign = 'center'; ct.textBaseline = 'middle'; ct.fillText(cfg.emoji, sz/2, sz/2+1);
      map.addImage(clImg, ct.getImageData(0, 0, sz, sz), { pixelRatio: 2 });
    }

    map.addSource(srcId, { type: 'geojson', data: geo, cluster: true, clusterMaxZoom: 14, clusterRadius: cfg.radius });
    map.addLayer({ id: `gao-2d-${t}-ring`, type: 'symbol', source: srcId, filter: ['has', 'point_count'], layout: { 'icon-image': clImg, 'icon-size': 0.8, 'icon-allow-overlap': true, 'icon-anchor': 'center', 'icon-pitch-alignment': 'viewport' } });
    map.addLayer({ id: `gao-2d-${t}-count`, type: 'symbol', source: srcId, filter: ['has', 'point_count'], layout: { 'text-field': '{point_count_abbreviated}', 'text-size': 11, 'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'], 'text-allow-overlap': true, 'text-offset': [0, 0.8], 'text-pitch-alignment': 'viewport' }, paint: { 'text-color': '#fff' } });
    map.addLayer({
      id: `gao-2d-${t}-single`, type: 'symbol', source: srcId,
      filter: ['!', ['has', 'point_count']],
      layout: { 'icon-image': dotImg, 'icon-size': 0.55, 'icon-allow-overlap': true, 'icon-anchor': 'center', 'icon-pitch-alignment': 'viewport' },
      // Paint-your-map: dim pins the viewer has not unlocked yet.
      paint: { 'icon-opacity': ['case', ['==', ['get', 'unlocked'], 1], 1, 0.35] },
    });
    map.addLayer({
      id: `gao-2d-${t}-label`, type: 'symbol', source: srcId,
      filter: ['!', ['has', 'point_count']], minzoom: 12,
      layout: { 'text-field': ['get', 'name'], 'text-size': 10, 'text-offset': [0, 1.4], 'text-anchor': 'top', 'text-max-width': 8, 'text-font': ['Open Sans Semibold', 'Arial Unicode MS Regular'], 'text-allow-overlap': false, 'text-pitch-alignment': 'viewport' },
      paint: { 'text-color': '#e2e8f0', 'text-halo-color': 'rgba(10,11,15,0.9)', 'text-halo-width': 1.5, 'text-opacity': ['case', ['==', ['get', 'unlocked'], 1], 1, 0.45] },
    });

    // Click cluster
    map.on('click', `gao-2d-${t}-ring`, async (e) => {
      const hit = map.queryRenderedFeatures(e.point, { layers: [`gao-2d-${t}-ring`, `gao-2d-${t}-count`] });
      const f = hit[0]; if (!f?.properties?.cluster_id) return;
      const src = map.getSource(srcId) as maplibregl.GeoJSONSource;
      try {
        const leaves = await src.getClusterLeaves(f.properties.cluster_id as number, Math.max((f.properties.point_count || 0) as number, 500), 0);
        if (!leaves?.length) return;
        const items = leaves.map(l => { const p = l.properties || {}; const g = l.geometry as GeoJSON.Point; return { id: p.id as string, name: (p.name || '') as string, avatar: '', city: (p.city || '') as string, trust_level: 'verified', lat: g.coordinates[1], lng: g.coordinates[0] }; });
        window.dispatchEvent(new CustomEvent('gao-cluster-click', { detail: { users: items, count: f.properties.point_count, entityType: t } }));
      } catch {}
    });
    map.on('click', `gao-2d-${t}-count`, async (e) => {
      const hit = map.queryRenderedFeatures(e.point, { layers: [`gao-2d-${t}-ring`, `gao-2d-${t}-count`] });
      const f = hit[0]; if (!f?.properties?.cluster_id) return;
      const src = map.getSource(srcId) as maplibregl.GeoJSONSource;
      try {
        const leaves = await src.getClusterLeaves(f.properties.cluster_id as number, Math.max((f.properties.point_count || 0) as number, 500), 0);
        if (!leaves?.length) return;
        const items = leaves.map(l => { const p = l.properties || {}; const g = l.geometry as GeoJSON.Point; return { id: p.id as string, name: (p.name || '') as string, avatar: '', city: (p.city || '') as string, trust_level: 'verified', lat: g.coordinates[1], lng: g.coordinates[0] }; });
        window.dispatchEvent(new CustomEvent('gao-cluster-click', { detail: { users: items, count: f.properties.point_count, entityType: t } }));
      } catch {}
    });
    // Click single
    map.on('click', `gao-2d-${t}-single`, (e) => {
      const f = e.features?.[0]; if (!f) return;
      const p = f.properties || {}; const g = f.geometry as GeoJSON.Point;
      window.dispatchEvent(new CustomEvent('gao-pin-detail', { detail: { entityId: p.id as string, entityType: t, label: (p.name || '') as string } }));
    });
    for (const l of [`gao-2d-${t}-ring`, `gao-2d-${t}-count`, `gao-2d-${t}-single`]) {
      map.on('mouseenter', l, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', l, () => { map.getCanvas().style.cursor = ''; });
    }
    entityClusterReady.current.add(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, businesses, unlockedBusinessIds, activeLayers, styleVersion, removeEntityClusterLayers]);

  // Event cluster
  useEffect(() => {
    if (!map) return;
    if (useMapStore.getState().viewMode === '3d') { removeEntityClusterLayers('event'); return; }

    const t = 'event';
    const cfg = ENTITY_CLUSTER_CFG[t];
    const srcId = `gao-2d-${t}-src`;
    const show = activeLayers.has(t);

    const features: GeoJSON.Feature[] = events
      .filter(e => e.location_lat && e.location_lng)
      .map(e => ({ type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: [e.location_lng!, e.location_lat!] }, properties: { id: e.id, name: e.title, city: e.city || '', unlocked: unlockedEventIds.has(e.id) ? 1 : 0 } }));
    const geo: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: show ? features : [] };

    const existingSrc = map.getSource(srcId) as maplibregl.GeoJSONSource | undefined;
    if (existingSrc && entityClusterReady.current.has(t)) { existingSrc.setData(geo); return; }
    if (existingSrc && !entityClusterReady.current.has(t)) removeEntityClusterLayers(t);

    const dotImg = `gao-2d-${t}-dot`;
    if (!map.hasImage(dotImg)) {
      const sz = 48; const cnv = document.createElement('canvas'); cnv.width = sz; cnv.height = sz;
      const ct = cnv.getContext('2d')!;
      ct.beginPath(); ct.arc(sz/2, sz/2, sz/2-3, 0, Math.PI*2); ct.fillStyle = cfg.color; ct.fill(); ct.strokeStyle = '#fff'; ct.lineWidth = 2; ct.stroke();
      ct.font = '22px serif'; ct.textAlign = 'center'; ct.textBaseline = 'middle'; ct.fillText(cfg.emoji, sz/2, sz/2+1);
      map.addImage(dotImg, ct.getImageData(0, 0, sz, sz), { pixelRatio: 2 });
    }
    const clImg = `gao-2d-${t}-cluster`;
    if (!map.hasImage(clImg)) {
      const sz = 64; const cnv = document.createElement('canvas'); cnv.width = sz; cnv.height = sz;
      const ct = cnv.getContext('2d')!;
      ct.beginPath(); ct.arc(sz/2, sz/2, sz/2-2, 0, Math.PI*2); ct.strokeStyle = cfg.color+'40'; ct.lineWidth = 3; ct.stroke();
      ct.beginPath(); ct.arc(sz/2, sz/2, sz/2-6, 0, Math.PI*2); ct.fillStyle = cfg.color; ct.fill(); ct.strokeStyle = 'rgba(255,255,255,0.3)'; ct.lineWidth = 2; ct.stroke();
      ct.font = '24px serif'; ct.textAlign = 'center'; ct.textBaseline = 'middle'; ct.fillText(cfg.emoji, sz/2, sz/2+1);
      map.addImage(clImg, ct.getImageData(0, 0, sz, sz), { pixelRatio: 2 });
    }

    map.addSource(srcId, { type: 'geojson', data: geo, cluster: true, clusterMaxZoom: 14, clusterRadius: cfg.radius });
    map.addLayer({ id: `gao-2d-${t}-ring`, type: 'symbol', source: srcId, filter: ['has', 'point_count'], layout: { 'icon-image': clImg, 'icon-size': 0.8, 'icon-allow-overlap': true, 'icon-anchor': 'center', 'icon-pitch-alignment': 'viewport' } });
    map.addLayer({ id: `gao-2d-${t}-count`, type: 'symbol', source: srcId, filter: ['has', 'point_count'], layout: { 'text-field': '{point_count_abbreviated}', 'text-size': 11, 'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'], 'text-allow-overlap': true, 'text-offset': [0, 0.8], 'text-pitch-alignment': 'viewport' }, paint: { 'text-color': '#fff' } });
    map.addLayer({
      id: `gao-2d-${t}-single`, type: 'symbol', source: srcId,
      filter: ['!', ['has', 'point_count']],
      layout: { 'icon-image': dotImg, 'icon-size': 0.55, 'icon-allow-overlap': true, 'icon-anchor': 'center', 'icon-pitch-alignment': 'viewport' },
      // Paint-your-map: dim pins the viewer has not unlocked yet.
      paint: { 'icon-opacity': ['case', ['==', ['get', 'unlocked'], 1], 1, 0.35] },
    });
    map.addLayer({
      id: `gao-2d-${t}-label`, type: 'symbol', source: srcId,
      filter: ['!', ['has', 'point_count']], minzoom: 12,
      layout: { 'text-field': ['get', 'name'], 'text-size': 10, 'text-offset': [0, 1.4], 'text-anchor': 'top', 'text-max-width': 8, 'text-font': ['Open Sans Semibold', 'Arial Unicode MS Regular'], 'text-allow-overlap': false, 'text-pitch-alignment': 'viewport' },
      paint: { 'text-color': '#e2e8f0', 'text-halo-color': 'rgba(10,11,15,0.9)', 'text-halo-width': 1.5, 'text-opacity': ['case', ['==', ['get', 'unlocked'], 1], 1, 0.45] },
    });

    // Click cluster
    map.on('click', `gao-2d-${t}-ring`, async (e) => {
      const hit = map.queryRenderedFeatures(e.point, { layers: [`gao-2d-${t}-ring`, `gao-2d-${t}-count`] });
      const f = hit[0]; if (!f?.properties?.cluster_id) return;
      const src = map.getSource(srcId) as maplibregl.GeoJSONSource;
      try {
        const leaves = await src.getClusterLeaves(f.properties.cluster_id as number, Math.max((f.properties.point_count || 0) as number, 500), 0);
        if (!leaves?.length) return;
        const items = leaves.map(l => { const p = l.properties || {}; const g = l.geometry as GeoJSON.Point; return { id: p.id as string, name: (p.name || '') as string, avatar: '', city: (p.city || '') as string, trust_level: 'verified', lat: g.coordinates[1], lng: g.coordinates[0] }; });
        window.dispatchEvent(new CustomEvent('gao-cluster-click', { detail: { users: items, count: f.properties.point_count, entityType: t } }));
      } catch {}
    });
    map.on('click', `gao-2d-${t}-count`, async (e) => {
      const hit = map.queryRenderedFeatures(e.point, { layers: [`gao-2d-${t}-ring`, `gao-2d-${t}-count`] });
      const f = hit[0]; if (!f?.properties?.cluster_id) return;
      const src = map.getSource(srcId) as maplibregl.GeoJSONSource;
      try {
        const leaves = await src.getClusterLeaves(f.properties.cluster_id as number, Math.max((f.properties.point_count || 0) as number, 500), 0);
        if (!leaves?.length) return;
        const items = leaves.map(l => { const p = l.properties || {}; const g = l.geometry as GeoJSON.Point; return { id: p.id as string, name: (p.name || '') as string, avatar: '', city: (p.city || '') as string, trust_level: 'verified', lat: g.coordinates[1], lng: g.coordinates[0] }; });
        window.dispatchEvent(new CustomEvent('gao-cluster-click', { detail: { users: items, count: f.properties.point_count, entityType: t } }));
      } catch {}
    });
    // Click single
    map.on('click', `gao-2d-${t}-single`, (e) => {
      const f = e.features?.[0]; if (!f) return;
      const p = f.properties || {}; const g = f.geometry as GeoJSON.Point;
      window.dispatchEvent(new CustomEvent('gao-pin-detail', { detail: { entityId: p.id as string, entityType: t, label: (p.name || '') as string } }));
    });
    for (const l of [`gao-2d-${t}-ring`, `gao-2d-${t}-count`, `gao-2d-${t}-single`]) {
      map.on('mouseenter', l, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', l, () => { map.getCanvas().style.cursor = ''; });
    }
    entityClusterReady.current.add(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, events, unlockedEventIds, activeLayers, styleVersion, removeEntityClusterLayers]);

  // Re-add markers after style change (style swap removes DOM elements)
  useEffect(() => {
    function handleStyleChanged() {
      console.log('[STYLE-CHANGED] fired — clearing markers, bumping styleVersion');
      // Clear DOM markers
      for (const marker of markersRef.current.values()) {
        marker.remove();
      }
      markersRef.current.clear();
      // Clear cluster layers (style swap removes them)
      clusterLayersReady.current = false;
      entityClusterReady.current.clear();
      // Trigger re-render to re-create everything
      setStyleVersion((v: number) => v + 1);
    }
    window.addEventListener('gao-style-changed', handleStyleChanged);
    return () => window.removeEventListener('gao-style-changed', handleStyleChanged);
  }, []);


  // ── 3D Globe: per-entity clustered GeoJSON sources ───────────────────────
  const globeReady = useRef(false);

  // Entity config for globe clustered sources
  const GLOBE_ENTITY_CFG: Record<string, { emoji: string; color: string; clusterRadius: number }> = {
    business: { emoji: '🏪', color: '#22C55E', clusterRadius: 60 },
    event:    { emoji: '🎉', color: '#EF4444', clusterRadius: 60 },
    people:   { emoji: '📍', color: '#3B82F6', clusterRadius: 50 },
    offer:    { emoji: '🏷', color: '#EAB308', clusterRadius: 50 },
    profile:  { emoji: '👤', color: '#818CF8', clusterRadius: 50 },
  };
  const GLOBE_ENTITY_TYPES = Object.keys(GLOBE_ENTITY_CFG);

  // Build globe layers — one clustered source per entity type
  const buildGlobe = useCallback(async () => {
    if (!map || useMapStore.getState().viewMode !== '3d') return;

    // Collect features per entity type
    const featuresByType: Record<string, GeoJSON.Feature[]> = { business: [], event: [], people: [], offer: [], profile: [] };
    for (const b of businesses) {
      if (b.location_lat && b.location_lng) featuresByType.business.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [b.location_lng, b.location_lat] }, properties: { id: b.id, name: b.name, city: b.city || '' } });
    }
    for (const e of events) {
      if (e.location_lat && e.location_lng) featuresByType.event.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [e.location_lng!, e.location_lat!] }, properties: { id: e.id, name: e.title, city: e.city || '' } });
    }
    for (const s of signals) {
      const et = s.type === 'offer' ? 'offer' : 'people';
      featuresByType[et].push({ type: 'Feature', geometry: { type: 'Point', coordinates: s.location.coordinates as [number, number] }, properties: { id: s.id, name: s.title } });
    }
    for (const p of profiles) {
      if (p.location) featuresByType.profile.push({ type: 'Feature', geometry: { type: 'Point', coordinates: p.location.coordinates as [number, number] }, properties: { id: p._id, name: p.headline } });
    }

    try {
      for (const t of GLOBE_ENTITY_TYPES) {
        const srcId = `gao-globe-${t}-src`;
        const cfg = GLOBE_ENTITY_CFG[t];
        const visible = activeLayers.has(t);
        const geo: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: visible ? featuresByType[t] : [] };

        // Generate icon images once
        const singleImg = `globe-${t}-dot`;
        if (!map.hasImage(singleImg)) {
          const sz = 48; const cnv = document.createElement('canvas'); cnv.width = sz; cnv.height = sz;
          const ct = cnv.getContext('2d')!;
          ct.beginPath(); ct.arc(sz / 2, sz / 2, sz / 2 - 3, 0, Math.PI * 2);
          ct.fillStyle = cfg.color; ct.fill(); ct.strokeStyle = '#fff'; ct.lineWidth = 2; ct.stroke();
          ct.font = '22px serif'; ct.textAlign = 'center'; ct.textBaseline = 'middle';
          ct.fillText(cfg.emoji, sz / 2, sz / 2 + 1);
          map.addImage(singleImg, ct.getImageData(0, 0, sz, sz), { pixelRatio: 2 });
        }
        // Cluster icon
        const clusterImg = `globe-${t}-cluster`;
        if (!map.hasImage(clusterImg)) {
          const sz = 64; const cnv = document.createElement('canvas'); cnv.width = sz; cnv.height = sz;
          const ct = cnv.getContext('2d')!;
          // Outer ring
          ct.beginPath(); ct.arc(sz / 2, sz / 2, sz / 2 - 2, 0, Math.PI * 2);
          ct.strokeStyle = cfg.color + '40'; ct.lineWidth = 3; ct.stroke();
          // Inner circle
          ct.beginPath(); ct.arc(sz / 2, sz / 2, sz / 2 - 6, 0, Math.PI * 2);
          ct.fillStyle = cfg.color; ct.fill(); ct.strokeStyle = 'rgba(255,255,255,0.3)'; ct.lineWidth = 2; ct.stroke();
          // Emoji
          ct.font = '24px serif'; ct.textAlign = 'center'; ct.textBaseline = 'middle';
          ct.fillText(cfg.emoji, sz / 2, sz / 2 + 1);
          map.addImage(clusterImg, ct.getImageData(0, 0, sz, sz), { pixelRatio: 2 });
        }

        // Source — remove + recreate if visibility changed (avoids empty cluster state)
        const existingSrc = map.getSource(srcId) as maplibregl.GeoJSONSource | undefined;
        if (existingSrc) {
          existingSrc.setData(geo);
          // Toggle layer visibility
          const layerIds = [`gao-globe-${t}-clusters`, `gao-globe-${t}-count`, `gao-globe-${t}`];
          for (const lid of layerIds) {
            if (map.getLayer(lid)) map.setLayoutProperty(lid, 'visibility', visible ? 'visible' : 'none');
          }
          continue;
        }

        // Skip creating source if nothing to show — create later when visible
        if (!visible || geo.features.length === 0) continue;

        map.addSource(srcId, { type: 'geojson', data: geo, cluster: true, clusterMaxZoom: 12, clusterRadius: cfg.clusterRadius });

        // Cluster — circle (reliable rendering on globe)
        map.addLayer({ id: `gao-globe-${t}-clusters`, type: 'circle', source: srcId, filter: ['has', 'point_count'], paint: {
          'circle-color': cfg.color,
          'circle-radius': ['step', ['get', 'point_count'], 16, 10, 22, 50, 28],
          'circle-stroke-width': 3,
          'circle-stroke-color': 'rgba(255,255,255,0.3)',
        }});
        // Cluster count
        map.addLayer({ id: `gao-globe-${t}-count`, type: 'symbol', source: srcId, filter: ['has', 'point_count'], layout: {
          'text-field': '{point_count_abbreviated}', 'text-size': 12,
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'], 'text-allow-overlap': true,
        }, paint: { 'text-color': '#fff' }});
        // Single dot — circle
        map.addLayer({ id: `gao-globe-${t}`, type: 'circle', source: srcId, filter: ['!', ['has', 'point_count']], paint: {
          'circle-color': cfg.color,
          'circle-radius': 7,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#fff',
        }});

        // Click handlers — cluster
        map.on('click', `gao-globe-${t}-clusters`, async (e) => {
          const feature = e.features?.[0];
          if (!feature?.properties?.cluster_id) return;
          const src = map.getSource(srcId) as maplibregl.GeoJSONSource;
          const count = (feature.properties.point_count || 0) as number;
          try {
            const leaves = await src.getClusterLeaves(feature.properties.cluster_id as number, Math.max(count, 500), 0);
            if (!leaves?.length) return;
            const items = leaves.map(l => { const p = l.properties || {}; const g = l.geometry as GeoJSON.Point; return { id: p.id as string, name: (p.name || t) as string, avatar: '', city: (p.city || '') as string, trust_level: 'verified', lat: g.coordinates[1], lng: g.coordinates[0] }; });
            window.dispatchEvent(new CustomEvent('gao-cluster-click', { detail: { users: items, count, entityType: t } }));
          } catch (err) { console.error(`[Globe ${t} cluster]`, err); }
        });
        map.on('click', `gao-globe-${t}-count`, async (e) => {
          const hitF = map.queryRenderedFeatures(e.point, { layers: [`gao-globe-${t}-clusters`, `gao-globe-${t}-count`] });
          const ff = hitF[0]; if (!ff?.properties?.cluster_id) return;
          const s = map.getSource(srcId) as maplibregl.GeoJSONSource;
          try {
            const count = (ff.properties.point_count || 0) as number;
            const lvs = await s.getClusterLeaves(ff.properties.cluster_id as number, Math.max(count, 500), 0);
            if (!lvs?.length) return;
            const items = lvs.map(l => { const p = l.properties || {}; const g = l.geometry as GeoJSON.Point; return { id: p.id as string, name: (p.name || t) as string, avatar: '', city: (p.city || '') as string, trust_level: 'verified', lat: g.coordinates[1], lng: g.coordinates[0] }; });
            window.dispatchEvent(new CustomEvent('gao-cluster-click', { detail: { users: items, count, entityType: t } }));
          } catch {}
        });

        // Click — single
        map.on('click', `gao-globe-${t}`, (e) => {
          const feature = e.features?.[0];
          if (!feature) return;
          const props = feature.properties || {};
          const geo = feature.geometry as GeoJSON.Point;
          addMarker({ id: props.id as string, entity_type: t as EntityType, lat: geo.coordinates[1], lng: geo.coordinates[0], title: (props.name || t) as string, state: 'default', metadata: { ...props } });
          setSelectedMarker(props.id as string);
        });

        // Cursor
        for (const layer of [`gao-globe-${t}-clusters`, `gao-globe-${t}-count`, `gao-globe-${t}`]) {
          map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer'; });
          map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = ''; });
        }
      }

      // ── Landmarks (no clustering — unique icons) ──
      const lmSrc = 'gao-globe-landmark-src';
      const lmFeatures: GeoJSON.Feature[] = landmarks.map(lm => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [lm.lng, lm.lat] }, properties: { id: lm.id, name: lm.name, icon: lm.icon } }));
      const lmGeo: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: activeLayers.has('landmark') ? lmFeatures : [] };
      if (map.getSource(lmSrc)) {
        (map.getSource(lmSrc) as maplibregl.GeoJSONSource).setData(lmGeo);
      } else {
        for (const emoji of new Set(landmarks.map(lm => lm.icon))) {
          const imgName = `lm-${emoji}`;
          if (!map.hasImage(imgName)) {
            const sz = 64; const cnv = document.createElement('canvas'); cnv.width = sz; cnv.height = sz;
            const ct = cnv.getContext('2d')!;
            ct.beginPath(); ct.arc(sz / 2, sz / 2, sz / 2 - 2, 0, Math.PI * 2);
            ct.fillStyle = 'rgba(251,191,36,0.95)'; ct.fill(); ct.strokeStyle = '#fff'; ct.lineWidth = 3; ct.stroke();
            ct.font = '30px serif'; ct.textAlign = 'center'; ct.textBaseline = 'middle'; ct.fillText(emoji, sz / 2, sz / 2 + 2);
            map.addImage(imgName, ct.getImageData(0, 0, sz, sz), { pixelRatio: 2 });
          }
        }
        map.addSource(lmSrc, { type: 'geojson', data: lmGeo });
        map.addLayer({ id: 'gao-globe-landmark', type: 'symbol', source: lmSrc, layout: { 'icon-image': ['concat', 'lm-', ['get', 'icon']], 'icon-size': 0.6, 'icon-allow-overlap': true, 'icon-anchor': 'center', 'icon-pitch-alignment': 'map' } });
        map.addLayer({ id: 'gao-globe-landmark-label', type: 'symbol', source: lmSrc, layout: { 'text-field': ['get', 'name'], 'text-size': 10, 'text-offset': [0, 2], 'text-anchor': 'top' }, paint: { 'text-color': '#fbbf24', 'text-halo-color': '#000', 'text-halo-width': 1.5 } });
      }

      // ── Friends (no clustering) ──
      const frSrc = 'gao-globe-friend-src';
      const frFeatures: GeoJSON.Feature[] = showFriendsOnMap ? friends.filter(f => f.location_sharing !== 'off' && f.location).map(f => ({ type: 'Feature', geometry: { type: 'Point', coordinates: f.location!.coordinates as [number, number] }, properties: { id: f.id, name: f.display_name, is_online: f.is_online } })) : [];
      const frGeo: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: frFeatures };
      if (map.getSource(frSrc)) {
        (map.getSource(frSrc) as maplibregl.GeoJSONSource).setData(frGeo);
      } else {
        map.addSource(frSrc, { type: 'geojson', data: frGeo });
        map.addLayer({ id: 'gao-globe-friend', type: 'circle', source: frSrc, paint: { 'circle-radius': 8, 'circle-color': '#00d4ff', 'circle-stroke-width': 3, 'circle-stroke-color': '#fff' } });
        map.addLayer({ id: 'gao-globe-friend-label', type: 'symbol', source: frSrc, layout: { 'text-field': ['get', 'name'], 'text-size': 11, 'text-offset': [0, 1.8], 'text-anchor': 'top', 'text-allow-overlap': true }, paint: { 'text-color': '#00d4ff', 'text-halo-color': '#000', 'text-halo-width': 1.5 } });
      }

      globeReady.current = true;
    } catch (err) {
      console.warn('[GLOBE] build error', err);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, activeLayers, signals, businesses, events, profiles, mapUsers, landmarks, friends, showFriendsOnMap]);

  // Keep buildGlobe ref current for effects that shouldn't re-run on every data change
  const buildGlobeRef = useRef(buildGlobe);
  buildGlobeRef.current = buildGlobe;

  // Auto-update globe data when entities change (SWR refetch after viewport move)
  useEffect(() => {
    if (!map || useMapStore.getState().viewMode !== '3d' || !globeReady.current) return;
    buildGlobeRef.current();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businesses, events, signals, profiles, mapUsers]);

  // ── Globe user cluster (separate clustered source for 3D) ────────────────
  const GLOBE_USERS_SRC = 'gao-globe-users';
  const GLOBE_USER_LAYERS = ['gao-globe-user-ring', 'gao-globe-user-count', 'gao-globe-user-single', 'gao-globe-user-label'];
  const globeUserLayersReady = useRef(false);

  const removeGlobeUserLayers = useCallback(() => {
    if (!map) return;
    for (const id of GLOBE_USER_LAYERS) {
      try { if (map.getLayer(id)) map.removeLayer(id); } catch {}
    }
    try { if (map.getSource(GLOBE_USERS_SRC)) map.removeSource(GLOBE_USERS_SRC); } catch {}
    globeUserLayersReady.current = false;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  useEffect(() => {
    if (!map) return;
    const isGlobe = useMapStore.getState().viewMode === '3d';
    if (!isGlobe) { removeGlobeUserLayers(); return; }

    const showPeople = activeLayers.has('people');
    const profileUserIds = new Set(profiles.map(p => p.user_id));
    const userFeatures: GeoJSON.Feature[] = mapUsers
      .filter(u => u.location_lat && u.location_lng && !profileUserIds.has(u.id))
      .map(u => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [u.location_lng, u.location_lat] },
        properties: { id: u.id, name: u.display_name || u.username || 'User', avatar: u.avatar_url || '', city: u.city || '', trust_level: u.trust_level || 'new' },
      }));

    const geo: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: showPeople ? userFeatures : [] };

    const existingSrc = map.getSource(GLOBE_USERS_SRC) as maplibregl.GeoJSONSource | undefined;
    if (existingSrc && globeUserLayersReady.current) {
      existingSrc.setData(geo);
      return;
    }
    if (existingSrc && !globeUserLayersReady.current) {
      removeGlobeUserLayers();
    }

    map.addSource(GLOBE_USERS_SRC, { type: 'geojson', data: geo, cluster: true, clusterMaxZoom: 12, clusterRadius: 80 });

    // Generate person-icon cluster images (canvas) so clusters look distinct from signals
    const clusterSizes = [
      { name: 'gao-cluster-sm', radius: 18, color: '#3B82F6', ringColor: 'rgba(59,130,246,0.25)' },
      { name: 'gao-cluster-md', radius: 24, color: '#6366F1', ringColor: 'rgba(99,102,241,0.25)' },
      { name: 'gao-cluster-lg', radius: 30, color: '#A855F7', ringColor: 'rgba(168,85,247,0.25)' },
    ];
    for (const cfg of clusterSizes) {
      if (!map.hasImage(cfg.name)) {
        const s = (cfg.radius + 6) * 2;
        const c = document.createElement('canvas'); c.width = s; c.height = s;
        const ctx = c.getContext('2d')!;
        const cx = s / 2, cy = s / 2;
        // Outer ring
        ctx.beginPath(); ctx.arc(cx, cy, cfg.radius + 4, 0, Math.PI * 2);
        ctx.strokeStyle = cfg.ringColor; ctx.lineWidth = 3; ctx.stroke();
        // Solid circle
        ctx.beginPath(); ctx.arc(cx, cy, cfg.radius, 0, Math.PI * 2);
        ctx.fillStyle = cfg.color; ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 2; ctx.stroke();
        // Person icon (head + body)
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        const iconScale = cfg.radius / 24;
        ctx.beginPath(); ctx.arc(cx, cy - 4 * iconScale, 5 * iconScale, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(cx, cy + 6 * iconScale, 7 * iconScale, 5 * iconScale, 0, Math.PI, 0, true); ctx.fill();
        map.addImage(cfg.name, ctx.getImageData(0, 0, s, s), { pixelRatio: 2 });
      }
    }

    // Single user person icon
    if (!map.hasImage('gao-user-dot')) {
      const s = 28;
      const c = document.createElement('canvas'); c.width = s; c.height = s;
      const ctx = c.getContext('2d')!;
      const cx = s / 2, cy = s / 2;
      ctx.beginPath(); ctx.arc(cx, cy, 11, 0, Math.PI * 2);
      ctx.fillStyle = '#3B82F6'; ctx.fill();
      ctx.strokeStyle = '#0a0b0f'; ctx.lineWidth = 2; ctx.stroke();
      // Tiny person
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath(); ctx.arc(cx, cy - 2, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx, cy + 3, 3.5, 2.5, 0, Math.PI, 0, true); ctx.fill();
      map.addImage('gao-user-dot', ctx.getImageData(0, 0, s, s), { pixelRatio: 2 });
    }

    // Cluster — icon layer (person silhouette inside colored circle)
    map.addLayer({ id: 'gao-globe-user-ring', type: 'symbol', source: GLOBE_USERS_SRC, filter: ['has', 'point_count'], layout: {
      'icon-image': ['step', ['get', 'point_count'], 'gao-cluster-sm', 10, 'gao-cluster-md', 50, 'gao-cluster-lg'],
      'icon-allow-overlap': true,
    }});

    // Count label on top
    map.addLayer({ id: 'gao-globe-user-count', type: 'symbol', source: GLOBE_USERS_SRC, filter: ['has', 'point_count'], layout: {
      'text-field': '{point_count_abbreviated}', 'text-size': ['step', ['get', 'point_count'], 11, 10, 13, 100, 15],
      'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'], 'text-allow-overlap': true,
      'text-offset': [0, 0.8],
    }, paint: { 'text-color': '#ffffff', 'text-halo-color': 'rgba(0,0,0,0.3)', 'text-halo-width': 1 }});

    // Single user — person icon
    map.addLayer({ id: 'gao-globe-user-single', type: 'symbol', source: GLOBE_USERS_SRC, filter: ['!', ['has', 'point_count']], layout: {
      'icon-image': 'gao-user-dot', 'icon-allow-overlap': true,
    }});

    // Single label
    map.addLayer({ id: 'gao-globe-user-label', type: 'symbol', source: GLOBE_USERS_SRC, filter: ['!', ['has', 'point_count']], minzoom: 8, layout: {
      'text-field': ['get', 'name'], 'text-size': 10, 'text-offset': [0, 1.4], 'text-anchor': 'top', 'text-max-width': 8,
      'text-font': ['Open Sans Semibold', 'Arial Unicode MS Regular'], 'text-allow-overlap': false,
    }, paint: { 'text-color': '#e2e8f0', 'text-halo-color': 'rgba(0,0,0,0.8)', 'text-halo-width': 1.5 }});

    // Cluster click → dispatch to React (same as 2D)
    const handleGlobeClusterClick = async (e: maplibregl.MapMouseEvent) => {
      const hitFeatures = map.queryRenderedFeatures(e.point, { layers: ['gao-globe-user-ring', 'gao-globe-user-count'] });
      const feature = hitFeatures[0];
      if (!feature || !feature.properties?.cluster_id) return;
      const clusterId = feature.properties.cluster_id as number;
      const totalCount = (feature.properties.point_count || 0) as number;
      const src = map.getSource(GLOBE_USERS_SRC) as maplibregl.GeoJSONSource;
      try {
        const leaves = await src.getClusterLeaves(clusterId, Math.max(totalCount, 500), 0);
        if (!leaves || leaves.length === 0) return;
        const users = leaves.map(leaf => {
          const p = leaf.properties || {};
          const g = leaf.geometry as GeoJSON.Point;
          return { id: p.id as string, name: (p.name || 'User') as string, avatar: (p.avatar || '') as string, city: (p.city || '') as string, trust_level: (p.trust_level || 'new') as string, lat: g.coordinates[1], lng: g.coordinates[0] };
        });
        window.dispatchEvent(new CustomEvent('gao-cluster-click', { detail: { users, count: totalCount } }));
      } catch (err) { console.error('[Globe Cluster]', err); }
    };
    map.on('click', 'gao-globe-user-ring', handleGlobeClusterClick);
    map.on('click', 'gao-globe-user-count', handleGlobeClusterClick);

    // Single user click
    map.on('click', 'gao-globe-user-single', (e) => {
      const feature = e.features?.[0];
      if (!feature) return;
      const props = feature.properties || {};
      const geo = feature.geometry as GeoJSON.Point;
      addMarker({ id: `user_${props.id}`, entity_type: 'people', lat: geo.coordinates[1], lng: geo.coordinates[0], title: props.name || 'User', state: 'default', metadata: { city: props.city, userId: props.id } });
      setSelectedMarker(`user_${props.id}`);
    });

    // Cursor
    for (const layer of ['gao-globe-user-ring', 'gao-globe-user-count', 'gao-globe-user-single']) {
      map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = ''; });
    }

    globeUserLayersReady.current = true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, mapUsers, profiles, activeLayers, styleVersion, removeGlobeUserLayers]);

  // Toggle between 2D DOM markers and 3D globe layers
  useEffect(() => {
    if (!map) return;
    const isGlobe = useMapStore.getState().viewMode === '3d';

    // Hide/show DOM markers
    for (const marker of markersRef.current.values()) {
      marker.getElement().style.display = isGlobe ? 'none' : '';
    }

    if (!isGlobe) {
      // Clean all globe sources + layers
      const allGlobeLayers = map.getStyle()?.layers?.filter(l => l.id.startsWith('gao-globe-')).map(l => l.id) || [];
      for (const id of allGlobeLayers) { try { map.removeLayer(id); } catch {} }
      const allGlobeSources = Object.keys(map.getStyle()?.sources || {}).filter(s => s.startsWith('gao-globe-'));
      for (const id of allGlobeSources) { try { map.removeSource(id); } catch {} }
      globeReady.current = false;
      removeGlobeUserLayers();
      // Cluster layers will be re-created by the cluster useEffect
      return;
    }

    // Entering 3D — remove cluster layers (globe has its own rendering)
    removeClusterLayers();

    // If globe layers already built, just update data
    if (globeReady.current) {
      buildGlobeRef.current();
      return;
    }

    // First time entering 3D — wait for style then build
    const timer = setTimeout(() => buildGlobeRef.current(), 600);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, activeLayers, styleVersion, removeClusterLayers, removeGlobeUserLayers]);

  // Globe click handlers registered in buildGlobe per entity type

  // ── Live Signal pulse layer (3D globe only) ────────────────────────────
  //
  // Every live signal gets an animated pulsing dot rendered on top of the
  // globe. Conveys "the world is doing stuff right now" at a glance.
  useEffect(() => {
    if (!map) return;
    const PULSE_IMG = 'gao-signal-pulse';
    const PULSE_SRC = 'gao-signal-pulse-src';
    const PULSE_LAYER = 'gao-signal-pulse-layer';

    const cleanup = () => {
      try { if (map.getLayer(PULSE_LAYER)) map.removeLayer(PULSE_LAYER); } catch {}
      try { if (map.getSource(PULSE_SRC)) map.removeSource(PULSE_SRC); } catch {}
      try { if (map.hasImage(PULSE_IMG)) map.removeImage(PULSE_IMG); } catch {}
    };

    if (viewMode !== '3d') { cleanup(); return; }

    const size = 120;
    // MapLibre StyleImageInterface — redraws per frame, triggers repaint
    const pulsingDot: maplibregl.StyleImageInterface = {
      width: size,
      height: size,
      data: new Uint8Array(size * size * 4),
      context: null as CanvasRenderingContext2D | null,
      // @ts-expect-error — StyleImageInterface allows extra fields
      onAdd(this: { context: CanvasRenderingContext2D | null; width: number; height: number }) {
        const cvs = document.createElement('canvas');
        cvs.width = this.width; cvs.height = this.height;
        this.context = cvs.getContext('2d');
      },
      // @ts-expect-error — StyleImageInterface allows extra fields
      render(this: { context: CanvasRenderingContext2D | null; width: number; height: number; data: Uint8Array }) {
        const duration = 1800;
        const t = (performance.now() % duration) / duration;
        const ctx = this.context;
        if (!ctx) return false;
        const radius = (this.width / 2) * 0.28;
        const outerRadius = (this.width / 2) * 0.85 * t + radius;
        const cx = this.width / 2;
        const cy = this.height / 2;
        ctx.clearRect(0, 0, this.width, this.height);

        // Expanding outer ring — bright fade
        ctx.beginPath();
        ctx.arc(cx, cy, outerRadius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 212, 255, ${0.55 * (1 - t)})`;
        ctx.fill();

        // Second ring slightly delayed
        const outerRadius2 = (this.width / 2) * 0.55 * t + radius;
        ctx.beginPath();
        ctx.arc(cx, cy, outerRadius2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 194, 224, ${0.35 * (1 - t)})`;
        ctx.fill();

        // Inner solid dot with cyan glow
        const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 1.6);
        glow.addColorStop(0, 'rgba(0, 212, 255, 1)');
        glow.addColorStop(0.6, 'rgba(0, 212, 255, 0.6)');
        glow.addColorStop(1, 'rgba(0, 212, 255, 0)');
        ctx.beginPath();
        ctx.arc(cx, cy, radius * 1.6, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = 'rgba(0,212,255,1)';
        ctx.lineWidth = 3;
        ctx.fill();
        ctx.stroke();

        this.data = new Uint8Array(ctx.getImageData(0, 0, this.width, this.height).data.buffer);
        map.triggerRepaint();
        return true;
      },
    };

    if (!map.hasImage(PULSE_IMG)) {
      try { map.addImage(PULSE_IMG, pulsingDot as maplibregl.StyleImageInterface, { pixelRatio: 2 }); } catch {}
    }

    // Build source from signals with valid coords
    const features: GeoJSON.Feature[] = signals
      .filter((s) => s.location?.coordinates && s.location.coordinates.length === 2)
      .slice(0, 80)
      .map((s) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: s.location.coordinates as [number, number] },
        properties: { id: s.id, type: s.type },
      }));
    const geo: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features };

    const addLayer = () => {
      try {
        const existing = map.getSource(PULSE_SRC) as maplibregl.GeoJSONSource | undefined;
        if (existing) {
          existing.setData(geo);
        } else {
          map.addSource(PULSE_SRC, { type: 'geojson', data: geo });
          map.addLayer({
            id: PULSE_LAYER,
            type: 'symbol',
            source: PULSE_SRC,
            layout: {
              'icon-image': PULSE_IMG,
              'icon-allow-overlap': true,
              'icon-ignore-placement': true,
              'icon-size': ['interpolate', ['linear'], ['zoom'], 0, 0.45, 3, 0.6, 8, 0.75, 15, 0.9],
              'icon-pitch-alignment': 'viewport',
              'icon-rotation-alignment': 'viewport',
            },
            paint: { 'icon-opacity': 0.9 },
          });
        }
      } catch {}
    };

    if (map.isStyleLoaded()) addLayer();
    else map.once('style.load', addLayer);

    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, signals, styleVersion, viewMode]);

  // Cleanup all on unmount
  useEffect(() => {
    return () => {
      for (const marker of markersRef.current.values()) {
        marker.remove();
      }
      markersRef.current.clear();
    };
  }, []);
}
