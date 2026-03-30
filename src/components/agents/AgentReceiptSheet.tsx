'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Check, X, Copy } from 'lucide-react';
import type { AgentReceipt } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────

interface AgentReceiptSheetProps {
  receipt: AgentReceipt | null;
  error?: string;
  onClose: () => void;
  onViewTarget?: () => void;
}

// ─── Action type labels ───────────────────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  booking_created: 'Booking created',
  availability_checked: 'Availability checked',
  reminder_sent: 'Reminder sent',
  payment_prepared: 'Payment prepared',
  recommendation_made: 'Recommendation provided',
};

// ─── Component ────────────────────────────────────────────────────────────

export default function AgentReceiptSheet({
  receipt,
  error,
  onClose,
  onViewTarget,
}: AgentReceiptSheetProps) {
  const [copied, setCopied] = useState(false);

  const success = receipt && receipt.execution_status === 'success';

  const copyReceiptId = () => {
    if (!receipt) return;
    navigator.clipboard.writeText(receipt.receipt_id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ─── Failed state ────────────────────────────────────────────────────

  if (error || (receipt && receipt.execution_status !== 'success')) {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#EF4444]/15">
          <X size={28} className="text-[#EF4444]" />
        </div>
        <h2 className="text-lg font-bold text-[#f0f4ff]">
          Action Could Not Complete
        </h2>
        <p className="max-w-xs text-sm text-[#4a5068]">
          {error || 'The agent was unable to complete the requested action.'}
        </p>
        <div className="flex gap-2 pt-2">
          <button
            onClick={onClose}
            className="rounded-xl bg-[#00d4ff] px-6 py-2.5 text-sm font-semibold text-[#0a0b0f]"
          >
            Try Again
          </button>
          <button
            onClick={onClose}
            className="rounded-xl border border-[#181c24] px-6 py-2.5 text-sm font-medium text-[#f0f4ff]"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // ─── Success state ───────────────────────────────────────────────────

  if (!receipt) return null;

  const actionLabel =
    ACTION_LABELS[receipt.action_type] ||
    receipt.action_type.replace(/_/g, ' ');

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      {/* Icon */}
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#00d4ff]/15">
        <Check size={28} className="text-[#00d4ff]" />
      </div>

      <h2 className="text-lg font-bold text-[#f0f4ff]">Action Completed</h2>

      {/* Receipt card */}
      <div className="w-full rounded-xl border border-[#181c24]/20 bg-[#111318]/30 p-4 text-left">
        {/* Agent */}
        <div className="flex items-center gap-2 text-xs">
          <span className="flex h-6 w-6 items-center justify-center rounded bg-[#A855F7]/20 text-[10px] text-[#A855F7]">
            ⬡
          </span>
          <span className="text-[#4a5068]">Agent:</span>
          <span className="font-medium text-[#f0f4ff]">
            {receipt.agent_name}
          </span>
        </div>

        <div className="mt-3 space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-[#4a5068]">Action</span>
            <span className="text-[#f0f4ff]">{actionLabel}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-[#4a5068]">Target</span>
            <span className="text-[#f0f4ff]">
              {receipt.target_type} · {receipt.target_id}
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-[#4a5068]">Approved by</span>
            <span className="text-[#22C55E]">You ✓</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-[#4a5068]">Status</span>
            <span className="text-[#22C55E]">Confirmed ✓</span>
          </div>

          {/* Receipt ID */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#4a5068]">Receipt ID</span>
            <button
              onClick={copyReceiptId}
              className="flex items-center gap-1 font-mono text-[10px] text-[#f0f4ff]/60 hover:text-[#f0f4ff]"
            >
              {receipt.receipt_id.slice(0, 16)}…
              {copied ? (
                <Check size={10} className="text-[#22C55E]" />
              ) : (
                <Copy size={10} />
              )}
            </button>
          </div>

          {/* Timestamp */}
          <div className="flex justify-between text-xs">
            <span className="text-[#4a5068]">Timestamp</span>
            <span className="text-[#f0f4ff]/80">
              {format(new Date(receipt.timestamp), 'MMM d, yyyy · h:mm:ss a')}
            </span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex w-full flex-col gap-2 pt-2">
        {onViewTarget && (
          <button
            onClick={onViewTarget}
            className="w-full rounded-xl bg-[#00d4ff] py-2.5 text-sm font-semibold text-[#0a0b0f]"
          >
            {receipt.action_type.includes('booking')
              ? 'View Booking'
              : 'View Details'}
          </button>
        )}
        <button
          onClick={onClose}
          className="w-full rounded-xl border border-[#181c24] py-2.5 text-sm font-medium text-[#f0f4ff]"
        >
          Message Business
        </button>
        <button onClick={onClose} className="py-2 text-sm text-[#4a5068]">
          Done
        </button>
      </div>
    </div>
  );
}
