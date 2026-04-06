'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { escapeHtml } from '@/lib/sanitize';
import type { Signal, Agent, Friend, Developer, Profile, Business, Event, Circle, EntityType, MarkerState } from '@/types';
import { ENTITY_MARKER_CONFIG, AGENT_COLORS } from '@/styles/tokens';
import { useMapStore } from '@/stores/mapStore';
import { useFriendStore } from '@/stores/friendStore';
import { useDeveloperStore } from '@/stores/developerStore';
import { useLandmarkStore, type Landmark } from '@/stores/landmarkStore';

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
  const isLive = new Date(signal.created_at).getTime() > Date.now() - 30 * 60 * 1000;

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
  circles: Circle[] = []
) {
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const [styleVersion, setStyleVersion] = useState(0);
  const { activeLayers, setSelectedMarker, addMarker, removeMarker } =
    useMapStore();
  const { friends, showOnMap: showFriendsOnMap } = useFriendStore();
  const { developers, showOnMap: showDevsOnMap } = useDeveloperStore();
  const { landmarks, showOnMap: showLandmarksOnMap } = useLandmarkStore();

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

      const isLive = signal.status === 'active' && new Date(signal.created_at).getTime() > Date.now() - 30 * 60 * 1000;
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

    // Add / update business markers
    if (activeLayers.has('business')) {
      for (const biz of businesses) {
        if (!biz.location_lat || !biz.location_lng) continue;
        const bid = biz.id;
        currentIds.add(bid);
        if (markersRef.current.has(bid)) continue;

        const el = createImageMarkerElement('/icons/business.png', '#34d399', biz.name);
        el.addEventListener('click', () => setSelectedMarker(bid));

        const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat([biz.location_lng, biz.location_lat])
          .addTo(map);

        markersRef.current.set(bid, marker);
        addMarker({
          id: bid, entity_type: 'business',
          lat: biz.location_lat, lng: biz.location_lng,
          title: biz.name, state: biz.open_now ? 'live' : 'default',
          trust_level: biz.trust_level as EntityType | undefined,
          metadata: { category: biz.category, open_now: biz.open_now },
        });
      }
    } else {
      for (const biz of businesses) {
        const existing = markersRef.current.get(biz.id);
        if (existing) { existing.remove(); markersRef.current.delete(biz.id); removeMarker(biz.id); }
      }
    }

    // Add / update event markers
    if (activeLayers.has('event')) {
      for (const evt of events) {
        if (!evt.location_lat || !evt.location_lng) continue;
        const eid = evt.id;
        currentIds.add(eid);
        if (markersRef.current.has(eid)) continue;

        const isLive = evt.status === 'live';
        const el = createImageMarkerElement('/icons/event.png', '#f87171', evt.title, isLive);
        el.addEventListener('click', () => setSelectedMarker(eid));

        const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat([evt.location_lng, evt.location_lat])
          .addTo(map);

        markersRef.current.set(eid, marker);
        addMarker({
          id: eid, entity_type: 'event',
          lat: evt.location_lat, lng: evt.location_lng,
          title: evt.title, state: isLive ? 'live' : 'default',
          metadata: { start_time: evt.start_time, joined_count: evt.joined_count, capacity: evt.capacity },
        });
      }
    } else {
      for (const evt of events) {
        const existing = markersRef.current.get(evt.id);
        if (existing) { existing.remove(); markersRef.current.delete(evt.id); removeMarker(evt.id); }
      }
    }

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
  }, [map, signals, agents, profiles, businesses, events, circles, friends, showFriendsOnMap, developers, showDevsOnMap, landmarks, showLandmarksOnMap, activeLayers, setSelectedMarker, addMarker, removeMarker, styleVersion]);

  // Re-add markers after style change (style swap removes DOM elements)
  useEffect(() => {
    function handleStyleChanged() {
      console.log('[STYLE-CHANGED] fired — clearing markers, bumping styleVersion');
      // Clear refs so markers get re-created on next render
      for (const marker of markersRef.current.values()) {
        marker.remove();
      }
      markersRef.current.clear();
      // Trigger re-render to re-create markers
      setStyleVersion((v: number) => v + 1);
    }
    window.addEventListener('gao-style-changed', handleStyleChanged);
    return () => window.removeEventListener('gao-style-changed', handleStyleChanged);
  }, []);


  // ── 3D Globe: GeoJSON layers ─────────────────────────────────────────────
  const GLOBE_SRC = 'gao-globe-src';
  const GLOBE_TYPES = ['business', 'event', 'people', 'offer', 'profile', 'landmark', 'friend'] as const;
  const GLOBE_COLORS: Record<string, string> = { business: '#22C55E', event: '#EF4444', people: '#3B82F6', offer: '#EAB308', profile: '#818CF8', landmark: '#fbbf24', friend: '#00d4ff' };
  const GLOBE_ICONS: Record<string, { src: string; size: number }> = {
    business: { src: '/icons/business.png', size: 0.12 },
    event: { src: '/icons/event.png', size: 0.03 },
  };
  const globeReady = useRef(false);

  // Build globe layers (called after delay or on layer toggle)
  const buildGlobe = useCallback(async () => {
    if (!map || useMapStore.getState().viewMode !== '3d') return;

    // Ensure icons are loaded (style swap removes them)
    for (const [key, cfg] of Object.entries(GLOBE_ICONS)) {
      const name = `globe-icon-${key}`;
      if (!map.hasImage(name)) {
        try { const img = await map.loadImage(cfg.src); map.addImage(name, img.data); } catch {}
      }
    }

    // Build features
    const features: GeoJSON.Feature[] = [];
    for (const b of businesses) {
      if (b.location_lat && b.location_lng) features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [b.location_lng, b.location_lat] }, properties: { id: b.id, entityType: 'business' } });
    }
    for (const e of events) {
      if (e.location_lat && e.location_lng) features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [e.location_lng!, e.location_lat!] }, properties: { id: e.id, entityType: 'event' } });
    }
    for (const s of signals) {
      features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: s.location.coordinates as [number, number] }, properties: { id: s.id, entityType: s.type === 'offer' ? 'offer' : 'people' } });
    }
    for (const p of profiles) {
      if (p.location) features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: p.location.coordinates as [number, number] }, properties: { id: p._id, entityType: 'profile' } });
    }
    for (const lm of landmarks) {
      features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [lm.lng, lm.lat] }, properties: { id: lm.id, entityType: 'landmark', name: lm.name, icon: lm.icon } });
    }
    if (showFriendsOnMap) {
      for (const f of friends) {
        if (f.location_sharing !== 'off' && f.location) {
          features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: f.location.coordinates as [number, number] }, properties: { id: f.id, entityType: 'friend', name: f.display_name, avatar_url: f.avatar_url || '', gao_domain: f.gao_domain || '', trust_level: f.trust_level, trust_score: f.trust_score, is_online: f.is_online, last_seen_at: f.last_seen_at || '' } });
        }
      }
    }

    const geo: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features };

    try {
      // Source
      if (map.getSource(GLOBE_SRC)) {
        (map.getSource(GLOBE_SRC) as maplibregl.GeoJSONSource).setData(geo);
      } else {
        map.addSource(GLOBE_SRC, { type: 'geojson', data: geo });
      }

      // Layers
      for (const t of GLOBE_TYPES) {
        const id = `gao-globe-${t}`;
        const visible = t === 'friend' ? showFriendsOnMap : activeLayers.has(t);

        if (!map.getLayer(id)) {
          if (t === 'landmark') {
            // Generate emoji images for each unique landmark icon
            const uniqueIcons = new Set(landmarks.map(lm => lm.icon));
            for (const emoji of uniqueIcons) {
              const imgName = `lm-${emoji}`;
              if (!map.hasImage(imgName)) {
                const size = 64;
                const canvas = document.createElement('canvas');
                canvas.width = size; canvas.height = size;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                  // Gold circle background
                  ctx.beginPath();
                  ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
                  ctx.fillStyle = 'rgba(251,191,36,0.95)';
                  ctx.fill();
                  ctx.strokeStyle = '#ffffff';
                  ctx.lineWidth = 3;
                  ctx.stroke();
                  // Emoji
                  ctx.font = '30px serif';
                  ctx.textAlign = 'center';
                  ctx.textBaseline = 'middle';
                  ctx.fillText(emoji, size / 2, size / 2 + 2);
                  const imgData = ctx.getImageData(0, 0, size, size);
                  map.addImage(imgName, imgData, { pixelRatio: 2 });
                }
              }
            }
            // Icon layer
            map.addLayer({ id, type: 'symbol', source: GLOBE_SRC, filter: ['==', ['get', 'entityType'], 'landmark'], layout: { 'icon-image': ['concat', 'lm-', ['get', 'icon']], 'icon-size': 0.6, 'icon-allow-overlap': true, visibility: visible ? 'visible' : 'none' } });
            // Name label below
            map.addLayer({ id: `${id}-label`, type: 'symbol', source: GLOBE_SRC, filter: ['==', ['get', 'entityType'], 'landmark'], layout: { 'text-field': ['get', 'name'], 'text-size': 10, 'text-offset': [0, 2], 'text-anchor': 'top', 'text-allow-overlap': false, visibility: visible ? 'visible' : 'none' }, paint: { 'text-color': '#fbbf24', 'text-halo-color': '#000000', 'text-halo-width': 1.5 } });
          } else if (t === 'friend') {
            // Friend: cyan circle + name label
            map.addLayer({ id, type: 'circle', source: GLOBE_SRC, filter: ['==', ['get', 'entityType'], 'friend'], paint: { 'circle-radius': 9, 'circle-color': '#00d4ff', 'circle-stroke-width': 3, 'circle-stroke-color': '#ffffff' }, layout: { visibility: visible ? 'visible' : 'none' } });
            map.addLayer({ id: `${id}-label`, type: 'symbol', source: GLOBE_SRC, filter: ['==', ['get', 'entityType'], 'friend'], layout: { 'text-field': ['get', 'name'], 'text-size': 11, 'text-offset': [0, 1.8], 'text-anchor': 'top', 'text-allow-overlap': true, visibility: visible ? 'visible' : 'none' }, paint: { 'text-color': '#00d4ff', 'text-halo-color': '#000000', 'text-halo-width': 1.5 } });
          } else {
            const iconCfg = GLOBE_ICONS[t];
            if (iconCfg && map.hasImage(`globe-icon-${t}`)) {
              map.addLayer({ id, type: 'symbol', source: GLOBE_SRC, filter: ['==', ['get', 'entityType'], t], layout: { 'icon-image': `globe-icon-${t}`, 'icon-size': iconCfg.size, 'icon-allow-overlap': true, visibility: visible ? 'visible' : 'none' } });
            } else {
              map.addLayer({ id, type: 'circle', source: GLOBE_SRC, filter: ['==', ['get', 'entityType'], t], paint: { 'circle-radius': 7, 'circle-color': GLOBE_COLORS[t] || '#fff', 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' }, layout: { visibility: visible ? 'visible' : 'none' } });
            }
          }
        } else {
          map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
          if (t === 'landmark' || t === 'friend') {
            if (map.getLayer(`${id}-label`)) map.setLayoutProperty(`${id}-label`, 'visibility', visible ? 'visible' : 'none');
          }
        }
      }
      globeReady.current = true;
    } catch (err) {
      console.warn('[GLOBE] build error', err);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, activeLayers, signals, businesses, events, profiles, landmarks, friends, showFriendsOnMap]);

  // Toggle between 2D DOM markers and 3D globe layers
  useEffect(() => {
    if (!map) return;
    const isGlobe = useMapStore.getState().viewMode === '3d';

    // Hide/show DOM markers
    for (const marker of markersRef.current.values()) {
      marker.getElement().style.display = isGlobe ? 'none' : '';
    }

    if (!isGlobe) {
      // Clean globe layers + label layers
      for (const t of GLOBE_TYPES) {
        try { if (map.getLayer(`gao-globe-${t}-label`)) map.removeLayer(`gao-globe-${t}-label`); } catch {}
        try { if (map.getLayer(`gao-globe-${t}-bg`)) map.removeLayer(`gao-globe-${t}-bg`); } catch {}
        try { if (map.getLayer(`gao-globe-${t}`)) map.removeLayer(`gao-globe-${t}`); } catch {}
      }
      try { if (map.getSource(GLOBE_SRC)) map.removeSource(GLOBE_SRC); } catch {}
      globeReady.current = false;
      return;
    }

    // If globe layers already built, just update visibility
    if (globeReady.current && map.getSource(GLOBE_SRC)) {
      buildGlobe();
      return;
    }

    // First time entering 3D — wait for style then build
    const timer = setTimeout(() => buildGlobe(), 600);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, activeLayers, styleVersion, buildGlobe]);

  // Globe click handler — register marker in store so sheets can read it
  useEffect(() => {
    if (!map) return;
    const handler = (e: maplibregl.MapMouseEvent) => {
      const layers = GLOBE_TYPES.map(t => `gao-globe-${t}`).filter(id => map.getLayer(id));
      if (layers.length === 0) return;
      const features = map.queryRenderedFeatures(e.point, { layers });
      if (features.length === 0) return;
      const props = features[0].properties || {};
      const geo = features[0].geometry as GeoJSON.Point;
      const id = props.id as string;
      const entityType = (props.entityType || 'people') as string;
      // Ensure marker exists in store for sheets to read
      if (!useMapStore.getState().markers.has(id)) {
        addMarker({
          id,
          entity_type: entityType as import('@/types').EntityType,
          lat: geo.coordinates[1],
          lng: geo.coordinates[0],
          title: (props.name as string) || id,
          state: props.is_online ? 'live' : 'default',
          metadata: { ...props },
        });
      }
      setSelectedMarker(id);
    };
    map.on('click', handler);
    return () => { map.off('click', handler); };
  }, [map, setSelectedMarker, addMarker]);

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
