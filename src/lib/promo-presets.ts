// Pre-built starter templates for Promote Template.
//
// Each preset is a fully-formed PromoElement array + canvas background —
// drop into a new promo_template row and the user starts with a
// designed canvas they can tweak instead of an empty page.
//
// Positions are % of the 540×960 reference canvas (9:16 portrait).
// Keep these in sync with PromoElement shape in PromoBuilder.tsx.

import type { PromoElement } from '@/components/promo/PromoBuilder';

export interface PromoPreset {
  id: string;
  name: string;
  blurb: string;
  background_color: string;
  background_gradient_to: string | null;
  background_image?: string | null;
  elements: PromoElement[];
}

const mk = (over: Partial<PromoElement>): PromoElement => ({
  id: over.id || `el_${Math.random().toString(36).slice(2, 8)}`,
  type: 'text',
  x: 10, y: 10, w: 80, h: 12, rotation: 0, z: 0,
  ...over,
}) as PromoElement;

// Caveat is loaded globally via next/font in app/layout.tsx as --font-caveat.
const SCRIPT_FONT = 'var(--font-caveat), "Caveat", "Brush Script MT", cursive';
const SERIF_FONT = 'Georgia, "Times New Roman", serif';

export const PROMO_PRESETS: PromoPreset[] = [
  // ── 1. Blank — empty canvas ───────────────────────────────────────
  {
    id: 'blank',
    name: 'Blank',
    blurb: 'Start from a clean canvas',
    background_color: '#ffffff',
    background_gradient_to: null,
    background_image: null,
    elements: [],
  },

  // ── 2. Velvet Black Friday — luxury black + gold flyer ────────────
  //     Modeled after a premium nail-spa Black Friday flyer. The two
  //     large image slots on the right are meant for merchant-uploaded
  //     photos (their hand/nails on top, gift box on bottom) — SVG
  //     can't replicate photography, so the template provides the
  //     designed layout and lets the merchant supply real product
  //     photos via the image element upload.
  {
    id: 'velvet-black-friday',
    name: 'Velvet · Black Friday',
    blurb: 'Luxury black + gold · upload your hand & gift photos',
    background_color: '#050505',
    background_gradient_to: null,
    background_image: '/images/promo-bg/velvet-black-friday.svg',
    elements: [
      // ── Top-left logo slot — merchant uploads brand logo here
      mk({ type: 'image', x: 3, y: 3, w: 14, h: 8, src: '' }),

      // ── Brand wordmark + sub-line (centred top) ───────────────────
      mk({
        type: 'text', text: 'VELVET',
        x: 10, y: 5, w: 80, h: 7,
        color: '#e8c875', fontSize: 60, fontWeight: 700,
        fontFamily: SERIF_FONT,
      }),
      mk({
        type: 'text', text: '— NAIL LAB —',
        x: 10, y: 13, w: 80, h: 3,
        color: '#e8c875', fontSize: 16, fontWeight: 700,
        fontFamily: SERIF_FONT,
      }),

      // ── Headline (centred) — BLACK (cream) + FRIDAY (gold) ────────
      mk({
        type: 'text', text: 'BLACK',
        x: 10, y: 20, w: 80, h: 11,
        color: '#f5e8c8', fontSize: 110, fontWeight: 900,
        fontFamily: SERIF_FONT,
      }),
      mk({
        type: 'text', text: 'FRIDAY',
        x: 10, y: 31, w: 80, h: 11,
        color: '#d4a13a', fontSize: 110, fontWeight: 900,
        fontFamily: SERIF_FONT,
      }),

      // ── Percentage line: "UP TO 70% OFF" (centred) ────────────────
      mk({
        type: 'text', text: 'UP TO',
        x: 18, y: 46, w: 18, h: 5,
        color: '#f5e8c8', fontSize: 24, fontWeight: 800,
        fontFamily: SERIF_FONT,
      }),
      mk({
        type: 'text', text: '70%',
        x: 36, y: 45, w: 28, h: 10,
        color: '#d4a13a', fontSize: 78, fontWeight: 900,
        fontFamily: SERIF_FONT,
      }),
      mk({
        type: 'text', text: 'OFF',
        x: 64, y: 48, w: 18, h: 6,
        color: '#d4a13a', fontSize: 34, fontWeight: 900,
        fontFamily: SERIF_FONT,
      }),

      // ── Info: "3 DAYS ONLY" + services line (centred) ─────────────
      mk({
        type: 'text', text: '📅  3 DAYS ONLY',
        x: 10, y: 57, w: 80, h: 4,
        color: '#f5e8c8', fontSize: 22, fontWeight: 700,
      }),
      mk({
        type: 'text', text: 'NAILS · LASHES · FACIAL · FOOT SPA',
        x: 4, y: 61, w: 92, h: 3,
        color: '#e8c875', fontSize: 14, fontWeight: 700,
      }),

      // ── Tagline (centred) ─────────────────────────────────────────
      mk({
        type: 'text', text: 'Indulge More',
        x: 10, y: 66, w: 80, h: 6,
        color: '#e8c875', fontSize: 44, fontWeight: 600,
        fontFamily: SCRIPT_FONT, fontStyle: 'italic',
      }),
      mk({
        type: 'text', text: 'YOU  ·  DESERVE  ·  IT',
        x: 10, y: 72, w: 80, h: 3,
        color: '#f5e8c8', fontSize: 14, fontWeight: 700,
      }),

      // ── Service icon row (centred, 4 icons spread across) ─────────
      mk({ type: 'sticker', emoji: '💅', x: 15,  y: 76, w: 10, h: 5, fontSize: 22 }),
      mk({ type: 'text', text: 'NAILS',   x: 13,  y: 81, w: 14, h: 3, color: '#e8c875', fontSize: 10, fontWeight: 700 }),

      mk({ type: 'sticker', emoji: '👁️', x: 35,  y: 76, w: 10, h: 5, fontSize: 22 }),
      mk({ type: 'text', text: 'LASHES',  x: 33,  y: 81, w: 14, h: 3, color: '#e8c875', fontSize: 10, fontWeight: 700 }),

      mk({ type: 'sticker', emoji: '✨',  x: 55,  y: 76, w: 10, h: 5, fontSize: 22 }),
      mk({ type: 'text', text: 'FACIAL',  x: 53,  y: 81, w: 14, h: 3, color: '#e8c875', fontSize: 10, fontWeight: 700 }),

      mk({ type: 'sticker', emoji: '🦶',  x: 75,  y: 76, w: 10, h: 5, fontSize: 22 }),
      mk({ type: 'text', text: 'FOOT SPA', x: 72,  y: 81, w: 16, h: 3, color: '#e8c875', fontSize: 10, fontWeight: 700 }),

      // ── Footer contact bar — address / hotline / IG / website ─────
      mk({
        type: 'button', text: '',
        x: 4, y: 90, w: 92, h: 7,
        color: '#e8c875', bgColor: '#0a0a0a',
        fontSize: 11, fontWeight: 700,
      }),
      mk({ type: 'text', text: '📍 123 Main St', x: 5,  y: 92, w: 24, h: 3, color: '#e8c875', fontSize: 11, fontWeight: 600 }),
      mk({ type: 'text', text: '📞 0000 000 000', x: 30, y: 92, w: 24, h: 3, color: '#e8c875', fontSize: 11, fontWeight: 600 }),
      mk({ type: 'text', text: '@yourstudio',    x: 55, y: 92, w: 20, h: 3, color: '#e8c875', fontSize: 11, fontWeight: 600 }),
      mk({ type: 'text', text: 'yourstudio.vn',  x: 76, y: 92, w: 20, h: 3, color: '#e8c875', fontSize: 11, fontWeight: 600 }),
    ],
  },

  // ── 3. Bridal Glow Package — cream + blush peonies, romantic ──────
  //     Modeled after a premium bridal-beauty flyer: floral SVG corners
  //     (peonies + leaves + silk ribbon + bow), centered serif headline,
  //     price capsule, included-services list, and full contact footer.
  {
    id: 'ella-bridal',
    name: 'Bridal Glow Package',
    blurb: 'Cream + blush peonies · bridal beauty flyer',
    background_color: '#fbf3e6',
    background_gradient_to: null,
    background_image: '/images/promo-bg/ella-bridal.svg',
    elements: [
      // ── Top-centre logo slot (merchant uploads brand mark)
      mk({ type: 'image', x: 42, y: 4, w: 16, h: 9, src: '' }),

      // ── Brand wordmark + sub-line
      mk({
        type: 'text', text: 'ELLA',
        x: 10, y: 13, w: 80, h: 6,
        color: '#a8794a', fontSize: 48, fontWeight: 700,
        fontFamily: SERIF_FONT,
      }),
      mk({
        type: 'text', text: 'B R I D A L   B E A U T Y',
        x: 10, y: 20, w: 80, h: 3,
        color: '#a8794a', fontSize: 14, fontWeight: 600,
        fontFamily: SERIF_FONT,
      }),

      // ── Big headline — BRIDAL GLOW / PACKAGE (rose-gold serif)
      mk({
        type: 'text', text: 'BRIDAL GLOW',
        x: 4, y: 27, w: 92, h: 8,
        color: '#b87060', fontSize: 64, fontWeight: 800,
        fontFamily: SERIF_FONT,
      }),
      mk({
        type: 'text', text: 'PACKAGE',
        x: 4, y: 35, w: 92, h: 8,
        color: '#b87060', fontSize: 64, fontWeight: 800,
        fontFamily: SERIF_FONT,
      }),

      // ── Tagline (script)
      mk({
        type: 'text', text: 'For the most beautiful day',
        x: 10, y: 44, w: 80, h: 5,
        color: '#d49888', fontSize: 32, fontWeight: 500,
        fontFamily: SCRIPT_FONT, fontStyle: 'italic',
      }),

      // ── Price capsule — oval frame around price text
      mk({
        type: 'button', text: '',
        x: 16, y: 50, w: 68, h: 11,
        color: '#b87060', bgColor: '#fbf3e6',
        fontSize: 12, fontWeight: 700,
      }),
      mk({
        type: 'text', text: 'Full Package from',
        x: 16, y: 51, w: 68, h: 3,
        color: '#8c6a3a', fontSize: 14, fontWeight: 500,
        fontFamily: SERIF_FONT, fontStyle: 'italic',
      }),
      mk({
        type: 'text', text: '2.990K',
        x: 16, y: 54, w: 68, h: 8,
        color: '#b87060', fontSize: 60, fontWeight: 800,
        fontFamily: SERIF_FONT,
      }),

      // ── INCLUDED SERVICES header
      mk({
        type: 'text', text: '—  INCLUDED SERVICES  —',
        x: 6, y: 65, w: 88, h: 3,
        color: '#a8794a', fontSize: 14, fontWeight: 800,
      }),

      // ── Service list (5 items, each emoji + label)
      mk({ type: 'sticker', emoji: '💅', x: 8,  y: 69, w: 8, h: 4, fontSize: 22 }),
      mk({ type: 'text', text: 'Luxury Gel Manicure', x: 18, y: 70, w: 70, h: 3, color: '#5a4030', fontSize: 16, fontWeight: 500, fontFamily: SERIF_FONT }),

      mk({ type: 'sticker', emoji: '🦶', x: 8,  y: 73, w: 8, h: 4, fontSize: 22 }),
      mk({ type: 'text', text: 'Soft Glam Pedicure', x: 18, y: 74, w: 70, h: 3, color: '#5a4030', fontSize: 16, fontWeight: 500, fontFamily: SERIF_FONT }),

      mk({ type: 'sticker', emoji: '✨', x: 8,  y: 77, w: 8, h: 4, fontSize: 22 }),
      mk({ type: 'text', text: 'Bridal Facial', x: 18, y: 78, w: 70, h: 3, color: '#5a4030', fontSize: 16, fontWeight: 500, fontFamily: SERIF_FONT }),

      mk({ type: 'sticker', emoji: '💆', x: 8,  y: 81, w: 8, h: 4, fontSize: 22 }),
      mk({ type: 'text', text: 'Relaxing Body Massage', x: 18, y: 82, w: 70, h: 3, color: '#5a4030', fontSize: 16, fontWeight: 500, fontFamily: SERIF_FONT }),

      mk({ type: 'sticker', emoji: '🎨', x: 8,  y: 85, w: 8, h: 4, fontSize: 22 }),
      mk({ type: 'text', text: 'Trial Nail Design', x: 18, y: 86, w: 70, h: 3, color: '#5a4030', fontSize: 16, fontWeight: 500, fontFamily: SERIF_FONT }),

      // ── Footer contact info (4 lines, address / phone / IG / hours)
      mk({ type: 'text', text: '📍  12 Nguyễn Bỉnh Khiêm, Quận 1, TP.HCM', x: 16, y: 91, w: 72, h: 3, color: '#5a4030', fontSize: 12, fontWeight: 500 }),
      mk({ type: 'text', text: '📞  Hotline: 0901 234 888',                x: 16, y: 93.5, w: 72, h: 3, color: '#5a4030', fontSize: 12, fontWeight: 500 }),
      mk({ type: 'text', text: '📷  Instagram: @ellabridalbeauty',          x: 16, y: 96, w: 72, h: 3, color: '#5a4030', fontSize: 12, fontWeight: 500 }),
    ],
  },

  // ── 4. Zen Spa · Wellness Week — forest green + cream botanical ───
  //     Modeled after a premium spa wellness flyer: dark green base
  //     framed by eucalyptus branches, cream wavy panel for the offer,
  //     stacked stones + candle illustration, gold accents, contact bar.
  {
    id: 'zen-spa',
    name: 'Zen Spa · Wellness Week',
    blurb: 'Forest green + cream · eucalyptus & zen stones',
    background_color: '#0e2818',
    background_gradient_to: null,
    background_image: '/images/promo-bg/zen-spa.svg',
    elements: [
      // ── Top-centre logo slot (overrides the placeholder ZEN SPA mark)
      mk({ type: 'image', x: 40, y: 4, w: 20, h: 12, src: '' }),

      // ── Brand wordmark (gold serif, sits below logo)
      mk({
        type: 'text', text: 'ZEN  ·  SPA',
        x: 10, y: 17, w: 80, h: 3,
        color: '#d4af6a', fontSize: 16, fontWeight: 700,
        fontFamily: SERIF_FONT,
      }),

      // ── Big headline — WELLNESS WEEK (centred, dark green serif)
      mk({
        type: 'text', text: 'WELLNESS',
        x: 4, y: 27, w: 92, h: 9,
        color: '#0e2818', fontSize: 82, fontWeight: 800,
        fontFamily: SERIF_FONT,
      }),
      mk({
        type: 'text', text: 'WEEK',
        x: 4, y: 36, w: 92, h: 9,
        color: '#0e2818', fontSize: 82, fontWeight: 800,
        fontFamily: SERIF_FONT,
      }),

      // ── Tagline — Relax. Renew. Restore. (serif italic)
      mk({
        type: 'text', text: 'Relax.  Renew.  Restore.',
        x: 10, y: 46, w: 80, h: 4,
        color: '#0e2818', fontSize: 22, fontWeight: 500,
        fontFamily: SERIF_FONT, fontStyle: 'italic',
      }),

      // ── Promo capsule — dark green block "BUY 2 GET 1 FREE"
      mk({
        type: 'button', text: '',
        x: 8, y: 51, w: 84, h: 9,
        color: '#f6ede0', bgColor: '#0e2818',
        fontSize: 12, fontWeight: 700,
      }),
      mk({
        type: 'text', text: 'BUY 2 GET 1 FREE',
        x: 8, y: 52, w: 84, h: 5,
        color: '#d4af6a', fontSize: 30, fontWeight: 900,
        fontFamily: SERIF_FONT,
      }),
      mk({
        type: 'text', text: 'ON ALL MASSAGE PACKAGES',
        x: 8, y: 57, w: 84, h: 3,
        color: '#f6ede0', fontSize: 14, fontWeight: 700,
      }),

      // ── Service list (2 lines, dot-separated, centred)
      mk({
        type: 'text', text: 'HOT STONE MASSAGE  ·  AROMATHERAPY',
        x: 4, y: 63, w: 92, h: 3,
        color: '#0e2818', fontSize: 13, fontWeight: 700,
      }),
      mk({
        type: 'text', text: 'FACIAL TREATMENT  ·  BODY SCRUB',
        x: 4, y: 66, w: 92, h: 3,
        color: '#0e2818', fontSize: 13, fontWeight: 700,
      }),
      mk({
        type: 'text', text: 'FOOT REFLEXOLOGY',
        x: 4, y: 69, w: 92, h: 3,
        color: '#0e2818', fontSize: 13, fontWeight: 700,
      }),

      // ── Price block — "From" (script) + "$39" (huge serif)
      mk({
        type: 'text', text: 'From',
        x: 30, y: 73, w: 40, h: 4,
        color: '#0e2818', fontSize: 26, fontWeight: 600,
        fontFamily: SCRIPT_FONT, fontStyle: 'italic',
      }),
      mk({
        type: 'text', text: '$39',
        x: 20, y: 76, w: 60, h: 8,
        color: '#0e2818', fontSize: 68, fontWeight: 800,
        fontFamily: SERIF_FONT,
      }),

      // ── Footer contact (left column)
      mk({ type: 'text', text: '📍  456 Serenity Boulevard, Hanoi', x: 4, y: 87, w: 50, h: 3, color: '#d4af6a', fontSize: 11, fontWeight: 500 }),
      mk({ type: 'text', text: '📞  +84 901 555 888',               x: 4, y: 90, w: 50, h: 3, color: '#d4af6a', fontSize: 11, fontWeight: 500 }),
      mk({ type: 'text', text: '✉  hello@zenspa.com',               x: 4, y: 93, w: 50, h: 3, color: '#d4af6a', fontSize: 11, fontWeight: 500 }),
      mk({ type: 'text', text: '🌐  www.zenspa.com',                x: 4, y: 96, w: 50, h: 3, color: '#d4af6a', fontSize: 11, fontWeight: 500 }),

      // ── Opening hours block (right column)
      mk({ type: 'text', text: '🕐  OPENING HOURS',                 x: 56, y: 89, w: 40, h: 3, color: '#d4af6a', fontSize: 12, fontWeight: 700 }),
      mk({ type: 'text', text: '9 AM — 10 PM DAILY',                x: 56, y: 93, w: 40, h: 3, color: '#f6ede0', fontSize: 13, fontWeight: 700 }),
    ],
  },

  // ── 5. Paradise · Summer Vibes — tropical beach, palm + hibiscus ──
  //     Modeled after a beach-themed nail flyer: sky + sea + sand SVG
  //     with palm fronds, hibiscus, flamingo, pineapple, shells, and
  //     a teal wooden footer plank for contact info.
  {
    id: 'paradise-summer',
    name: 'Paradise · Summer Vibes',
    blurb: 'Tropical beach · palm, hibiscus, flamingo',
    background_color: '#a8d8f0',
    background_gradient_to: null,
    background_image: '/images/promo-bg/paradise-summer.svg',
    elements: [
      // ── Top-centre logo slot (sun + wave + brand name go here)
      mk({ type: 'image', x: 40, y: 4, w: 20, h: 11, src: '' }),

      // ── Brand wordmark + sub (navy + coral)
      mk({
        type: 'text', text: 'PARADISE',
        x: 6, y: 18, w: 88, h: 6,
        color: '#1f3a5a', fontSize: 56, fontWeight: 800,
        fontFamily: SERIF_FONT,
      }),
      mk({
        type: 'text', text: '—  N A I L S  —',
        x: 6, y: 25, w: 88, h: 3,
        color: '#e34869', fontSize: 20, fontWeight: 700,
      }),

      // ── Big headline — SUMMER (pink) + VIBES (teal)
      mk({
        type: 'text', text: 'SUMMER',
        x: 4, y: 31, w: 92, h: 9,
        color: '#e34869', fontSize: 96, fontWeight: 900, fontStyle: 'italic',
      }),
      mk({
        type: 'text', text: 'VIBES',
        x: 4, y: 40, w: 92, h: 9,
        color: '#3aa0bc', fontSize: 96, fontWeight: 900, fontStyle: 'italic',
      }),

      // ── Pink tagline ribbon — "Beach-Ready Beauty"
      mk({
        type: 'button', text: '',
        x: 20, y: 52, w: 60, h: 5,
        color: '#ffffff', bgColor: '#e34869',
        fontSize: 12, fontWeight: 700,
      }),
      mk({
        type: 'text', text: 'Beach-Ready Beauty ♡',
        x: 20, y: 52.5, w: 60, h: 4,
        color: '#ffffff', fontSize: 22, fontWeight: 700,
        fontFamily: SCRIPT_FONT, fontStyle: 'italic',
      }),

      // ── Promo capsule — split: FLAT 25% OFF | FREE Foot Spa
      mk({
        type: 'button', text: '',
        x: 6, y: 58, w: 88, h: 12,
        color: '#1f3a5a', bgColor: '#fff8e8',
        fontSize: 11, fontWeight: 700,
      }),
      mk({
        type: 'text', text: 'FLAT',
        x: 8, y: 59, w: 30, h: 3,
        color: '#3aa0bc', fontSize: 18, fontWeight: 900,
      }),
      mk({
        type: 'text', text: '25% OFF',
        x: 8, y: 62, w: 30, h: 7,
        color: '#e34869', fontSize: 48, fontWeight: 900, fontStyle: 'italic',
      }),
      // vertical divider
      mk({ type: 'text', text: '|', x: 48, y: 60, w: 4, h: 8, color: '#1f3a5a', fontSize: 60, fontWeight: 200 }),
      mk({
        type: 'text', text: 'FREE',
        x: 52, y: 59, w: 40, h: 5,
        color: '#3aa0bc', fontSize: 32, fontWeight: 900,
      }),
      mk({
        type: 'text', text: 'Foot Spa',
        x: 52, y: 63, w: 40, h: 4,
        color: '#e34869', fontSize: 22, fontWeight: 700, fontFamily: SCRIPT_FONT, fontStyle: 'italic',
      }),
      mk({
        type: 'text', text: 'with any Pedicure',
        x: 52, y: 67, w: 40, h: 3,
        color: '#1f3a5a', fontSize: 11, fontWeight: 600,
      }),

      // ── Service icon row — 5 services with emoji + label
      mk({ type: 'sticker', emoji: '🦶', x: 6,  y: 71, w: 10, h: 4, fontSize: 24 }),
      mk({ type: 'text', text: 'Pedicure', x: 4, y: 75, w: 14, h: 3, color: '#1f3a5a', fontSize: 11, fontWeight: 700 }),

      mk({ type: 'sticker', emoji: '💅', x: 22, y: 71, w: 10, h: 4, fontSize: 24 }),
      mk({ type: 'text', text: 'Manicure', x: 20, y: 75, w: 14, h: 3, color: '#1f3a5a', fontSize: 11, fontWeight: 700 }),

      mk({ type: 'sticker', emoji: '🕯️', x: 38, y: 71, w: 10, h: 4, fontSize: 24 }),
      mk({ type: 'text', text: 'Paraffin', x: 36, y: 75, w: 14, h: 3, color: '#1f3a5a', fontSize: 11, fontWeight: 700 }),

      mk({ type: 'sticker', emoji: '👣', x: 54, y: 71, w: 10, h: 4, fontSize: 24 }),
      mk({ type: 'text', text: 'Foot Spa', x: 52, y: 75, w: 14, h: 3, color: '#1f3a5a', fontSize: 11, fontWeight: 700 }),

      mk({ type: 'sticker', emoji: '✨', x: 70, y: 71, w: 10, h: 4, fontSize: 24 }),
      mk({ type: 'text', text: 'Acrylic', x: 68, y: 75, w: 14, h: 3, color: '#1f3a5a', fontSize: 11, fontWeight: 700 }),

      // ── Teal wooden footer plank — 4 contact items
      mk({ type: 'text', text: '📍 302 Beach Road, Vung Tau', x: 4,  y: 88, w: 46, h: 3, color: '#ffffff', fontSize: 12, fontWeight: 600 }),
      mk({ type: 'text', text: '📞 Call: 0934 567 890',        x: 4,  y: 91, w: 46, h: 3, color: '#ffffff', fontSize: 12, fontWeight: 600 }),
      mk({ type: 'text', text: '📷 @paradisenails.vn',         x: 50, y: 88, w: 46, h: 3, color: '#ffffff', fontSize: 12, fontWeight: 600 }),
      mk({ type: 'text', text: '🕐 Open Daily  8 AM — 9 PM',    x: 50, y: 91, w: 46, h: 3, color: '#ffe6a8', fontSize: 12, fontWeight: 700 }),

      // ── Closing tagline — "Treat Yourself · You Deserve It!"
      mk({
        type: 'text', text: 'Treat Yourself · You Deserve It! ♡',
        x: 4, y: 96, w: 92, h: 3,
        color: '#e34869', fontSize: 18, fontWeight: 600,
        fontFamily: SCRIPT_FONT, fontStyle: 'italic',
      }),
    ],
  },
];
