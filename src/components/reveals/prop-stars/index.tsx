'use client';

// Under the Stars — Proposal reveal. Placeholder scaffold.

import type { TemplateProps, TemplateConfig } from '../_types';
import PlaceholderReveal from '../_shared/PlaceholderReveal';

function PropStarsReveal(props: TemplateProps) {
  return <PlaceholderReveal {...props}
    accent="#f43f5e"
    heroEmoji="⭐"
    title="Marry Me"
    tagline="Written in the stars"
    particleEmojis={['⭐', '✨', '🌟', '💫']}
    bgGradient="linear-gradient(180deg, #030712 0%, #1e293b 40%, #f43f5e 100%)"
  />;
}

export default PropStarsReveal;

export const PropStarsConfig: TemplateConfig = {
  id: 'prop-stars',
  name: 'Under the Stars',
  occasionIds: ['proposal'],
  emoji: '⭐',
  description: 'Night sky reveals "Will you marry me?" written in stars.',
  thumbnailBg: 'linear-gradient(135deg, #1e293b, #f43f5e)',
  premium: true,
  coins: 40,
  Component: PropStarsReveal,
};
