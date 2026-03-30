'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import { ArrowLeft, Bookmark, MessageCircle } from 'lucide-react';
import { format } from 'date-fns';
import TrustLevelPill from '@/components/trust/TrustLevelPill';
import AgentTaskSheet from '@/components/agents/AgentTaskSheet';
import { AGENT_COLORS } from '@/styles/tokens';
import type { Agent, AgentReceipt, AgentCapability } from '@/types';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// ─── Capability descriptions ──────────────────────────────────────────────

const CAP_LABELS: Record<AgentCapability, string> = {
  answer_questions: 'Answer questions about the business',
  find_nearby: 'Find nearby options for you',
  trust_lookup: 'Look up trust scores and reviews',
  check_availability: 'Check open time slots',
  create_booking: 'Create booking requests',
  send_reminders: 'Send appointment reminders',
  recommend_options: 'Recommend best options',
  summarize_activity: 'Summarize recent activity',
  prepare_payment: 'Prepare payment details',
};

// ─── Permission display ───────────────────────────────────────────────────

function PermissionsSection({ agent }: { agent: Agent }) {
  const perms = agent.permission_scope;

  const items: { icon: string; color: string; text: string }[] = [];

  if (perms.can_suggest) {
    items.push({ icon: '✓', color: '#22C55E', text: 'Can suggest options to you' });
  }
  if (perms.can_prepare_action) {
    items.push({ icon: '✓', color: '#22C55E', text: 'Can prepare actions for review' });
  }
  if (perms.execute_with_approval.length > 0) {
    items.push({
      icon: '⚠',
      color: '#F59E0B',
      text: `Requires your approval to: ${perms.execute_with_approval.map((c) => c.replace(/_/g, ' ')).join(', ')}`,
    });
  }
  if (perms.requires_user_approval) {
    items.push({
      icon: '⚠',
      color: '#F59E0B',
      text: 'Requires your approval to confirm bookings',
    });
  }
  if (!perms.can_access_payment) {
    items.push({ icon: '✕', color: '#EF4444', text: 'Cannot access your wallet' });
    items.push({
      icon: '✕',
      color: '#EF4444',
      text: 'Cannot execute payments without your consent',
    });
  }
  if (perms.auto_execute.length === 0) {
    items.push({ icon: '✕', color: '#EF4444', text: 'No auto-execute permissions' });
  }

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-2 text-xs">
          <span style={{ color: item.color }} className="mt-0.5 shrink-0 font-bold">
            {item.icon}
          </span>
          <span className="text-[#f0f4ff]/70">{item.text}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="animate-pulse space-y-4 p-4 pt-16">
      <div className="flex items-center gap-4">
        <div className="h-16 w-16 rounded-xl bg-[#181c24]/30" />
        <div className="space-y-2">
          <div className="h-6 w-40 rounded bg-[#181c24]/30" />
          <div className="h-4 w-24 rounded bg-[#181c24]/20" />
        </div>
      </div>
      <div className="h-4 w-56 rounded bg-[#181c24]/20" />
      <div className="space-y-2">
        <div className="h-3 w-full rounded bg-[#181c24]/15" />
        <div className="h-3 w-full rounded bg-[#181c24]/15" />
        <div className="h-3 w-3/4 rounded bg-[#181c24]/15" />
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default function AgentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [showTask, setShowTask] = useState(false);

  const { data: agentData, isLoading } = useSWR<{ data: Agent }>(
    `/api/v1/agents/${id}`,
    fetcher
  );

  const { data: actionsData } = useSWR<{ data: AgentReceipt[] }>(
    `/api/v1/agents/${id}/actions`,
    fetcher
  );

  if (isLoading) return <Skeleton />;

  const agent = agentData?.data;
  if (!agent) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <p className="text-lg font-bold text-[#f0f4ff]">Agent not found</p>
        <button
          onClick={() => router.push('/nearby')}
          className="rounded-xl bg-[#00d4ff] px-6 py-2.5 text-sm font-semibold text-[#0a0b0f]"
        >
          Back to Nearby
        </button>
      </div>
    );
  }

  const color = AGENT_COLORS[agent.type];
  const recentActions = actionsData?.data?.slice(0, 3) ?? [];

  const typeLabels: Record<string, string> = {
    system: 'System Agent',
    merchant: 'Merchant Agent',
    personal: 'Personal Agent',
    circle: 'Community Agent',
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-[env(safe-area-inset-top,12px)]">
        <button
          onClick={() => router.back()}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[#4a5068] hover:bg-[#111318]"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-sm font-medium text-[#4a5068]">AI Agent</h1>
      </div>

      <div className="space-y-6 px-4 pt-4">
        {/* Identity card */}
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-[#181c24]/20 bg-[#111318]/30 p-6 text-center">
          <span
            className="flex h-16 w-16 items-center justify-center rounded-xl text-3xl"
            style={{ background: `${color}20`, color }}
          >
            ⬡
          </span>
          <h2 className="text-2xl font-bold text-[#f0f4ff]">{agent.name}</h2>
          <p className="text-xs text-[#4a5068]">
            {typeLabels[agent.type] || agent.type}
          </p>
          <TrustLevelPill level={agent.trust_level} score={agent.trust_score} />
          <p className="text-xs text-[#4a5068]">
            {agent.trust_score} trust · ★ 4.8 · 96% success
          </p>
        </div>

        {/* Capabilities */}
        <div>
          <h3 className="mb-3 text-sm font-semibold text-[#f0f4ff]">
            What this agent can do
          </h3>
          <div className="space-y-2">
            {agent.capabilities.map((cap) => (
              <div key={cap} className="flex items-center gap-2 text-xs">
                <span className="text-[#22C55E]">✓</span>
                <span className="text-[#f0f4ff]/80">
                  {CAP_LABELS[cap] || cap.replace(/_/g, ' ')}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Permissions (CRITICAL) */}
        <div>
          <h3 className="mb-3 text-sm font-semibold text-[#f0f4ff]">
            Permissions
          </h3>
          <PermissionsSection agent={agent} />
        </div>

        {/* Recent actions */}
        {recentActions.length > 0 && (
          <div>
            <h3 className="mb-3 text-sm font-semibold text-[#f0f4ff]">
              Recent Actions
            </h3>
            <div className="space-y-2">
              {recentActions.map((action) => (
                <div
                  key={action.receipt_id}
                  className="flex items-center gap-2 rounded-lg border border-[#181c24]/15 bg-[#0a0b0f] px-3 py-2 text-xs"
                >
                  <span
                    className={
                      action.execution_status === 'success'
                        ? 'text-[#22C55E]'
                        : 'text-[#EF4444]'
                    }
                  >
                    {action.execution_status === 'success' ? '✓' : '✕'}
                  </span>
                  <span className="text-[#f0f4ff]/80">
                    {action.action_type.replace(/_/g, ' ')}
                  </span>
                  <span className="text-[#4a5068]">·</span>
                  <span className="text-[#4a5068]">{action.target_type}</span>
                  <span className="ml-auto text-[10px] text-[#4a5068]">
                    {format(new Date(action.timestamp), 'MMM d, h:mm a')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Sticky CTA */}
      <div className="fixed bottom-16 left-0 right-0 z-40 border-t border-[#181c24]/20 bg-[#0a0b0f]/95 px-4 py-3 backdrop-blur-xl">
        <div className="flex gap-2">
          <button className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#181c24] py-2.5 text-sm font-medium text-[#f0f4ff] hover:bg-[#111318]">
            <MessageCircle size={16} />
            Chat
          </button>
          <button
            onClick={() => setShowTask(true)}
            className="flex flex-[2] items-center justify-center rounded-xl py-2.5 text-sm font-semibold text-[#0a0b0f] hover:opacity-80"
            style={{ background: color }}
          >
            Execute Task
          </button>
          <button className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#181c24] text-[#4a5068] hover:bg-[#111318]">
            <Bookmark size={16} />
          </button>
        </div>
      </div>

      {/* Task Sheet */}
      {showTask && agent && (
        <AgentTaskSheet
          agentId={id}
          agent={agent}
          onClose={() => setShowTask(false)}
        />
      )}
    </div>
  );
}
