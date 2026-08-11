thoi bo bay'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import maplibregl from 'maplibre-gl';
import { escapeHtml, sanitizeUrl } from '@/lib/sanitize';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { useMap } from './WorldMap';
import { useFriendStore } from '@/stores/friendStore';
import SignInGateSheet from '@/components/auth/SignInGateSheet';
import { useAuthStore } from '@/stores/auth-store';
import { useMapStore } from '@/stores/mapStore';
import { useGiftsPopupStore } from '@/stores/giftsPopupStore';
import { GiftsPopup } from '@/components/gifts/GiftsPopup';
import { HeartBuilder } from '@/components/gifts/HeartBuilder';
import { CoupleCardBuilder } from '@/components/gifts/CoupleCardBuilder';
import CapsuleCreateModal from '@/components/capsules/CapsuleCreateModal';

const fetcher = (url: string) => fetch(url, {
  
}).then(r => r.json());

interface Kiss {
  id: string;
  sender_id: string; sender_name: string; sender_avatar?: string;
  receiver_id: string; receiver_name: string; receiver_avatar?: string;
  message: string; emoji: string; visibility: string;
  sender_lat: number; sender_lng: number;
  receiver_lat: number; receiver_lng: number;
  opened: boolean; created_at: string;
}

// ── Great circle interpolation ──
function interpolateGreatCircle(from: [number, number], to: [number, number], steps: number): [number, number][] {
  const toRad = (d: number) => d * Math.PI / 180;
  const toDeg = (r: number) => r * 180 / Math.PI;
  const [lng1, lat1] = from.map(toRad);
  const [lng2, lat2] = to.map(toRad);

  const d = 2 * Math.asin(Math.sqrt(
    Math.pow(Math.sin((lat2 - lat1) / 2), 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.pow(Math.sin((lng2 - lng1) / 2), 2)
  ));

  if (d < 0.0001) return [from, to];

  const points: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(lat1) * Math.cos(lng1) + B * Math.cos(lat2) * Math.cos(lng2);
    const y = A * Math.cos(lat1) * Math.sin(lng1) + B * Math.cos(lat2) * Math.sin(lng2);
    const z = A * Math.sin(lat1) + B * Math.sin(lat2);
    points.push([toDeg(Math.atan2(y, x)), toDeg(Math.atan2(z, Math.sqrt(x * x + y * y)))]);
  }
  return points;
}


// ── Heart-shaped flight path for the dove ──
// The dove flies OUT from sender to the map centre, traces a full HEART
// SHAPE around the map centre (so the heart sits dead-centre of what
// the user is looking at, not off to the side), then flies down to the
// receiver. Uses the classic parametric heart equation:
//   x(t) = 16 sin³(t)
//   y(t) = 13 cos(t) − 5 cos(2t) − 2 cos(3t) − cos(4t)
// centre = [lng, lat] of the map viewport centre.
// heartWidthKm = 70-90% of viewport width so the heart is nearly as big
// as the visible globe (or city on close-in views).
function generateHeartPath(from: [number, number], to: [number, number], centre: [number, number], heartWidthKm: number): [number, number][] {
  const cLng = centre[0], cLat = centre[1];
  const cosLat = Math.cos(cLat * Math.PI / 180);
  const kmPerUnit = heartWidthKm / 32; // heart parametric x ∈ [-16, 16]
  const scaleLng = kmPerUnit / (111 * Math.max(cosLat, 0.05));
  const scaleLat = kmPerUnit / 111;

  const heartPts: [number, number][] = [];
  const N = 220;
  for (let i = 0; i <= N; i++) {
    const t = (i / N) * 2 * Math.PI;
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    heartPts.push([cLng + x * scaleLng, cLat + y * scaleLat]);
  }
  // Full path: sender → complete heart loop → receiver
  return [from, ...heartPts, to];
}

