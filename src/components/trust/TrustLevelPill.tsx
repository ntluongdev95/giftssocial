'use client';

import { TRUST_BANDS } from '@/styles/tokens';
import type { TrustLevel } from '@/types';

interface TrustLevelPillProps {
  level: TrustLevel;
  score?: number;
  size?: 'sm' | 'md';
}

export default function TrustLevelPill({
  level,
  score,
  size = 'md',
}: TrustLevelPillProps) {
  const band = TRUST_BANDS[level];

  const sm = size === 'sm';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold ${
        sm ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-0.5 text-[10px]'
      }`}
      style={{
        border: `1.5px solid ${band.color}`,
        color: band.color,
        background: `${band.color}15`,
      }}
    >
      <span
        className={`inline-block rounded-full ${sm ? 'h-1 w-1' : 'h-1.5 w-1.5'}`}
        style={{ background: band.color }}
      />
      {band.label}
      {score !== undefined && !sm && (
        <span style={{ opacity: 0.7 }}>({score})</span>
      )}
    </span>
  );
}
