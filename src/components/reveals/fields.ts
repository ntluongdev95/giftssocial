// Fields schema — the sender's inputs for a template.
//
// Each template's `fields_schema` JSON is an array of FieldSpec objects.
// The DynamicForm walks the list, mounts the matching input type, and
// collects values into a { key: value } object saved as kiss.template_data.

export type FieldType = 'text' | 'textarea' | 'number' | 'color' | 'select' | 'toggle' | 'date' | 'image' | 'audio-url' | 'password';

export interface FieldOption {
  value: string;
  label: string;
}

export interface FieldSpec {
  /** Machine key — used as {placeholder} in effect params + on the kiss. */
  key: string;
  /** Input widget type. */
  type: FieldType;
  /** Human label shown above the input. */
  label: string;
  /** Optional helper text below the input. */
  hint?: string;
  /** Value shown when the sender hasn't typed anything. */
  default?: string | number | boolean;
  /** For text/textarea. */
  placeholder?: string;
  maxLength?: number;
  /** For number. */
  min?: number;
  max?: number;
  step?: number;
  /** For select. */
  options?: FieldOption[];
  /** If true, the send button is disabled until a value is provided. */
  required?: boolean;
}

/** Builds the initial data object from a schema — uses `default` when set. */
export function initialDataFromSchema(schema: FieldSpec[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of schema) {
    if (f.default !== undefined) out[f.key] = f.default;
  }
  return out;
}

/** Returns keys whose required constraint is unmet (missing or empty string). */
export function validateSchema(schema: FieldSpec[], data: Record<string, unknown>): string[] {
  const missing: string[] = [];
  for (const f of schema) {
    if (!f.required) continue;
    const v = data[f.key];
    if (v === undefined || v === null || v === '') missing.push(f.key);
  }
  return missing;
}
