'use client';

// Santa Delivery — Christmas reveal. Placeholder scaffold.

import type { TemplateProps, TemplateConfig } from '../_types';
import PlaceholderReveal from '../_shared/PlaceholderReveal';

function XmasSantaReveal(props: TemplateProps) {
  return <PlaceholderReveal {...props}
    accent="#dc2626"
    heroEmoji="🎅"
    title="Ho Ho Ho"
    tagline="A gift for you"
    particleEmojis={['🎁', '❄️', '⭐']}
    bgGradient="linear-gradient(180deg, #0f172a 0%, #14532d 50%, #7f1d1d 100%)"
  />;
}

export default XmasSantaReveal;

export const XmasSantaConfig: TemplateConfig = {
  id: 'xmas-santa',
  name: 'Santa Delivery',
  occasionIds: ['christmas'],
  emoji: '🎅',
  description: 'Santa flies past in his sleigh dropping a wrapped gift.',
  thumbnailBg: 'linear-gradient(135deg, #dcfce7, #dc2626)',
  Component: XmasSantaReveal,
};
