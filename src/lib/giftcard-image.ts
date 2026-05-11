// Offline voucher image generator.
//
// Renders a printable / saveable PNG that contains everything the
// merchant needs to redeem the card without an internet connection:
//   - Card visual design (gradient, business name, value, emoji)
//   - The redeem QR (encoded with the card id)
//   - Card name + expiry
//   - Gao Social attribution
//
// Output: 1080×1620 portrait (2:3, social-friendly). Layout is split
// into a "card top" section and a "redeem bottom" section divided by a
// subtle line so neither overlaps the other.

import QRCodeLib from 'qrcode';

export interface VoucherCard {
  id: string;
  name: string;
  description?: string | null;
  business_name?: string | null;
  type: 'voucher' | 'stored_value' | 'service' | 'loyalty';
  face_value?: number;
  percent_off?: number;
  amount_off?: number;
  service_name?: string | null;
  currency?: string;
  gradient_from?: string;
  gradient_to?: string;
  cover_image?: string | null;
  icon_emoji?: string | null;
  tagline?: string | null;
  text_color?: string | null;
  expires_at?: string | null;
  expires_in_days?: number;
}

const W = 1080;
const H = 1620;

// Vertical zones — keeps every piece of text in its own band so nothing
// ever overlaps the QR. Re-tuning these here propagates everywhere.
const ZONE = {
  businessY:   140,
  subtitleY:   205,
  emojiY:      370,
  valueY:      620,
  taglineY:    720,
  nameY:       810,
  descY:       870,
  // Bottom redeem panel (white card containing the QR)
  panelTop:    960,
  panelHeight: 560,
  // Inside the panel
  qrSize:      400,
  qrTop:       1000,    // panelTop + 40 padding
  captionY:    1455,    // below the QR inside the panel
  // Outside the panel
  metaY:       1560,
};

