import type { TemplateConfig } from '../_types';
import HeartBlastReveal from './index';

export const HeartBlastConfig: TemplateConfig = {
  id: 'val-heart-blast',
  name: 'Heart Explosion',
  occasionIds: ['valentine'],
  emoji: '💥',
  description: 'A giant heart bursts open into hundreds of tiny hearts and sparkles across the whole screen.',
  thumbnailBg: 'linear-gradient(135deg, #fbcfe8, #ec4899)',
  Component: HeartBlastReveal,
};
