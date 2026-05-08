'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, ChevronDown, X } from 'lucide-react';
import TrustLevelPill from '@/components/trust/TrustLevelPill';
import AgentReceiptSheet from '@/components/agents/AgentReceiptSheet';
import { AGENT_COLORS } from '@/styles/tokens';
import type { Agent, AgentReceipt } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────

interface AgentTaskSheetProps {
  agentId: string;
  agent: Agent;
  onClose: () => void;
}

type State = 'input' | 'results' | 'approval' | 'executing' | 'receipt';

interface Recommendation {
  id: string;
  name: string;
  trust_level: Agent['trust_level'];
  trust_score: number;
  detail: string;
  reason: string;
}

// ─── Component ────────────────────────────────────────────────────────────

export default function AgentTaskSheet({
  agentId,
  agent,
  onClose,
}: AgentTaskSheetProps) {
  const color = AGENT_COLORS[agent.type];

  const [state, setState] = useState<State>('input');
  const [instruction, setInstruction] = useState('');
  const [showConstraints, setShowConstraints] = useState(false);
  const [distance, setDistance] = useState(5);
  const [trustedOnly, setTrustedOnly] = useState(true);
  const [budget, setBudget] = useState('');

  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [selectedRec, setSelectedRec] = useState<Recommendation | null>(null);
  const [receipt, setReceipt] = useState<AgentReceipt | null>(null);
  const [receiptError, setReceiptError] = useState<string | undefined>();

  // Run task → get recommendations
  const handleRunTask = async () => {
    if (!instruction.trim()) return;
    setState('executing');

    try {
      const res = await fetch(`/api/v1/agents/${agentId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instruction,
          mode: 'execute_with_approval',
          constraints: {
            max_distance_miles: distance,
            trusted_only: trustedOnly,
            max_budget: budget || undefined,
          },
        }),
      });

      if (!res.ok) throw new Error('Task failed');

      const data = await res.json();
      const recs: Recommendation[] = data.recommendations ?? [
        {
          id: 'rec_1',
          name: 'Recommended option',
          trust_level: 'trusted' as const,
          trust_score: 78,
          detail: 'Available today',
          reason: 'Best match for your request',
        },
      ];

      setRecommendations(recs);
      setSelectedRec(recs[0] || null);
      setState('results');
    } catch {
      setState('input');
    }
  };

  // Approve → execute → get receipt
  const handleApprove = async () => {
    setState('executing');

    try {
      const res = await fetch(`/api/v1/agents/${agentId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instruction,
          mode: 'execute',
          approved: true,
          target_id: selectedRec?.id,
        }),
      });

      if (!res.ok) throw new Error('Execution failed');

      const data = await res.json();
      setReceipt(
        data.receipt ?? {
          receipt_id: `rcpt_${Date.now()}`,
          agent_id: agentId,
          agent_name: agent.name,
          action_type: 'booking_created',
          target_type: 'business',
          target_id: selectedRec?.id ?? '',
          approved_by_user: true,
          execution_status: 'success' as const,
          timestamp: new Date().toISOString(),
        }
      );
      setReceiptError(undefined);
      setState('receipt');
    } catch {
      setReceiptError('The action could not be completed. Please try again.');
      setState('receipt');
    }
  };

  return (
    <>
      {/* Backdrop */}
      <motion.div
        className="fixed inset-0 z-50 bg-black/50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />

      {/* Sheet */}
      <motion.div
        className="fixed bottom-0 left-0 right-0 z-50 max-h-[90vh] overflow-y-auto rounded-t-2xl border-t border-[#181c24]/30 bg-[#0a0b0f]"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      >
        {/* Handle + close */}
        <div className="flex items-center justify-between px-4 pt-3">
          <div className="h-1 w-10 rounded-full bg-[#181c24]" />
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[#4a5068] hover:bg-[#111318]"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-4 pb-8 pt-2">
          <AnimatePresence mode="wait">
            {/* ─── STATE 1: Task Input ────────────── */}
            {state === 'input' && (
              <motion.div
                key="input"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                <h2 className="text-lg font-bold text-[#f0f4ff]">
                  Give {agent.name} a task
                </h2>

                <textarea
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  placeholder="e.g. Find available nail appointment for tomorrow afternoon"
                  rows={3}
                  className="w-full resize-none rounded-xl border border-[#181c24]/30 bg-[#0a0b0f] px-4 py-3 text-sm text-[#f0f4ff] placeholder-[#4a5068] outline-none focus:border-[#00d4ff]"
                />

                {/* Constraints */}
                <button
                  onClick={() => setShowConstraints(!showConstraints)}
                  className="flex items-center gap-1 text-xs text-[#4a5068]"
                >
                  Constraints
                  <ChevronDown
                    size={12}
                    className={`transition-transform ${showConstraints ? 'rotate-180' : ''}`}
                  />
                </button>

                {showConstraints && (
                  <div className="space-y-3 rounded-xl border border-[#181c24]/20 bg-[#111318]/20 p-3">
                    {/* Distance */}
                    <div>
                      <label className="mb-1 flex justify-between text-[10px] text-[#4a5068]">
                        <span>Distance</span>
                        <span>{distance} miles</span>
                      </label>
                      <input
                        type="range"
                        min={1}
                        max={25}
                        value={distance}
                        onChange={(e) => setDistance(Number(e.target.value))}
                        className="w-full accent-[#00d4ff]"
                      />
                    </div>

                    {/* Trusted only */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[#4a5068]">
                        Trusted only (score ≥ 60)
                      </span>
                      <button
                        onClick={() => setTrustedOnly(!trustedOnly)}
                        className={`h-5 w-9 rounded-full transition-colors ${
                          trustedOnly ? 'bg-[#00d4ff]' : 'bg-[#181c24]'
                        }`}
                      >
                        <span
                          className={`block h-4 w-4 translate-x-0.5 rounded-full bg-white transition-transform ${
                            trustedOnly ? 'translate-x-[18px]' : ''
                          }`}
                        />
                      </button>
                    </div>

                    {/* Budget */}
                    <div>
                      <label className="mb-1 block text-[10px] text-[#4a5068]">
                        Max budget
                      </label>
                      <input
                        value={budget}
                        onChange={(e) => setBudget(e.target.value)}
                        placeholder="$ (optional)"
                        className="w-full rounded-lg border border-[#181c24]/30 bg-[#0a0b0f] px-3 py-2 text-xs text-[#f0f4ff] placeholder-[#4a5068] outline-none focus:border-[#00d4ff]"
                      />
                    </div>

                    {/* Mode (fixed) */}
                    <div className="flex items-center gap-2 text-[10px] text-[#4a5068]">
                      <span className="text-[#F59E0B]">⚠</span>
                      Mode: Execute with approval (required in MVP)
                    </div>
                  </div>
                )}

                <button
                  onClick={handleRunTask}
                  disabled={!instruction.trim()}
                  className="w-full rounded-xl py-3 text-sm font-semibold text-[#0a0b0f] transition-colors hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
                  style={{ background: color }}
                >
                  Run Task
                </button>
              </motion.div>
            )}

            {/* ─── STATE 2: Results ───────────────── */}
            {state === 'results' && (
              <motion.div
                key="results"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                <h2 className="text-lg font-bold text-[#f0f4ff]">
                  Found {recommendations.length} option
                  {recommendations.length !== 1 ? 's' : ''}
                </h2>

                {recommendations.map((rec) => (
                  <div
                    key={rec.id}
                    onClick={() => setSelectedRec(rec)}
                    className={`cursor-pointer rounded-xl border p-4 transition-colors ${
                      selectedRec?.id === rec.id
                        ? 'border-[#00d4ff] bg-[#00d4ff]/5'
                        : 'border-[#181c24]/20 bg-[#111318]/30'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-[#f0f4ff]">
                        {rec.name}
                      </p>
                      <TrustLevelPill
                        level={rec.trust_level}
                        score={rec.trust_score}
                        size="sm"
                      />
                    </div>
                    <p className="mt-1 text-xs text-[#4a5068]">{rec.detail}</p>
                    <p className="mt-1 text-[10px] text-[#A855F7]">
                      Why: {rec.reason}
                    </p>
                  </div>
                ))}

                <div className="flex gap-2">
                  <button
                    onClick={() => setState('approval')}
                    disabled={!selectedRec}
                    className="flex-1 rounded-xl bg-[#00d4ff] py-3 text-sm font-semibold text-[#0a0b0f] disabled:opacity-40"
                  >
                    Approve & Proceed
                  </button>
                  <button
                    onClick={() => setState('input')}
                    className="rounded-xl border border-[#181c24] px-4 py-3 text-sm text-[#4a5068]"
                  >
                    Cancel
                  </button>
                </div>
              </motion.div>
            )}

            {/* ─── STATE 3: Approval Gate ─────────── */}
            {state === 'approval' && selectedRec && (
              <motion.div
                key="approval"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle size={20} className="text-[#F59E0B]" />
                  <h2 className="text-lg font-bold text-[#f0f4ff]">
                    Approval Required
                  </h2>
                </div>

                {/* Summary */}
                <div className="rounded-xl border border-[#F59E0B]/20 bg-[#F59E0B]/5 p-4 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-[#4a5068]">Agent</span>
                    <span className="text-[#f0f4ff]">{agent.name}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-[#4a5068]">Action</span>
                    <span className="text-[#f0f4ff]">{instruction}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#4a5068]">Target</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[#f0f4ff]">{selectedRec.name}</span>
                      <TrustLevelPill
                        level={selectedRec.trust_level}
                        size="sm"
                      />
                    </div>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-[#4a5068]">Amount</span>
                    <span className="text-[#f0f4ff]">
                      {budget ? `$${budget}` : 'No payment'}
                    </span>
                  </div>
                </div>

                <p className="text-[10px] leading-relaxed text-[#4a5068]">
                  This agent will act on your behalf. You can cancel anytime.
                  Every action produces a verifiable receipt.
                </p>

                <div className="flex gap-2">
                  <button
                    onClick={handleApprove}
                    className="flex-1 rounded-xl bg-[#22C55E] py-3 text-sm font-semibold text-[#0a0b0f]"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => setState('results')}
                    className="flex-1 rounded-xl border border-[#EF4444]/40 py-3 text-sm font-medium text-[#EF4444]"
                  >
                    Reject
                  </button>
                </div>
              </motion.div>
            )}

            {/* ─── Executing spinner ──────────────── */}
            {state === 'executing' && (
              <motion.div
                key="executing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center gap-3 py-12"
              >
                <span className="inline-block animate-spin text-3xl" style={{ color }}>
                  ⬡
                </span>
                <p className="text-sm text-[#4a5068]">
                  {agent.name} is working on it…
                </p>
              </motion.div>
            )}

            {/* ─── Receipt ────────────────────────── */}
            {state === 'receipt' && (
              <motion.div
                key="receipt"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <AgentReceiptSheet
                  receipt={receipt}
                  error={receiptError}
                  onClose={onClose}
                  onViewTarget={() => {
                    onClose();
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </>
  );
}
