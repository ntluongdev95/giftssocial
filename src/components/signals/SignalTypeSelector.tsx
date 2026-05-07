'use client';

import { motion } from 'framer-motion';
import { SIGNAL_LABELS, SIGNAL_ICONS } from '@/styles/tokens';
import type { SignalType } from '@/types';

const SUBTITLES: Record<SignalType, string> = {
  presence: 'Share your live location',
  intent: 'Tell others what you need',
  offer: 'Publish a deal or service',
  event: "Share what's happening here right now",
  update: 'Post a quick update',
  proof: 'Rate a past experience',
};

const TYPES: SignalType[] = [
  'presence',
  'intent',
  'offer',
  'event',
  'update',
  'proof',
];

interface SignalTypeSelectorProps {
  onSelect: (type: SignalType) => void;
  selected?: SignalType;
}

export default function SignalTypeSelector({
  onSelect,
  selected,
}: SignalTypeSelectorProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {TYPES.map((type) => {
        const active = selected === type;
        return (
          <motion.button
            key={type}
            onClick={() => onSelect(type)}
            whileTap={{ scale: 0.97 }}
            className={`flex flex-col items-center gap-2 rounded-xl border p-5 text-center transition-colors ${
              active
                ? 'border-[#00d4ff] bg-[#00d4ff]/10'
                : 'border-[#181c24]/30 bg-[#111318]/60 hover:bg-[#111318]/80'
            }`}
          >
            <span className="text-4xl">{SIGNAL_ICONS[type]}</span>
            <span className="text-sm font-bold text-[#f0f4ff]">
              {SIGNAL_LABELS[type]}
            </span>
            <span className="text-[10px] leading-tight text-[#4a5068]">
              {SUBTITLES[type]}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}
