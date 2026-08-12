import type { TemplateConfig } from '../_types';
import XmasSnowReveal from './index';

export const XmasSnowConfig: TemplateConfig = {
  id: 'xmas-snow',
  name: 'Snow Fall',
  occasionIds: ['christmas'],
  emoji: '❄️',
  description: 'Soft snowflakes drift down over a warmly lit Christmas tree silhouette with twinkling lights.',
  thumbnailBg: 'linear-gradient(180deg, #1e1b4b 0%, #6366f1 50%, #1a4d3a 100%)',
  Component: XmasSnowReveal,
};
