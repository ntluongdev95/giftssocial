'use client';

// Heartfelt Note — Sorry reveal. Placeholder scaffold.

import type { TemplateProps, TemplateConfig } from '../_types';
import PlaceholderReveal from '../_shared/PlaceholderReveal';

function SorryNoteReveal(props: TemplateProps) {
  return <PlaceholderReveal {...props}
    accent="#8b5cf6"
    heroEmoji="💌"
    title="A Heartfelt Note"
    tagline="From my heart to yours"
    particleEmojis={['💌', '📜', '✨']}
    bgGradient="linear-gradient(180deg, #1e1b4b 0%, #4c1d95 50%, #6d28d9 100%)"
  />;
}

export default SorryNoteReveal;

export const SorryNoteConfig: TemplateConfig = {
  id: 'sorry-note',
  name: 'Heartfelt Note',
  occasionIds: ['sorry'],
  emoji: '💌',
  description: 'A handwritten "I\'m sorry" letter unfolds slowly.',
  thumbnailBg: 'linear-gradient(135deg, #ede9fe, #8b5cf6)',
  Component: SorryNoteReveal,
};
