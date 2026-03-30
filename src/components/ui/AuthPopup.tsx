'use client';

import { X, ArrowRight, ShieldCheck, RotateCcw } from 'lucide-react';
import Image from 'next/image';

interface AuthPopupProps {
  open: boolean;
  onClose: () => void;
}

export default function AuthPopup({ open, onClose }: AuthPopupProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9000] flex items-center justify-center px-4" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative w-full max-w-sm rounded-2xl p-6 animate-[popIn_0.2s_ease-out]"
        style={{
          background: 'rgba(10,11,15,0.97)',
          border: '1px solid rgba(0,212,255,0.1)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.6), 0 0 40px rgba(0,212,255,0.05)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button onClick={onClose} className="absolute right-4 top-4 text-[#4a5068] hover:text-white transition-colors cursor-pointer">
          <X size={18} />
        </button>

        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <Image src="/images/gao-logo.png" alt="Gao" width={48} height={48} className="mb-3" />
          <h2 className="text-lg font-bold text-white">Passkey Access</h2>
          <p className="mt-1 text-[11px] font-medium tracking-widest uppercase" style={{ color: '#4a5068' }}>
            Biometric Identity
          </p>
        </div>

        {/* Auth buttons */}
        <div className="space-y-3">
          {/* Sign up with Passkey */}
          <button
            className="flex w-full items-center rounded-2xl px-5 py-4 transition-all hover:brightness-110 cursor-pointer"
            style={{
              background: 'rgba(0,212,255,0.04)',
              border: '1px solid rgba(0,212,255,0.12)',
            }}
          >
            <div className="flex-1 text-left">
              <p className="text-[10px] font-medium tracking-widest uppercase mb-1" style={{ color: '#00d4ff' }}>
                Biometric
              </p>
              <p className="text-sm font-bold text-white">Sign up with Passkey</p>
            </div>
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full shrink-0"
              style={{ background: 'linear-gradient(135deg, #00d4ff, #6366f1)' }}
            >
              <ArrowRight size={16} className="text-white" />
            </div>
          </button>

          {/* Restore Account */}
          <button
            className="flex w-full items-center rounded-2xl px-5 py-4 transition-all hover:bg-white/2 cursor-pointer"
            style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <div className="flex-1 text-left">
              <p className="text-[10px] font-medium tracking-widest uppercase mb-1" style={{ color: '#4a5068' }}>
                Recovery
              </p>
              <p className="text-sm font-bold text-white">Restore Account</p>
            </div>
            <RotateCcw size={16} style={{ color: '#4a5068' }} className="shrink-0" />
          </button>
        </div>

        {/* Security badge */}
        <div className="flex flex-col items-center mt-6">
          <div className="flex items-center gap-1.5 mb-1.5">
            <ShieldCheck size={14} style={{ color: '#22C55E' }} />
            <span className="text-[10px] font-medium tracking-widest uppercase" style={{ color: '#4a5068' }}>
              Secure Enclave Active
            </span>
          </div>
          <p className="text-[10px]" style={{ color: '#2d3548' }}>
            No passwords required. On-device authentication only.
          </p>
        </div>

        {/* Guest option */}
        <div className="flex items-center gap-3 mt-5 mb-3">
          <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.04)' }} />
          <button
            onClick={onClose}
            className="text-[10px] text-[#4a5068] hover:text-[#a3adc3] transition-colors cursor-pointer"
          >
            Continue as Guest
          </button>
          <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.04)' }} />
        </div>
      </div>

      <style>{`
        @keyframes popIn {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