export async function generateVoucherImage(card: VoucherCard, valueLabel: string): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D unavailable');

  const from = card.gradient_from || '#00d4ff';
  const to = card.gradient_to || '#a78bfa';
  const tc = (card.text_color && /^#[0-9a-fA-F]{3,8}$/.test(card.text_color))
    ? card.text_color : '#ffffff';
  const isLight = isLightHex(tc);

  // ── 1. Background gradient ─────────────────────────────────────────
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, from);
  grad.addColorStop(1, to);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Optional cover image — opacity 0.4 so text-on-photo still reads.
  if (card.cover_image) {
    try {
      const coverImg = await loadImage(card.cover_image);
      ctx.globalAlpha = 0.45;
      drawCover(ctx, coverImg, 0, 0, W, H);
      ctx.globalAlpha = 1;
    } catch {
      // Fall through — gradient stays as the background.
    }
  }

  // Soft top-left light + bottom-right shade for depth.
  paintRadial(ctx, W * 0.2, H * 0.15, W * 0.7, 'rgba(255,255,255,0.18)', 'rgba(255,255,255,0)');
  paintRadial(ctx, W * 0.85, H * 0.5,  W * 0.6, 'rgba(0,0,0,0.25)',     'rgba(0,0,0,0)');

  // ── 2. Business name — auto-shrunk to fit the canvas width ─────────
  drawAutoFit(ctx, (card.business_name || 'Gao Social').toUpperCase(), {
    x: W / 2,
    y: ZONE.businessY,
    maxWidth: W - 160,           // 80px gutter each side
    maxSize: 60,
    minSize: 30,
    weight: 900,
    color: withAlpha(tc, 0.95),
    shadow: shadowFor(isLight, 0.4),
    tracking: 6,
  });

  drawText(ctx, 'GAO · GIFTCARD', {
    x: W / 2,
    y: ZONE.subtitleY,
    size: 22,
    weight: 700,
    color: withAlpha(tc, 0.55),
    shadow: shadowFor(isLight, 0.25),
    tracking: 8,
  });

  // ── 3. Emoji / chip ────────────────────────────────────────────────
  if (card.icon_emoji) {
    ctx.save();
    ctx.font = '160px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 28;
    ctx.shadowOffsetY = 6;
    ctx.fillText(card.icon_emoji, W / 2, ZONE.emojiY);
    ctx.restore();
  } else {
    // Default — small gold chip as a subtle anchor.
    const cx = W / 2, cy = ZONE.emojiY, cw = 100, ch = 76;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 12;
    const chip = ctx.createLinearGradient(cx - cw / 2, cy - ch / 2, cx + cw / 2, cy + ch / 2);
    chip.addColorStop(0, '#f6e6a3');
    chip.addColorStop(0.45, '#d4af37');
    chip.addColorStop(1, '#8a6e1f');
    ctx.fillStyle = chip;
    roundRect(ctx, cx - cw / 2, cy - ch / 2, cw, ch, 14);
    ctx.fill();
    ctx.restore();
  }

  // ── 4. Value (headline) — auto-shrink for long strings ────────────
  drawAutoFit(ctx, valueLabel, {
    x: W / 2,
    y: ZONE.valueY,
    maxWidth: W - 180,
    maxSize: 180,
    minSize: 80,
    weight: 900,
    color: withAlpha(tc, 1),
    shadow: shadowFor(isLight, 0.4),
  });

  // ── 5. Tagline pill (optional) ────────────────────────────────────
  if (card.tagline) {
    const text = card.tagline.toUpperCase().slice(0, 60);
    ctx.font = `700 28px system-ui, sans-serif`;
    const w = ctx.measureText(text).width + (text.length - 1) * 3;
    const padX = 30, padY = 14;
    const pillW = w + padX * 2;
    const pillH = 28 + padY * 2;
    const pillX = W / 2 - pillW / 2;
    const pillY = ZONE.taglineY - pillH / 2;
    ctx.save();
    ctx.fillStyle = withAlpha(tc, 0.16);
    ctx.strokeStyle = withAlpha(tc, 0.28);
    ctx.lineWidth = 2;
    roundRect(ctx, pillX, pillY, pillW, pillH, pillH / 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    drawText(ctx, text, {
      x: W / 2, y: ZONE.taglineY,
      size: 28, weight: 700,
      color: withAlpha(tc, 0.95),
      shadow: shadowFor(isLight, 0.3),
      tracking: 3,
    });
  }

  // ── 6. Card name + description ─────────────────────────────────────
  drawAutoFit(ctx, card.name || 'Gift card', {
    x: W / 2,
    y: ZONE.nameY,
    maxWidth: W - 180,
    maxSize: 48,
    minSize: 28,
    weight: 700,
    color: withAlpha(tc, 0.9),
    shadow: shadowFor(isLight, 0.3),
  });

  if (card.description) {
    drawText(ctx, ellipsis(ctx, card.description, W - 200, 22), {
      x: W / 2,
      y: ZONE.descY,
      size: 22,
      weight: 500,
      color: withAlpha(tc, 0.7),
      shadow: shadowFor(isLight, 0.25),
    });
  }

  // ── 7. White redeem panel — QR + caption sit ENTIRELY inside this ─
  const panelX = 80;
  const panelY = ZONE.panelTop;
  const panelW = W - panelX * 2;
  const panelH = ZONE.panelHeight;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 16;
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, panelX, panelY, panelW, panelH, 32);
  ctx.fill();
  ctx.restore();

  // QR
  const qrDataUrl = await QRCodeLib.toDataURL(card.id, {
    width: ZONE.qrSize,
    margin: 0,
    color: { dark: '#0a0b0f', light: '#ffffff' },
    errorCorrectionLevel: 'H',
  });
  const qrImg = await loadImage(qrDataUrl);
  ctx.drawImage(qrImg, W / 2 - ZONE.qrSize / 2, ZONE.qrTop, ZONE.qrSize, ZONE.qrSize);

  // Caption inside the panel, dark text on the white card
  ctx.save();
  ctx.fillStyle = '#1a1a2e';
  ctx.font = '800 26px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  drawTrackedText(ctx, 'SCAN AT THE SHOP', W / 2, ZONE.captionY, 4);
  ctx.restore();

  // ── 8. Footer — card id + expiry + Gao Social attribution ─────────
  let expiryText = '';
  if (card.expires_at) {
    const exp = new Date(card.expires_at);
    if (!isNaN(exp.getTime())) {
      expiryText = `Valid until ${exp.toLocaleDateString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric',
      })}`;
    }
  } else if (card.expires_in_days) {
    expiryText = `Valid ${card.expires_in_days} days from claim`;
  }

  // Card id (monospace-ish, small, low contrast)
  drawText(ctx, card.id, {
    x: W / 2, y: ZONE.metaY - 36,
    size: 18, weight: 600,
    color: withAlpha(tc, 0.45),
    shadow: shadowFor(isLight, 0.2),
    tracking: 1.5,
  });
  if (expiryText) {
    drawText(ctx, expiryText, {
      x: W / 2, y: ZONE.metaY,
      size: 22, weight: 600,
      color: withAlpha(tc, 0.75),
      shadow: shadowFor(isLight, 0.25),
    });
  }
  drawText(ctx, 'GAO SOCIAL', {
    x: W / 2, y: H - 50,
    size: 24, weight: 800,
    color: withAlpha(tc, 0.6),
    shadow: shadowFor(isLight, 0.25),
    tracking: 8,
  });

  return canvas.toDataURL('image/png');
}

