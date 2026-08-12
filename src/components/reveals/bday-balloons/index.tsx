'use client';

// Balloon Rain — Birthday reveal. Placeholder scaffold.

import type { TemplateProps, TemplateConfig } from '../_types';
import PlaceholderReveal from '../_shared/PlaceholderReveal';

function BdayBalloonsReveal(props: TemplateProps) {
  return <PlaceholderReveal {...props}
    accent="#ec4899"
    heroEmoji="🎈"
    title="Happy Birthday"
    tagline="Balloons for you"
    particleEmojis={['🎈', '🎉', '🎊']}
    bgGradient="linear-gradient(180deg, #1e3a8a 0%, #6366f1 50%, #ec4899 100%)"
  />;
}

export default BdayBalloonsReveal;

export const BdayBalloonsConfig: TemplateConfig = {
  id: 'bday-balloons',
  name: 'Balloon Rain',
  occasionIds: ['birthday'],
  emoji: '🎈',
  description: 'Colorful balloons rain down, dove delivers wrapped gift.',
  thumbnailBg: 'linear-gradient(135deg, #dbeafe, #ec4899)',
  Component: BdayBalloonsReveal,
};
