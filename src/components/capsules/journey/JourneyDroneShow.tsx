'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import * as THREE from 'three';
import { SCENE_DRAWERS, type SceneDrawer } from './scenes';

// Drone-swarm size. Bumped from 1200 → 1800 so 10-burst fireworks can
// distribute enough drones per burst (~180 each) for the dotted spark
// trails to read densely — matches the density of real firework
// photos where each burst has hundreds of individual sparks. 1800
// still hits 60 FPS on mid-tier mobile because Three.js renders
// points on the GPU.
const DRONE_COUNT = 1800;

// Per-drone sprite size in world units. Slightly larger than the old
// 4.5 so glyphs look denser rather than sparse.
const DRONE_SIZE = 5.6;

type DroneColor = 'cyan' | 'red' | 'pink' | 'gold' | 'multicolor';

// Base tint per drone-colour theme. Rendered onto a WHITE sprite via
// per-vertex `color` BufferAttribute — Three.js multiplies texture ×
// vertex colour per fragment, so each drone glows in its assigned
// tone. This is the simple mono case (all drones the same colour).
const DRONE_HEX: Record<Exclude<DroneColor, 'multicolor'>, string> = {
  cyan: '#00d4ff',
  red:  '#ff5060',
  pink: '#ff5aa0',
  gold: '#ffcd00',
};

// 6 vibrant tones for the 'multicolor' drone show mode — matches a
// real drone-fireworks display. Drones are assigned in round-robin
// (drone #i uses index i % 6) so every 6th drone shares a colour;
// bursts naturally read as a rainbow mix rather than clumping. Values
// chosen to look saturated with additive blending on a dark sky.
const MULTICOLOR_HEX: string[] = [
  '#ff4488',  // hot pink
  '#ff3344',  // vivid red
  '#ffaa22',  // gold amber
  '#22ee88',  // neon green
  '#22aaff',  // sky cyan
  '#bb66ff',  // purple
];

// Named palettes callers can pass as a per-stage `colors:` prop.
// Each palette is a small array of hex codes that gets round-robin
// assigned to the 1200 drones for the stage's duration. Colours
// interpolate between adjacent stages during morph, so the show
// smoothly shifts through the emotional arc rather than snap-cutting.
export const JOURNEY_PALETTES = {
  // Cinematic drone fireworks — the reference-image mix.
  fireworks:  ['#ff4488', '#ff3344', '#ffaa22', '#22ee88', '#22aaff', '#bb66ff', '#ffffff'],
  // Warm romantic — pinks and roses for text-intro + heart moments.
  romantic:   ['#ff4488', '#ff77aa', '#ffaacc', '#ff5588', '#ff88bb'],
  // Warm sunset — amber + gold, works for the "reunion" beats.
  warm:       ['#ff8844', '#ffbb66', '#ffdd88', '#ff9966', '#ffaa77'],
  // Bright pre-burst — mostly white + hot gold, feels like shells about to detonate.
  shells:     ['#ffffff', '#fff2cc', '#ffdd88', '#ffffff', '#ffbb66'],
  // Soft dreamy pastel — dissolve / fade endings.
  pastel:     ['#ffbbcc', '#ffddaa', '#ccddff', '#e8b3d9', '#ffccdd'],
  // Pure gold — celebration highlight.
  gold:       ['#ffd644', '#ffcd00', '#ffe088', '#fff2aa'],
};

// Glow-shadow tint for the heart-embedded photo overlay per drone
// colour. Kept in sync with the sky so the photo doesn't look like a
// disconnected element.
const DRONE_PHOTO_SHADOW: Record<DroneColor, string> = {
  cyan:       'rgba(0,212,255,0.35)',
  red:        'rgba(255,80,90,0.4)',
  pink:       'rgba(255,90,150,0.4)',
  gold:       'rgba(255,200,60,0.4)',
  multicolor: 'rgba(255,120,180,0.4)',  // soft-pink pairs well with a romantic photo
};

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
}

// Every stage variant may optionally supply its own colour palette.
// When set, drones lerp from the previous stage's colours into this
// palette over the morph duration — the sky's emotional tone shifts
// smoothly with the drone positions. When omitted the stage inherits
// the show's `droneColor` prop (or the default cyan).
type ColorsField = { colors?: string[] };