// ─── Drawing helpers ──────────────────────────────────────────────────

interface TextOpts {
  x: number;
  y: number;
  size: number;
  weight?: number;
  color: string;
  shadow?: string;
  tracking?: number;
  align?: CanvasTextAlign;
}

function drawText(ctx: CanvasRenderingContext2D, text: string, opts: TextOpts) {
  ctx.save();
  ctx.fillStyle = opts.color;
  ctx.font = `${opts.weight ?? 700} ${opts.size}px system-ui, -apple-system, sans-serif`;
  ctx.textAlign = opts.align ?? 'center';
  ctx.textBaseline = 'middle';
  if (opts.shadow) {
    ctx.shadowColor = opts.shadow;
    ctx.shadowBlur = opts.size * 0.25;
  }
  if (opts.tracking) {
    drawTrackedText(ctx, text, opts.x, opts.y, opts.tracking);
  } else {
    ctx.fillText(text, opts.x, opts.y);
  }
  ctx.restore();
}

// Render text with manual letter-spacing (Canvas's letterSpacing prop has
// poor browser support). Always centred for now — the only place we use
// tracking is centred headings.
function drawTrackedText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, tracking: number) {
  const chars = [...text];
  const totalW = chars.reduce((s, c) => s + ctx.measureText(c).width, 0) + tracking * (chars.length - 1);
  const prevAlign = ctx.textAlign;
  ctx.textAlign = 'left';
  let cur = x - totalW / 2;
  for (const c of chars) {
    ctx.fillText(c, cur, y);
    cur += ctx.measureText(c).width + tracking;
  }
  ctx.textAlign = prevAlign;
}

// Auto-shrinks the font until the rendered text fits within maxWidth.
function drawAutoFit(
  ctx: CanvasRenderingContext2D,
  text: string,
  opts: {
    x: number; y: number;
    maxWidth: number;
    maxSize: number;
    minSize: number;
    weight: number;
    color: string;
    shadow?: string;
    tracking?: number;
  },
) {
  let size = opts.maxSize;
  while (size > opts.minSize) {
    ctx.font = `${opts.weight} ${size}px system-ui, -apple-system, sans-serif`;
    const tw = opts.tracking
      ? [...text].reduce((s, c) => s + ctx.measureText(c).width, 0) + opts.tracking * (text.length - 1)
      : ctx.measureText(text).width;
    if (tw <= opts.maxWidth) break;
    size -= 4;
  }
  drawText(ctx, text, {
    x: opts.x, y: opts.y, size,
    weight: opts.weight,
    color: opts.color,
    shadow: opts.shadow,
    tracking: opts.tracking,
  });
}

function ellipsis(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, fontSize: number): string {
  ctx.save();
  ctx.font = `500 ${fontSize}px system-ui, sans-serif`;
  if (ctx.measureText(text).width <= maxWidth) {
    ctx.restore();
    return text;
  }
  let lo = 0, hi = text.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (ctx.measureText(text.slice(0, mid) + '…').width <= maxWidth) lo = mid + 1;
    else hi = mid;
  }
  ctx.restore();
  return text.slice(0, Math.max(1, lo - 1)) + '…';
}

function paintRadial(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, from: string, to: string) {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, from);
  g.addColorStop(1, to);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const ar = img.naturalWidth / img.naturalHeight;
  const boxAr = w / h;
  let drawW = w, drawH = h, dx = x, dy = y;
  if (ar > boxAr) {
    drawW = h * ar;
    dx = x - (drawW - w) / 2;
  } else {
    drawH = w / ar;
    dy = y - (drawH - h) / 2;
  }
  ctx.drawImage(img, dx, dy, drawW, drawH);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6);
  const r = parseInt(v.slice(0, 2), 16);
  const g = parseInt(v.slice(2, 4), 16);
  const b = parseInt(v.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function isLightHex(hex: string): boolean {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6);
  const r = parseInt(v.slice(0, 2), 16);
  const g = parseInt(v.slice(2, 4), 16);
  const b = parseInt(v.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6;
}

function shadowFor(isLight: boolean, alpha: number): string {
  return isLight
    ? `rgba(0,0,0,${alpha})`
    : `rgba(255,255,255,${alpha})`;
}
