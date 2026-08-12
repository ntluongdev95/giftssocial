'use client';

// Love Letter — Valentine reveal. Placeholder-based scaffold; customize
// by replacing this component with your own hand-written animation.

import type { TemplateProps, TemplateConfig } from '../_types';
import PlaceholderReveal from '../_shared/PlaceholderReveal';

function ValLoveLetterReveal(props: TemplateProps) {
  return <PlaceholderReveal {...props}
    accent="#f472b6"
    heroEmoji="💌"
    title="Love Letter"
    tagline="Sealed with a kiss"
    particleEmojis={['💌', '💕', '✨']}
    bgGradient="linear-gradient(180deg, #4a0e2f 0%, #9d1770 60%, #b45387 100%)"
  />;
}

export default ValLoveLetterReveal;

export const ValLoveLetterConfig: TemplateConfig = {
  id: 'val-love-letter',
  name: 'Love Letter',
  occasionIds: ['valentine'],
  emoji: '💌',
  description: 'An envelope flies in, seals itself with a wax heart, then unfolds your message.',
  thumbnailBg: 'linear-gradient(135deg, #fef3c7, #f472b6)',
  premium: true,
  coins: 20,
  Component: ValLoveLetterReveal,
};
