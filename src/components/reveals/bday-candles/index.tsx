'use client';

// Elegant Candles — Birthday reveal. Placeholder scaffold.

import type { TemplateProps, TemplateConfig } from '../_types';
import PlaceholderReveal from '../_shared/PlaceholderReveal';

function BdayCandlesReveal(props: TemplateProps) {
  return <PlaceholderReveal {...props}
    accent="#d97706"
    heroEmoji="🕯️"
    title="Make a Wish"
    tagline="One candle at a time"
    particleEmojis={['🕯️', '✨', '⭐']}
    bgGradient="linear-gradient(180deg, #1c1917 0%, #451a03 50%, #78350f 100%)"
  />;
}

export default BdayCandlesReveal;

export const BdayCandlesConfig: TemplateConfig = {
  id: 'bday-candles',
  name: 'Elegant Candles',
  occasionIds: ['birthday'],
  emoji: '🕯️',
  description: 'Soft candle glow around a golden cake — quiet birthday wish.',
  thumbnailBg: 'linear-gradient(135deg, #fef3c7, #d97706)',
  Component: BdayCandlesReveal,
};
