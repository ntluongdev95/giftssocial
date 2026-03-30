'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { SIGNAL_ICONS, SIGNAL_LABELS } from '@/styles/tokens';
import type { SignalType } from '@/types';

const QUICK_ACTIONS: { href: string; icon: string; label: string }[] = [
  { href: '/create', icon: '📡', label: 'Create Signal' },
  { href: '/actions/ask-gao', icon: '⬡', label: 'Ask Gao' },
];

const SIGNAL_TYPES: SignalType[] = [
  'presence',
  'intent',
  'offer',
  'event',
  'update',
  'proof',
];

export default function ActionsPage() {
  return (
    <div className="h-full overflow-y-auto px-4 pt-[env(safe-area-inset-top,12px)]">
      <h1 className="text-2xl font-bold text-[#f0f4ff]">Actions</h1>
      <p className="mt-1 text-sm text-[#4a5068]">
        Create, discover, and manage
      </p>

      {/* Quick actions */}
      <div className="mt-6 grid grid-cols-2 gap-3">
        {QUICK_ACTIONS.map((a) => (
          <Link key={a.href} href={a.href}>
            <motion.div
              whileTap={{ scale: 0.97 }}
              className="flex flex-col items-center gap-2 rounded-xl border border-[#181c24]/30 bg-[#111318]/40 p-5"
            >
              <span className="text-3xl">{a.icon}</span>
              <span className="text-sm font-semibold text-[#f0f4ff]">
                {a.label}
              </span>
            </motion.div>
          </Link>
        ))}
      </div>

      {/* Signal types */}
      <h2 className="mb-3 mt-8 text-sm font-semibold text-[#4a5068]">
        Create by type
      </h2>
      <div className="space-y-2">
        {SIGNAL_TYPES.map((type) => (
          <Link key={type} href={`/create?type=${type}`}>
            <div className="flex items-center gap-3 rounded-xl border border-[#181c24]/20 bg-[#111318]/30 px-4 py-3 transition-colors hover:bg-[#111318]/50">
              <span className="text-xl">{SIGNAL_ICONS[type]}</span>
              <span className="text-sm text-[#f0f4ff]">
                {SIGNAL_LABELS[type]}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
