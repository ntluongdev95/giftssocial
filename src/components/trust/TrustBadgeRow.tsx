'use client';

import type { Badge } from '@/types';

const BADGE_CONFIG: Record<Badge, { icon: string; color: string; label: string }> = {
  verified_identity:    { icon: '🪪', color: '#3B82F6', label: 'Verified Identity' },
  verified_business:    { icon: '✅', color: '#22C55E', label: 'Verified Business' },
  official_brand:       { icon: '🏢', color: '#00d4ff', label: 'Official Brand' },
  top_rated:            { icon: '⭐', color: '#EAB308', label: 'Top Rated' },
  trusted_seller:       { icon: '🛡', color: '#22C55E', label: 'Trusted Seller' },
  active_host:          { icon: '🎤', color: '#EF4444', label: 'Active Host' },
  trusted_member:       { icon: '👤', color: '#3B82F6', label: 'Trusted Member' },
  active_community:     { icon: '🌐', color: '#06B6D4', label: 'Active Community' },
  verified_agent:       { icon: '🤖', color: '#A855F7', label: 'Verified Agent' },
  highly_trusted_agent: { icon: '💎', color: '#C084FC', label: 'Highly Trusted Agent' },
};

interface TrustBadgeRowProps {
  badges: Badge[];
  maxVisible?: number;
}

export default function TrustBadgeRow({
  badges,
  maxVisible = 3,
}: TrustBadgeRowProps) {
  if (badges.length === 0) return null;

  const visible = badges.slice(0, maxVisible);
  const overflow = badges.length - maxVisible;

  return (
    <div className="flex items-center gap-1">
      {visible.map((badge) => {
        const config = BADGE_CONFIG[badge];
        return (
          <span
            key={badge}
            title={config.label}
            className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px]"
            style={{ background: `${config.color}20` }}
          >
            {config.icon}
          </span>
        );
      })}
      {overflow > 0 && (
        <span className="text-[10px] text-[#4a5068]">+{overflow}</span>
      )}
    </div>
  );
}
