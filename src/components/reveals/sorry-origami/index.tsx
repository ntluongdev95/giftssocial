'use client';

// Origami Crane — Sorry reveal. Placeholder scaffold.

import type { TemplateProps, TemplateConfig } from '../_types';
import PlaceholderReveal from '../_shared/PlaceholderReveal';

function SorryOrigamiReveal(props: TemplateProps) {
  return <PlaceholderReveal {...props}
    accent="#7c3aed"
    heroEmoji="🕊️"
    title="A Paper Crane"
    tagline="Carrying a thousand wishes"
    particleEmojis={['🕊️', '📄', '✨']}
    bgGradient="linear-gradient(180deg, #1e1b4b 0%, #5b21b6 50%, #a78bfa 100%)"
  />;
}

export default SorryOrigamiReveal;

export const SorryOrigamiConfig: TemplateConfig = {
  id: 'sorry-origami',
  name: 'Origami Crane',
  occasionIds: ['sorry'],
  emoji: '🕊️',
  description: 'A paper crane folds itself with your message inside.',
  thumbnailBg: 'linear-gradient(135deg, #f3e8ff, #7c3aed)',
  premium: true,
  coins: 20,
  Component: SorryOrigamiReveal,
};
