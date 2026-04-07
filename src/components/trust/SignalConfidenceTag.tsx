'use client';

import { parseUTC } from '@/lib/date';
import type { Signal } from '@/types';

type TagVariant = {
  label: string;
  color: string;
  bg: string;
};

function getTag(signal: Signal): TagVariant | null {
  const ageMs = Date.now() - (parseUTC(signal.created_at)?.getTime() ?? Date.now());
  const thirtyMin = 30 * 60 * 1000;
  const twentyFourH = 24 * 60 * 60 * 1000;

  if (signal.verified && ageMs < thirtyMin) {
    return { label: 'Live now', color: '#00d4ff', bg: '#00d4ff15' };
  }
  if (signal.verified) {
    return { label: 'Verified', color: '#3B82F6', bg: '#3B82F615' };
  }
  // Proof-backed: check metadata for linked proofs
  if (signal.metadata?.proof_count && (signal.metadata.proof_count as number) > 0) {
    return { label: 'Proof-backed', color: '#22C55E', bg: '#22C55E15' };
  }
  if (ageMs < twentyFourH) {
    return { label: 'Recent', color: '#4a5068', bg: '#4a506815' };
  }
  return null;
}

interface SignalConfidenceTagProps {
  signal: Signal;
}

export default function SignalConfidenceTag({ signal }: SignalConfidenceTagProps) {
  const tag = getTag(signal);
  if (!tag) return null;

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
      style={{ color: tag.color, background: tag.bg, border: `1px solid ${tag.color}30` }}
    >
      <span
        className="inline-block h-1 w-1 rounded-full"
        style={{ background: tag.color }}
      />
      {tag.label}
    </span>
  );
}
