// Effect registry — the vocabulary the TemplateRenderer speaks.
//
// To add a new effect primitive:
//   1. Create a component under src/components/reveals/_effects/[Name].tsx
//      that accepts { data, ...params } and renders a fullscreen positioned layer.
//   2. Import it here and add an entry to EFFECT_REGISTRY.
//   3. Optionally add an entry to EFFECT_META so the admin picker shows it.

import type { ComponentType } from 'react';
import type { EffectProps } from './_types';

import BgGradient from './BgGradient';
import ParticleRain from './ParticleRain';
import TextFlash from './TextFlash';
import TextFade from './TextFade';
import BalloonFloat from './BalloonFloat';
import ConfettiBurst from './ConfettiBurst';
import PhotoHero from './PhotoHero';

// The renderer looks up components by effect.type from this map.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const EFFECT_REGISTRY: Record<string, ComponentType<EffectProps & any>> = {
  'bg-gradient':    BgGradient,
  'particle-rain':  ParticleRain,
  'text-flash':     TextFlash,
  'text-fade':      TextFade,
  'balloon-float':  BalloonFloat,
  'confetti-burst': ConfettiBurst,
  'photo-hero':     PhotoHero,
};

/** Admin-facing metadata: label + param schema hints for the picker/editor. */
export interface EffectMeta {
  type: string;
  label: string;
  description: string;
  emoji: string;
  /** z-index hint — backgrounds render below, particles above. */
  layer: 'background' | 'particle' | 'text' | 'burst';
}

export const EFFECT_META: EffectMeta[] = [
  { type: 'bg-gradient',    label: 'Background Gradient', description: 'Animated color gradient backdrop',   emoji: '🎨', layer: 'background' },
  { type: 'particle-rain',  label: 'Particle Rain',       description: 'Emojis fall from the top',           emoji: '🌸', layer: 'particle' },
  { type: 'balloon-float',  label: 'Balloon Float',       description: 'Balloons rise from the bottom',      emoji: '🎈', layer: 'particle' },
  { type: 'text-flash',     label: 'Text Flash',          description: 'Bold text pops in with bounce',      emoji: '💥', layer: 'text' },
  { type: 'text-fade',      label: 'Text Fade',           description: 'Message fades in gently',            emoji: '📜', layer: 'text' },
  { type: 'confetti-burst', label: 'Confetti Burst',      description: 'Confetti explodes from center',      emoji: '🎉', layer: 'burst' },
  { type: 'photo-hero',     label: 'Photo Hero',          description: 'Display an uploaded photo (polaroid/card)', emoji: '🖼️', layer: 'text' },
];
