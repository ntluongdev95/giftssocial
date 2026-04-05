'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Lock, PenTool, Users, CalendarCheck, Wallet } from 'lucide-react';
import AuthPopup from '@/components/ui/AuthPopup';

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
  const [showAuth, setShowAuth] = useState(false);
  const config = ACTION_CONFIG[action];
  const IconComponent = config.Icon;

  return (
    <>
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-[250] bg-black/60"
            style={{ backdropFilter: 'blur(6px)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Sheet: bottom on mobile, centered on desktop */}
          <motion.div
            className="fixed z-[250] bg-[#0a0b0f] px-6 pb-8 pt-5
              bottom-0 left-0 right-0 rounded-t-3xl
              lg:bottom-auto lg:left-1/2 lg:top-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2
              lg:w-[420px] lg:rounded-3xl"
            style={{ border: '1px solid rgba(0,212,255,0.08)', boxShadow: '0 20px 80px rgba(0,0,0,0.6)' }}
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          >
            {/* Close */}
            <div className="flex justify-end">
              <button
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[#4a5068] hover:bg-[#111318] cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content */}
            <div className="flex flex-col items-center gap-4 pt-2 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#00d4ff]/10">
                <IconComponent size={32} className="text-[#00d4ff]" />
              </div>

              <h2 className="text-xl font-bold text-[#f0f4ff]">
                {config.title}
              </h2>

              <p className="max-w-xs text-sm text-[#4a5068]">
                Your Gao identity keeps your trust record and bookings safe.
              </p>

              <div className="w-full space-y-3 pt-4">
                <button
                  onClick={() => { onClose(); setShowAuth(true); }}
                  className="w-full rounded-xl bg-[#00d4ff] py-3 text-sm font-semibold text-[#0a0b0f] cursor-pointer"
                >
                  Sign In
                </button>
                <button
                  onClick={onClose}
                  className="w-full py-2 text-sm text-[#4a5068] cursor-pointer"
                >
                  Continue Exploring
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
    <AuthPopup open={showAuth} onClose={() => setShowAuth(false)} />
    </>
  );
}
