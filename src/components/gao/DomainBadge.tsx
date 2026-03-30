'use client';

export function DomainBadge({ domain = 'social.gao' }: { domain?: string }) {
  return (
    <span className="domain-badge">
      <span className="inline-block h-1.5 w-1.5 rounded-full glow-sm" style={{ background: '#00d4ff' }} />
      {domain}
    </span>
  );
}
