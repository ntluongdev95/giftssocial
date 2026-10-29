import type { TemplateConfig } from '../_types';
import SilkBlossomReveal from './index';

export const SilkBlossomConfig: TemplateConfig = {
  id: 'silk-blossom',
  name: 'Silk & Blossoms',
  occasionIds: ['vietnam-womens-day'],
  emoji: '🌺',
  description: 'Hibiscus, cherry blossom, and tulip petals drift down past soft flowing silk-ribbon light streaks — a warm tribute for Vietnamese Women\'s Day.',
  thumbnailBg: 'linear-gradient(135deg, #ffe4e6, #e11d48)',
  Component: SilkBlossomReveal,
};
