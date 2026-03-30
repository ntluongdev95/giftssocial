'use client';

import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Lock, PenTool, Users, CalendarCheck, Wallet } from 'lucide-react';

// ─── Action config ────────────────────────────────────────────────────────

type GateAction = 'create' | 'join' | 'book' | 'pay' | 'default';

const ACTION_CONFIG: Record<
  GateAction,
  { title: string; Icon: React.ElementType }
> = {
  create: { title: 'Sign in to create signals', Icon: PenTool },
  join: { title: 'Sign in to join this circle', Icon: Users },
  book: { title: 'Sign in to book services', Icon: CalendarCheck },
  pay: { title: 'Sign in to make payments', Icon: Wallet },
  default: { title: 'Sign in to continue', Icon: Lock },
};

// ─── Props ────────────────────────────────────────────────────────────────

interface SignInGateSheetProps {
  action: GateAction;
  isOpen: boolean;
  onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────

export default function SignInGateSheet({
  action,
  isOpen,
  onClose,
}: SignInGateSheetProps) {
  const router = useRouter();
  const config = ACTION_CONFIG[action];
  const IconComponent = config.Icon;

  return (
    <AnimatePresence>
      {isOpen && (
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
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl border-t border-[#181c24]/30 bg-[#0a0b0f] px-6 pb-10 pt-4"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          >
            {/* Close */}
            <div className="flex justify-end">
              <button
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[#4a5068] hover:bg-[#111318]"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content */}
            <div className="flex flex-col items-center gap-4 pt-2 text-center">
              {/* Icon */}
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#00d4ff]/10">
                <IconComponent size={32} className="text-[#00d4ff]" />
              </div>

              {/* Title */}
              <h2 className="text-xl font-bold text-[#f0f4ff]">
                {config.title}
              </h2>

              {/* Subtitle */}
              <p className="max-w-xs text-sm text-[#4a5068]">
                Your Gao identity keeps your trust record and bookings safe.
              </p>

              {/* Actions */}
              <div className="w-full space-y-3 pt-4">
                <button
                  onClick={() => {
                    onClose();
                    router.push('/auth');
                  }}
                  className="w-full rounded-xl bg-[#00d4ff] py-3 text-sm font-semibold text-[#0a0b0f]"
                >
                  Sign In
                </button>
                <button
                  onClick={() => {
                    onClose();
                    router.push('/auth');
                  }}
                  className="w-full rounded-xl border border-[#181c24] py-3 text-sm font-medium text-[#f0f4ff]"
                >
                  Create Account
                </button>
                <button
                  onClick={onClose}
                  className="w-full py-2 text-sm text-[#4a5068]"
                >
                  Continue Exploring
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
