'use client';

// Good Morning — everyday scaffold.

import type { TemplateProps, TemplateConfig } from '../_types';
import PlaceholderReveal from '../_shared/PlaceholderReveal';

function DailyGoodmorningReveal(props: TemplateProps) {
  return <PlaceholderReveal {...props}
    accent="#f59e0b"
    heroEmoji="☀️"
    title="Good Morning"
    tagline="Rise and shine · chào buổi sáng"
    particleEmojis={['☀️', '🌤', '🐦', '🌸']}
    bgGradient="linear-gradient(180deg, #fef3c7 0%, #fdba74 40%, #fb923c 80%, #ec4899 100%)"
  />;
}

export default DailyGoodmorningReveal;

export const DailyGoodmorningConfig: TemplateConfig = {
  id: 'daily-goodmorning',
  name: 'Good Morning',
  occasionIds: ['daily'],
  emoji: '☀️',
  description: 'A warm sunrise "good morning" — perfect way to start their day with a smile.',
  thumbnailBg: 'linear-gradient(135deg, #fed7aa, #f97316)',
  Component: DailyGoodmorningReveal,
};
