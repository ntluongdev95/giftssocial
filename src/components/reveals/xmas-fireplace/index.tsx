'use client';

// Fireplace — Christmas reveal. Placeholder scaffold.

import type { TemplateProps, TemplateConfig } from '../_types';
import PlaceholderReveal from '../_shared/PlaceholderReveal';

function XmasFireplaceReveal(props: TemplateProps) {
  return <PlaceholderReveal {...props}
    accent="#f97316"
    heroEmoji="🔥"
    title="Warm Wishes"
    tagline="By the fireside"
    particleEmojis={['🔥', '✨', '🎄']}
    bgGradient="linear-gradient(180deg, #1c0f04 0%, #7c2d12 50%, #dc2626 100%)"
  />;
}

export default XmasFireplaceReveal;

export const XmasFireplaceConfig: TemplateConfig = {
  id: 'xmas-fireplace',
  name: 'Fireplace',
  occasionIds: ['christmas'],
  emoji: '🔥',
  description: 'A cozy fireplace with stockings — flames flicker warmly.',
  thumbnailBg: 'linear-gradient(135deg, #fee2e2, #dc2626)',
  premium: true,
  coins: 15,
  Component: XmasFireplaceReveal,
};