type StageScene =
  | ({ kind: 'scatter'; durationMs: number; label?: string } & ColorsField)
  | ({
      kind: 'scene';
      sceneKey: keyof typeof SCENE_DRAWERS;
      durationMs: number;
      label?: string;
      /** When set, the whole drone Points object rotates on its Z
       *  axis at this speed (radians/sec) throughout the stage. Used
       *  by the galaxy scene to spin the spiral. Reset to 0 between
       *  stages so subsequent formations don't inherit rotation. */
      spin?: number;
    } & ColorsField)
  | ({
      kind: 'text';
      value: string;
      fontPx?: number;
      durationMs: number;
      label?: string;
      /** Vertical offset (world units) applied to this text formation.
       *  Defaults to TEXT_Y_SHIFT (~90) which places prose in the upper
       *  half. Countdown-style stages pass 0 to centre the number over
       *  where the heart will appear. */
      yShift?: number;
      /** Fixed target width (world units) for this text — bypasses the
       *  aspect-aware auto-fit. Used for single-character countdowns
       *  ("3", "2", "1") that would otherwise scale up to fill the
       *  entire viewport width. */
      fitWidth?: number;
    } & ColorsField)
  | ({ kind: 'photos'; urls: string[]; durationMs: number; label?: string } & ColorsField)
  | ({ kind: 'dissolve'; durationMs: number; label?: string } & ColorsField)
  // Physics-based burst — drones fly outward from their current
  // position with real velocity + gravity + air drag instead of a
  // static shape morph. Used for realistic firework explosion.
  | ({ kind: 'physics'; durationMs: number; label?: string } & ColorsField);

type Props = {
  stages: StageScene[];
  /** Fired when the last stage completes. Not called when `loop` is
   *  true — instead the show restarts from stage 0. */
  onDone?: () => void;
  /** When true, the show restarts from stage 0 after the final stage
   *  instead of firing onDone. Used by the couple-heart gift viewer
   *  which is meant to run forever until the user closes the page. */
  loop?: boolean;
  /** By default the show mounts to document.body via a portal so it
   *  covers the whole viewport. Set true to render in place — useful
   *  when the parent already provides a fullscreen container and wants
   *  to layer its own UI on top of the drones. */
  inline?: boolean;
  /** Drone light colour theme. Defaults to cyan (birthday-capsule
   *  look). Callers pass 'red' etc. to tint the swarm without
   *  otherwise changing the show. */
  droneColor?: DroneColor;
  /** Photo URL displayed as a circular overlay in the centre of the
   *  frame while the current stage is a heart scene. Fades in/out
   *  with the stage — no dedicated 'photos' stage needed. Used by
   *  the couple-heart gift viewer so the recipient's photo sits
   *  INSIDE the drone-formed heart. */
  heartPhotoUrl?: string | null;
};

