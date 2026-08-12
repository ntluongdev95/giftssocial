// Helpers for reading kiss.template_data (sender's answers to the
// template's fields_schema) inside React reveal components.
//
// The sender fills a form (DynamicForm) whose values are stored as a
// JSON string on kiss.template_data. Every React reveal component can
// read those answers to customize its display (their name, their
// photo, their age, etc.) — this file has the two helpers you need.

import type { RevealKiss } from '../_types';

/**
 * Parse kiss.template_data into a plain object. Returns {} if empty
 * or malformed so callers can safely destructure.
 *
 *   const { photo, wish, age } = parseKissData(kiss);
 */
export function parseKissData(kiss: Pick<RevealKiss, 'template_data'>): Record<string, unknown> {
  if (!kiss.template_data) return {};
  try {
    const parsed = JSON.parse(kiss.template_data);
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

/** Convenience: get a single string field, or fallback. */
export function getKissString(kiss: Pick<RevealKiss, 'template_data'>, key: string, fallback = ''): string {
  const v = parseKissData(kiss)[key];
  return typeof v === 'string' ? v : fallback;
}

/** Convenience: get a single number field, or fallback. */
export function getKissNumber(kiss: Pick<RevealKiss, 'template_data'>, key: string, fallback = 0): number {
  const v = parseKissData(kiss)[key];
  if (typeof v === 'number') return v;
  if (typeof v === 'string') { const n = Number(v); return Number.isFinite(n) ? n : fallback; }
  return fallback;
}
