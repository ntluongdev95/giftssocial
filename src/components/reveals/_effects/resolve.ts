// Placeholder resolver — substitutes {key} tokens with template_data values.
//
// resolveString("Happy Birthday {name}!", { name: "Linh" })
//   → "Happy Birthday Linh!"
//
// resolveNumber("{age}", { age: 25 })   → 25
// resolveNumber("{age}", {})            → NaN — callers should provide a fallback

export function resolveString(input: string | undefined, data: Record<string, unknown>): string {
  if (!input) return '';
  return input.replace(/\{([a-zA-Z0-9_]+)\}/g, (_m, key) => {
    const v = data[key];
    return v == null ? '' : String(v);
  });
}

export function resolveNumber(input: string | number | undefined, data: Record<string, unknown>, fallback = 0): number {
  if (typeof input === 'number') return input;
  if (!input) return fallback;
  const s = resolveString(input, data);
  const n = Number(s);
  return Number.isFinite(n) ? n : fallback;
}

/** Resolves any string values in an object (shallow) — leaves numbers/booleans as-is. */
export function resolveParams<T extends Record<string, unknown>>(params: T, data: Record<string, unknown>): T {
  const out: Record<string, unknown> = { ...params };
  for (const k of Object.keys(out)) {
    const v = out[k];
    if (typeof v === 'string') out[k] = resolveString(v, data);
  }
  return out as T;
}