// ── Drone sprite — a neutral white glow. The drone's actual colour
// comes from a per-vertex BufferAttribute, which Three.js multiplies
// with the sprite alpha per fragment. This means one shared texture
// can tint N different-coloured drones, unlocking the 'multicolor'
// mode.
function buildDroneTexture(): THREE.Texture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.Texture();
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0,    'rgba(255,255,255,1)');
  grad.addColorStop(0.3,  'rgba(255,255,255,0.9)');
  grad.addColorStop(0.65, 'rgba(255,255,255,0.35)');
  grad.addColorStop(1,    'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

// ── Sample N evenly-distributed points from opaque pixels of a canvas ──
function sampleCanvasPoints(canvas: HTMLCanvasElement, count: number): Array<[number, number]> {
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const opaque: Array<[number, number]> = [];
  for (let y = 0; y < canvas.height; y += 2) {
    for (let x = 0; x < canvas.width; x += 2) {
      if (img.data[(y * canvas.width + x) * 4 + 3] > 60) {
        opaque.push([x - canvas.width / 2, y - canvas.height / 2]);
      }
    }
  }
  if (opaque.length === 0) return [];
  const out: Array<[number, number]> = new Array(count);
  for (let i = 0; i < count; i++) {
    out[i] = opaque[Math.floor((i / count) * opaque.length) % opaque.length];
  }
  // Shuffle so adjacent drones don't share neighbouring source pixels
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Draw a scene drawer into an offscreen canvas and sample its points.
function pointsFromScene(drawer: SceneDrawer, drones: number): Array<[number, number, number]> {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 500;
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];
  ctx.fillStyle = '#000';
  drawer(ctx, canvas.width, canvas.height);
  const pts = sampleCanvasPoints(canvas, drones);
  return fit2D(pts, 180);
}

// Vertical shift (world units) applied to text formations only.
// Positions text formations high in the frame so they sit just
// beneath the recipient-name overlay rather than dead-centre —
// matches the "chữ dịch lên trên nữa" design ask. Scenes/photos/
// runners stay centred at the origin.
const TEXT_Y_SHIFT = 90;

// Vertical space multiplier between lines of multi-line drone text.
// Tight enough that the two lines read as a stanza rather than as
// separated blocks, matches "khoảng cách chữ nhỏ lại".
const TEXT_LINE_HEIGHT_MUL = 1.28;

// Negative letter-spacing (in px on the offscreen canvas) so drone-
// formed characters cluster tightly and read as continuous words
// rather than isolated glyph-blobs. Widely-supported since 2023 in
// Chrome/Safari/Firefox — older browsers silently ignore it.
const TEXT_LETTER_SPACING_PX = -3;

// Explicit gap between words as a fraction of fontPx. We draw each
// word left-aligned with `ctx.measureText`-based positioning instead of
// relying on the native space character + ctx.wordSpacing: Safari
// below 16.4 and older Android WebViews ignore wordSpacing entirely,
// leaving the default (huge) space char intact. Manual positioning
// gives identical results in every browser.
//
// 0.10 → ~12px at fontPx=118 → a tight kerning-like gap that reads
// as one continuous phrase without letters colliding.
const TEXT_WORD_GAP_FRAC = 0.10;

// Font weight — 600 (semi-bold) instead of 'bold' (700). Letters look
// slightly thinner + more elegant when reconstituted from drones,
// matching "bold font chữ cũng mỏng lại".
const TEXT_FONT_WEIGHT = '600';

// Draw text into an offscreen canvas and sample its points. Supports
// multi-line — split the input on \n. Long phrases (e.g. Vietnamese
// dedications) don't fit as a single line so callers typically pass
// pre-wrapped text.
function pointsFromText(
  text: string,
  fontPx: number,
  drones: number,
  opts?: { yShift?: number; fitWidth?: number },
): Array<[number, number, number]> {
  const lines = text.split('\n');
  const canvas = document.createElement('canvas');
  const lineHeight = Math.round(fontPx * TEXT_LINE_HEIGHT_MUL);
  const wordGap = Math.round(fontPx * TEXT_WORD_GAP_FRAC);
  // Approximate line width with negative letter-spacing + tight
  // manual word gap baked in.
  const longestChars = Math.max(...lines.map((l) => l.length));
  canvas.width = Math.max(700, Math.round(longestChars * fontPx * 0.52));
  canvas.height = Math.round(lineHeight * lines.length + fontPx * 0.5);
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];
  ctx.fillStyle = '#fff';
  ctx.font = `${TEXT_FONT_WEIGHT} ${fontPx}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","SF Pro Display",sans-serif`;
  ctx.textBaseline = 'middle';
  // Letter-spacing still uses the standard API — well supported
  // (Chrome 99+/Safari 16.4+/Firefox 112+). Older engines ignore it,
  // which is fine, letters just spread with default kerning.
  (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing =
    `${TEXT_LETTER_SPACING_PX}px`;

  // Word gap is applied manually with left-aligned draws — Safari
  // <16.4 does NOT honour ctx.wordSpacing, so relying on it left
  // massive gaps between words like "CHÀO ANH". Manual positioning
  // gives identical results across every browser.
  ctx.textAlign = 'left';
  const startY =
    (canvas.height - lineHeight * lines.length) / 2 + lineHeight / 2;
  lines.forEach((line, i) => {
    const words = line.split(/\s+/).filter(Boolean);
    if (!words.length) return;
    const widths = words.map((w) => ctx.measureText(w).width);
    const gaps = wordGap * Math.max(0, words.length - 1);
    const totalWidth = widths.reduce((a, b) => a + b, 0) + gaps;
    let cursorX = canvas.width / 2 - totalWidth / 2;
    const y = startY + i * lineHeight;
    for (let j = 0; j < words.length; j++) {
      ctx.fillText(words[j], cursorX, y);
      cursorX += widths[j] + wordGap;
    }
  });

  const pts = sampleCanvasPoints(canvas, drones);
  // Fit width — callers can pass an explicit `fitWidth` (used for
  // single-char countdowns so the number sits at a controlled size),
  // otherwise we auto-fit to the visible viewport width capped at 200
  // world units. The cap keeps letter density high enough on wide
  // desktop viewports for drones to read as glyphs rather than
  // scattered dots.
  //
  // Camera FOV = 60° vertical, distance ~321 → visible height ≈ 370
  // world units. Visible width = height × aspect.
  let targetWidth: number;
  if (opts?.fitWidth != null) {
    targetWidth = opts.fitWidth;
  } else {
    const viewportAspect =
      typeof window !== 'undefined'
        ? window.innerWidth / Math.max(1, window.innerHeight)
        : 0.55;
    const visibleWorldWidth = 370 * viewportAspect;
    targetWidth = Math.min(visibleWorldWidth * 0.94, 200);
  }
  const fitted = fit2D(pts, targetWidth);
  const yShift = opts?.yShift ?? TEXT_Y_SHIFT;
  return fitted.map(([x, y, z]) => [x, y + yShift, z]);
}

// Scattered shell around origin — used for scatter + dissolve stages.
function pointsScattered(count: number, radius: number): Array<[number, number, number]> {
  const out: Array<[number, number, number]> = new Array(count);
  for (let i = 0; i < count; i++) {
    const t = Math.random() * Math.PI * 2;
    const u = Math.random() * 2 - 1;
    const r = radius * (0.7 + Math.random() * 0.3);
    out[i] = [
      r * Math.sqrt(1 - u * u) * Math.cos(t),
      r * u,
      r * Math.sqrt(1 - u * u) * Math.sin(t),
    ];
  }
  return out;
}

// Photo-frame outline: rectangle of opaque pixels for drones to form.
function pointsPhotoFrame(drones: number): Array<[number, number, number]> {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 500;
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];
  ctx.fillStyle = '#fff';
  ctx.lineWidth = 12;
  ctx.strokeStyle = '#fff';
  const margin = 90;
  // Stroked frame — drones form just the border, leaving the interior
  // empty so the photo can fade in inside it.
  ctx.strokeRect(margin, margin, canvas.width - margin * 2, canvas.height - margin * 2);
  // Corner accent dots for density
  const corners = [
    [margin, margin], [canvas.width - margin, margin],
    [margin, canvas.height - margin], [canvas.width - margin, canvas.height - margin],
  ];
  for (const [x, y] of corners) {
    ctx.beginPath();
    ctx.arc(x, y, 14, 0, Math.PI * 2);
    ctx.fill();
  }
  const pts = sampleCanvasPoints(canvas, drones);
  return fit2D(pts, 220);
}

