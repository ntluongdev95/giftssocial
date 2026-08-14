'use client';

// Coffee Break — everyday scaffold. Little pick-me-up during the day.

import type { TemplateProps, TemplateConfig } from '../_types';
import PlaceholderReveal from '../_shared/PlaceholderReveal';

function DailyCoffeeReveal(props: TemplateProps) {
  return <PlaceholderReveal {...props}
    accent="#b45309"
    heroEmoji="☕"
    title="Coffee time"
    tagline="Take a break · làm ly cafe nha"
    particleEmojis={['☕', '✨', '🍪', '🥐']}
    bgGradient="linear-gradient(180deg, #451a03 0%, #78350f 50%, #b45309 100%)"
  />;
}

export default DailyCoffeeReveal;

export const DailyCoffeeConfig: TemplateConfig = {
  id: 'daily-coffee',
  name: 'Coffee Break',
  occasionIds: ['daily'],
  emoji: '☕',
  description: 'A little pick-me-up — "let\'s grab a coffee together" mood, warm brown backdrop with steam swirls.',
  thumbnailBg: 'linear-gradient(135deg, #78350f, #f59e0b)',
  Component: DailyCoffeeReveal,
};
