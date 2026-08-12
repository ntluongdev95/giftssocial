'use client';

// Cake Reveal — Birthday reveal. Placeholder scaffold.

import type { TemplateProps, TemplateConfig } from '../_types';
import PlaceholderReveal from '../_shared/PlaceholderReveal';

function BdayCakeReveal(props: TemplateProps) {
  return <PlaceholderReveal {...props}
    accent="#db2777"
    heroEmoji="🎂"
    title="Blow the Candles"
    tagline="Make it count"
    particleEmojis={['🎂', '🧁', '✨']}
    bgGradient="linear-gradient(180deg, #500724 0%, #831843 50%, #db2777 100%)"
  />;
}

export default BdayCakeReveal;

export const BdayCakeConfig: TemplateConfig = {
  id: 'bday-cake',
  name: 'Cake Reveal',
  occasionIds: ['birthday'],
  emoji: '🎂',
  description: 'Cinematic cake reveal with slow-mo candle blow-out.',
  thumbnailBg: 'linear-gradient(135deg, #fce7f3, #db2777)',
  premium: true,
  coins: 25,
  Component: BdayCakeReveal,
};