// Scale 2D points to a target world width, centred on origin.
function fit2D(pts: Array<[number, number]>, targetWidth: number): Array<[number, number, number]> {
  if (pts.length === 0) return [];
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of pts) {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  const w = maxX - minX || 1;
  const scale = targetWidth / w;
  return pts.map(([x, y]) => [
    (x - (minX + maxX) / 2) * scale,
    -(y - (minY + maxY) / 2) * scale,
    0,
  ]);
}

type ResolvedStage = {
  spec: StageScene;
  targets: Array<[number, number, number]>;
  /** Per-drone RGB (flat length = DRONE_COUNT * 3) used as the
   *  target colour buffer when this stage is on-stage. */
  colors: Float32Array;
};

/** Build a per-drone RGB Float32Array from a palette (round-robin
 *  assignment). Length = count * 3. */
function makeDroneColorBuffer(palette: string[], count: number): Float32Array {
  const out = new Float32Array(count * 3);
  const safe = palette.length ? palette : ['#ffffff'];
  for (let i = 0; i < count; i++) {
    const [r, g, b] = hexToRgb(safe[i % safe.length]);
    out[i * 3] = r;
    out[i * 3 + 1] = g;
    out[i * 3 + 2] = b;
  }
  return out;
}

/** Fallback palette used for stages that don't override colors — falls
 *  back to the show's mono `droneColor` or the multicolor mix. */
function defaultPaletteFor(droneColor: DroneColor): string[] {
  if (droneColor === 'multicolor') return MULTICOLOR_HEX;
  return [DRONE_HEX[droneColor]];
}

/** The drone show plays through a list of stages. For each stage we
 * precompute a target formation for every drone, then tween drones from
 * their current position to the new formation with easeOutCubic. Photos
 * fade in over a frame stage; the frame itself is held by the drones
 * while a stack of <img>s cross-fades through. */
