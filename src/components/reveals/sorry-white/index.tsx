'use client';

// White Rose — Sorry reveal. Placeholder scaffold.

import type { TemplateProps, TemplateConfig } from '../_types';
import PlaceholderReveal from '../_shared/PlaceholderReveal';

function SorryWhiteReveal(props: TemplateProps) {
  return <PlaceholderReveal {...props}
    accent="#a78bfa"
    heroEmoji="🌹"
    title="I'm Sorry"
    tagline="Please forgive me"
    particleEmojis={['🤍', '🌹', '✨']}
    bgGradient="linear-gradient(180deg, #1e1b4b 0%, #4c1d95 50%, #a78bfa 100%)"
  />;
}

export default SorryWhiteReveal;

export const SorryWhiteConfig: TemplateConfig = {
  id: 'sorry-white',
  name: 'White Rose',
  occasionIds: ['sorry'],
  emoji: '🌹',
  description: 'A single white rose drifts down over a subtle apology note.',
  thumbnailBg: 'linear-gradient(135deg, #f5f3ff, #a78bfa)',
  Component: SorryWhiteReveal,
};
