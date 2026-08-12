'use client';

// Starry Night — Valentine reveal. Placeholder scaffold — customize by
// rewriting this component with your own animation.

import type { TemplateProps, TemplateConfig } from '../_types';
import PlaceholderReveal from '../_shared/PlaceholderReveal';

function ValStarryReveal(props: TemplateProps) {
  return <PlaceholderReveal {...props}
    accent="#6366f1"
    heroEmoji="✨"
    title="Starry Night"
    tagline="Under a sky full of stars"
    particleEmojis={['✨', '⭐', '🌟', '💫']}
    bgGradient="linear-gradient(180deg, #0a0a2e 0%, #1e1b4b 50%, #312e81 100%)"
  />;
}

export default ValStarryReveal;

export const ValStarryConfig: TemplateConfig = {
  id: 'val-starry',
  name: 'Starry Night',
  occasionIds: ['valentine'],
  emoji: '✨',
  description: 'Two silhouettes under a starry sky — shooting stars spell "I love you".',
  thumbnailBg: 'linear-gradient(135deg, #1e293b, #6366f1)',
  premium: true,
  coins: 30,
  Component: ValStarryReveal,
};