export function JourneyDroneShow({
  stages,
  onDone,
  loop = false,
  inline = false,
  droneColor = 'cyan',
  heartPhotoUrl,
}: Props) {
  const photoShadow = DRONE_PHOTO_SHADOW[droneColor];
  const mountRef = useRef<HTMLDivElement>(null);
  const [stageIdx, setStageIdx] = useState(0);
  const [label, setLabel] = useState<string>('');
  const [photoIdx, setPhotoIdx] = useState(0);
  const [skipReady, setSkipReady] = useState(false);

  // Resolve target points + colours for each stage once on mount.
  const resolvedRef = useRef<ResolvedStage[] | null>(null);
  if (!resolvedRef.current) {
    const fallbackPalette = defaultPaletteFor(droneColor);
    resolvedRef.current = stages.map(spec => {
      let targets: Array<[number, number, number]> = [];
      switch (spec.kind) {
        case 'scatter':
        case 'dissolve':
          targets = pointsScattered(DRONE_COUNT, spec.kind === 'dissolve' ? 420 : 240);
          break;
        case 'scene':
          targets = pointsFromScene(SCENE_DRAWERS[spec.sceneKey], DRONE_COUNT);
          break;
        case 'text':
          targets = pointsFromText(
            spec.value,
            spec.fontPx ?? 110,
            DRONE_COUNT,
            { yShift: spec.yShift, fitWidth: spec.fitWidth },
          );
          break;
        case 'photos':
          targets = pointsPhotoFrame(DRONE_COUNT);
          break;
        case 'physics':
          // Physics stages don't tween origins→targets — the animate
          // loop overrides positions via a velocity integration. A
          // placeholder targets array satisfies the schema.
          targets = new Array(DRONE_COUNT).fill([0, 0, 0]);
          break;
      }
      const palette = spec.colors && spec.colors.length ? spec.colors : fallbackPalette;
      const colors = makeDroneColorBuffer(palette, DRONE_COUNT);
      return { spec, targets, colors };
    });
  }

  useEffect(() => {
    const t = setTimeout(() => setSkipReady(true), 1500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const mount = mountRef.current;
    const resolved = resolvedRef.current;
    if (!mount || !resolved) return;

    // ── Scene setup ──
    const width = mount.clientWidth;
    const height = mount.clientHeight;
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x05060a, 0.0035);

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 2000);
    camera.position.set(0, 30, 320);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    // Inline mode gets a TRANSPARENT clear so any CSS starfield /
    // photo layer behind the canvas shows through — needed by the
    // heart-gift viewer which renders a dense CSS starfield behind
    // the drones. Portal (birthday) mode keeps its opaque dark-navy
    // clear so its self-contained backdrop stays visually the same.
    renderer.setClearColor(0x05060a, inline ? 0 : 1);
    mount.appendChild(renderer.domElement);

    // Star field
    const starGeo = new THREE.BufferGeometry();
    const starCount = 900;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      starPositions[i * 3] = (Math.random() - 0.5) * 1400;
      starPositions[i * 3 + 1] = (Math.random() - 0.5) * 700;
      starPositions[i * 3 + 2] = -200 - Math.random() * 900;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const stars = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({ color: 0xffffff, size: 1.2, sizeAttenuation: false, transparent: true, opacity: 0.55 }),
    );
    scene.add(stars);

    // Drone swarm — neutral white sprite tinted per-vertex.
    const droneTex = buildDroneTexture();
    const droneGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(DRONE_COUNT * 3);
    const origins = new Float32Array(DRONE_COUNT * 3);
    const targets = new Float32Array(DRONE_COUNT * 3);

    // Per-drone colour attribute. For mono modes every drone gets the
    // same hex; for 'multicolor' we cycle through MULTICOLOR_HEX in
    // round-robin so every 6th drone shares a colour — bursts blend
    // as a rainbow mix without clumping.
    const droneColors = new Float32Array(DRONE_COUNT * 3);
    for (let i = 0; i < DRONE_COUNT; i++) {
      const hex =
        droneColor === 'multicolor'
          ? MULTICOLOR_HEX[i % MULTICOLOR_HEX.length]
          : DRONE_HEX[droneColor];
      const [r, g, b] = hexToRgb(hex);
      droneColors[i * 3] = r;
      droneColors[i * 3 + 1] = g;
      droneColors[i * 3 + 2] = b;
    }

    const initial = pointsScattered(DRONE_COUNT, 260);
    for (let i = 0; i < DRONE_COUNT; i++) {
      positions[i * 3] = initial[i][0];
      positions[i * 3 + 1] = initial[i][1];
      positions[i * 3 + 2] = initial[i][2];
      origins[i * 3] = positions[i * 3];
      origins[i * 3 + 1] = positions[i * 3 + 1];
      origins[i * 3 + 2] = positions[i * 3 + 2];
    }
    droneGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    droneGeo.setAttribute('color', new THREE.BufferAttribute(droneColors, 3));
    const droneMat = new THREE.PointsMaterial({
      size: DRONE_SIZE,
      map: droneTex,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
    });
    const drones = new THREE.Points(droneGeo, droneMat);
    scene.add(drones);

    // ── Stage controller ──
    let idx = 0;
    let stageStart = performance.now();
    let finished = false;

    // Colour lerp buffers — origins = last-frame drone colours (drone-
    // Colors buffer live-updates), targets = stage's target colours.
    const originColors = new Float32Array(DRONE_COUNT * 3);
    const targetColors = new Float32Array(DRONE_COUNT * 3);
    // Prime originColors with the current drone colours so the first
    // morph fades from mount-state (already-assigned droneColors) into
    // stage 0's colours cleanly.
    originColors.set(droneColors);

    // Per-drone velocity — populated at physics stage entry, integrated
    // per frame while physics stage is active. Not touched by other
    // stage kinds.
    const velocities = new Float32Array(DRONE_COUNT * 3);
    let lastFrameT = performance.now();

    // ── PHYSICS-STAGE TRAILS ──────────────────────────────────────
    // LineSegments where each pair of vertices draws a line from the
    // drone's position AT PHYSICS-STAGE ENTRY (fixed) to its current
    // simulated position. Vertex colours grade from BLACK (origin, so
    // it fades into the additive-blended dark sky) to full drone
    // colour (current tip). The line lengthens as the physics runs,
    // producing the "streak of light behind each spark" look that's
    // the visual signature of real firework photography. Hidden
    // outside physics stages so morph/scene stages render clean.
    const trailPositions = new Float32Array(DRONE_COUNT * 6);
    const trailColors = new Float32Array(DRONE_COUNT * 6);
    const trailGeo = new THREE.BufferGeometry();
    trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
    trailGeo.setAttribute('color', new THREE.BufferAttribute(trailColors, 3));
    const trailMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const trailsObj = new THREE.LineSegments(trailGeo, trailMat);
    trailsObj.visible = false;
    scene.add(trailsObj);
    // Origin positions saved at physics stage entry — line origins
    // stay fixed even as drones fly outward.
    const trailOrigins = new Float32Array(DRONE_COUNT * 3);

    const setStage = (newIdx: number) => {
      idx = newIdx;
      stageStart = performance.now();

      // Bake any accumulated Points-object rotation from the previous
      // stage (e.g. galaxy spin) back into positions so the next
      // stage's morph starts from the SEEN configuration rather than
      // snapping the unrotated stored positions.
      const carriedRot = drones.rotation.z;
      if (Math.abs(carriedRot) > 0.001) {
        const c = Math.cos(carriedRot);
        const s = Math.sin(carriedRot);
        for (let i = 0; i < DRONE_COUNT; i++) {
          const i3 = i * 3;
          const x = positions[i3];
          const y = positions[i3 + 1];
          positions[i3] = c * x - s * y;
          positions[i3 + 1] = s * x + c * y;
        }
        drones.rotation.z = 0;
      }

      // Snapshot current positions + colours as new origins.
      for (let i = 0; i < DRONE_COUNT * 3; i++) {
        origins[i] = positions[i];
        originColors[i] = droneColors[i];
      }
      const stage = resolved[idx];
      for (let i = 0; i < DRONE_COUNT; i++) {
        const t = stage.targets[i] || [0, 0, 0];
        targets[i * 3] = t[0];
        targets[i * 3 + 1] = t[1];
        targets[i * 3 + 2] = t[2];
      }
      targetColors.set(stage.colors);

      // Physics stage — compute initial velocity per drone: RADIAL
      // OUTWARD from world origin (each drone flies away from the
      // centre of the sky) with a random speed + a small upward bias.
      // Since the previous stage typically leaves drones clustered
      // around the centre (hug), this creates one huge central burst
      // with drones fanning out into a real firework explosion arc.
      if (stage.spec.kind === 'physics') {
        for (let i = 0; i < DRONE_COUNT; i++) {
          const i3 = i * 3;
          const px = positions[i3];
          const py = positions[i3 + 1];
          const dist = Math.hypot(px, py);
          let dirX: number;
          let dirY: number;
          if (dist > 1.5) {
            dirX = px / dist;
            dirY = py / dist;
          } else {
            // If a drone happens to sit right at origin, pick a
            // random direction so nothing has zero velocity.
            const a = Math.random() * Math.PI * 2;
            dirX = Math.cos(a);
            dirY = Math.sin(a);
          }
          // Speed pushed higher than the first-pass values so the
          // explosion actually reads as EXPLOSIVE — drones fly out
          // fast and cover meaningful visible distance before drag
          // slows them.
          const speed = 90 + Math.random() * 70;
          velocities[i3] = dirX * speed;
          // Upward bias so drones arc up before gravity pulls them
          // back — the classic firework peak.
          velocities[i3 + 1] = dirY * speed + Math.random() * 34;
          velocities[i3 + 2] = 0;
        }
        // Snapshot current positions as trail origins — each drone's
        // trail line will start here and stretch outward as the drone
        // flies.
        trailOrigins.set(positions);
        trailsObj.visible = true;
      } else {
        // Any non-physics stage: hide the trails.
        trailsObj.visible = false;
      }

      setStageIdx(idx);
      setLabel(stage.spec.label ?? '');
      if (stage.spec.kind === 'photos') setPhotoIdx(0);
    };
    setStage(0);

    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    // Photo cross-fade controller — only relevant when current stage is 'photos'.
    let photoTimer: ReturnType<typeof setInterval> | null = null;
    const stagePhotos = (sp: StageScene): string[] =>
      sp.kind === 'photos' ? sp.urls : [];
    const onStageEnter = () => {
      if (photoTimer) { clearInterval(photoTimer); photoTimer = null; }
      const stage = resolved[idx];
      const urls = stagePhotos(stage.spec);
      if (urls.length > 1) {
        const slice = Math.floor(stage.spec.durationMs / urls.length);
        photoTimer = setInterval(() => {
          setPhotoIdx(prev => (prev + 1) % urls.length);
        }, slice);
      }
    };
    onStageEnter();

    let raf = 0;
    const animate = () => {
      if (finished) return;
      const now = performance.now();
      const stage = resolved[idx];
      const elapsed = now - stageStart;
      const t = Math.min(1, elapsed / stage.spec.durationMs);
      const eased = easeOutCubic(t);
      // Frame delta in seconds, clamped so a tab-focus regain doesn't
      // send the physics integrator into a huge step.
      const frameDt = Math.min(0.05, (now - lastFrameT) / 1000);
      lastFrameT = now;

      if (stage.spec.kind === 'physics') {
        // Physics integration — velocity Verlet-style with gravity
        // (Y pulls down) and per-frame drag. Colours fade less
        // aggressively than the first-pass values so sparks stay
        // visible for most of the stage. Trails render this frame's
        // position along with the fixed origin position for each
        // drone, producing streak lines that grow as physics runs.
        const GRAVITY_Y = -38;
        const DRAG_PER_SEC = 0.82;
        const dragFactor = Math.pow(DRAG_PER_SEC, frameDt);
        // Fade in an "S-curve" — sparks stay bright for the first
        // half of the stage, then dim in the second half. Better
        // than linear fade (which would dim visible sparks too soon).
        const fade = t < 0.5 ? 1 : 1 - (t - 0.5) * 0.9;

        for (let i = 0; i < DRONE_COUNT; i++) {
          const i3 = i * 3;
          const i6 = i * 6;
          // Gravity applied to Y velocity, then all axes drag.
          velocities[i3 + 1] += GRAVITY_Y * frameDt;
          velocities[i3] *= dragFactor;
          velocities[i3 + 1] *= dragFactor;
          velocities[i3 + 2] *= dragFactor;
          // Integrate positions.
          positions[i3] += velocities[i3] * frameDt;
          positions[i3 + 1] += velocities[i3 + 1] * frameDt;
          positions[i3 + 2] += velocities[i3 + 2] * frameDt;
          // Drone (spark head) colour — bright target palette × fade.
          droneColors[i3] = targetColors[i3] * fade;
          droneColors[i3 + 1] = targetColors[i3 + 1] * fade;
          droneColors[i3 + 2] = targetColors[i3 + 2] * fade;
          // Trail line — vertex 0 = origin (dim), vertex 1 = current
          // position (drone colour). LineSegments draws this line
          // additively so it reads as a "streak of light".
          trailPositions[i6] = trailOrigins[i3];
          trailPositions[i6 + 1] = trailOrigins[i3 + 1];
          trailPositions[i6 + 2] = trailOrigins[i3 + 2];
          trailPositions[i6 + 3] = positions[i3];
          trailPositions[i6 + 4] = positions[i3 + 1];
          trailPositions[i6 + 5] = positions[i3 + 2];
          // Origin end faded almost to black (invisible in additive
          // blending), tip end lit at 70% drone colour. This gives
          // a proper "bright head, fading tail" streak.
          trailColors[i6] = 0;
          trailColors[i6 + 1] = 0;
          trailColors[i6 + 2] = 0;
          trailColors[i6 + 3] = targetColors[i3] * fade * 0.7;
          trailColors[i6 + 4] = targetColors[i3 + 1] * fade * 0.7;
          trailColors[i6 + 5] = targetColors[i3 + 2] * fade * 0.7;
        }
        trailGeo.attributes.position.needsUpdate = true;
        trailGeo.attributes.color.needsUpdate = true;
      } else {
        for (let i = 0; i < DRONE_COUNT; i++) {
          const i3 = i * 3;
          const hoverX = Math.sin(now * 0.001 + i * 0.13) * 0.6;
          const hoverY = Math.cos(now * 0.0011 + i * 0.17) * 0.5;
          positions[i3] = origins[i3] + (targets[i3] - origins[i3]) * eased + hoverX;
          positions[i3 + 1] = origins[i3 + 1] + (targets[i3 + 1] - origins[i3 + 1]) * eased + hoverY;
          positions[i3 + 2] = origins[i3 + 2] + (targets[i3 + 2] - origins[i3 + 2]) * eased;
          droneColors[i3] = originColors[i3] + (targetColors[i3] - originColors[i3]) * eased;
          droneColors[i3 + 1] =
            originColors[i3 + 1] + (targetColors[i3 + 1] - originColors[i3 + 1]) * eased;
          droneColors[i3 + 2] =
            originColors[i3 + 2] + (targetColors[i3 + 2] - originColors[i3 + 2]) * eased;
        }
      }
      droneGeo.attributes.position.needsUpdate = true;
      droneGeo.attributes.color.needsUpdate = true;

      // Per-stage rotation — only scene stages currently expose
      // `spin`. Applied to the drone Points object as Z-axis
      // rotation so the whole formation rotates around origin.
      // Reset to 0 for stages without spin so heart/text/etc don't
      // inherit rotation from the galaxy stage before them.
      const stageSpin =
        stage.spec.kind === 'scene' && stage.spec.spin
          ? stage.spec.spin
          : 0;
      drones.rotation.z = (stageSpin * elapsed) / 1000;

      camera.position.x = Math.sin(now * 0.0001) * 16;
      camera.position.y = 30 + Math.sin(now * 0.00015) * 6;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);

      if (t >= 1) {
        if (idx < resolved.length - 1) {
          setStage(idx + 1);
          onStageEnter();
        } else if (loop) {
          // Loop mode — restart from the top. Origins snapshot inside
          // setStage means drones smoothly morph from the last stage's
          // formation back into stage 0.
          setStage(0);
          onStageEnter();
        } else {
          finished = true;
          if (photoTimer) clearInterval(photoTimer);
          if (onDone) setTimeout(onDone, 500);
          return;
        }
      }
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);

    const onResize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', onResize);

    return () => {
      finished = true;
      cancelAnimationFrame(raf);
      if (photoTimer) clearInterval(photoTimer);
      window.removeEventListener('resize', onResize);
      droneGeo.dispose();
      droneMat.dispose();
      droneTex.dispose();
      starGeo.dispose();
      trailGeo.dispose();
      trailMat.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (typeof document === 'undefined') return null;

  const currentStage = resolvedRef.current?.[stageIdx]?.spec;
  const photoUrls = currentStage?.kind === 'photos' ? currentStage.urls : [];
  // Show the heart-embedded photo while the current stage is a heart
  // scene. The rest of the stages (text, countdown, runners…) hide it.
  const showHeartPhoto =
    !!heartPhotoUrl &&
    currentStage?.kind === 'scene' &&
    currentStage.sceneKey === 'heart';

  const content = (
    <div
      className={inline ? 'absolute inset-0' : 'fixed inset-0 z-400'}
      style={{ background: inline ? 'transparent' : '#05060a' }}
    >
      {/* Three.js canvas */}
      <div ref={mountRef} className="absolute inset-0" />

      {/* Photo embedded INSIDE the drone-formed heart. Circular crop,
          faded in only while the heart scene is active. */}
      <AnimatePresence>
        {showHeartPhoto && heartPhotoUrl && (
          <motion.div
            key="heart-embedded-photo"
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
            className="absolute inset-0 pointer-events-none flex items-center justify-center"
          >
            <div
              style={{
                width: 'min(30vh, 32vw, 220px)',
                aspectRatio: '1',
                borderRadius: '50%',
                overflow: 'hidden',
                boxShadow: `0 0 44px ${photoShadow}, 0 0 12px rgba(255,255,255,0.25) inset`,
                border: '2px solid rgba(255,255,255,0.25)',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={heartPhotoUrl}
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Legacy photo carousel — birthday capsule still uses the
          dedicated 'photos' stage. Untouched. */}
      {photoUrls.length > 0 && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div
            className="relative"
            style={{ width: 'min(60vw, 520px)', aspectRatio: '4 / 3' }}
          >
            <AnimatePresence>
              {photoUrls.map((url, i) =>
                i === photoIdx ? (
                  <motion.div
                    key={url + i}
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.05 }}
                    transition={{ duration: 0.7, ease: 'easeOut' }}
                    className="absolute inset-0 rounded-xl overflow-hidden"
                    style={{ boxShadow: `0 0 40px ${photoShadow}` }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="w-full h-full object-cover" />
                  </motion.div>
                ) : null,
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Subtitle */}
      <div className="absolute bottom-12 left-0 right-0 text-center pointer-events-none">
        <AnimatePresence mode="wait">
          {label && (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.4 }}
              className="inline-block px-4 py-2 rounded-full text-sm font-semibold text-white"
              style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(6px)' }}
            >
              {label}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Skip — only in one-shot mode. Loop shows have no "end" to skip to. */}
      {skipReady && !loop && onDone && (
        <button
          onClick={onDone}
          className="absolute top-4 right-4 text-[11px] font-semibold text-white/80 hover:text-white px-3 py-1.5 rounded-full cursor-pointer"
          style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
        >
          Skip ▸
        </button>
      )}
    </div>
  );

  return inline ? content : createPortal(content, document.body);
}
