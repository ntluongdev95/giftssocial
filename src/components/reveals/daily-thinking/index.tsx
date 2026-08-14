'use client';

// Thinking of You — everyday scaffold. Random "just because" affection
// with no occasion needed.

import type { TemplateProps, TemplateConfig } from '../_types';
import PlaceholderReveal from '../_shared/PlaceholderReveal';

function DailyThinkingReveal(props: TemplateProps) {
  return <PlaceholderReveal {...props}
    accent="#ec4899"
    heroEmoji="💭"
    title="Thinking of you"
    tagline="Just because · nhớ bạn ghê"
    particleEmojis={['💗', '💕', '💖', '✨', '💭']}
    bgGradient="linear-gradient(180deg, #4c0519 0%, #831843 50%, #db2777 100%)"
  />;
}

export default DailyThinkingReveal;

export const DailyThinkingConfig: TemplateConfig = {
  id: 'daily-thinking',
  name: 'Thinking of You',
  occasionIds: ['daily'],
  emoji: '💭',
  description: 'A soft "just because" gift — hearts drifting over a pink dreamy backdrop, no occasion needed.',
  thumbnailBg: 'linear-gradient(135deg, #831843, #ec4899)',
  Component: DailyThinkingReveal,
};
