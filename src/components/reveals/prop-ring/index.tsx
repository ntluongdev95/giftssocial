'use client';

// Ring Reveal — Proposal reveal. Placeholder scaffold.

import type { TemplateProps, TemplateConfig } from '../_types';
import PlaceholderReveal from '../_shared/PlaceholderReveal';

function PropRingReveal(props: TemplateProps) {
  return <PlaceholderReveal {...props}
    accent="#f43f5e"
    heroEmoji="💍"
    title="Will You Marry Me?"
    tagline="You are the one"
    particleEmojis={['💍', '✨', '💎']}
    bgGradient="linear-gradient(180deg, #1a0510 0%, #4a0e1f 50%, #b91c3c 100%)"
  />;
}

export default PropRingReveal;

export const PropRingConfig: TemplateConfig = {
  id: 'prop-ring',
  name: 'Ring Reveal',
  occasionIds: ['proposal'],
  emoji: '💍',
  description: 'Ring box slowly opens, diamond sparkles fill the screen.',
  thumbnailBg: 'linear-gradient(135deg, #fff1f2, #f43f5e)',
  Component: PropRingReveal,
};
