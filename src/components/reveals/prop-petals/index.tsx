'use client';

// Petal Path — Proposal reveal. Placeholder scaffold.

import type { TemplateProps, TemplateConfig } from '../_types';
import PlaceholderReveal from '../_shared/PlaceholderReveal';

function PropPetalsReveal(props: TemplateProps) {
  return <PlaceholderReveal {...props}
    accent="#e11d48"
    heroEmoji="🌹"
    title="Follow the Petals"
    tagline="Where they lead, love waits"
    particleEmojis={['🌹', '🌸', '💐']}
    bgGradient="linear-gradient(180deg, #4a0e1f 0%, #9f1239 50%, #e11d48 100%)"
  />;
}

export default PropPetalsReveal;

export const PropPetalsConfig: TemplateConfig = {
  id: 'prop-petals',
  name: 'Petal Path',
  occasionIds: ['proposal'],
  emoji: '🌹',
  description: 'A trail of rose petals leads to a shining ring at the end.',
  thumbnailBg: 'linear-gradient(135deg, #ffe4e6, #e11d48)',
  premium: true,
  coins: 30,
  Component: PropPetalsReveal,
};
