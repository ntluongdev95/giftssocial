'use client';

// Enjoy Your Meal — everyday scaffold. Lunch / dinner "have a nice meal" gift.

import type { TemplateProps, TemplateConfig } from '../_types';
import PlaceholderReveal from '../_shared/PlaceholderReveal';

function DailyLunchReveal(props: TemplateProps) {
  return <PlaceholderReveal {...props}
    accent="#22c55e"
    heroEmoji="🍱"
    title="Enjoy your meal"
    tagline="Have a nice lunch · ăn ngon nhé"
    particleEmojis={['🍜', '🍱', '🍚', '🍙', '🥢', '🍡']}
    bgGradient="linear-gradient(180deg, #fef3c7 0%, #fde68a 40%, #fbbf24 100%)"
  />;
}

export default DailyLunchReveal;

export const DailyLunchConfig: TemplateConfig = {
  id: 'daily-lunch',
  name: 'Enjoy Your Meal',
  occasionIds: ['daily'],
  emoji: '🍱',
  description: 'Send a warm "have a nice lunch" — Asian food emojis drifting on a cozy warm backdrop.',
  thumbnailBg: 'linear-gradient(135deg, #fef3c7, #22c55e)',
  Component: DailyLunchReveal,
};
