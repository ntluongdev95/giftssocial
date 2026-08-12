import type { TemplateConfig } from '../_types';
import RoseRainReveal from './index';

export const RoseRainConfig: TemplateConfig = {
  id: 'rose-rain',
  name: 'Rose Rain',
  occasionIds: ['valentine'],
  emoji: '🌹',
  description: 'Red rose petals cascade across the screen while a love letter fades in over a dark romantic backdrop.',
  thumbnailBg: 'linear-gradient(135deg, #fecdd3, #f43f5e)',
  Component: RoseRainReveal,
};