// ── Catmull-Rom spline — smooth curve through a set of control points ──
// Used to turn the dove's few meander waypoints into a dense, naturally
// curved flight path (birds don't fly straight lines).
function catmullRomSpline(points: [number, number][], samplesPerSegment: number): [number, number][] {
  if (points.length < 2) return points.slice();
  const pts = [points[0], ...points, points[points.length - 1]];
  const out: [number, number][] = [];
  for (let i = 1; i < pts.length - 2; i++) {
    const p0 = pts[i - 1], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2];
    for (let j = 0; j < samplesPerSegment; j++) {
      const t = j / samplesPerSegment;
      const t2 = t * t, t3 = t2 * t;
      const x = 0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
      const y = 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
      out.push([x, y]);
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

// ── Dove flight path — natural weaving instead of a laser-straight arc ──
// A real bird meanders. We generate 3-4 intermediate waypoints along the
// great-circle route, each offset perpendicular by a small random amount
// (alternating sides), then smooth the whole thing with Catmull-Rom into
// ~120 dense points so the dove marker curves gracefully across the map.
function generateBirdPath(from: [number, number], to: [number, number], distanceKm: number): [number, number][] {
  const numMid = 4;
  const baseArc = interpolateGreatCircle(from, to, numMid + 1);
  // Perpendicular offset scaled to distance. ~0.0004 deg per km → for a
  // 5 km flight we get ~200 m of lateral weave, clearly visible at zoom 15
  // without pushing the bird out of the sender/receiver neighbourhood.
  const maxOffsetDeg = Math.min(distanceKm * 0.0004, 0.005);
  const controlPoints: [number, number][] = [from];
  for (let idx = 1; idx < baseArc.length - 1; idx++) {
    const prev = baseArc[idx - 1];
    const next = baseArc[idx + 1];
    const dx = next[0] - prev[0];
    const dy = next[1] - prev[1];
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    // Perpendicular unit vector (rotated 90°)
    const px = -dy / len;
    const py = dx / len;
    const sign = (idx % 2 === 0 ? 1 : -1) * (0.4 + Math.random() * 0.6);
    const p = baseArc[idx];
    controlPoints.push([p[0] + px * maxOffsetDeg * sign, p[1] + py * maxOffsetDeg * sign]);
  }
  controlPoints.push(to);
  return catmullRomSpline(controlPoints, 30); // 30 samples per segment × 5 segments ≈ 150 points
}

// ── Distance-based delivery vehicle picker ──
// Four commercial tiers keyed to travel distance in Vietnam / SE Asia:
//   < 5 km    → 🕊️ chim bo cau (intimate, hand-carried feel)
//   5–100 km  → 🏍️ xe may (city / provincial hop)
//   100–1000  → 🚗 o to (regional / cross-country road trip)
//   > 1000 km → ✈️ may bay (international)
// Each vehicle drives its own flight timing, camera framing and marker
// motion in playFlightAnimation.
type VehicleKind = 'dove' | 'motorbike' | 'car' | 'plane';

interface VehicleConfig {
  kind: VehicleKind;
  size: number;               // marker pixel size (square)
  durationMs: number;         // total flight time
  arcSteps: number;           // resolution of the great-circle path
  cruiseZoom: number;         // steady-follow zoom during middle of flight
  landZoom: number;           // final zoom on arrival
  cruisePitch: number;        // camera pitch during cruise
  lineColor: string;          // arc + trail colour
  lineWidth: number;
  lineDash: [number, number] | null; // null = solid trail (rocket)
  emoji: string;              // HUD label
  displayName: string;        // HUD label word
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function pickVehicle(distanceKm: number): VehicleConfig {
  if (distanceKm < 5) return {
    // Dove holds a 3D tilted city view (pitch 40°) for the whole flight,
    // matching the "plane about to land" reference screenshot — you see
    // the city with a slight 3D perspective and the bird flying across.
    // cruiseZoom/landZoom are unused for dove — startup uses a direct
    // jumpTo with zoom 13 and pitch 40 so the show starts INSTANTLY
    // framed like the reference (no 2-second fly-in transition).
    kind: 'dove', size: 60, durationMs: 14000, arcSteps: 100,
    cruiseZoom: 13, landZoom: 15, cruisePitch: 40,
    lineColor: '#ef4444', lineWidth: 2.5, lineDash: [2, 3],
    emoji: '🕊️', displayName: 'Bo cau',
  };
  if (distanceKm < 100) return {
    kind: 'motorbike', size: 46, durationMs: 12000, arcSteps: 180,
    cruiseZoom: 13, landZoom: 14.5, cruisePitch: 50,
    lineColor: '#ec4899', lineWidth: 2.2, lineDash: [2, 3],
    emoji: '🏍️', displayName: 'Xe may',
  };
  if (distanceKm < 1000) return {
    kind: 'car', size: 52, durationMs: 20000, arcSteps: 300,
    cruiseZoom: 12, landZoom: 14, cruisePitch: 45,
    lineColor: '#f97316', lineWidth: 2.5, lineDash: [3, 3],
    emoji: '🚗', displayName: 'O to',
  };
  return {
    kind: 'plane', size: 64, durationMs: 25000, arcSteps: 500,
    cruiseZoom: 12, landZoom: 14, cruisePitch: 50,
    lineColor: '#ef4444', lineWidth: 3, lineDash: [2, 3],
    emoji: '✈️', displayName: 'May bay',
  };
}

function buildVehicleSvg(kind: VehicleKind, kissId: string): string {
  const id = kissId.slice(0, 8);
  switch (kind) {
    case 'dove': return `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="dv-${id}" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="#0f172a" flood-opacity="0.55"/></filter>
        <linearGradient id="dvw-${id}" x1="0" y1="0" x2="48" y2="48"><stop offset="0%" stop-color="#fff"/><stop offset="100%" stop-color="#e0e7ff"/></linearGradient>
        <linearGradient id="dvenv-${id}" x1="0" y1="0" x2="48" y2="0"><stop offset="0%" stop-color="#fff7ed"/><stop offset="100%" stop-color="#fef3c7"/></linearGradient>
      </defs>
      <g filter="url(#dv-${id})">
        <!-- Left wing: flap-flap-glide cycle (2 quick flaps then extended glide) -->
        <path fill="url(#dvw-${id})" stroke="#c7d2fe" stroke-width="0.4">
          <animate attributeName="d" dur="2s" repeatCount="indefinite"
            keyTimes="0;0.07;0.14;0.21;0.28;1"
            values="M24 24 Q13 16 5 22 Q11 26 24 28Z;M24 24 Q11 10 3 16 Q9 24 24 28Z;M24 24 Q13 16 5 22 Q11 26 24 28Z;M24 24 Q11 10 3 16 Q9 24 24 28Z;M24 24 Q13 18 5 24 Q11 26 24 28Z;M24 24 Q13 18 5 24 Q11 26 24 28Z"/>
        </path>
        <!-- Right wing: mirrored -->
        <path fill="url(#dvw-${id})" stroke="#c7d2fe" stroke-width="0.4">
          <animate attributeName="d" dur="2s" repeatCount="indefinite"
            keyTimes="0;0.07;0.14;0.21;0.28;1"
            values="M24 24 Q35 16 43 22 Q37 26 24 28Z;M24 24 Q37 10 45 16 Q39 24 24 28Z;M24 24 Q35 16 43 22 Q37 26 24 28Z;M24 24 Q37 10 45 16 Q39 24 24 28Z;M24 24 Q35 18 43 24 Q37 26 24 28Z;M24 24 Q35 18 43 24 Q37 26 24 28Z"/>
        </path>
        <!-- Body -->
        <ellipse cx="24" cy="25" rx="4.2" ry="7" fill="#fff" stroke="#c7d2fe" stroke-width="0.4"/>
        <!-- Tail -->
        <path d="M24 32 L19 38 L24 35 L29 38Z" fill="#fff" stroke="#c7d2fe" stroke-width="0.4"/>
        <!-- Head -->
        <circle cx="24" cy="15" r="3.6" fill="#fff" stroke="#c7d2fe" stroke-width="0.4"/>
        <!-- Beak (bigger, pointing up so it visibly holds the envelope) -->
        <path d="M23 12 L24 8 L25 12 Z" fill="#f97316" stroke="#c2410c" stroke-width="0.3"/>
        <!-- Eye -->
        <circle cx="25.3" cy="14" r="0.7" fill="#0f172a"/>
        <circle cx="25.5" cy="13.7" r="0.25" fill="#fff"/>
        <!-- ── ENVELOPE being carried in beak ── -->
        <!-- Small tether string from beak to envelope so it reads as "carried" -->
        <line x1="24" y1="8.2" x2="24" y2="6" stroke="#334155" stroke-width="0.5"/>
        <!-- Envelope shadow (subtle depth) -->
        <rect x="15" y="0.7" width="18" height="7" rx="0.6" fill="#0f172a" opacity="0.18"/>
        <!-- Envelope body -->
        <rect x="15" y="0" width="18" height="7" rx="0.6" fill="url(#dvenv-${id})" stroke="#ec4899" stroke-width="0.7"/>
        <!-- Envelope flap lines -->
        <path d="M15 0 L24 5 L33 0" stroke="#ec4899" stroke-width="0.6" fill="none"/>
        <!-- Wax heart seal -->
        <circle cx="24" cy="3.5" r="1.9" fill="#ec4899" stroke="#be185d" stroke-width="0.3"/>
        <text x="24" y="4.7" font-size="3" text-anchor="middle" fill="#fff" font-weight="bold">♥</text>
      </g></svg>`;

    case 'motorbike': return `<svg viewBox="0 0 46 46" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="mb-${id}" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <g filter="url(#mb-${id})">
        <circle cx="23" cy="35" r="5" fill="none" stroke="#94a3b8" stroke-width="2"/>
        <circle cx="23" cy="35" r="1.5" fill="#64748b"/>
        <circle cx="23" cy="11" r="5" fill="none" stroke="#94a3b8" stroke-width="2"/>
        <circle cx="23" cy="11" r="1.5" fill="#64748b"/>
        <path d="M23 30 L23 16" stroke="#ec4899" stroke-width="2.5" stroke-linecap="round"/>
        <path d="M23 16 L19 21 M23 16 L27 21" stroke="#ec4899" stroke-width="2" stroke-linecap="round"/>
        <ellipse cx="23" cy="23" rx="4" ry="3" fill="#ec4899" opacity="0.85"/>
        <circle cx="23" cy="18" r="3" fill="#fbbf24" stroke="#f59e0b" stroke-width="0.3"/>
        <rect x="18" y="27" width="10" height="8" rx="2" fill="#f87171" opacity="0.95"/>
        <path d="M18 31 L28 31 M23 27 L23 35" stroke="#fbbf24" stroke-width="1"/>
        <circle cx="23" cy="6" r="2" fill="#fbbf24" opacity="0.8"><animate attributeName="opacity" values="0.5;1;0.5" dur="0.6s" repeatCount="indefinite"/></circle>
        <circle cx="21" cy="41" r="2" fill="#94a3b8" opacity="0"><animate attributeName="cy" values="41;46;54" dur="1.2s" repeatCount="indefinite"/><animate attributeName="r" values="1;3;5" dur="1.2s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.5;0.3;0" dur="1.2s" repeatCount="indefinite"/></circle>
        <circle cx="25" cy="41" r="2" fill="#94a3b8" opacity="0"><animate attributeName="cy" values="41;48;56" dur="1.5s" repeatCount="indefinite" begin="0.3s"/><animate attributeName="r" values="1;2.5;4" dur="1.5s" repeatCount="indefinite" begin="0.3s"/><animate attributeName="opacity" values="0.4;0.2;0" dur="1.5s" repeatCount="indefinite" begin="0.3s"/></circle>
      </g></svg>`;

    case 'car': return `<svg viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="cr-${id}" x="-15%" y="-15%" width="130%" height="130%"><feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="#000" flood-opacity="0.5"/></filter>
        <linearGradient id="crb-${id}" x1="12" y1="0" x2="40" y2="0"><stop offset="0%" stop-color="#dc2626"/><stop offset="50%" stop-color="#ef4444"/><stop offset="100%" stop-color="#dc2626"/></linearGradient>
      </defs>
      <g filter="url(#cr-${id})">
        <ellipse cx="26" cy="4" rx="4" ry="1" fill="#fff" opacity="0"><animate attributeName="cy" values="6;-2" dur="0.4s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.7;0" dur="0.4s" repeatCount="indefinite"/></ellipse>
        <rect x="12" y="4" width="28" height="44" rx="8" fill="url(#crb-${id})" stroke="#991b1b" stroke-width="0.5"/>
        <path d="M15 12 L37 12 L35 20 L17 20Z" fill="#0c4a6e" stroke="#38bdf8" stroke-width="0.3" opacity="0.9"/>
        <ellipse cx="19" cy="16" rx="1" ry="1.5" fill="#7dd3fc" opacity="0.5"/>
        <rect x="17" y="20" width="18" height="12" fill="#b91c1c"/>
        <path d="M17 32 L35 32 L37 40 L15 40Z" fill="#0c4a6e" stroke="#38bdf8" stroke-width="0.3" opacity="0.85"/>
        <circle cx="16" cy="6" r="1.6" fill="#fef08a"><animate attributeName="opacity" values="0.7;1;0.7" dur="0.9s" repeatCount="indefinite"/></circle>
        <circle cx="36" cy="6" r="1.6" fill="#fef08a"><animate attributeName="opacity" values="0.7;1;0.7" dur="0.9s" repeatCount="indefinite" begin="0.45s"/></circle>
        <rect x="14" y="44" width="5" height="2" rx="1" fill="#7f1d1d"/>
        <rect x="33" y="44" width="5" height="2" rx="1" fill="#7f1d1d"/>
        <rect x="7" y="12" width="5" height="10" rx="1.5" fill="#1e293b" stroke="#334155" stroke-width="0.3"/>
        <rect x="40" y="12" width="5" height="10" rx="1.5" fill="#1e293b" stroke="#334155" stroke-width="0.3"/>
        <rect x="7" y="34" width="5" height="10" rx="1.5" fill="#1e293b" stroke="#334155" stroke-width="0.3"/>
        <rect x="40" y="34" width="5" height="10" rx="1.5" fill="#1e293b" stroke="#334155" stroke-width="0.3"/>
        <rect x="21" y="23" width="10" height="6" rx="0.6" fill="#fbbf24" opacity="0.95"/>
        <line x1="26" y1="23" x2="26" y2="29" stroke="#dc2626" stroke-width="0.7"/>
        <line x1="21" y1="26" x2="31" y2="26" stroke="#dc2626" stroke-width="0.7"/>
        <path d="M23 22 C22 20 25 20 26 22 C27 20 30 20 29 22" stroke="#dc2626" stroke-width="0.5" fill="none"/>
      </g></svg>`;

    case 'plane': return `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="shadow-${id}" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000" flood-opacity="0.5"/></filter>
        <linearGradient id="fuselage-${id}" x1="32" y1="6" x2="32" y2="58" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#f8fafc"/><stop offset="40%" stop-color="#e2e8f0"/><stop offset="100%" stop-color="#cbd5e1"/></linearGradient>
        <linearGradient id="wing-${id}" x1="6" y1="28" x2="58" y2="28" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#64748b"/><stop offset="50%" stop-color="#94a3b8"/><stop offset="100%" stop-color="#64748b"/></linearGradient>
      </defs>
      <g filter="url(#shadow-${id})">
        <path d="M32 6 C29 6 27 10 27 16 L27 48 C27 52 29 56 32 58 C35 56 37 52 37 48 L37 16 C37 10 35 6 32 6Z" fill="url(#fuselage-${id})" stroke="#94a3b8" stroke-width="0.3"/>
        <line x1="32" y1="8" x2="32" y2="54" stroke="#cbd5e1" stroke-width="0.5" opacity="0.5"/>
        <ellipse cx="32" cy="10" rx="2" ry="2.5" fill="#0c4a6e" stroke="#0ea5e9" stroke-width="0.4"/>
        <ellipse cx="32" cy="10" rx="1.2" ry="1.5" fill="#38bdf8" opacity="0.6"/>
        <path d="M27 24 L4 32 L6 34 L27 28Z" fill="url(#wing-${id})" stroke="#64748b" stroke-width="0.3"/>
        <path d="M37 24 L60 32 L58 34 L37 28Z" fill="url(#wing-${id})" stroke="#64748b" stroke-width="0.3"/>
        <ellipse cx="16" cy="28" rx="2" ry="3.5" fill="#475569" stroke="#334155" stroke-width="0.3"/>
        <ellipse cx="48" cy="28" rx="2" ry="3.5" fill="#475569" stroke="#334155" stroke-width="0.3"/>
        <ellipse cx="16" cy="32" rx="1.2" ry="1.5" fill="#f97316" opacity="0.5"><animate attributeName="opacity" values="0.3;0.7;0.3" dur="0.6s" repeatCount="indefinite"/></ellipse>
        <ellipse cx="48" cy="32" rx="1.2" ry="1.5" fill="#f97316" opacity="0.5"><animate attributeName="opacity" values="0.3;0.7;0.3" dur="0.6s" repeatCount="indefinite" begin="0.3s"/></ellipse>
        <path d="M27 46 L16 50 L18 51 L27 48Z" fill="#94a3b8" stroke="#64748b" stroke-width="0.3"/>
        <path d="M37 46 L48 50 L46 51 L37 48Z" fill="#94a3b8" stroke="#64748b" stroke-width="0.3"/>
        <path d="M32 44 L32 56 L35 54 L35 46Z" fill="#ec4899" stroke="#be185d" stroke-width="0.3"/>
        <text x="33" y="52" font-size="5" text-anchor="middle">❤</text>
        <circle cx="4" cy="32" r="0.8" fill="#ef4444"><animate attributeName="opacity" values="1;0.3;1" dur="1.5s" repeatCount="indefinite"/></circle>
        <circle cx="60" cy="32" r="0.8" fill="#22c55e"><animate attributeName="opacity" values="1;0.3;1" dur="1.5s" repeatCount="indefinite" begin="0.75s"/></circle>
      </g></svg>`;
  }
}


// ── Send Kiss Modal ──
export function SendKissModal({ onClose, onSent, defaultReceiverId, inline = false, hideHeader = false }: { onClose: () => void; onSent: () => void; defaultReceiverId?: string | null; inline?: boolean; hideHeader?: boolean }) {
  const { friends, fetchFriends } = useFriendStore();
  const [following, setFollowing] = useState<{ id: string; name: string; avatar?: string }[]>([]);
  const [searchResults, setSearchResults] = useState<{ id: string; name: string; avatar?: string }[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<{ id: string; name: string; avatar?: string } | null>(null);
  const [receiverId, setReceiverId] = useState(defaultReceiverId || '');
  const [friendSearch, setFriendSearch] = useState('');
  const [friendDropdownOpen, setFriendDropdownOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [message, setMessage] = useState('');
  const [emoji, setEmoji] = useState('💋');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [kissType, setKissType] = useState<'kiss' | 'declaration'>('kiss');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [noLocationWarning, setNoLocationWarning] = useState(false);
  const [customAddress, setCustomAddress] = useState('');
  const [addressCoords, setAddressCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [addressSuggestions, setAddressSuggestions] = useState<{ display_name: string; lat: string; lon: string }[]>([]);
  const addressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetchFriends();
    // Also fetch following users as fallback — auth flows through cookies, the
    // server returns 401 if the viewer isn't logged in (we just ignore that).
    if (typeof document !== 'undefined' && document.cookie.includes('gao_logged_in=1')) {
      fetch('/api/v1/follows?type=following')
        .then(r => r.json())
        .then(d => {
          if (d.data) setFollowing(d.data.map((f: Record<string, unknown>) => ({
            id: (f.following_user_id || f.id) as string,
            name: (f.user_name || f.display_name || 'User') as string,
            avatar: (f.user_avatar || f.avatar_url) as string | undefined,
          })));
        })
        .catch(() => {});
    }
  }, [fetchFriends]);

  const doSend = async (overrideReceiverCoords?: { lat: number; lng: number }) => {
    if (typeof document === 'undefined' || !document.cookie.includes('gao_logged_in=1')) { setSendError('Please login first'); return; }
    setSending(true);
    try {
      const payload: Record<string, unknown> = { receiver_id: receiverId, message, emoji, visibility, kiss_type: kissType };
      if (kissType === 'declaration') payload.visibility = 'public'; // declarations are always public
      if (overrideReceiverCoords) {
        payload.receiver_lat = overrideReceiverCoords.lat;
        payload.receiver_lng = overrideReceiverCoords.lng;
      }
      const res = await fetch('/api/v1/kisses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) { toast.success('Kiss sent! ✈️💋'); onSent(); onClose(); }
      else { const d = await res.json(); setSendError(d.error?.message || 'Failed to send kiss'); }
    } catch { setSendError('Network error — please try again'); }
    finally { setSending(false); }
  };

  const handleSend = async () => {
    setSendError(null);
    setNoLocationWarning(false);
    if (!receiverId) { setSendError('Pick someone to send to'); return; }
    if (receiverId === useAuthStore.getState().user?.id) { setSendError("Can't send a kiss to yourself"); return; }
    if (!emoji) { setSendError('Choose a gift first'); return; }
    if (typeof document === 'undefined' || !document.cookie.includes('gao_logged_in=1')) { setSendError('Please login first'); return; }

    // Check if receiver has location
    try {
      const res = await fetch(`/api/v1/users/${receiverId}`, { });
      const data = await res.json();
      if (data.data && !data.data.location_lat) {
        // Receiver has no location → show warning
        setNoLocationWarning(true);
        return;
      }
    } catch { /* continue sending anyway */ }

    await doSend();
  };

  const handleSendWithAddress = async () => {
    if (addressCoords) {
      await doSend(addressCoords);
    } else {
      // Send anyway without coords — no fly animation
      await doSend();
    }
  };

  const handleAddressInput = (q: string) => {
    setCustomAddress(q);
    setAddressCoords(null);
    if (addressTimer.current) clearTimeout(addressTimer.current);
    if (q.length < 2) { setAddressSuggestions([]); return; }
    addressTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5`, { headers: { 'User-Agent': 'GaoSocial/1.0' } });
        const data = await res.json();
        setAddressSuggestions(data || []);
      } catch { setAddressSuggestions([]); }
    }, 300);
  };

  const GIFT_CATEGORIES = [
    { label: 'Love', gifts: [
      { emoji: '💋', name: 'Kiss', coins: 1 },
      { emoji: '❤️', name: 'Heart', coins: 1 },
      { emoji: '😘', name: 'Blow Kiss', coins: 5 },
      { emoji: '🥰', name: 'In Love', coins: 5 },
      { emoji: '💕', name: 'Two Hearts', coins: 10 },
      { emoji: '💖', name: 'Sparkling', coins: 20 },
      { emoji: '💝', name: 'Gift Heart', coins: 50 },
      { emoji: '❤️‍🔥', name: 'Fire Heart', coins: 100 },
    ]},
    { label: 'Flowers', gifts: [
      { emoji: '🌹', name: 'Rose', coins: 10 },
      { emoji: '🌸', name: 'Sakura', coins: 15 },
      { emoji: '💐', name: 'Bouquet', coins: 50 },
      { emoji: '🌻', name: 'Sunflower', coins: 10 },
      { emoji: '🌺', name: 'Hibiscus', coins: 15 },
      { emoji: '🪻', name: 'Lavender', coins: 20 },
    ]},
    { label: 'Luxury', gifts: [
      { emoji: '💎', name: 'Diamond', coins: 500 },
      { emoji: '👑', name: 'Crown', coins: 1000 },
      { emoji: '🏰', name: 'Castle', coins: 2000 },
      { emoji: '🛳️', name: 'Cruise', coins: 5000 },
      { emoji: '🚀', name: 'Rocket', coins: 10000 },
      { emoji: '🌍', name: 'The World', coins: 50000 },
    ]},
    { label: 'Fun', gifts: [
      { emoji: '🎁', name: 'Gift Box', coins: 5 },
      { emoji: '🧸', name: 'Teddy Bear', coins: 20 },
      { emoji: '🎂', name: 'Cake', coins: 30 },
      { emoji: '🍫', name: 'Chocolate', coins: 10 },
      { emoji: '🎵', name: 'Music', coins: 15 },
      { emoji: '⭐', name: 'Star', coins: 25 },
      { emoji: '🦋', name: 'Butterfly', coins: 50 },
      { emoji: '🌈', name: 'Rainbow', coins: 100 },
    ]},
  ];
  const [activeCategory, setActiveCategory] = useState(0);

  // Inner form — the actual content of the modal minus its outer
  // overlay / centering wrapper. Extracted as a variable so we can
  // render it either full-screen (`inline=false`, default) or
  // embedded in another container like GiftsPopup's Kiss tab
  // (`inline=true`, no backdrop, no positioning).
  const formContent = (
    <>
      {/* Header — hidden when the form is rendered inline inside
          another container (e.g. GiftsPopup) that already owns its
          own header + close button. */}
      {!hideHeader && (
        <>
          <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, #f87171, #ec4899, #f87171)' }} />
          <div className="flex items-center justify-between px-5 pt-4 pb-2">
            <h3 className="text-base font-bold text-white">Send a Kiss ✈️💋</h3>
            <button onClick={onClose} className="text-[#4a5068] cursor-pointer"><X size={18} /></button>
          </div>
        </>
      )}

      <div className="px-5 pb-5 pt-4 space-y-4">
          {/* Pick recipient — search anyone */}
          <div className="relative">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-[#4a5068] mb-1 block">Send to</label>
            {(() => {
              const allPeople = [
                ...friends.map(f => ({ id: f.id, name: f.display_name, avatar: f.avatar_url, tag: 'Friend' as const })),
                ...following.filter(f => !friends.some(fr => fr.id === f.id)).map(f => ({ ...f, tag: 'Following' as const })),
                ...searchResults.filter(s => !friends.some(fr => fr.id === s.id) && !following.some(f => f.id === s.id)).map(s => ({ ...s, tag: 'User' as const })),
              ];
              const displayPerson = selectedPerson
                || allPeople.find(p => p.id === receiverId);
              const filtered = friendSearch
                ? allPeople.filter(p => p.name.toLowerCase().includes(friendSearch.toLowerCase()))
                : allPeople;

              const handleSearchInput = (q: string) => {
                setFriendSearch(q);
                if (searchTimer.current) clearTimeout(searchTimer.current);
                if (q.length >= 2) {
                  setSearching(true);
                  searchTimer.current = setTimeout(async () => {
                    try {
                      const res = await fetch(`/api/v1/search?q=${encodeURIComponent(q)}&tab=people&limit=10`);
                      if (res.ok) {
                        const data = await res.json();
                        setSearchResults((data.data?.people || []).map((r: Record<string, unknown>) => ({
                          id: r.id as string, name: r.title as string, avatar: r.image as string | undefined,
                        })));
                      }
                    } catch {}
                    setSearching(false);
                  }, 300);
                } else {
                  setSearchResults([]);
                }
              };

              const tagColor = { Friend: '#34d399', Following: '#00d4ff', User: '#4a5068' };

              return (
                <>
                  <button
                    type="button"
                    onClick={() => setFriendDropdownOpen(!friendDropdownOpen)}
                    className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-left cursor-pointer"
                    style={{ background: 'rgba(17,19,24,0.8)', border: '1px solid rgba(255,255,255,0.07)' }}
                  >
                    {displayPerson ? (
                      <>
                        <div className="h-6 w-6 rounded-full flex items-center justify-center shrink-0 overflow-hidden text-[10px] font-bold" style={{ background: 'rgba(0,212,255,0.1)', color: '#00d4ff' }}>
                          {displayPerson.avatar ? <img src={displayPerson.avatar} alt="" className="h-full w-full object-cover" /> : displayPerson.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-white flex-1 truncate">{displayPerson.name}</span>
                      </>
                    ) : (
                      <span className="text-[#4a5068] flex-1">Search anyone...</span>
                    )}
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4a5068" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
                  </button>

                  {friendDropdownOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1 rounded-xl overflow-hidden z-50" style={{ background: 'rgba(10,11,15,0.98)', border: '1px solid rgba(0,212,255,0.12)', boxShadow: '0 8px 30px rgba(0,0,0,0.5)', maxHeight: '240px' }}>
                      <div className="px-2.5 pt-2.5 pb-1">
                        <input
                          value={friendSearch}
                          onChange={e => handleSearchInput(e.target.value)}
                          placeholder="Search people..."
                          className="w-full rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-[#4a5068] outline-none"
                          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.06)' }}
                          autoFocus
                        />
                      </div>
                      <div className="overflow-y-auto" style={{ maxHeight: '195px' }}>
                        {searching && <p className="text-center text-[10px] text-[#00d4ff] py-2">Searching...</p>}
                        {!searching && filtered.length === 0 && friendSearch.length >= 2 && (
                          <p className="text-center text-[10px] text-[#4a5068] py-3">No results</p>
                        )}
                        {!searching && filtered.length === 0 && friendSearch.length < 2 && allPeople.length === 0 && (
                          <p className="text-center text-[10px] text-[#4a5068] py-3">Type to search people</p>
                        )}
                        {filtered.map(p => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => { setReceiverId(p.id); setSelectedPerson({ id: p.id, name: p.name, avatar: p.avatar }); setFriendDropdownOpen(false); setFriendSearch(''); setSearchResults([]); }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-left cursor-pointer transition-colors hover:bg-white/5"
                            style={p.id === receiverId ? { background: 'rgba(0,212,255,0.08)' } : {}}
                          >
                            <div className="h-7 w-7 rounded-full flex items-center justify-center shrink-0 overflow-hidden text-[10px] font-bold" style={{ background: 'rgba(0,212,255,0.1)', color: '#00d4ff' }}>
                              {p.avatar ? <img src={p.avatar} alt="" className="h-full w-full object-cover" /> : p.name.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-sm text-white truncate flex-1">{p.name}</span>
                            {'tag' in p && <span className="text-[8px] font-semibold px-1.5 py-0.5 rounded-full shrink-0" style={{ background: `${tagColor[p.tag as keyof typeof tagColor]}15`, color: tagColor[p.tag as keyof typeof tagColor] }}>{p.tag}</span>}
                            {p.id === receiverId && <span className="text-[#00d4ff] text-xs shrink-0">✓</span>}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>

          {/* Gift picker — TikTok style */}
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-[#4a5068] mb-2 block">Choose a Gift</label>
            {/* Category tabs */}
            <div className="flex gap-1 mb-2">
              {GIFT_CATEGORIES.map((cat, idx) => (
                <button key={cat.label} onClick={() => setActiveCategory(idx)} className="px-2.5 py-1 rounded-lg text-[10px] font-semibold cursor-pointer transition-colors" style={activeCategory === idx ? { background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)' } : { background: 'rgba(17,19,24,0.5)', color: '#4a5068', border: '1px solid rgba(255,255,255,0.04)' }}>
                  {cat.label}
                </button>
              ))}
            </div>
            {/* Gift grid */}
            <div className="grid grid-cols-4 gap-1.5 max-h-[140px] overflow-y-auto">
              {GIFT_CATEGORIES[activeCategory].gifts.map(g => (
                <button key={g.emoji} onClick={() => setEmoji(g.emoji)} className="flex flex-col items-center gap-0.5 rounded-xl py-2 cursor-pointer transition-all" style={emoji === g.emoji ? { background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', transform: 'scale(1.05)' } : { background: 'rgba(17,19,24,0.4)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <span className="text-2xl">{g.emoji}</span>
                  <span className="text-[8px] font-medium text-[#a3adc3] truncate w-full text-center px-1">{g.name}</span>
                  <span className="text-[8px] font-bold" style={{ color: '#fbbf24' }}>🪙 {g.coins}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Message */}
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-[#4a5068] mb-1 block">Message (optional)</label>
            <input
              value={message} onChange={(e) => setMessage(e.target.value)}
              placeholder="I miss you 💕"
              maxLength={200}
              className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none placeholder:text-[#2d3548]"
              style={{ background: 'rgba(17,19,24,0.8)', border: '1px solid rgba(255,255,255,0.07)' }}
            />
          </div>

          {/* Visibility — 2-way toggle between Private and Public.
              The old "Declare" third option was removed per product
              decision. kissType stays 'kiss' throughout the UI now;
              existing declaration rows in the database still render
              on the globe, we just don't let users create new ones
              from this form. */}
          {(() => {
            type Mode = 'private' | 'public';
            const OPTIONS: Array<{ v: Mode; icon: string; label: string }> = [
              { v: 'private', icon: '🔒', label: 'Private' },
              { v: 'public',  icon: '🌍', label: 'Public'  },
            ];
            return (
              <div className="flex gap-2">
                {OPTIONS.map((o) => {
                  const active = visibility === o.v;
                  return (
                    <button
                      key={o.v}
                      onClick={() => {
                        setKissType('kiss');
                        setVisibility(o.v);
                      }}
                      className="flex-1 rounded-xl py-2 text-xs font-semibold cursor-pointer transition-all flex items-center justify-center gap-1.5"
                      style={active
                        ? { background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.28)' }
                        : { background: 'rgba(17,19,24,0.5)', color: '#4a5068', border: '1px solid rgba(255,255,255,0.04)' }}
                    >
                      <span>{o.icon}</span>
                      <span>{o.label}</span>
                    </button>
                  );
                })}
              </div>
            );
          })()}

          {/* Error */}
          {sendError && (
            <div className="rounded-xl px-3 py-2.5" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <div className="flex items-center gap-2">
                <span className="text-[12px]">⚠️</span>
                <p className="text-[11px] text-[#f87171] flex-1">{sendError}</p>
                <button onClick={() => setSendError(null)} className="text-[#f87171] cursor-pointer"><X size={12} /></button>
              </div>
              {sendError.includes('location sharing') && (
                <button
                  onClick={async () => {
                    setSendError(null);
                    try {
                      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
                        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 })
                      );
                      const res = await fetch('/api/v1/users/me', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ location_lat: pos.coords.latitude, location_lng: pos.coords.longitude }),
                      });
                      if (res.ok) {
                        toast.success('Location updated!');
                        setSendError(null);
                      } else { setSendError('Failed to save location'); }
                    } catch {
                      setSendError('Location permission denied. Please enable it in browser settings.');
                    }
                  }}
                  className="mt-2 w-full flex items-center justify-center gap-1.5 rounded-lg py-2 text-[11px] font-semibold cursor-pointer"
                  style={{ background: 'rgba(0,212,255,0.1)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.15)' }}
                >
                  📍 Share my location now
                </button>
              )}
            </div>
          )}

          {/* No location warning */}
          {noLocationWarning && (
            <div className="rounded-xl px-4 py-3 space-y-2.5" style={{ background: 'rgba(234,179,8,0.06)', border: '1px solid rgba(234,179,8,0.15)' }}>
              <div className="flex items-start gap-2">
                <span className="text-base">📍</span>
                <p className="text-[11px] text-[#EAB308] leading-relaxed">
                  This person hasn&apos;t shared their location. You can enter their address to see the flight, or send anyway — you will not see how it&apos;s delivered on the map.
                </p>
              </div>
              <div className="relative">
                <input
                  value={customAddress}
                  onChange={e => handleAddressInput(e.target.value)}
                  placeholder="Enter their city or address (optional)..."
                  className="w-full rounded-lg px-3 py-2 text-xs text-white placeholder:text-[#4a5068] outline-none"
                  style={{ background: 'rgba(17,19,24,0.8)', border: addressCoords ? '1px solid rgba(52,211,153,0.3)' : '1px solid rgba(255,255,255,0.06)' }}
                />
                {addressCoords && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[#34d399]">✓</span>}
                {addressSuggestions.length > 0 && !addressCoords && (
                  <div className="absolute left-0 right-0 top-full mt-1 rounded-lg overflow-hidden z-50" style={{ background: 'rgba(10,11,15,0.98)', border: '1px solid rgba(255,255,255,0.08)', maxHeight: '150px', overflowY: 'auto' }}>
                    {addressSuggestions.map((s, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          setCustomAddress(s.display_name.split(',').slice(0, 2).join(','));
                          setAddressCoords({ lat: parseFloat(s.lat), lng: parseFloat(s.lon) });
                          setAddressSuggestions([]);
                        }}
                        className="w-full text-left px-3 py-2 text-[10px] text-[#a3adc3] hover:bg-white/5 cursor-pointer truncate"
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                      >
                        📍 {s.display_name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSendWithAddress}
                  disabled={sending}
                  className="flex-1 rounded-lg py-2 text-[11px] font-semibold cursor-pointer disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #f87171, #ec4899)', color: 'white' }}
                >
                  {sending ? 'Sending…' : addressCoords ? `Send to ${customAddress.split(',')[0]}` : 'Send anyway'}
                </button>
                <button
                  onClick={() => setNoLocationWarning(false)}
                  className="rounded-lg px-3 py-2 text-[11px] font-semibold cursor-pointer"
                  style={{ background: 'rgba(255,255,255,0.04)', color: '#4a5068' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Send */}
          {!noLocationWarning && (
          <button onClick={handleSend} disabled={sending} className="w-full rounded-xl py-3 text-sm font-bold cursor-pointer disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #f87171, #ec4899)', color: 'white', boxShadow: '0 4px 20px rgba(236,72,153,0.3)' }}>
            {sending ? 'Sending…' : `Send ${emoji}`}
          </button>
          )}
        </div>
      </>
  );

  // Embedded rendering — GiftsPopup's Kiss tab drops this into its own
  // scroll container, so we return the raw form without an overlay or
  // full-screen centering wrapper.
  if (inline) return formContent;

  // Default full-screen modal rendering.
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
        className="relative w-full max-w-md rounded-2xl overflow-hidden"
        style={{ background: 'rgba(10,11,15,0.98)', border: '1px solid rgba(239,68,68,0.15)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {formContent}
      </motion.div>
    </div>
  );
}

// ── Gift Effects Config ──
const GIFT_EFFECTS: Record<string, { particles: string[]; bg: string; sound?: string; animation?: string; subtitle?: string }> = {
  '💋': { particles: ['💋', '❤️', '💕', '✨'], bg: 'rgba(236,72,153,0.15)', subtitle: 'Mwah!' },
  '❤️': { particles: ['❤️', '💕', '💗', '✨'], bg: 'rgba(239,68,68,0.15)', subtitle: 'Love you!' },
  '😘': { particles: ['😘', '💋', '💕', '❤️'], bg: 'rgba(236,72,153,0.15)', subtitle: 'XOXO' },
  '🥰': { particles: ['🥰', '❤️', '✨', '💖'], bg: 'rgba(251,113,133,0.15)', subtitle: 'So sweet!' },
  '💕': { particles: ['💕', '💗', '💖', '❤️'], bg: 'rgba(236,72,153,0.15)', subtitle: 'Double love!' },
  '💖': { particles: ['💖', '✨', '⭐', '💫'], bg: 'rgba(236,72,153,0.2)', animation: 'sparkle', subtitle: '✨ Sparkling!' },
  '💝': { particles: ['💝', '🎀', '✨', '💖'], bg: 'rgba(236,72,153,0.15)', subtitle: 'A gift of love!' },
  '❤️‍🔥': { particles: ['🔥', '❤️‍🔥', '💥', '✨'], bg: 'rgba(239,68,68,0.2)', animation: 'fire', subtitle: '🔥 On fire!' },
  '🌹': { particles: ['🌹', '🌸', '🪻', '✨'], bg: 'rgba(225,29,72,0.15)', subtitle: 'A rose for you' },
  '🌸': { particles: ['🌸', '🌺', '✨', '💮'], bg: 'rgba(244,114,182,0.15)', subtitle: 'Cherry blossom' },
  '💐': { particles: ['🌹', '🌸', '🌺', '🌻', '💐', '✨'], bg: 'rgba(244,114,182,0.15)', subtitle: 'Beautiful bouquet!' },
  '🌻': { particles: ['🌻', '☀️', '✨', '🌼'], bg: 'rgba(234,179,8,0.15)', subtitle: 'Sunshine!' },
  '💎': { particles: ['💎', '✨', '⭐', '💫', '🔮'], bg: 'rgba(99,102,241,0.2)', animation: 'sparkle', subtitle: '💎 Flawless!' },
  '👑': { particles: ['👑', '✨', '⭐', '💎', '🏆'], bg: 'rgba(234,179,8,0.2)', animation: 'sparkle', subtitle: '👑 Royal gift!' },
  '🏰': { particles: ['🏰', '✨', '👑', '🌟', '🎆'], bg: 'rgba(167,139,250,0.2)', animation: 'fireworks', subtitle: '🏰 A castle for you!' },
  '🛳️': { particles: ['🛳️', '🌊', '⚓', '✨', '🐬'], bg: 'rgba(59,130,246,0.15)', subtitle: '⛵ Bon voyage!' },
  '🚀': { particles: ['🚀', '⭐', '🌟', '✨', '💫', '🪐'], bg: 'rgba(99,102,241,0.2)', animation: 'fireworks', subtitle: '🚀 To the moon!' },
  '🌍': { particles: ['🌍', '✨', '⭐', '🌟', '💫', '🎆', '🪐', '🌈'], bg: 'rgba(52,211,153,0.2)', animation: 'fireworks', subtitle: '🌍 The whole world!' },
  '🎁': { particles: ['🎁', '🎀', '✨', '🎉', '🎊'], bg: 'rgba(239,68,68,0.15)', subtitle: 'Surprise!' },
  '🧸': { particles: ['🧸', '❤️', '✨', '🎀'], bg: 'rgba(180,83,9,0.15)', subtitle: 'Cuddles!' },
  '🎂': { particles: ['🎂', '🎉', '🎊', '✨', '🕯️'], bg: 'rgba(234,179,8,0.15)', animation: 'fireworks', subtitle: '🎂 Make a wish!' },
  '🍫': { particles: ['🍫', '❤️', '✨', '😋'], bg: 'rgba(120,53,15,0.15)', subtitle: 'Sweet treat!' },
  '🎵': { particles: ['🎵', '🎶', '🎤', '✨', '🎧'], bg: 'rgba(167,139,250,0.15)', subtitle: '🎵 A song for you!' },
  '⭐': { particles: ['⭐', '✨', '🌟', '💫'], bg: 'rgba(234,179,8,0.15)', animation: 'sparkle', subtitle: 'You are a star!' },
  '🦋': { particles: ['🦋', '🌸', '✨', '🌺', '🌈'], bg: 'rgba(99,102,241,0.15)', subtitle: '🦋 Beautiful!' },
  '🌈': { particles: ['🌈', '✨', '⭐', '🦋', '☀️', '🌸'], bg: 'rgba(52,211,153,0.15)', animation: 'fireworks', subtitle: '🌈 Over the rainbow!' },
};

// Precomputed at module level — avoids impure Math.random() calls during render
const SHOWER_PARTICLES = Array.from({ length: 20 }, (_, i) => ({
  left: `${Math.random() * 100}%`,
  x: (Math.random() - 0.5) * 100,
  duration: 3 + Math.random() * 2,
  repeatDelay: Math.random() * 2,
  delay: i * 0.15,
}));
const FIREWORKS_BURSTS = Array.from({ length: 5 }, (_, i) => ({
  left: `${20 + Math.random() * 60}%`,
  top: `${20 + Math.random() * 40}%`,
  delay: 0.5 + i * 0.4,
}));
const ORBIT_PARTICLES = Array.from({ length: 12 }, (_, i) => ({
  x: (Math.random() - 0.5) * 250,
  y: -100 - Math.random() * 150,
  duration: 2.5 + Math.random() * 1.5,
  repeatDelay: Math.random(),
  delay: i * 0.2,
}));
const FIRE_DURATIONS = Array.from({ length: 5 }, () => 0.8 + Math.random() * 0.5);

// ── Kiss Reveal Popup ──
function KissRevealPopup({ kiss, onClose, currentUserId, onSendBack }: { kiss: Kiss; onClose: () => void; currentUserId?: string; onSendBack?: (toId: string) => void }) {
  const senderDisplay = currentUserId === kiss.sender_id ? 'You' : kiss.sender_name;
  const receiverDisplay = currentUserId === kiss.receiver_id ? 'You' : kiss.receiver_name;
  const canSendBack = currentUserId === kiss.receiver_id && onSendBack;
  const fx = GIFT_EFFECTS[kiss.emoji] || GIFT_EFFECTS['💋'];
  const isFireworks = fx.animation === 'fireworks';
  const isSparkle = fx.animation === 'sparkle';
  const isFire = fx.animation === 'fire';

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70" />

      {/* Full-screen particle shower */}
      {SHOWER_PARTICLES.map((p, i) => (
        <motion.span
          key={`shower-${i}`}
          className="absolute text-3xl pointer-events-none"
          style={{ left: p.left, top: '-5%' }}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: [0, 1, 1, 0], y: ['0vh', '110vh'], x: p.x }}
          transition={{ duration: p.duration, delay: p.delay, repeat: Infinity, repeatDelay: p.repeatDelay }}
        >
          {fx.particles[i % fx.particles.length]}
        </motion.span>
      ))}

      {/* Fireworks bursts */}
      {isFireworks && FIREWORKS_BURSTS.map((burst, i) => (
        <motion.div
          key={`fw-${i}`}
          className="absolute pointer-events-none"
          style={{ left: burst.left, top: burst.top }}
          initial={{ scale: 0, opacity: 1 }}
          animate={{ scale: [0, 2.5, 3], opacity: [1, 1, 0] }}
          transition={{ duration: 1.5, delay: burst.delay, repeat: Infinity, repeatDelay: 2 }}
        >
          {Array.from({ length: 8 }).map((_, j) => (
            <motion.span
              key={j}
              className="absolute text-xl"
              style={{ transform: `rotate(${j * 45}deg)` }}
              animate={{ x: [0, Math.cos(j * 45 * Math.PI / 180) * 60], y: [0, Math.sin(j * 45 * Math.PI / 180) * 60], opacity: [1, 0] }}
              transition={{ duration: 1, delay: burst.delay }}
            >
              {fx.particles[j % fx.particles.length]}
            </motion.span>
          ))}
        </motion.div>
      ))}

      <motion.div
        initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }}
        transition={{ type: 'spring', damping: 15, stiffness: 200 }}
        className="relative flex flex-col items-center gap-4 px-12 py-10 rounded-3xl overflow-hidden w-full max-w-sm"
        style={{ background: 'rgba(10,11,15,0.95)', border: '1px solid rgba(236,72,153,0.2)', boxShadow: `0 0 80px ${fx.bg}` }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Background glow */}
        <div className="absolute inset-0 rounded-3xl" style={{ background: `radial-gradient(circle at 50% 30%, ${fx.bg}, transparent 70%)` }} />

        {/* Main emoji — with special animations */}
        <motion.div
          initial={{ scale: 0, rotate: -30 }}
          animate={isFire
            ? { scale: [0, 1.3, 1.1, 1.3, 1.1], rotate: [-30, 0, -3, 3, 0] }
            : isSparkle
              ? { scale: [0, 1.4, 1.2, 1.3, 1.2], rotate: [-30, 5, -5, 3, 0] }
              : { scale: [0, 1.3, 1], rotate: [-30, 5, 0] }
          }
          transition={isFire || isSparkle
            ? { duration: 2, ease: 'easeInOut', repeat: Infinity, repeatType: 'reverse' }
            : { delay: 0.2, duration: 0.6, ease: 'easeOut' }
          }
          className="relative text-8xl z-10"
        >
          {kiss.emoji}
          {/* Sparkle ring around emoji */}
          {isSparkle && (
            <motion.div
              className="absolute inset-0 flex items-center justify-center"
              animate={{ rotate: 360 }}
              transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
            >
              {Array.from({ length: 6 }).map((_, i) => (
                <motion.span key={i} className="absolute text-lg" style={{ transform: `rotate(${i * 60}deg) translateY(-50px)` }}
                  animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
                  transition={{ duration: 1.5, delay: i * 0.25, repeat: Infinity }}
                >✨</motion.span>
              ))}
            </motion.div>
          )}
          {/* Fire effect */}
          {isFire && (
            <>
              {FIRE_DURATIONS.map((duration, i) => (
                <motion.span key={i} className="absolute text-2xl" style={{ bottom: 0, left: `${10 + i * 18}%` }}
                  animate={{ y: [0, -30, -50], opacity: [0.8, 0.5, 0], scale: [1, 1.3, 0.5] }}
                  transition={{ duration, delay: i * 0.15, repeat: Infinity }}
                >🔥</motion.span>
              ))}
            </>
          )}
        </motion.div>

        {/* ── Cinematic Scene — chibi characters run & hug ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="relative z-10 w-full"
        >
          <div className="relative h-48 w-full flex items-end justify-center overflow-hidden">
            {/* Ground line */}
            <div className="absolute bottom-6 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(236,72,153,0.2) 30%, rgba(0,212,255,0.2) 70%, transparent)' }} />

            {/* Quote */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0, 1, 1, 0] }}
              transition={{ duration: 3, times: [0, 0.1, 0.25, 0.75, 1], ease: 'easeInOut' }}
              className="absolute top-0 left-0 right-0 text-center text-[10px] italic text-[#4a5068] pointer-events-none"
            >
              distance means nothing when someone means everything
            </motion.p>

            {/* ── Sender chibi — runs from far left to receiver ── */}
            <motion.div
              initial={{ x: -130 }}
              animate={{ x: [-130, -40, 30, 65] }}
              transition={{ duration: 3, ease: 'easeOut', times: [0, 0.4, 0.8, 1] }}
              className="absolute bottom-6 z-10 flex flex-col items-center"
            >
              {/* Running bounce */}
              <motion.div
                animate={{ y: [0, -6, 0, -6, 0, -3, 0, 0] }}
                transition={{ duration: 2.8, ease: 'easeInOut', times: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.7, 1] }}
                className="flex flex-col items-center"
              >
                {/* Head = avatar */}
                <div className="h-12 w-12 rounded-full overflow-hidden flex items-center justify-center text-sm font-bold"
                  style={{ background: 'rgba(236,72,153,0.15)', border: '2.5px solid #ec4899', color: '#ec4899', boxShadow: '0 0 15px rgba(236,72,153,0.3)' }}>
                  {kiss.sender_avatar
                    ? <img src={kiss.sender_avatar} alt="" className="w-full h-full object-cover" />
                    : (kiss.sender_name || '?').charAt(0).toUpperCase()}
                </div>
                {/* Body — SVG stick figure */}
                <svg width="32" height="36" viewBox="0 0 32 36" className="-mt-1">
                  {/* Body */}
                  <line x1="16" y1="2" x2="16" y2="18" stroke="#ec4899" strokeWidth="2.5" strokeLinecap="round"/>
                  {/* Arms — running pose, then open for hug */}
                  <motion.line x1="16" y1="8" x2="6" y2="4" stroke="#ec4899" strokeWidth="2" strokeLinecap="round"
                    animate={{ x2: [6, 4, 6, 4, 2], y2: [4, 12, 4, 12, 2] }}
                    transition={{ duration: 2.8, times: [0, 0.15, 0.3, 0.7, 1] }}/>
                  <motion.line x1="16" y1="8" x2="26" y2="12" stroke="#ec4899" strokeWidth="2" strokeLinecap="round"
                    animate={{ x2: [26, 28, 26, 28, 30], y2: [12, 4, 12, 4, 2] }}
                    transition={{ duration: 2.8, times: [0, 0.15, 0.3, 0.7, 1] }}/>
                  {/* Legs — running */}
                  <motion.line x1="16" y1="18" x2="10" y2="34" stroke="#ec4899" strokeWidth="2" strokeLinecap="round"
                    animate={{ x2: [10, 20, 10, 20, 12] }}
                    transition={{ duration: 2.8, times: [0, 0.15, 0.3, 0.7, 1] }}/>
                  <motion.line x1="16" y1="18" x2="22" y2="34" stroke="#ec4899" strokeWidth="2" strokeLinecap="round"
                    animate={{ x2: [22, 12, 22, 12, 20] }}
                    transition={{ duration: 2.8, times: [0, 0.15, 0.3, 0.7, 1] }}/>
                </svg>
              </motion.div>
              <span className="text-[8px] font-semibold text-[#ec4899]">{senderDisplay}</span>
            </motion.div>

            {/* ── Receiver chibi — stands still, waiting ── */}
            <motion.div
              initial={{ x: 80, opacity: 0 }}
              animate={{ x: 80, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="absolute bottom-6 z-10 flex flex-col items-center"
            >
              <motion.div
                animate={{ y: [0, -2, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                className="flex flex-col items-center"
              >
                <div className="h-12 w-12 rounded-full overflow-hidden flex items-center justify-center text-sm font-bold"
                  style={{ background: 'rgba(0,212,255,0.15)', border: '2.5px solid #00d4ff', color: '#00d4ff', boxShadow: '0 0 15px rgba(0,212,255,0.3)' }}>
                  {kiss.receiver_avatar
                    ? <img src={kiss.receiver_avatar} alt="" className="w-full h-full object-cover" />
                    : (kiss.receiver_name || '?').charAt(0).toUpperCase()}
                </div>
                {/* Standing pose — arms at side, slight wave when sender arrives */}
                <svg width="32" height="36" viewBox="0 0 32 36" className="-mt-1" style={{ transform: 'scaleX(-1)' }}>
                  <line x1="16" y1="2" x2="16" y2="18" stroke="#00d4ff" strokeWidth="2.5" strokeLinecap="round"/>
                  {/* Arms: idle → open for hug */}
                  <motion.line x1="16" y1="8" x2="6" y2="14" stroke="#00d4ff" strokeWidth="2" strokeLinecap="round"
                    animate={{ x2: [6, 6, 6, 2], y2: [14, 14, 14, 3] }}
                    transition={{ duration: 3, times: [0, 0.7, 0.85, 1], ease: 'easeOut' }}/>
                  <motion.line x1="16" y1="8" x2="26" y2="14" stroke="#00d4ff" strokeWidth="2" strokeLinecap="round"
                    animate={{ x2: [26, 26, 26, 30], y2: [14, 14, 14, 3] }}
                    transition={{ duration: 3, times: [0, 0.7, 0.85, 1], ease: 'easeOut' }}/>
                  {/* Legs: standing still */}
                  <line x1="16" y1="18" x2="11" y2="34" stroke="#00d4ff" strokeWidth="2" strokeLinecap="round"/>
                  <line x1="16" y1="18" x2="21" y2="34" stroke="#00d4ff" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </motion.div>
              <span className="text-[8px] font-semibold text-[#00d4ff]">{receiverDisplay}</span>
            </motion.div>

            {/* ── Glow when they meet ── */}
            <motion.div
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: [0, 0, 0.8, 0.4], scale: [0, 0, 1.5, 2] }}
              transition={{ duration: 3.5, times: [0, 0.7, 0.85, 1], ease: 'easeOut' }}
              className="absolute w-24 h-24 rounded-full"
              style={{ bottom: '3rem', right: '20%', background: 'radial-gradient(circle, rgba(236,72,153,0.5), rgba(0,212,255,0.3), transparent 70%)' }}
            />

            {/* Particle burst when they meet */}
            {Array.from({ length: 12 }).map((_, i) => {
              const angle = (i / 12) * Math.PI * 2;
              return (
                <motion.span key={`hug-${i}`}
                  className="absolute text-lg pointer-events-none z-30"
                  style={{ bottom: '5rem', right: '25%' }}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: [0, 1, 0], x: [0, Math.cos(angle) * 80], y: [0, Math.sin(angle) * 80 - 20], scale: [0, 1.2, 0] }}
                  transition={{ delay: 2.9 + i * 0.04, duration: 1.2, ease: 'easeOut' }}
                >{fx.particles[i % fx.particles.length]}</motion.span>
              );
            })}
          </div>
        </motion.div>

        {/* Subtitle */}
        <motion.p initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.4 }}
          className="text-base font-bold z-10" style={{ color: '#ec4899' }}>{fx.subtitle}</motion.p>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.6 }} className="z-10 flex flex-col items-center">
          <p className="text-base font-bold text-white text-center">
            From <span style={{ color: '#f87171' }}>{senderDisplay}</span>
          </p>
          {kiss.message && <p className="text-sm text-[#a3adc3] text-center mt-2 max-w-xs">{kiss.message}</p>}
          <p className="text-[10px] text-[#4a5068] text-center mt-2">
            {senderDisplay} → {receiverDisplay}
          </p>
          {canSendBack && (
            <button
              onClick={() => { onSendBack(kiss.sender_id); onClose(); }}
              className="mt-4 flex items-center justify-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold cursor-pointer transition-transform active:scale-95"
              style={{ background: 'linear-gradient(135deg, #f87171, #ec4899)', color: 'white', boxShadow: '0 4px 16px rgba(236,72,153,0.3)' }}
            >
              💋 Send Back
            </button>
          )}
        </motion.div>

        {/* Orbiting particles around card */}
        {ORBIT_PARTICLES.map((p, i) => (
          <motion.span
            key={`orbit-${i}`}
            className="absolute text-xl pointer-events-none z-0"
            initial={{ opacity: 0 }}
            animate={{
              opacity: [0, 0.8, 0],
              x: [0, p.x],
              y: [0, p.y],
              scale: [0.5, 1.2, 0.3],
            }}
            transition={{ duration: p.duration, delay: p.delay, repeat: Infinity, repeatDelay: p.repeatDelay }}
          >
            {fx.particles[i % fx.particles.length]}
          </motion.span>
        ))}
      </motion.div>
    </div>
  );
}

// ── Flight HUD Overlay ──
function generateFlightCode(senderName: string, receiverName: string): string {
  const s = (senderName || 'X').charAt(0).toUpperCase();
  const r = (receiverName || 'Y').charAt(0).toUpperCase();
  const num = Math.abs(senderName.length * 37 + receiverName.length * 73) % 900 + 100;
  return `${s}${r}${num}`;
}

function FlightHUD({ from, to, progress, senderName, receiverName, emoji, turbulence }: {
  from: string; to: string; progress: number; senderName: string; receiverName: string; emoji: string; turbulence?: boolean;
}) {
  const pct = Math.round(progress * 100);
  const remaining = Math.max(0, Math.round((1 - progress) * 25));
  const flightCode = generateFlightCode(senderName, receiverName);
  return (
    <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 pointer-events-none" style={{ fontFamily: 'Inter, system-ui, monospace' }}>
      {/* Flight info card */}
      <div className="rounded-2xl px-5 py-3 flex flex-col items-center gap-2 min-w-[280px]" style={{ background: 'rgba(10,11,15,0.85)', backdropFilter: 'blur(16px)', border: '1px solid rgba(236,72,153,0.2)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
        {/* Flight title */}
        <div className="flex items-center gap-2 w-full">
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(236,72,153,0.15)', color: '#ec4899' }}>FLIGHT</span>
          <span className="text-[11px] font-bold text-white tracking-wider">Love Air {flightCode}</span>
          <span className="text-[9px] text-[#4a5068] ml-auto">{emoji}</span>
        </div>
        {/* Route */}
        <div className="flex items-center gap-3 w-full">
          <div className="text-right flex-1">
            <p className="text-[10px] text-[#4a5068] uppercase tracking-wider">From</p>
            <p className="text-xs font-bold text-white truncate">{senderName}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-[#ec4899]" />
            <div className="w-12 h-px" style={{ background: 'linear-gradient(90deg, #ec4899, #f87171)' }} />
            <span className="text-sm">{emoji === '💋' ? '✈️' : emoji}</span>
            <div className="w-12 h-px" style={{ background: 'linear-gradient(90deg, #f87171, #ec4899)' }} />
            <div className="h-1.5 w-1.5 rounded-full bg-[#ec4899]" />
          </div>
          <div className="flex-1">
            <p className="text-[10px] text-[#4a5068] uppercase tracking-wider">To</p>
            <p className="text-xs font-bold text-white truncate">{receiverName}</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full">
          <div className="h-1 rounded-full overflow-hidden w-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #ec4899, #f87171)' }} />
          </div>
        </div>

        {/* Turbulence warning */}
        {turbulence && (
          <div className="flex items-center gap-1.5 w-full rounded-lg px-2 py-1" style={{ background: 'rgba(234,179,8,0.12)', border: '1px solid rgba(234,179,8,0.25)' }}>
            <span className="text-sm">⚠️</span>
            <span className="text-[9px] font-semibold" style={{ color: '#EAB308' }}>TURBULENCE — Fasten seatbelt</span>
          </div>
        )}

        {/* Stats */}
        <div className="flex items-center justify-between w-full text-[9px] text-[#4a5068]">
          <span>{from}</span>
          <span className="text-[#ec4899] font-semibold">{pct}% · ~{remaining}s</span>
          <span>{to}</span>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ──
export default function KissGlobe() {
  const { map } = useMap();
  const currentUserId = useAuthStore(s => s.user?.id);
  const isAuthed = useAuthStore(s => s.isAuthed);
  // Kiss send modal is opened DIRECTLY (bypassing the tabbed Gifts
  // popup) only by the send-back flow in KissRevealPopup. The Gifts
  // chip opens the tabbed popup instead, which embeds SendKissModal
  // inline in its Kiss tab. Both paths route through useGiftsPopupStore.
  const showSendModal = useGiftsPopupStore(s => s.isKissModalOpen);
  const sendBackTo = useGiftsPopupStore(s => s.kissSendBackTo);
  const closeKissModal = useGiftsPopupStore(s => s.closeKissModal);
  const isHeartBuilderOpen = useGiftsPopupStore(s => s.isHeartBuilderOpen);
  const closeHeartBuilder = useGiftsPopupStore(s => s.closeHeartBuilder);
  const isCoupleBuilderOpen = useGiftsPopupStore(s => s.isCoupleBuilderOpen);
  const closeCoupleBuilder = useGiftsPopupStore(s => s.closeCoupleBuilder);
  const isBirthdayCapsuleOpen = useGiftsPopupStore(s => s.isBirthdayCapsuleOpen);
  const closeBirthdayCapsule = useGiftsPopupStore(s => s.closeBirthdayCapsule);
  const [showAuthGate, setShowAuthGate] = useState(false);
  const [revealKiss, setRevealKiss] = useState<Kiss | null>(null);
  const [flightHUD, setFlightHUD] = useState<{ from: string; to: string; progress: number; senderName: string; receiverName: string; emoji: string; turbulence?: boolean } | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const animFrameRef = useRef<Map<string, number>>(new Map());
  const replayedRef = useRef<Set<string>>(new Set());
  const activeFollowRef = useRef<string | null>(null); // Only 1 kiss controls camera at a time

  const giftLayerOn = useMapStore(s => s.activeLayers.has('gift'));
  const searchParams = useSearchParams();
  const kissParam = searchParams.get('kiss');

  // Auto-enable gift layer when navigating with ?kiss= param
  useEffect(() => {
    if (kissParam && !useMapStore.getState().activeLayers.has('gift')) {
      useMapStore.getState().toggleLayer('gift');
    }
  }, [kissParam]);

  // Auto-dismiss auth gate if user becomes authenticated (e.g. hydration completes or login succeeds)
  useEffect(() => {
    if (isAuthed && showAuthGate) setShowAuthGate(false);
  }, [isAuthed, showAuthGate]);

  // Any caller (Gifts chip, Send-back button) can open the modal via
  // the store; here we intercept the open when the viewer isn't
  // authed, close the modal, and show the sign-in gate instead.
  useEffect(() => {
    if (!showSendModal) return;
    const hasCookie = typeof document !== 'undefined' && document.cookie.includes('gao_logged_in=1');
    if (!isAuthed && !hasCookie) {
      closeKissModal();
      setShowAuthGate(true);
    }
  }, [showSendModal, isAuthed, closeKissModal]);

  const { data, mutate } = useSWR<{ data: Kiss[] }>(giftLayerOn ? '/api/v1/kisses?limit=30' : null, fetcher, { refreshInterval: 30000 });
  const kisses = data?.data ?? [];

  // ── Place static gift marker (no animation) ──
  const placeGiftMarker = useCallback((kiss: Kiss) => {
    if (!map || markersRef.current.has(kiss.id)) return;

    const isReceiver = currentUserId === kiss.receiver_id;
    const isSender = currentUserId === kiss.sender_id;
    const to: [number, number] = [kiss.receiver_lng, kiss.receiver_lat];
    const displayName = isReceiver ? 'You' : (kiss.receiver_name || '?');
    const receiverInitial = displayName.charAt(0).toUpperCase();
    const hasOpened = kiss.opened;

    const el = document.createElement('div');
    el.style.cssText = 'cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px;';

    if (!hasOpened) {
      // Unopened: receiver avatar with "waiting" animation
      el.innerHTML = `
        <div style="position:relative;">
          <div style="
            width:44px;height:44px;border-radius:50%;
            display:flex;align-items:center;justify-content:center;
            background:rgba(236,72,153,0.15);
            border:2.5px solid #ec4899;
            box-shadow:0 0 16px rgba(236,72,153,0.3);
            font-size:16px;font-weight:700;color:#ec4899;
            overflow:hidden;
            animation:kiss-receiver-pulse 2s ease-in-out infinite;
          ">
            ${kiss.receiver_avatar
              ? `<img src="${sanitizeUrl(kiss.receiver_avatar)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`
              : receiverInitial
            }
          </div>
          <span style="
            position:absolute;-top:6px;right:-6px;
            font-size:18px;
            animation:kiss-wave 1.5s ease-in-out infinite;
          ">🙌</span>
        </div>
        <span style="
          font-size:9px;font-weight:600;color:#ec4899;
          background:rgba(10,11,15,0.8);backdrop-filter:blur(4px);
          padding:1px 6px;border-radius:8px;
          white-space:nowrap;max-width:70px;overflow:hidden;text-overflow:ellipsis;
        ">${escapeHtml(displayName)}</span>
        <style>
          @keyframes kiss-receiver-pulse {
            0%,100% { box-shadow:0 0 16px rgba(236,72,153,0.3); }
            50% { box-shadow:0 0 24px rgba(236,72,153,0.6); }
          }
          @keyframes kiss-wave {
            0%,100% { transform:rotate(0deg); }
            25% { transform:rotate(15deg); }
            75% { transform:rotate(-15deg); }
          }
        </style>
      `;
    } else {
      // Opened: show the emoji with a happy glow
      el.innerHTML = `
        <div style="
          width:40px;height:40px;border-radius:50%;
          display:flex;align-items:center;justify-content:center;
          background:rgba(236,72,153,0.1);
          border:2px solid rgba(236,72,153,0.3);
          font-size:22px;
        ">${kiss.emoji}</div>
        <span style="
          font-size:8px;font-weight:600;color:#a3adc3;
          background:rgba(10,11,15,0.7);
          padding:1px 5px;border-radius:6px;
          white-space:nowrap;
        ">${escapeHtml(displayName)}</span>
      `;
    }

    el.onclick = () => {
      if (isReceiver && !hasOpened) {
        setRevealKiss(kiss);
        fetch('/api/v1/kisses', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: kiss.id }),
        }).then(() => {
          mutate();
          // Update marker to opened state
          el.querySelector('div')!.innerHTML = `<span style="font-size:22px">${escapeHtml(kiss.emoji)}</span>`;
        });
      } else if (isReceiver || isSender) {
        setRevealKiss(kiss);
      }
    };

    const marker = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat(to).addTo(map);
    markersRef.current.set(kiss.id, marker);
  }, [map, currentUserId, mutate]);

  // ── Play flight animation (only when explicitly triggered) ──
  const playFlightAnimation = useCallback(async (kiss: Kiss) => {
    if (!map) return;
    // Skip animation if no valid destination (receiver_lat = 0 means "send anyway")
    if (!kiss.receiver_lat || !kiss.receiver_lng) { placeGiftMarker(kiss); return; }

    // Cancel ALL existing flights first — only 1 flight at a time
    animFrameRef.current.forEach(f => { clearTimeout(f); cancelAnimationFrame(f); });
    animFrameRef.current.clear();
    // Remove plane markers, dove endpoint pulse dots, and dove landmark pins from any previous flight
    const doveTransientPrefixes = ['plane_', 'dove-start-', 'dove-end-', 'dove-lm-'];
    const isTransient = (key: string) => doveTransientPrefixes.some(p => key.startsWith(p));
    markersRef.current.forEach((marker, key) => { if (isTransient(key)) marker.remove(); });
    Array.from(markersRef.current.keys()).forEach(key => { if (isTransient(key)) markersRef.current.delete(key); });
    // Clean up all arc/trail layers (incl. dove's white casing)
    kisses.forEach(k => {
      ['kiss-arc-cas-', 'kiss-arc-', 'kiss-trail-'].forEach(prefix => {
        try { if (map.getLayer(`${prefix}${k.id}`)) map.removeLayer(`${prefix}${k.id}`); } catch {}
      });
      ['kiss-arc-', 'kiss-trail-'].forEach(prefix => {
        try { if (map.getSource(`${prefix}${k.id}`)) map.removeSource(`${prefix}${k.id}`); } catch {}
      });
    });
    setFlightHUD(null);

    // Set this as the active followed kiss
    activeFollowRef.current = kiss.id;

    const from: [number, number] = [kiss.sender_lng, kiss.sender_lat];
    const to: [number, number] = [kiss.receiver_lng, kiss.receiver_lat];

    const isGlobe = useMapStore.getState().viewMode === '3d';

    // ── Vehicle selection by geographic distance ──
    // Distance drives everything: which messenger appears, how long the
    // flight lasts, how the camera frames the trip, arc resolution, and
    // per-frame motion in the fly loop below.
    const distanceKm = haversineKm(kiss.sender_lat, kiss.sender_lng, kiss.receiver_lat, kiss.receiver_lng);
    const vehicle = pickVehicle(distanceKm);

    // Dove: heart sits in the CENTRE of the current viewport, size ≈ 70%
    // of viewport width so it's nearly as big as the visible globe (or
    // city on close-in views). The camera is never touched — user's view
    // stays as-is and the bird traces a huge heart across whatever they
    // are looking at.
    let doveHeartKm = 3; // fallback
    let doveHeartCentre: [number, number] = from;
    if (vehicle.kind === 'dove') {
      try {
        const b = map.getBounds();
        const c = map.getCenter();
        doveHeartCentre = [c.lng, c.lat];
        const midLat = (b.getNorth() + b.getSouth()) / 2;
        const viewWidthKm = haversineKm(midLat, b.getWest(), midLat, b.getEast());
        doveHeartKm = Math.max(0.5, viewWidthKm * 0.7);
      } catch {}
    }

    // Opening zoom before the cinematic camera takes over — non-dove
    // vehicles use this. Sits just below cruise so takeoff already shows
    // city-scale detail (no big ramp-in from a wide regional view).
    // Dove uses fitBounds instead.
    const openZoom = isGlobe ? 5 : Math.max(11, vehicle.cruiseZoom - 1);

    // Reverse geocode for HUD only (no longer influences vehicle choice)
    let senderCity = `${kiss.sender_lat.toFixed(1)}°`;
    let receiverCity = `${kiss.receiver_lat.toFixed(1)}°`;
    try {
      const [sRes, rRes] = await Promise.all([
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${kiss.sender_lat}&lon=${kiss.sender_lng}&zoom=10`, { headers: { 'User-Agent': 'GaoSocial/1.0' } }).then(r => r.json()).catch(() => null),
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${kiss.receiver_lat}&lon=${kiss.receiver_lng}&zoom=10`, { headers: { 'User-Agent': 'GaoSocial/1.0' } }).then(r => r.json()).catch(() => null),
      ]);
      if (sRes?.address) senderCity = sRes.address.city || sRes.address.town || sRes.address.state || sRes.address.country || senderCity;
      if (rRes?.address) receiverCity = rRes.address.city || rRes.address.town || rRes.address.state || rRes.address.country || receiverCity;
    } catch {}

    // Dove: heart-shape parametric path centred on the viewport centre
    // and sized to ~70% of viewport width.
    // Every other vehicle uses the great-circle arc.
    const arcPoints = vehicle.kind === 'dove'
      ? generateHeartPath(from, to, doveHeartCentre, doveHeartKm)
      : interpolateGreatCircle(from, to, vehicle.arcSteps);

    // Remove existing gift marker — will re-place when plane arrives
    const existingGift = markersRef.current.get(kiss.id);
    if (existingGift) { existingGift.remove(); markersRef.current.delete(kiss.id); }

    // Animation element — vehicle SVG chosen by distance.
    // maplibre applies its OWN positioning transform to planeEl, so we
    // put motion offsets / altitude scale on an INNER wrapper. Otherwise
    // our transform would fight maplibre's and either be overwritten
    // (silent no-op) or throw the marker off-screen.
    const planeEl = document.createElement('div');
    planeEl.style.cssText = `pointer-events:none;width:${vehicle.size}px;height:${vehicle.size}px;`;
    const innerEl = document.createElement('div');
    innerEl.style.cssText = `width:100%;height:100%;`;
    innerEl.innerHTML = buildVehicleSvg(vehicle.kind, kiss.id);
    planeEl.appendChild(innerEl);
    // rotation=0 means pointing up (North). setRotation(bearing) points it in travel direction.
    const planeMarker = new maplibregl.Marker({ element: planeEl, anchor: 'center', rotationAlignment: 'map' })
      .setLngLat(from)
      .addTo(map);
    markersRef.current.set(`plane_${kiss.id}`, planeMarker);

    // ── Draw flight path ──
    // Dove: SOLID thick pink line with WHITE casing underneath so the
    //       route is unmistakable on satellite tiles (green/brown/blue).
    // Others: dashed line as before.
    // Layers are only added once the map's style is fully loaded —
    // otherwise addSource/addLayer can silently fail on cold-start.
    const lineId = `kiss-arc-${kiss.id}`;
    const casingId = `kiss-arc-cas-${kiss.id}`;
    const addArcLayers = () => {
      if (!map.getSource(lineId)) {
        map.addSource(lineId, { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: arcPoints }, properties: {} } });
      }
      if (vehicle.kind === 'dove') {
        if (!map.getLayer(casingId)) {
          map.addLayer({ id: casingId, type: 'line', source: lineId,
            paint: { 'line-color': '#ffffff', 'line-width': 6, 'line-opacity': 0.8 },
            layout: { 'line-cap': 'round', 'line-join': 'round' } });
        }
        if (!map.getLayer(lineId)) {
          map.addLayer({ id: lineId, type: 'line', source: lineId,
            paint: { 'line-color': vehicle.lineColor, 'line-width': 3.5, 'line-opacity': 1 },
            layout: { 'line-cap': 'round', 'line-join': 'round' } });
        }
      } else {
        if (!map.getLayer(lineId)) {
          const arcPaint: Record<string, unknown> = {
            'line-color': vehicle.lineColor,
            'line-width': vehicle.lineWidth,
            'line-opacity': 0.7,
          };
          if (vehicle.lineDash) arcPaint['line-dasharray'] = vehicle.lineDash;
          map.addLayer({ id: lineId, type: 'line', source: lineId, paint: arcPaint });
        }
      }
    };
    if (map.isStyleLoaded()) addArcLayers();
    else map.once('idle', addArcLayers);

    // ── Dove endpoint markers — pulsing pink dots at sender + receiver
    // so the viewer can see exactly where the route starts and ends.
    // Attached as maplibre Markers so they follow zoom/pan correctly.
    const doveEndpointKeys: string[] = [];
    if (vehicle.kind === 'dove') {
      const makePulseDot = (): HTMLDivElement => {
        const el = document.createElement('div');
        el.style.cssText = `pointer-events:none;width:20px;height:20px;position:relative;`;
        el.innerHTML = `
          <div style="position:absolute;inset:0;border-radius:50%;background:#ef4444;box-shadow:0 0 0 3px #fff, 0 2px 6px rgba(0,0,0,0.4);"></div>
          <div style="position:absolute;inset:-8px;border-radius:50%;border:2px solid #ef4444;opacity:0;animation:kissPulse 1.6s ease-out infinite;"></div>
        `;
        return el;
      };
      // Inject the pulse keyframes once (idempotent).
      if (!document.getElementById('kiss-pulse-style')) {
        const st = document.createElement('style');
        st.id = 'kiss-pulse-style';
        st.textContent = '@keyframes kissPulse { 0% { transform: scale(0.6); opacity: 0.9; } 100% { transform: scale(1.8); opacity: 0; } }';
        document.head.appendChild(st);
      }
      const startKey = `dove-start-${kiss.id}`;
      const endKey = `dove-end-${kiss.id}`;
      const startMarker = new maplibregl.Marker({ element: makePulseDot(), anchor: 'center' }).setLngLat(from).addTo(map);
      const endMarker = new maplibregl.Marker({ element: makePulseDot(), anchor: 'center' }).setLngLat(to).addTo(map);
      markersRef.current.set(startKey, startMarker);
      markersRef.current.set(endKey, endMarker);
      doveEndpointKeys.push(startKey, endKey);
    }

    // Trail line (shows where the vehicle has been — solid, vehicle-coloured).
    const trailId = `kiss-trail-${kiss.id}`;
    const trailCoords: [number, number][] = [];
    const addTrailLayers = () => {
      if (!map.getSource(trailId)) {
        map.addSource(trailId, { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [] }, properties: {} } });
        map.addLayer({ id: trailId, type: 'line', source: trailId,
          paint: { 'line-color': vehicle.lineColor, 'line-width': vehicle.kind === 'dove' ? 3.5 : 2.5, 'line-opacity': 0.9 },
          layout: { 'line-cap': 'round', 'line-join': 'round' } });
      }
    };
    if (map.isStyleLoaded()) addTrailLayers();
    else map.once('idle', addTrailLayers);

    const isFollowing = () => activeFollowRef.current === kiss.id;

    // ── Buttery smooth flight — direct camera control each frame ──
    // Dove: duration scales with heart size — a small city heart takes
    // ~16 s, a nearly-globe-spanning heart takes up to ~45 s so the shape
    // has room to breathe and the drawing feels intentional.
    const flightMs = vehicle.kind === 'dove'
      ? Math.min(45000, 15000 + Math.sqrt(doveHeartKm) * 250)
      : vehicle.durationMs;
    let t0 = 0;
    // Camera state — lerped every frame for zero jitter
    let camLng = from[0], camLat = from[1], camZoom = 9, camPitch = 0, camBearing = 0;
    let planeLng = from[0], planeLat = from[1], planeBrg = 0;

    // Turbulence zones — only for airliners; other vehicles use their own
    // signature motion (dove flutter, balloon sway, rocket ramrod) below.
    const turbZones = vehicle.kind === 'plane' ? Array.from({ length: 2 + Math.floor(Math.random() * 2) }, () => {
      const center = 0.15 + Math.random() * 0.6;
      const width = 0.03 + Math.random() * 0.04;
      return { start: center - width, end: center + width };
    }) : [];
    let turbulenceActive = false;

    function fly(ts: number) {
      if (!t0) t0 = ts;
      const elapsed = ts - t0;
      // Ease-in-out-cubic for natural motion
      const lin = Math.min(elapsed / flightMs, 1);
      const t = lin < 0.5 ? 4 * lin * lin * lin : 1 - Math.pow(-2 * lin + 2, 3) / 2;

      if (t >= 1) {
        // Arrived — full cleanup
        planeMarker.remove();
        planeEl.remove();
        markersRef.current.delete(`plane_${kiss.id}`);
        animFrameRef.current.delete(kiss.id);
        // Remove dove endpoint pulse markers (start + end pink dots)
        doveEndpointKeys.forEach(k => {
          const m = markersRef.current.get(k);
          if (m) { m.remove(); markersRef.current.delete(k); }
        });
        placeGiftMarker(kiss);

        // Stop camera control + reset to normal view. Dove keeps the
        // route-framed view so the finished route stays visible.
        setFlightHUD(null);
        activeFollowRef.current = null;
        if (vehicle.kind === 'dove') {
          // Leave camera alone in BOTH globe and 2D — the user's chosen
          // view stays as-is after the heart is complete.
        } else {
          map?.jumpTo({ center: to, zoom: isGlobe ? 4 : vehicle.landZoom, pitch: 0, bearing: 0 });
        }

        // Clean arc/trail lines (and dove casing) after delay
        setTimeout(() => {
          [casingId, trailId, lineId].forEach(lid => {
            try { if (map?.getLayer(lid)) map.removeLayer(lid); } catch {}
          });
          [trailId, lineId].forEach(sid => {
            try { if (map?.getSource(sid)) map.removeSource(sid); } catch {}
          });
        }, 3000);
        return;
      }

      // ── Plane position: smooth sub-pixel interpolation ──
      const exactIdx = t * (arcPoints.length - 1);
      const i = Math.floor(exactIdx);
      const f = exactIdx - i;
      const a = arcPoints[i];
      const b = arcPoints[Math.min(i + 1, arcPoints.length - 1)];
      const tgtLng = a[0] + (b[0] - a[0]) * f;
      const tgtLat = a[1] + (b[1] - a[1]) * f;

      // Lerp plane position — handle dateline wrapping
      let dLng = tgtLng - planeLng;
      if (dLng > 180) dLng -= 360;
      if (dLng < -180) dLng += 360;
      planeLng += dLng * 0.12;
      planeLat += (tgtLat - planeLat) * 0.12;

      // ── Per-vehicle motion signature ──
      //  dove      : constant fluttery Y/X sine + slow altitude illusion
      //              (scale + drop-shadow modulated by a sine so the bird
      //              visibly rises and dips across the map)
      //  motorbike : subtle high-freq wobble (bumps in the road)
      //  car       : very slight sway (smooth suspension)
      //  plane     : airliner turbulence bob only during weather zones
      let motionOffsetY = 0;
      let motionOffsetX = 0;
      let extraTransform = '';
      let extraFilter = '';
      turbulenceActive = false;
      if (vehicle.kind === 'plane') {
        turbulenceActive = turbZones.some(z => t >= z.start && t <= z.end);
        if (turbulenceActive) {
          motionOffsetY = Math.sin(elapsed * 0.008) * 6 + Math.sin(elapsed * 0.013) * 3;
        }
      } else if (vehicle.kind === 'dove') {
        motionOffsetY = Math.sin(elapsed * 0.012) * 4 + Math.sin(elapsed * 0.021) * 2;
        motionOffsetX = Math.sin(elapsed * 0.007) * 2.5;
        const altPhase = 0.5 + 0.5 * Math.sin(elapsed * 0.0009); // 0..1, slow rise/dip
        const scale = 0.92 + 0.16 * altPhase;                    // 0.92..1.08
        const shadowY = 3 + altPhase * 4;                        // higher = further shadow
        const shadowBlur = 2 + altPhase * 5;                     // higher = softer shadow
        const shadowOpa = 0.5 - altPhase * 0.2;                  // higher = lighter shadow
        extraTransform = ` scale(${scale.toFixed(3)})`;
        extraFilter = `drop-shadow(0 ${shadowY.toFixed(1)}px ${shadowBlur.toFixed(1)}px rgba(0,0,0,${shadowOpa.toFixed(2)}))`;
      } else if (vehicle.kind === 'motorbike') {
        motionOffsetY = Math.sin(elapsed * 0.03) * 1.2;
        motionOffsetX = Math.sin(elapsed * 0.026) * 0.8;
      } else if (vehicle.kind === 'car') {
        motionOffsetX = Math.sin(elapsed * 0.004) * 1;
      }
      innerEl.style.transform = (motionOffsetX || motionOffsetY || extraTransform)
        ? `translate(${motionOffsetX}px, ${motionOffsetY}px)${extraTransform}`
        : '';
      innerEl.style.filter = extraFilter;

      planeMarker.setLngLat([planeLng, planeLat]);

      // ── Vehicle bearing: look far ahead + heavy smoothing ──
      // Ground vehicles (motorbike/car) get slightly tighter smoothing than the plane
      // so they don't lag when the arc curves.
      const lookIdx = Math.min(i + Math.max(15, Math.floor(arcPoints.length * 0.03)), arcPoints.length - 1);
      const lk = arcPoints[lookIdx];
      const dLn = (lk[0] - planeLng) * Math.PI / 180;
      const la1 = planeLat * Math.PI / 180;
      const la2 = lk[1] * Math.PI / 180;
      const rawBrg = Math.atan2(Math.sin(dLn) * Math.cos(la2), Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dLn)) * 180 / Math.PI;
      let brgDiff = rawBrg - planeBrg;
      if (brgDiff > 180) brgDiff -= 360;
      if (brgDiff < -180) brgDiff += 360;
      const brgSmooth = (vehicle.kind === 'motorbike' || vehicle.kind === 'car') ? 0.05 : 0.03;
      planeBrg += brgDiff * brgSmooth;
      planeMarker.setRotation(planeBrg);

      // ── Dove: hold the bounds-fit view static so the viewer sees the
      // WHOLE route on the map and watches the bird weave across it.
      // Only the HUD updates each frame — no camera lerp.
      if (isFollowing() && vehicle.kind === 'dove') {
        setFlightHUD({
          from: senderCity, to: receiverCity, progress: t,
          senderName: kiss.sender_name || 'Sender',
          receiverName: currentUserId === kiss.receiver_id ? 'You' : (kiss.receiver_name || 'Receiver'),
          emoji: vehicle.emoji,
          turbulence: false,
        });
      }
      // ── Camera: lerp ALL properties every frame → zero jitter ──
      // Every other vehicle uses the cinematic follow camera so the trip
      // feels like a full journey with the vehicle in view the whole time.
      else if (isFollowing()) {
        let tgtZoom: number, tgtPitch: number;

        if (isGlobe) {
          // Globe: zoom out to see Earth, then zoom in for landing.
          const orbitZ = 1.8;
          const landZ = vehicle.landZoom;
          if (t < 0.1) { tgtZoom = 5 - (5 - orbitZ) * (t / 0.1); tgtPitch = 0; }
          else if (t > 0.9) { tgtZoom = orbitZ + (landZ - orbitZ) * ((t - 0.9) / 0.1); tgtPitch = ((t - 0.9) / 0.1) * 40; }
          else { tgtZoom = orbitZ; tgtPitch = 0; }
        } else {
          const cruiseZ = vehicle.cruiseZoom;
          const cruisePitch = vehicle.cruisePitch;
          const landZ = vehicle.landZoom;
          if (t < 0.12) { tgtZoom = openZoom - (openZoom - cruiseZ) * (t / 0.12); tgtPitch = t / 0.12 * cruisePitch; }
          else if (t > 0.85) { tgtZoom = cruiseZ + (landZ - cruiseZ) * ((t - 0.85) / 0.15); tgtPitch = ((1 - t) / 0.15) * cruisePitch; }
          else { tgtZoom = cruiseZ; tgtPitch = cruisePitch; }
        }

        // Camera looks ahead of the vehicle.
        const lookAmt = isGlobe ? 40 : 25;
        const camLookIdx = Math.min(i + lookAmt, arcPoints.length - 1);
        const cl = arcPoints[camLookIdx];

        const lerpSpeed = isGlobe ? 0.025 : 0.04;
        let camDLng = cl[0] - camLng;
        if (camDLng > 180) camDLng -= 360;
        if (camDLng < -180) camDLng += 360;
        camLng += camDLng * lerpSpeed;
        camLat += (cl[1] - camLat) * lerpSpeed;
        camZoom += (tgtZoom - camZoom) * lerpSpeed;
        camPitch += (tgtPitch - camPitch) * lerpSpeed;
        let camBrgDiff = planeBrg - camBearing;
        if (camBrgDiff > 180) camBrgDiff -= 360;
        if (camBrgDiff < -180) camBrgDiff += 360;
        camBearing += camBrgDiff * (isGlobe ? 0.02 : 0.03);

        map?.jumpTo({ center: [camLng, camLat], zoom: camZoom, pitch: camPitch, bearing: isGlobe ? 0 : camBearing });

        setFlightHUD({
          from: senderCity, to: receiverCity, progress: t,
          senderName: kiss.sender_name || 'Sender',
          receiverName: currentUserId === kiss.receiver_id ? 'You' : (kiss.receiver_name || 'Receiver'),
          emoji: vehicle.emoji,
          turbulence: turbulenceActive,
        });
      }

      // Trail
      if (i % 10 === 0) {
        trailCoords.push([planeLng, planeLat]);
        try {
          const src = map?.getSource(trailId) as maplibregl.GeoJSONSource;
          if (src) src.setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: trailCoords }, properties: {} });
        } catch {}
      }

      const frame = requestAnimationFrame(fly);
      animFrameRef.current.set(kiss.id, frame);
    }

    // Start — three opening moves matched to vehicle behaviour:
    //  • dove   → fitBounds on both endpoints with tight padding, then
    //             hold that view for the whole flight (camera static;
    //             bird flies visibly across the framed map). maxZoom 17
    //             so ultra-short flights don't over-zoom.
    //  • globe  → fly to sender then pull out to see Earth
    //  • other  → swoop into the journey at cruise pitch
    if (vehicle.kind === 'dove') {
      // Don't touch the camera in EITHER view mode (globe or 2D). The
      // bird flies its heart shape wherever the map is currently framed.
      // Just start the fly loop.
      setTimeout(() => requestAnimationFrame(fly), 60);
    } else if (isGlobe) {
      map?.flyTo({ center: from, zoom: openZoom, pitch: 0, bearing: 0, duration: 2000 });
      setTimeout(() => {
        camLng = from[0]; camLat = from[1]; camZoom = openZoom; camPitch = 0; camBearing = 0;
        requestAnimationFrame(fly);
      }, 2300);
    } else {
      map?.flyTo({ center: from, zoom: openZoom, pitch: vehicle.cruisePitch, bearing: 0, duration: 2500, easing: (x: number) => 1 - Math.pow(1 - x, 3) });
      setTimeout(() => {
        camLng = from[0]; camLat = from[1]; camZoom = openZoom; camPitch = vehicle.cruisePitch; camBearing = 0;
        requestAnimationFrame(fly);
      }, 2800);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, mutate, currentUserId, placeGiftMarker]);

  // Place/remove gift markers based on layer toggle
  // On 3D globe: don't auto-place markers (only show on ?kiss= replay)
  useEffect(() => {
    if (!map) return;
    const isGlobe = useMapStore.getState().viewMode === '3d';
    if (giftLayerOn && !isGlobe) {
      kisses.forEach(k => {
        if (markersRef.current.has(`plane_${k.id}`)) return;
        placeGiftMarker(k);
      });
    } else if (!giftLayerOn) {
      // Clean everything: markers, animations, map layers
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current.clear();
      animFrameRef.current.forEach(f => { clearTimeout(f); cancelAnimationFrame(f); });
      animFrameRef.current.clear();
      activeFollowRef.current = null;
      setFlightHUD(null);
      // Remove all kiss arc/trail layers
      kisses.forEach(k => {
        ['kiss-arc-', 'kiss-trail-'].forEach(prefix => {
          try { if (map.getLayer(`${prefix}${k.id}`)) map.removeLayer(`${prefix}${k.id}`); } catch {}
          try { if (map.getSource(`${prefix}${k.id}`)) map.removeSource(`${prefix}${k.id}`); } catch {}
        });
      });
    }
  }, [map, kisses, placeGiftMarker, giftLayerOn]);

  // Hide/show gift markers based on zoom level (prevent clutter on globe)
  useEffect(() => {
    if (!map || !giftLayerOn) return;
    const updateVisibility = () => {
      const zoom = map.getZoom();
      const isGlobe = useMapStore.getState().viewMode === '3d';
      const minZoom = isGlobe ? 4 : 0; // hide on globe when zoomed out
      markersRef.current.forEach((marker, key) => {
        if (key.startsWith('plane_')) return; // don't hide flying planes
        marker.getElement().style.display = zoom >= minZoom ? '' : 'none';
      });
    };
    map.on('zoom', updateVisibility);
    updateVisibility();
    return () => { map.off('zoom', updateVisibility); };
  }, [map, giftLayerOn]);

  // Listen for ?kiss=<id> URL param — replay that kiss animation
  useEffect(() => {
    if (!map || kisses.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const kissId = params.get('kiss');
    if (!kissId || replayedRef.current.has(kissId)) return;

    const kiss = kisses.find(k => k.id === kissId);
    if (kiss) {
      replayedRef.current.add(kissId);
      // Clean URL
      window.history.replaceState(null, '', '/world');
      // Small delay to let map settle, then replay
      setTimeout(() => playFlightAnimation(kiss), 1000);
    }
  }, [map, kisses, playFlightAnimation]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      markersRef.current.forEach(m => m.remove());
      markersRef.current.clear();
      animFrameRef.current.forEach(f => { clearTimeout(f); cancelAnimationFrame(f); });
    };
  }, []);

  return (
    <>
      {/* Flight HUD overlay */}
      <AnimatePresence>
        {flightHUD && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
            <FlightHUD {...flightHUD} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Send Modal — full-screen fallback opened by KissRevealPopup's
          Send-Back flow via useGiftsPopupStore.openKissModalDirect().
          (The Gifts chip on the top filter bar uses the tabbed
          GiftsPopup below, which embeds this same SendKissModal
          inline in its Kiss tab.) */}
      <AnimatePresence>
        {showSendModal && <SendKissModal defaultReceiverId={sendBackTo} onClose={closeKissModal} onSent={async () => {
          const fresh = await mutate();
          const newest = (fresh as { data: Kiss[] } | undefined)?.data?.[0];
          if (newest) setTimeout(() => playFlightAnimation(newest), 500);
        }} />}
      </AnimatePresence>

      {/* Kiss Reveal */}
      <AnimatePresence>
        {revealKiss && <KissRevealPopup kiss={revealKiss} onClose={() => setRevealKiss(null)} currentUserId={currentUserId} onSendBack={(toId) => useGiftsPopupStore.getState().openKissModalDirect(toId)} />}
      </AnimatePresence>

      {/* Unified Gifts popup (tabbed: Kiss + Templates) — opened by
          the Gifts chip in LayerFilterPanel. */}
      <GiftsPopup />

      {/* Template builders — full-screen modals opened when the user
          picks a template card inside GiftsPopup's Templates tab. */}
      <HeartBuilder open={isHeartBuilderOpen} onClose={closeHeartBuilder} />
      <CoupleCardBuilder open={isCoupleBuilderOpen} onClose={closeCoupleBuilder} />
      {/* Birthday launches the time-capsule composer preloaded with
          the birthday theme. Recipients get the cinematic drone
          reveal via BirthdayJourneyFlow when they open the capsule. */}
      <CapsuleCreateModal
        open={isBirthdayCapsuleOpen}
        onClose={closeBirthdayCapsule}
        initialThemeId="birthday"
      />

      {/* Auth Gate */}
      <SignInGateSheet action="default" isOpen={showAuthGate} onClose={() => setShowAuthGate(false)} />
    </>
  );
}
