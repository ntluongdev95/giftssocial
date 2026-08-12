// Effect primitive types — the vocabulary the TemplateRenderer speaks.
//
// Each template's `effects` JSON is an array of EffectSpec objects.
// The renderer walks the list, looks up the matching component in the
// registry, and mounts it with the (substituted) params.
//
// Placeholders like "{name}" inside string params are replaced with
// values from the kiss's template_data map before mount.

export interface EffectSpec {
  /** Registry key — e.g. 'particle-rain' | 'text-flash' | ... */
  type: string;
  /** When to start playing, ms after reveal begins. Default 0. */
  at?: number;
  /** How long the effect stays active, ms. Undefined = for the whole reveal. */
  duration?: number;
  /** Per-primitive parameters. Renderer passes these + resolved template_data. */
  [key: string]: unknown;
}

export interface EffectProps {
  /** The kiss's template_data merged with defaults from fields_schema. */
  data: Record<string, unknown>;
  /** Fires when a finite-duration effect finishes. */
  onComplete?: () => void;
}
