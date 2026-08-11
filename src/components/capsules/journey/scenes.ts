// Scene drawers — each function paints one tableau into a 2D canvas. The
// JourneyDroneShow then samples opaque pixels from the result to use as
// target positions for the drone swarm. Drawings are intentionally
// silhouette-style: thick strokes, filled circles, no fine detail —
// detail can't survive a 600-drone reconstruction anyway.
//
// All drawings assume the canvas is set up with the origin at top-left,
// width = W, height = H. Coordinates are normalised so each drawer
// scales naturally to the canvas size handed to it.

export type SceneDrawer = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

// ── Helpers ──────────────────────────────────────────────────────────────

function fillCircle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function strokeCircle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, lw: number) {
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
}

function thickLine(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number, x2: number, y2: number, lw: number,
) {
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

// Stick figure with optional head-tilt + arm position. Designed to be
// readable at small sizes when reconstructed by ~80 drones.
function stickFigure(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, scale: number,
  opts: { armsForward?: boolean; armsHugging?: boolean } = {},
) {
  const headR = 7 * scale;
  const bodyH = 22 * scale;
  const armH = 14 * scale;
  const legH = 18 * scale;
  const lw = 4 * scale;

  // Head (filled so it samples densely)
  fillCircle(ctx, cx, cy - bodyH - headR, headR);
  // Body
  thickLine(ctx, cx, cy - bodyH, cx, cy, lw);
  // Arms
  if (opts.armsForward) {
    thickLine(ctx, cx, cy - bodyH + 5 * scale, cx + armH * 0.9, cy - bodyH + 6 * scale, lw);
  } else if (opts.armsHugging) {
    // Hugging arms wrap forward to the rider in front
    thickLine(ctx, cx, cy - bodyH + 4 * scale, cx + armH * 0.7, cy - bodyH + 8 * scale, lw);
    thickLine(ctx, cx - 1, cy - bodyH + 7 * scale, cx + armH * 0.6, cy - bodyH + 11 * scale, lw);
  } else {
    thickLine(ctx, cx, cy - bodyH + 4 * scale, cx - armH * 0.6, cy - bodyH + 14 * scale, lw);
    thickLine(ctx, cx, cy - bodyH + 4 * scale, cx + armH * 0.6, cy - bodyH + 14 * scale, lw);
  }
  // Legs
  thickLine(ctx, cx, cy, cx - 8 * scale, cy + legH, lw);
  thickLine(ctx, cx, cy, cx + 8 * scale, cy + legH, lw);
}

// ── Scenes ───────────────────────────────────────────────────────────────

// Filled heart: classic two-arc-and-triangle shape, centred.
export const heartScene: SceneDrawer = (ctx, w, h) => {
  ctx.fillStyle = '#fff';
  const cx = w / 2;
  const cy = h / 2;
  const size = Math.min(w, h) * 0.55;
  const x = cx - size / 2;
  const y = cy - size / 2 + size * 0.05;
  ctx.beginPath();
  ctx.moveTo(cx, y + size);
  ctx.bezierCurveTo(x - size * 0.1, y + size * 0.55, x, y + size * 0.15, x + size * 0.3, y + size * 0.1);
  ctx.bezierCurveTo(x + size * 0.45, y + size * 0.05, cx, y + size * 0.25, cx, y + size * 0.42);
  ctx.bezierCurveTo(cx, y + size * 0.25, x + size * 0.55, y + size * 0.05, x + size * 0.7, y + size * 0.1);
  ctx.bezierCurveTo(x + size, y + size * 0.15, x + size * 1.1, y + size * 0.55, cx, y + size);
  ctx.closePath();
  ctx.fill();
};

// Bicycle with 2 riders — childhood Vietnam vibe, school-bag flavour.
export const bicycleScene: SceneDrawer = (ctx, w, h) => {
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#fff';
  const baseY = h * 0.78;
  const scale = Math.min(w, h) / 200;
  const wheelR = 30 * scale;
  const backX = w * 0.32;
  const frontX = w * 0.68;

  // Wheels (stroked rings + spokes hint)
  strokeCircle(ctx, backX, baseY, wheelR, 5 * scale);
  strokeCircle(ctx, frontX, baseY, wheelR, 5 * scale);
  // Hubs (filled dots)
  fillCircle(ctx, backX, baseY, 3 * scale);
  fillCircle(ctx, frontX, baseY, 3 * scale);

  // Frame
  const seatY = baseY - 38 * scale;
  const headTubeY = baseY - 32 * scale;
  const seatX = backX + 30 * scale;
  const headX = frontX - 8 * scale;
  thickLine(ctx, backX, baseY, seatX, seatY, 4 * scale);          // seat tube
  thickLine(ctx, backX, baseY, headX, headTubeY, 4 * scale);      // down tube
  thickLine(ctx, seatX, seatY, headX, headTubeY, 4 * scale);      // top tube
  thickLine(ctx, headX, headTubeY, frontX, baseY, 4 * scale);     // fork

  // Handlebars
  thickLine(ctx, headX, headTubeY, headX + 14 * scale, headTubeY - 18 * scale, 4 * scale);
  thickLine(ctx, headX + 8 * scale, headTubeY - 14 * scale, headX + 22 * scale, headTubeY - 14 * scale, 4 * scale);

  // Front rider (smaller, leaning forward)
  stickFigure(ctx, headX + 8 * scale, headTubeY - 4 * scale, scale * 0.85, { armsForward: true });
  // Back rider (passenger on the rack — sits taller)
  stickFigure(ctx, seatX - 4 * scale, seatY + 4 * scale, scale * 0.85);
};

// Motorbike with 2 riders — uni / young-adult vibe, helmet shaped heads.
export const motorbikeScene: SceneDrawer = (ctx, w, h) => {
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#fff';
  const baseY = h * 0.78;
  const scale = Math.min(w, h) / 200;
  const wheelR = 34 * scale;
  const backX = w * 0.3;
  const frontX = w * 0.7;

  // Wheels — thicker than bicycle
  strokeCircle(ctx, backX, baseY, wheelR, 7 * scale);
  strokeCircle(ctx, frontX, baseY, wheelR, 7 * scale);
  fillCircle(ctx, backX, baseY, 4 * scale);
  fillCircle(ctx, frontX, baseY, 4 * scale);

  // Body — chunky filled block
  ctx.beginPath();
  ctx.moveTo(backX, baseY - wheelR + 4 * scale);
  ctx.lineTo(backX - 8 * scale, baseY - wheelR - 16 * scale);
  ctx.lineTo(frontX - 12 * scale, baseY - wheelR - 22 * scale);
  ctx.lineTo(frontX + 6 * scale, baseY - wheelR);
  ctx.closePath();
  ctx.fill();

  // Handlebars + windshield
  thickLine(ctx, frontX, baseY - wheelR - 6 * scale, frontX + 4 * scale, baseY - wheelR - 30 * scale, 5 * scale);
  thickLine(ctx, frontX - 8 * scale, baseY - wheelR - 26 * scale, frontX + 12 * scale, baseY - wheelR - 26 * scale, 4 * scale);

  // Front rider (slightly leaning), back rider with arms hugging
  const seatBase = baseY - wheelR - 20 * scale;
  stickFigure(ctx, frontX - 14 * scale, seatBase - 4 * scale, scale * 0.9, { armsForward: true });
  stickFigure(ctx, backX + 14 * scale, seatBase, scale * 0.9, { armsHugging: true });
};

// Car — sedan side profile with two heads visible through windows.
export const carScene: SceneDrawer = (ctx, w, h) => {
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#fff';
  const baseY = h * 0.78;
  const scale = Math.min(w, h) / 200;
  const carW = 150 * scale;
  const carH = 50 * scale;
  const cx = w / 2;
  const left = cx - carW / 2;
  const top = baseY - carH;

  // Lower body (filled)
  ctx.beginPath();
  ctx.moveTo(left, baseY);
  ctx.lineTo(left + carW, baseY);
  ctx.lineTo(left + carW, top + carH * 0.35);
  ctx.lineTo(left, top + carH * 0.35);
  ctx.closePath();
  ctx.fill();

  // Cabin/roof (outline)
  ctx.lineWidth = 5 * scale;
  ctx.beginPath();
  ctx.moveTo(left + carW * 0.15, top + carH * 0.35);
  ctx.lineTo(left + carW * 0.28, top);
  ctx.lineTo(left + carW * 0.72, top);
  ctx.lineTo(left + carW * 0.85, top + carH * 0.35);
  ctx.stroke();

  // Windows divider (b-pillar)
  thickLine(ctx, left + carW * 0.5, top + 4 * scale, left + carW * 0.5, top + carH * 0.35, 3 * scale);

  // Two heads through the windshield
  fillCircle(ctx, left + carW * 0.38, top + carH * 0.22, 6 * scale);
  fillCircle(ctx, left + carW * 0.62, top + carH * 0.22, 6 * scale);

  // Wheels
  const wheelR = 14 * scale;
  fillCircle(ctx, left + carW * 0.2, baseY, wheelR);
  fillCircle(ctx, left + carW * 0.8, baseY, wheelR);
};

// Two people running side by side — used in the couple-heart drone
// show as the closing moment ("us running into the future"). Both
// figures are in mid-stride: forward arm/back leg on one, back
// arm/forward leg on the other, so the pair looks like it's actually
// moving rather than posing.
export const runnersScene: SceneDrawer = (ctx, w, h) => {
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#fff';
  ctx.lineCap = 'round';
  const scale = Math.min(w, h) / 200;
  const baseY = h * 0.72;
  const separation = 42 * scale;
  const cx1 = w / 2 - separation;
  const cx2 = w / 2 + separation;

  const drawRunner = (cx: number, cy: number, flipStride: boolean) => {
    const headR = 8 * scale;
    const bodyH = 24 * scale;
    const armH = 16 * scale;
    const legH = 20 * scale;
    const lw = 4.2 * scale;
    // Slight forward lean — head + shoulders shift ahead of the hips.
    const lean = 4 * scale;

    // Head + body (leaning)
    fillCircle(ctx, cx + lean, cy - bodyH - headR, headR);
    thickLine(ctx, cx + lean, cy - bodyH, cx, cy, lw);

    // Arms — one forward high, one back low (running swing)
    const armFwdX = cx + lean + (flipStride ? -armH * 0.85 : armH * 0.85);
    const armFwdY = cy - bodyH + 2 * scale;
    const armBackX = cx + lean + (flipStride ? armH * 0.65 : -armH * 0.65);
    const armBackY = cy - bodyH + 12 * scale;
    thickLine(ctx, cx + lean, cy - bodyH + 5 * scale, armFwdX, armFwdY, lw);
    thickLine(ctx, cx + lean, cy - bodyH + 5 * scale, armBackX, armBackY, lw);

    // Legs — opposite phase to arms. Front leg bent at knee, back leg
    // extended and trailing.
    const legFwdKneeX = cx + (flipStride ? -6 * scale : 6 * scale);
    const legFwdKneeY = cy + legH * 0.5;
    const legFwdFootX = cx + (flipStride ? -14 * scale : 14 * scale);
    const legFwdFootY = cy + legH;
    const legBackKneeX = cx + (flipStride ? 8 * scale : -8 * scale);
    const legBackKneeY = cy + legH * 0.55;
    const legBackFootX = cx + (flipStride ? 14 * scale : -14 * scale);
    const legBackFootY = cy + legH + 3 * scale;
    thickLine(ctx, cx, cy, legFwdKneeX, legFwdKneeY, lw);
    thickLine(ctx, legFwdKneeX, legFwdKneeY, legFwdFootX, legFwdFootY, lw);
    thickLine(ctx, cx, cy, legBackKneeX, legBackKneeY, lw);
    thickLine(ctx, legBackKneeX, legBackKneeY, legBackFootX, legBackFootY, lw);
  };

  // Mirror stride phase between the two runners so they visibly stride
  // in sync rather than looking like carbon copies.
  drawRunner(cx1, baseY, false);
  drawRunner(cx2, baseY, true);
};

// Draw one stylised rose silhouette at (cx, cy) with radius r and the
// given rotation. Composed as 5 outer petal ellipses radiating from
// the centre + a filled centre bulb + a destination-out inner hole
// (the "rose heart") + a tiny lit dot in the middle. This produces
// a flower-shaped silhouette drones can reconstruct as an
// unmistakable rose, unlike a plain filled circle which just reads
// as a polka dot.
function drawRose(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  rotation: number,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);

  const PETAL_COUNT = 5;
  const petalDist = r * 0.42;
  const petalLong = r * 0.62;
  const petalShort = r * 0.42;

  // 5 petals radiating outward — each ellipse tilted so its long
  // axis points away from the rose centre.
  for (let i = 0; i < PETAL_COUNT; i++) {
    const angle = (i / PETAL_COUNT) * Math.PI * 2 - Math.PI / 2;
    const px = Math.cos(angle) * petalDist;
    const py = Math.sin(angle) * petalDist;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(angle + Math.PI / 2);
    ctx.beginPath();
    ctx.ellipse(0, 0, petalShort, petalLong, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Centre bulb — blends petals into one flower body.
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.32, 0, Math.PI * 2);
  ctx.fill();

  // Rose heart — erased inner circle. Drones leave a visible gap
  // here so the flower has a real focal centre instead of being a
  // uniform blob.
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';

  // Single-drone bright pistil in the very middle of the erased
  // heart — a tiny light point that anchors each rose.
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.06, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ═══════════════════════════════════════════════════════════════════
// BURST-TYPE HELPERS — each mimics a real firework shell style so
// the sky reads as an authentic drone show instead of a wallpaper of
// identical starbursts. Called by fireworksScene which composes 10
// bursts of mixed types across the frame.
//
// Design lesson from real firework photos: each "ray" is actually a
// CHAIN of tiny bright sparks trailing outward, not a solid line.
// drawSparkRay lays down that chain — 10-14 dots along the ray path,
// gently tapering in size (fresh sparks near centre → dying sparks at
// tip) and optionally curving under simulated gravity for willow-like
// droop. Drones cluster on the dot chain, reconstructing a
// convincingly organic spark trail after the morph.
// ═══════════════════════════════════════════════════════════════════

// Lay a chain of tapering sparks along a straight (or curved) ray
// from (cx, cy) at the given angle, spanning lengthPx canvas pixels.
// Gravity is expressed in scale units and applied quadratically (t²)
// so the droop feels like real spark trails — negligible at the head,
// pronounced toward the tail.
function drawSparkRay(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  angle: number,
  lengthPx: number,
  dotCount: number,
  scale: number,
  gravity: number,   // scale units
  headSize: number,  // dot radius at t=1/N (scale units)
  tipSize: number,   // dot radius at t=1.0
): void {
  for (let k = 1; k <= dotCount; k++) {
    const t = k / dotCount;
    const px = cx + Math.cos(angle) * lengthPx * t;
    const py = cy + Math.sin(angle) * lengthPx * t + gravity * scale * t * t;
    const r = (headSize + (tipSize - headSize) * t) * scale;
    fillCircle(ctx, px, py, r);
  }
}

// Chrysanthemum (菊花) — the workhorse hero burst. Two interlaced
// layers of dotted spark trails radiating from a bright pistil. Each
// ray is a chain of tapering dots — the "sparks fading outward" look
// you see in real firework photos.
function drawChrysanthemum(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  rays: number, radius: number, scale: number,
  rotation: number,
): void {
  // Outer layer — full-radius spark trails with ±12% length jitter
  // per ray so the silhouette isn't a perfect circle.
  for (let i = 0; i < rays; i++) {
    const angle = (i / rays) * Math.PI * 2 + rotation;
    const jitter = 1 + (((i * 7) % 5) / 5 - 0.5) * 0.24;
    drawSparkRay(ctx, cx, cy, angle, radius * jitter, 12, scale,
      /* gravity */ 1.5,
      /* head */ 2.4,
      /* tip */ 1.0,
    );
  }
  // Inner layer — ~70% ray count at 55% radius, offset half a
  // segment for interlaced-petal look.
  const innerRays = Math.floor(rays * 0.7);
  for (let i = 0; i < innerRays; i++) {
    const angle = (i / innerRays) * Math.PI * 2 + rotation + Math.PI / rays;
    drawSparkRay(ctx, cx, cy, angle, radius * 0.55, 8, scale,
      1.0, 1.9, 0.7,
    );
  }
  // Bright pistil — halo of small dots around a dense core.
  fillCircle(ctx, cx, cy, 4.5 * scale);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    fillCircle(ctx, cx + Math.cos(a) * 3 * scale, cy + Math.sin(a) * 3 * scale, 1.3 * scale);
  }
}

// Peony (牡丹) — dense outer ring pattern with an empty middle, plus
// a subtle mid-radius ring of secondary sparks. Reads as "ring
// flower" vs the chrysanthemum's filled dome.
function drawPeony(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  rays: number, radius: number, scale: number,
  rotation: number,
): void {
  // Outer spark ring — short trails clustered near the outer radius.
  for (let i = 0; i < rays; i++) {
    const angle = (i / rays) * Math.PI * 2 + rotation;
    const jitter = 1 + (((i * 3) % 5) / 5 - 0.5) * 0.08;
    drawSparkRay(ctx, cx, cy, angle, radius * jitter, 6, scale,
      1.5, 2.5, 1.2,
    );
  }
  // Additional outer bloom sparks offset by half a segment
  for (let i = 0; i < rays; i++) {
    const angle = (i / rays) * Math.PI * 2 + rotation + Math.PI / rays;
    const px = cx + Math.cos(angle) * radius * 0.95;
    const py = cy + Math.sin(angle) * radius * 0.95 + 1 * scale;
    fillCircle(ctx, px, py, 1.8 * scale);
  }
  fillCircle(ctx, cx, cy, 3.5 * scale);
}

// 5-point star burst — 5 long spark-trail arms + 5 short offset arms.
// Very readable star silhouette even with random per-drone shuffle.
function drawStar5(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  radius: number, scale: number,
  rotation: number,
): void {
  const points = 5;
  // 5 long primary arms with dense spark trails
  for (let i = 0; i < points; i++) {
    const angle = (i / points) * Math.PI * 2 + rotation - Math.PI / 2;
    drawSparkRay(ctx, cx, cy, angle, radius, 14, scale,
      0.5, 2.8, 1.1,
    );
  }
  // 5 shorter secondary arms filling the notches
  for (let i = 0; i < points; i++) {
    const angle = (i / points) * Math.PI * 2 + rotation - Math.PI / 2 + Math.PI / points;
    drawSparkRay(ctx, cx, cy, angle, radius * 0.5, 8, scale,
      0.3, 2.0, 0.8,
    );
  }
  fillCircle(ctx, cx, cy, 5 * scale);
}

// Willow (垂柳) — long drooping spark trails, mimicking heavy
// gravity-affected sparks in real long-burn fireworks. Uses the
// gravity term of drawSparkRay directly, with upward-aimed rays
// getting more droop (they've been in flight longer).
function drawWillow(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  rays: number, radius: number, scale: number,
  rotation: number,
): void {
  for (let i = 0; i < rays; i++) {
    const angle = (i / rays) * Math.PI * 2 + rotation;
    // Rays aimed sideways or upward droop more; downward-aimed rays
    // droop less because they've already been pulled down.
    const upwardness = Math.max(0, -Math.sin(angle));
    const gravity = 8 + upwardness * 12;
    drawSparkRay(ctx, cx, cy, angle, radius, 12, scale,
      gravity, 2.2, 0.9,
    );
  }
  fillCircle(ctx, cx, cy, 4 * scale);
}

// Legacy simple radial burst — kept for backward compatibility with
// any external caller that imports drawFirework. New code should use
// drawChrysanthemum et al.
function drawFirework(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rays: number,
  radius: number,
  scale: number,
  opts: { withInner?: boolean; offset?: number } = {},
): void {
  const withInner = opts.withInner ?? false;
  const offset = opts.offset ?? 0;
  for (let i = 0; i < rays; i++) {
    const angle = (i / rays) * Math.PI * 2 + offset;
    const endX = cx + Math.cos(angle) * radius;
    const endY = cy + Math.sin(angle) * radius;
    thickLine(ctx, cx, cy, endX, endY, 1.8 * scale);
    fillCircle(ctx, endX, endY, 2.4 * scale);
  }
  fillCircle(ctx, cx, cy, 3.5 * scale);
  if (withInner) {
    const innerCount = Math.max(6, Math.floor(rays / 2));
    for (let i = 0; i < innerCount; i++) {
      const angle = (i / innerCount) * Math.PI * 2 + Math.PI / innerCount;
      const dx = cx + Math.cos(angle) * radius * 0.35;
      const dy = cy + Math.sin(angle) * radius * 0.35;
      fillCircle(ctx, dx, dy, 1.6 * scale);
    }
  }
}

// Pre-burst state — drones cluster tightly at exactly the same
// centres the fireworksScene bursts from. When the show morphs
// from this scene into fireworksScene the drones fly OUTWARD from
// each cluster to the ray tips, producing a visible "shells
// exploding outward" motion rather than a diffuse rearrangement.
//
// Cluster radii are scaled to roughly match the drone share of each
// burst in fireworksScene (hero much larger than the four
// secondaries) so drone density per cluster carries through the
// morph without one burst suddenly gaining or losing drones.
//
// A small trail of embers hangs below the hero cluster to hint at
// the moment BEFORE the detonation — like a shell that's just
// reached its apex.
// Cosmic galaxy spiral — 3 arms tracing outward log spirals from a
// dense central core. The scene is drawn STATIC on the canvas; the
// drone show applies a per-frame Z-axis rotation to the Points
// object at render time, so the galaxy visibly SPINS while drones
// hold the spiral positions. Adds a small heart glyph in the very
// centre — the "love in the middle of the cosmos" romantic hook.
export const galaxyScene: SceneDrawer = (ctx, w, h) => {
  ctx.fillStyle = '#fff';
  const scale = Math.min(w, h) / 200;
  const cx = w / 2;
  const cy = h * 0.45;

  const arms = 3;
  const totalTurns = 1.7;
  const dotsPerArm = 100;
  const b = 0.16;  // spiral tightness (higher = looser spiral)
  const aStart = 6;  // starting radius in scale units (right outside core)

  for (let armI = 0; armI < arms; armI++) {
    const armOffset = (armI / arms) * Math.PI * 2;
    for (let s = 1; s <= dotsPerArm; s++) {
      const t = s / dotsPerArm;
      const theta = t * totalTurns * Math.PI * 2;
      const radius = aStart * Math.exp(b * theta);
      const angle = theta + armOffset;
      // Wobble the arm slightly perpendicular so it reads as an
      // organic star-field arm instead of a clean math curve.
      const wobble = Math.sin(s * 0.9 + armI * 1.3) * 1.4;
      const rx = radius + wobble;
      const px = cx + Math.cos(angle) * rx * scale;
      const py = cy + Math.sin(angle) * rx * scale;
      // Dot size taper — bigger near core (dense star cluster) →
      // smaller at arm tips (sparser outer stars).
      const dotSize = 2.6 - t * 1.6;
      fillCircle(ctx, px, py, dotSize * scale);
    }
  }

  // Galactic core — bright dense central mass.
  fillCircle(ctx, cx, cy, 6 * scale);

  // Star halo ring immediately outside the core.
  for (let i = 0; i < 14; i++) {
    const angle = (i / 14) * Math.PI * 2 + Math.PI / 14;
    const dist = 3.2 * scale;
    fillCircle(ctx, cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist, 1.5 * scale);
  }

  // Small heart glyph inside the core — sits atop the galactic
  // centre. Signature "vũ trụ tình yêu" flourish that makes the
  // cosmic swirl unmistakably romantic rather than purely astronomical.
  const heartR = 3.8 * scale;
  ctx.beginPath();
  ctx.moveTo(cx, cy + heartR * 0.9);
  ctx.bezierCurveTo(
    cx - heartR * 1.4, cy + heartR * 0.3,
    cx - heartR * 1.2, cy - heartR * 0.8,
    cx,               cy - heartR * 0.1,
  );
  ctx.bezierCurveTo(
    cx + heartR * 1.2, cy - heartR * 0.8,
    cx + heartR * 1.4, cy + heartR * 0.3,
    cx,               cy + heartR * 0.9,
  );
  ctx.closePath();
  ctx.fill();

  // A few scattered "distant stars" between the arms so the space
  // between arm branches isn't dead-empty.
  const backgroundSparks: Array<[number, number, number]> = [
    // [dx, dy, size]
    [-60, 40, 1.4],
    [58, 42, 1.4],
    [-70, -30, 1.2],
    [65, -32, 1.2],
    [15, 60, 1],
    [-20, 62, 1],
    [-45, -20, 0.9],
    [50, -18, 0.9],
    [30, 25, 0.8],
    [-30, 30, 0.8],
  ];
  for (const [dx, dy, r] of backgroundSparks) {
    fillCircle(ctx, cx + dx * scale, cy + dy * scale, r * scale);
  }
};

// PRE-shells state: 10 shells at the burst apex WITH visible trailing
// smoke tails behind them — the moment a real firework shell reaches
// its peak, still glowing, still trailing sparks below from its rise.
//
// The key trick: drones distribute across BOTH the apex heads (dense
// clusters) AND the tail dots below (sparse chain). When the show
// then morphs to fireworksShellsScene (drones ONLY at apex clusters,
// NO trails), the tail drones RISE UP into the head clusters. That
// aggregate upward motion reads as "shells finishing their ascent" —
// the visual moment before detonation. It's the missing beat between
// heart and burst.
export const fireworksLaunchScene: SceneDrawer = (ctx, w, h) => {
  ctx.fillStyle = '#fff';
  const scale = Math.min(w, h) / 200;
  const cx = w / 2;
  const cy = h * 0.45;

  // Same 10 burst positions as fireworksScene / fireworksShellsScene.
  // sizes stored so the head cluster dominates (matching the drone
  // share each burst will need after explosion).
  const shells: Array<[number, number, number]> = [
    // [dx, dy, headRadius] in scale units
    [0,   -68, 11],
    [-78, -55, 7],
    [78,  -55, 7],
    [-50, -18, 6.5],
    [50,  -18, 6.5],
    [-88, 12,  6],
    [88,  12,  6],
    [0,   15,  9],
    [-50, 44,  5.5],
    [55,  44,  5.5],
  ];

  for (const [dx, dy, headR] of shells) {
    const apexX = cx + dx * scale;
    const apexY = cy + dy * scale;

    // Head cluster at apex — the shell about to detonate.
    fillCircle(ctx, apexX, apexY, headR * scale);

    // Trailing smoke/spark tail hanging BELOW the apex — 10 dots
    // stepping down with slight sinusoidal sway (real shell smoke
    // wobbles as the wind pushes it).
    const trailLength = 88;  // scale units the tail extends downward
    for (let k = 1; k <= 10; k++) {
      const t = k / 10;
      const tx = apexX + Math.sin(k * 1.7 + dx * 0.1) * 1.6 * scale;
      const ty = apexY + trailLength * scale * t;
      // Larger dots near the head (fresh smoke), smaller near the
      // ground (dispersed smoke).
      const r = (1.9 - t * 1.35) * scale;
      fillCircle(ctx, tx, ty, r);
    }
  }
};

export const fireworksShellsScene: SceneDrawer = (ctx, w, h) => {
  ctx.fillStyle = '#fff';
  const scale = Math.min(w, h) / 200;
  const cx = w / 2;
  const cy = h * 0.45;

  // 10 clusters — exact same positions as fireworksScene bursts so
  // drones concentrate here BEFORE the explosion, then fly outward
  // radially into the ray pattern. Cluster radii are scaled so each
  // one holds a drone share proportional to how many drones its
  // matching burst needs.
  const clusters: Array<[number, number, number]> = [
    // [dx, dy, radius] in scale units, matching fireworksScene layout
    [0,   -68, 11],   // top hero
    [-78, -55, 7],    // top-left wing
    [78,  -55, 7],    // top-right wing
    [-50, -18, 6.5],  // upper mid-left
    [50,  -18, 6.5],  // upper mid-right
    [-88, 12,  6],    // side-left
    [88,  12,  6],    // side-right
    [0,   15,  9],    // mid hero
    [-50, 44,  5.5],  // lower-left
    [55,  44,  5.5],  // lower-right
  ];
  for (const [dx, dy, r] of clusters) {
    fillCircle(ctx, cx + dx * scale, cy + dy * scale, r * scale);
  }

  // Trailing shell embers — pairs of fading dots below the two
  // hero clusters, hinting at "shell just reached apex, about to
  // burst".
  const trailDots: Array<[number, number, number]> = [
    // Below top hero
    [-2, -50, 1.8],
    [1,  -34, 1.4],
    [-3, -20, 1.0],
    // Below mid hero
    [-2, 30,  1.7],
    [1,  46,  1.3],
    [-3, 60,  1.0],
    // Rising trails at bottom edges
    [-40, 78, 1.4],
    [40,  78, 1.4],
  ];
  for (const [dx, dy, r] of trailDots) {
    fillCircle(ctx, cx + dx * scale, cy + dy * scale, r * scale);
  }
};

// A whole sky of drone fireworks — 10 bursts of MIXED types
// (chrysanthemum, peony, star5, willow) across the frame. Real
// fireworks shows never fire 10 identical shells; the mix of shapes
// is what makes the silhouette read as "actual show" rather than
// "wallpaper pattern".
type BurstType = 'chrysanthemum' | 'peony' | 'star5' | 'willow';

export const fireworksScene: SceneDrawer = (ctx, w, h) => {
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#fff';
  ctx.lineCap = 'round';
  const scale = Math.min(w, h) / 200;
  const cx = w / 2;
  const cy = h * 0.45;

  const bursts: Array<{
    type: BurstType;
    dx: number;
    dy: number;
    rays: number;   // ignored by star5
    radius: number;
    rotation: number;
  }> = [
    // Ray counts pushed higher than the old solid-line design: with
    // dotted spark trails each ray uses less "opaque area", so denser
    // spacing keeps the burst reading as a genuine flower of sparks.
    // Top hero — chrysanthemum (dense hero, most rays)
    { type: 'chrysanthemum', dx: 0,   dy: -68, rays: 56, radius: 46, rotation: 0.1 },
    // Top-left — peony (ring)
    { type: 'peony',         dx: -78, dy: -55, rays: 42, radius: 30, rotation: 0.4 },
    // Top-right — 5-point star
    { type: 'star5',         dx: 78,  dy: -55, rays: 0,  radius: 30, rotation: -0.3 },
    // Upper-mid-left — willow (drooping)
    { type: 'willow',        dx: -50, dy: -18, rays: 38, radius: 28, rotation: 0.2 },
    // Upper-mid-right — peony
    { type: 'peony',         dx: 50,  dy: -18, rays: 40, radius: 26, rotation: -0.5 },
    // Mid hero — chrysanthemum (2nd biggest)
    { type: 'chrysanthemum', dx: 0,   dy: 15,  rays: 48, radius: 36, rotation: 0.3 },
    // Side-left — 5-point star
    { type: 'star5',         dx: -88, dy: 12,  rays: 0,  radius: 24, rotation: 0.6 },
    // Side-right — willow
    { type: 'willow',        dx: 88,  dy: 12,  rays: 34, radius: 24, rotation: -0.4 },
    // Lower-left — peony
    { type: 'peony',         dx: -50, dy: 44,  rays: 36, radius: 22, rotation: 0.5 },
    // Lower-right — 5-point star
    { type: 'star5',         dx: 55,  dy: 44,  rays: 0,  radius: 22, rotation: -0.6 },
  ];

  for (const b of bursts) {
    const bx = cx + b.dx * scale;
    const by = cy + b.dy * scale;
    switch (b.type) {
      case 'chrysanthemum':
        drawChrysanthemum(ctx, bx, by, b.rays, b.radius * scale, scale, b.rotation);
        break;
      case 'peony':
        drawPeony(ctx, bx, by, b.rays, b.radius * scale, scale, b.rotation);
        break;
      case 'star5':
        drawStar5(ctx, bx, by, b.radius * scale, scale, b.rotation);
        break;
      case 'willow':
        drawWillow(ctx, bx, by, b.rays, b.radius * scale, scale, b.rotation);
        break;
    }
  }

  // Sparkles filling the sky between bursts. Deterministic PRNG so
  // the scatter is stable across mounts.
  let seed = 137;
  const rnd = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  const burstCentres = bursts.map((b) => ({ x: b.dx * scale, y: b.dy * scale }));
  for (let i = 0; i < 80; i++) {
    const dx = (rnd() - 0.5) * 230 * scale;
    const dy = (rnd() - 0.5) * 180 * scale;
    // Skip if inside any burst's radius (keeps burst patterns clean).
    let tooClose = false;
    for (const c of burstCentres) {
      if (Math.hypot(dx - c.x, dy - c.y) < 24 * scale) {
        tooClose = true;
        break;
      }
    }
    if (tooClose) continue;
    const r = (0.8 + rnd() * 1.3) * scale;
    fillCircle(ctx, cx + dx, cy + dy, r);
  }

  // Rising shell trails from the bottom edge — hint the bursts are
  // still arriving from below.
  const trailStarts: Array<[number, number, number, number]> = [
    [-30, 92, -6, 30],
    [30, 92, 6, 30],
    [-70, 90, -78, 24],
    [70, 90, 78, 24],
  ];
  for (const [sx, sy, ex, ey] of trailStarts) {
    for (let k = 0; k < 4; k++) {
      const t = 0.15 + k * 0.22;
      const px = cx + (sx + (ex - sx) * t) * scale;
      const py = cy + (sy + (ey - sy) * t) * scale;
      fillCircle(ctx, px, py, (1.0 + (3 - k) * 0.25) * scale);
    }
  }
};

// One person holding a big rose bouquet — the gifting moment in the
// couple-heart show.
//
// Design goals (matching "1 bó hoa gồm nhiều bông ghép lại, thấy rõ
// từng bông hoa"):
//   - 14 distinct rose flowers arranged in a layered dome +
//     cascade. Each rose is drawn with drawRose() → true 5-petal
//     flower silhouette, not a filled circle.
//   - Roses are well-spaced so drones cluster densely per bloom
//     (~85 drones/rose) with visible gaps between adjacent flowers.
//     Every rose reads as its own object.
//   - Back → middle → front rendering order gives real depth: back
//     row is smallest, front row is largest, cascading roses hang
//     below the wrap.
//   - Wrap = truncated cone with a BOW ribbon (two loops + knot +
//     streamers) + three angled leaves + five long stems. Rounded
//     hand caps on the arms so the person clearly grips the wrap.
export const roseBouquetScene: SceneDrawer = (ctx, w, h) => {
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#fff';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const scale = Math.min(w, h) / 200;
  const cx = w / 2;
  const feetY = h * 0.92;

  // Person proportions — bouquet covers most of torso; head and
  // shoulders sit above it.
  const legH = 26 * scale;
  const headR = 8.5 * scale;
  const shoulderW = 12 * scale;
  const lw = 4 * scale;
  const hipY = feetY - legH;
  const shoulderY = hipY - 32 * scale;
  const headY = shoulderY - headR - 3 * scale;

  // === PERSON — head, neck, shoulders, legs, feet ===
  fillCircle(ctx, cx, headY, headR);
  thickLine(ctx, cx, headY + headR * 0.9, cx, shoulderY, lw * 0.9);

  // Shoulders — a filled slab above the bouquet, not the full torso
  // (bouquet occludes torso below).
  ctx.beginPath();
  ctx.moveTo(cx - shoulderW, shoulderY);
  ctx.lineTo(cx + shoulderW, shoulderY);
  ctx.lineTo(cx + shoulderW * 0.9, shoulderY + 8 * scale);
  ctx.lineTo(cx - shoulderW * 0.9, shoulderY + 8 * scale);
  ctx.closePath();
  ctx.fill();

  // Legs
  thickLine(ctx, cx - 4 * scale, hipY, cx - 9 * scale, feetY, lw);
  thickLine(ctx, cx + 4 * scale, hipY, cx + 9 * scale, feetY, lw);
  // Feet
  ctx.beginPath();
  ctx.ellipse(cx - 9 * scale, feetY, 5 * scale, 2 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx + 9 * scale, feetY, 5 * scale, 2 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // === BOUQUET ===
  const bqCx = cx;
  const bqTop = shoulderY + 6 * scale;      // top of rose dome
  const bqWrapTop = bqTop + 32 * scale;
  const bqWrapBottom = bqWrapTop + 30 * scale;

  // Wrap paper — trapezoid cone, wider at top.
  ctx.beginPath();
  ctx.moveTo(bqCx - 26 * scale, bqWrapTop);
  ctx.lineTo(bqCx + 26 * scale, bqWrapTop);
  ctx.lineTo(bqCx + 11 * scale, bqWrapBottom);
  ctx.lineTo(bqCx - 11 * scale, bqWrapBottom);
  ctx.closePath();
  ctx.fill();

  // Bow — two elliptical loops + centre knot + streamers. Reads
  // instantly as "ribbon bow" in silhouette.
  const bowY = bqWrapTop + 7 * scale;
  ctx.save();
  ctx.translate(bqCx - 9 * scale, bowY);
  ctx.rotate(-Math.PI / 6);
  ctx.beginPath();
  ctx.ellipse(0, 0, 7 * scale, 5 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.translate(bqCx + 9 * scale, bowY);
  ctx.rotate(Math.PI / 6);
  ctx.beginPath();
  ctx.ellipse(0, 0, 7 * scale, 5 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // Knot
  fillCircle(ctx, bqCx, bowY, 3.5 * scale);
  // Streamers
  thickLine(ctx, bqCx - 3 * scale, bowY + 4 * scale,
                 bqCx - 8 * scale, bowY + 20 * scale, 2.5 * scale);
  thickLine(ctx, bqCx + 3 * scale, bowY + 4 * scale,
                 bqCx + 10 * scale, bowY + 22 * scale, 2.5 * scale);

  // Leaves — 3 elongated ellipses poking out at the base of the dome
  // and one below. Rotated so they angle outward like real foliage.
  const leaves: Array<[number, number, number, number]> = [
    // [dx, dy, rotationRad, sizeMul]
    [-22, 20, -Math.PI / 3.2, 1.0],
    [22, 20, Math.PI / 3.2, 1.0],
    [0, 30, 0, 0.75],
  ];
  for (const [dx, dy, rot, sMul] of leaves) {
    ctx.save();
    ctx.translate(bqCx + dx * scale, bqTop + dy * scale);
    ctx.rotate(rot);
    ctx.beginPath();
    ctx.ellipse(0, 0, 10 * scale * sMul, 4 * scale * sMul, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Rose blooms — 14 individual 5-petal flowers layered back → front.
  // Positions are hand-composed so the reader sees a dome of many
  // separate roses (not a single blob), with a hero flower slightly
  // below-centre plus a cascading rose hanging under the wrap.
  const roseSpecs: Array<[number, number, number, number]> = [
    // [dx, dy, sizeMul, rotationRad] — offsets from bouquet dome top.
    // Back row (top of dome, smallest, drawn first so front covers)
    [-19, -6, 0.7, 0.3],
    [-5, -9, 0.72, -0.2],
    [10, -9, 0.72, 0.5],
    [22, -5, 0.7, -0.35],

    // Middle row (medium)
    [-26, 8, 0.88, -0.4],
    [-14, 6, 0.92, 0.35],
    [14, 6, 0.92, -0.35],
    [26, 8, 0.88, 0.4],

    // Front row (biggest)
    [-22, 22, 1.05, 0.25],
    [22, 22, 1.05, -0.25],

    // Hero rose — largest, front-centre, slightly below crown.
    [0, 14, 1.35, 0.1],

    // Front-row wings flanking the hero
    [-11, 24, 1.1, -0.3],
    [11, 24, 1.1, 0.3],

    // Cascade — one rose hanging below the main dome, gives the
    // bouquet a floral "waterfall" edge instead of a hard bottom.
    [0, 36, 0.85, 0],
  ];

  // Sort by y ascending so back roses (smaller y) draw first — front
  // roses (larger y) end up on top with proper occlusion.
  const roses = roseSpecs
    .map(([dx, dy, sMul, rot]) => ({
      x: bqCx + dx * scale,
      y: bqTop + dy * scale,
      r: 12 * scale * sMul,
      rot,
    }))
    .sort((a, b) => a.y - b.y);

  for (const rose of roses) {
    drawRose(ctx, rose.x, rose.y, rose.r, rose.rot);
  }

  // Stems — five long verticals dropping below the wrap.
  for (let i = -2; i <= 2; i++) {
    thickLine(
      ctx,
      bqCx + i * 3.5 * scale, bqWrapBottom,
      bqCx + i * 2 * scale, bqWrapBottom + 26 * scale,
      2 * scale,
    );
  }

  // === ARMS — drawn LAST so they render in front of the bouquet,
  // holding it. Shoulder → elbow (down + out) → grip on the wrap.
  const gripY = bqWrapTop + 14 * scale;
  const gripXOffset = 14 * scale;
  const elbowY = shoulderY + 16 * scale;
  const elbowXOffset = 22 * scale;
  const handR = lw * 0.95;
  // Left arm
  thickLine(ctx, cx - shoulderW + 1 * scale, shoulderY + 6 * scale,
                 cx - elbowXOffset, elbowY, lw);
  thickLine(ctx, cx - elbowXOffset, elbowY,
                 cx - gripXOffset, gripY, lw);
  fillCircle(ctx, cx - gripXOffset, gripY, handR);
  // Right arm
  thickLine(ctx, cx + shoulderW - 1 * scale, shoulderY + 6 * scale,
                 cx + elbowXOffset, elbowY, lw);
  thickLine(ctx, cx + elbowXOffset, elbowY,
                 cx + gripXOffset, gripY, lw);
  fillCircle(ctx, cx + gripXOffset, gripY, handR);
};

// One partner waiting on the left, another sprinting in from the
// right — the "gap between us is closing" beat that precedes the
// hug scene. The running figure faces LEFT so its motion clearly
// reads as "toward the standing partner".
export const approachScene: SceneDrawer = (ctx, w, h) => {
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#fff';
  ctx.lineCap = 'round';
  const scale = Math.min(w, h) / 200;
  const baseY = h * 0.78;

  const stillCx = w * 0.32;
  const runCx = w * 0.66;

  // Standing figure (waiting)
  const headR = 8 * scale;
  const bodyH = 24 * scale;
  const legH = 22 * scale;
  const lw = 4 * scale;

  const stillHipY = baseY - legH;
  const stillShoulderY = stillHipY - bodyH;
  fillCircle(ctx, stillCx, stillShoulderY - headR - 2 * scale, headR);
  thickLine(ctx, stillCx, stillShoulderY, stillCx, stillHipY, lw);
  // Relaxed arms
  thickLine(ctx, stillCx, stillShoulderY + 3 * scale, stillCx - 9 * scale, stillHipY - 2 * scale, lw);
  thickLine(ctx, stillCx, stillShoulderY + 3 * scale, stillCx + 9 * scale, stillHipY - 2 * scale, lw);
  // Straight legs
  thickLine(ctx, stillCx, stillHipY, stillCx - 6 * scale, baseY, lw);
  thickLine(ctx, stillCx, stillHipY, stillCx + 6 * scale, baseY, lw);

  // Running figure — mid-stride, facing LEFT (mirrored). Body leans
  // forward-left, front leg forward-left, back leg extended right.
  const runHipY = baseY - legH;
  const runShoulderY = runHipY - bodyH;
  const lean = 5 * scale;   // lean toward the direction of motion (-x)

  fillCircle(ctx, runCx - lean, runShoulderY - headR - 2 * scale, headR);
  thickLine(ctx, runCx - lean, runShoulderY, runCx, runHipY, lw);
  // Forward arm reaching toward the standing figure
  thickLine(ctx,
    runCx - lean, runShoulderY + 3 * scale,
    runCx - 18 * scale, runShoulderY + 1 * scale,
    lw,
  );
  // Trailing arm (swung back)
  thickLine(ctx,
    runCx - lean, runShoulderY + 3 * scale,
    runCx + 12 * scale, runShoulderY + 14 * scale,
    lw,
  );
  // Front leg (forward-left, bent at knee)
  thickLine(ctx, runCx, runHipY, runCx - 12 * scale, runHipY + legH * 0.55, lw);
  thickLine(ctx, runCx - 12 * scale, runHipY + legH * 0.55, runCx - 16 * scale, baseY, lw);
  // Back leg (extended right)
  thickLine(ctx, runCx, runHipY, runCx + 8 * scale, runHipY + legH * 0.55, lw);
  thickLine(ctx, runCx + 8 * scale, runHipY + legH * 0.55, runCx + 14 * scale, baseY + 2 * scale, lw);
};

// The reunion — two figures in a close embrace, arms wrapped around
// each other. A small heart floats between the heads to sell the
// emotional beat.
export const hugScene: SceneDrawer = (ctx, w, h) => {
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#fff';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const scale = Math.min(w, h) / 200;
  const cx = w / 2;
  const baseY = h * 0.82;

  const headR = 9 * scale;
  const bodyH = 28 * scale;
  const legH = 24 * scale;
  const lw = 4.2 * scale;
  const gap = 3 * scale;     // horizontal gap between the two figures
  const leftCx = cx - headR - gap / 2;
  const rightCx = cx + headR + gap / 2;

  const hipY = baseY - legH;
  const shoulderY = hipY - bodyH;
  const headY = shoulderY - headR - 1 * scale;

  // Heads — turned slightly toward each other via horizontal squash.
  ctx.beginPath();
  ctx.ellipse(leftCx, headY, headR * 0.95, headR, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(rightCx, headY, headR * 0.95, headR, 0, 0, Math.PI * 2);
  ctx.fill();

  // Torsos leaning inward toward each other
  ctx.beginPath();
  ctx.moveTo(leftCx - 6 * scale, shoulderY);
  ctx.lineTo(leftCx + 4 * scale, shoulderY);
  ctx.lineTo(leftCx + 2 * scale, hipY);
  ctx.lineTo(leftCx - 6 * scale, hipY);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(rightCx - 4 * scale, shoulderY);
  ctx.lineTo(rightCx + 6 * scale, shoulderY);
  ctx.lineTo(rightCx + 6 * scale, hipY);
  ctx.lineTo(rightCx - 2 * scale, hipY);
  ctx.closePath();
  ctx.fill();

  // Hugging arms — each figure's inner arm reaches around the other's
  // back, wrapping across the shoulder line. Outer arms drape down.
  thickLine(ctx,
    leftCx + 2 * scale, shoulderY + 4 * scale,
    rightCx + 10 * scale, shoulderY + 12 * scale, lw,
  );
  thickLine(ctx,
    rightCx - 2 * scale, shoulderY + 4 * scale,
    leftCx - 10 * scale, shoulderY + 12 * scale, lw,
  );
  // Outer arms
  thickLine(ctx,
    leftCx - 6 * scale, shoulderY + 3 * scale,
    leftCx - 12 * scale, shoulderY + 16 * scale, lw,
  );
  thickLine(ctx,
    rightCx + 6 * scale, shoulderY + 3 * scale,
    rightCx + 12 * scale, shoulderY + 16 * scale, lw,
  );

  // Legs — stance close, feet grounded.
  thickLine(ctx, leftCx - 2 * scale, hipY, leftCx - 6 * scale, baseY, lw);
  thickLine(ctx, leftCx - 2 * scale, hipY, leftCx - 10 * scale, baseY, lw);
  thickLine(ctx, rightCx + 2 * scale, hipY, rightCx + 6 * scale, baseY, lw);
  thickLine(ctx, rightCx + 2 * scale, hipY, rightCx + 10 * scale, baseY, lw);

  // Small heart floating above the couple's heads.
  const heartCy = headY - headR - 8 * scale;
  const heartR = 6 * scale;
  fillCircle(ctx, cx - heartR * 0.55, heartCy, heartR * 0.7);
  fillCircle(ctx, cx + heartR * 0.55, heartCy, heartR * 0.7);
  ctx.beginPath();
  ctx.moveTo(cx - heartR * 1.1, heartCy + heartR * 0.15);
  ctx.lineTo(cx + heartR * 1.1, heartCy + heartR * 0.15);
  ctx.lineTo(cx, heartCy + heartR * 1.5);
  ctx.closePath();
  ctx.fill();
};

// Cake — final stage before the photo + reveal.
export const cakeScene: SceneDrawer = (ctx, w, h) => {
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#fff';
  const cx = w / 2;
  const cy = h / 2;
  const scale = Math.min(w, h) / 200;

  // Cake body — 2 tiers
  const lowerW = 120 * scale;
  const lowerH = 40 * scale;
  const upperW = 80 * scale;
  const upperH = 30 * scale;
  ctx.fillRect(cx - lowerW / 2, cy + 10 * scale, lowerW, lowerH);
  ctx.fillRect(cx - upperW / 2, cy - upperH + 10 * scale, upperW, upperH);

  // Candles
  const candles = 5;
  const candleW = 4 * scale;
  const candleH = 14 * scale;
  const spread = 50 * scale;
  for (let i = 0; i < candles; i++) {
    const t = i / (candles - 1);
    const x = cx - spread + t * (spread * 2);
    ctx.fillRect(x - candleW / 2, cy - upperH - candleH + 10 * scale, candleW, candleH);
    // Flame (small filled diamond)
    fillCircle(ctx, x, cy - upperH - candleH + 4 * scale, 3 * scale);
  }
};

// Pick the drawer for a stage key. Centralised so the show component only
// needs a string identifier per stage.
export const SCENE_DRAWERS: Record<string, SceneDrawer> = {
  heart: heartScene,
  bicycle: bicycleScene,
  motorbike: motorbikeScene,
  car: carScene,
  cake: cakeScene,
  runners: runnersScene,
  bouquet: roseBouquetScene,
  fireworks: fireworksScene,
  fireworksShells: fireworksShellsScene,
  fireworksLaunch: fireworksLaunchScene,
  galaxy: galaxyScene,
  approach: approachScene,
  hug: hugScene,
};
