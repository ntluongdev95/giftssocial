'use client';

import type { Agent } from '@/types';
import { AGENT_COLORS } from '@/styles/tokens';
import TrustLevelPill from '@/components/trust/TrustLevelPill';

interface AgentCardProps {
  agent: Agent;
  distance?: number;
}

const TYPE_LABELS: Record<string, string> = {
  system: 'System Agent',
  merchant: 'Merchant Agent',
  personal: 'Personal Agent',
  circle: 'Community Agent',
};

function formatDistance(meters?: number): string {
  if (!meters) return '';
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1609.34).toFixed(1)} mi`;
}

export default function AgentCard({ agent, distance }: AgentCardProps) {
  const color = AGENT_COLORS[agent.type];

  return (
    <div className="rounded-xl border border-[#181c24]/30 bg-[#111318]/60 p-4">
      <div className="flex items-start gap-3">
        {/* Icon */}
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg"
          style={{ background: `${color}20`, color }}
        >
          ⬡
        </span>

        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-[#f0f4ff]">
            {agent.name}
          </h3>

          <div className="mt-0.5 flex items-center gap-1.5">
            <span className="text-xs text-[#4a5068]">
              {TYPE_LABELS[agent.type] || agent.type}
              {distance ? ` · ${formatDistance(distance)}` : ''}
            </span>
            <TrustLevelPill level={agent.trust_level} size="sm" />
          </div>

          {/* Capabilities */}
          {agent.capabilities.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {agent.capabilities.slice(0, 2).map((cap) => (
                <span
                  key={cap}
                  className="rounded px-1.5 py-0.5 text-[9px] font-medium"
                  style={{ background: `${color}15`, color }}
                >
                  {cap.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          )}

          {/* Stats placeholder */}
          <p className="mt-1.5 text-[10px] text-[#4a5068]">
            {agent.trust_score} trust score · ★ 4.8
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-3 flex gap-2">
        <button className="flex-1 rounded-lg border border-[#181c24] py-1.5 text-xs font-medium text-[#f0f4ff] transition-colors hover:bg-[#111318]">
          Chat
        </button>
        <button
          className="flex-1 rounded-lg py-1.5 text-xs font-medium text-[#0a0b0f] transition-colors hover:opacity-80"
          style={{ background: color }}
        >
          Execute
        </button>
      </div>
    </div>
  );
}
