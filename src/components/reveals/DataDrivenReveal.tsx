'use client';

// DataDrivenReveal — the receiver-side reveal component used for every
// template that uses the data-driven engine (i.e. has effects[] set in
// the DB). Wraps TemplateRenderer inside the shared TemplateShell so
// the meet-and-hug opening is identical to hardcoded templates, then
// plays the template's effects timeline.
//
// Sender's answers (kiss.template_data) are merged with fields_schema
// defaults before being handed to the renderer for placeholder
// substitution.

import { useMemo } from 'react';
import TemplateShell from './_shared/TemplateShell';
import TemplateRenderer from './TemplateRenderer';
import type { RevealKiss } from './_types';
import type { EffectSpec } from './_effects/_types';
import type { FieldSpec } from './fields';
import { initialDataFromSchema } from './fields';

interface Props {
  kiss: RevealKiss;
  currentUserId?: string;
  onClose: () => void;
  onSendBack?: (senderId: string) => void;
  effects: EffectSpec[];
  fieldsSchema: FieldSpec[];
  accent?: string;
}

export default function DataDrivenReveal({
  kiss,
  onClose,
  effects,
  fieldsSchema,
  accent = '#ec4899',
}: Props) {
  const data = useMemo(() => {
    const defaults = initialDataFromSchema(fieldsSchema);
    let userData: Record<string, unknown> = {};
    if (kiss.template_data) {
      try { userData = JSON.parse(kiss.template_data); } catch { /* ignore */ }
    }
    return {
      ...defaults,
      ...userData,
      // Convenience fields templates can reference without a schema entry.
      sender_name: kiss.sender_name ?? '',
      receiver_name: kiss.receiver_name ?? '',
      message: kiss.message ?? '',
    };
  }, [fieldsSchema, kiss]);

  return (
    <TemplateShell
      sender={{ name: kiss.sender_name, avatarUrl: kiss.sender_avatar }}
      receiver={{ name: kiss.receiver_name, avatarUrl: kiss.receiver_avatar }}
      accent={accent}
      onClose={onClose}
    >
      <TemplateRenderer effects={effects} data={data} />
    </TemplateShell>
  );
}
