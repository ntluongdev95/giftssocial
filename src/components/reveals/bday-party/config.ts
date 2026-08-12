import type { TemplateConfig } from '../_types';
import BdayPartyReveal from './index';

export const BdayPartyConfig: TemplateConfig = {
  id: 'bday-party',
  name: 'Party Popper',
  occasionIds: ['birthday'],
  emoji: '🎉',
  description: 'Confetti bursts from every direction, balloons drift upward, and a rotating cake reveals the birthday greeting.',
  thumbnailBg: 'linear-gradient(135deg, #fbbf24, #f97316, #ec4899)',
  Component: BdayPartyReveal,
};
