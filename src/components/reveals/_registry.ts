// Central registry of all React reveal templates.
//
// Each template is a self-contained plugin under src/components/reveals/[id]/.
// Adding a new template:
//   1. Create src/components/reveals/[my-template]/index.tsx
//      (export default component + export named XxxConfig: TemplateConfig)
//   2. Import + register the config here
//   3. In admin, ensure the DB template's `component_key` matches config.id
//
// Templates using PlaceholderReveal are ready-to-customize scaffolds —
// rewrite their index.tsx with your own animation when you're ready.
//
// Custom-designed examples: rose-rain, val-heart-blast, xmas-snow, bday-party

import type { TemplateConfig } from './_types';

// Custom-designed
import { RoseRainConfig }        from './rose-rain/config';
import { HeartBlastConfig }      from './val-heart-blast/config';
import { XmasSnowConfig }        from './xmas-snow/config';
import { BdayPartyConfig }       from './bday-party/config';
import { BdayJourneyConfig }     from './bday-journey';

// Scaffolds (using PlaceholderReveal) — customize by rewriting index.tsx
import { ValLoveLetterConfig }   from './val-love-letter';
import { ValStarryConfig }       from './val-starry';
import { BdayCandlesConfig }     from './bday-candles';
import { BdayBalloonsConfig }    from './bday-balloons';
import { BdayCakeConfig }        from './bday-cake';
import { XmasSantaConfig }       from './xmas-santa';
import { XmasFireplaceConfig }   from './xmas-fireplace';
import { SorryWhiteConfig }      from './sorry-white';
import { SorryNoteConfig }       from './sorry-note';
import { SorryOrigamiConfig }    from './sorry-origami';
import { PropRingConfig }        from './prop-ring';
import { PropStarsConfig }       from './prop-stars';
import { PropPetalsConfig }      from './prop-petals';

/** All registered templates, keyed by config.id. */
export const TEMPLATE_REGISTRY: Record<string, TemplateConfig> = {
  [RoseRainConfig.id]:      RoseRainConfig,
  [HeartBlastConfig.id]:    HeartBlastConfig,
  [XmasSnowConfig.id]:      XmasSnowConfig,
  [BdayPartyConfig.id]:     BdayPartyConfig,
  [BdayJourneyConfig.id]:   BdayJourneyConfig,
  [ValLoveLetterConfig.id]: ValLoveLetterConfig,
  [ValStarryConfig.id]:     ValStarryConfig,
  [BdayCandlesConfig.id]:   BdayCandlesConfig,
  [BdayBalloonsConfig.id]:  BdayBalloonsConfig,
  [BdayCakeConfig.id]:      BdayCakeConfig,
  [XmasSantaConfig.id]:     XmasSantaConfig,
  [XmasFireplaceConfig.id]: XmasFireplaceConfig,
  [SorryWhiteConfig.id]:    SorryWhiteConfig,
  [SorryNoteConfig.id]:     SorryNoteConfig,
  [SorryOrigamiConfig.id]:  SorryOrigamiConfig,
  [PropRingConfig.id]:      PropRingConfig,
  [PropStarsConfig.id]:     PropStarsConfig,
  [PropPetalsConfig.id]:    PropPetalsConfig,
};

/** Ordered list of every registered template. */
export function allTemplates(): TemplateConfig[] {
  return Object.values(TEMPLATE_REGISTRY);
}

/** Templates registered for a given occasion. */
export function templatesByOccasion(occasionId: string): TemplateConfig[] {
  return Object.values(TEMPLATE_REGISTRY).filter(t => t.occasionIds.includes(occasionId));
}

/** Look up a template by its ID (returns undefined if not found). */
export function getTemplate(id: string | null | undefined): TemplateConfig | undefined {
  if (!id) return undefined;
  return TEMPLATE_REGISTRY[id];
}
