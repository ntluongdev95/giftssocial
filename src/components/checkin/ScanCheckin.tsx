'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, X, Keyboard, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ScanCheckinProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ScanCheckin({ isOpen, onClose }: ScanCheckinProps) {
  const [mode, setMode] = useState<'scan' | 'code'>('scan');
  const [manualCode, setManualCode] = useState('');
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<{ name: string; points: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<import('html5-qrcode').Html5Qrcode | null>(null);

  // Start camera scanner
  const startScanner = useCallback(async () => {
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const scanner = new Html5Qrcode('qr-reader');
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          // QR detected
          scanner.stop().catch(() => {});
          handleCheckin(decodedText, undefined);
        },
        () => {} // ignore errors during scanning
      );
    } catch (err) {
      console.warn('Camera unavailable, falling back to manual code:', (err as Error).message);
      setMode('code'); // fallback to manual code
    }
  }, []);

  // Stop scanner on close
  useEffect(() => {
    if (!isOpen) {
      scannerRef.current?.stop().catch(() => {});
      scannerRef.current = null;
      setResult(null);
      setError(null);
      setManualCode('');
      setMode('scan');
    }
  }, [isOpen]);

  // Start scanner when mode is scan and open
  useEffect(() => {
    if (isOpen && mode === 'scan') {
      const timer = setTimeout(() => startScanner(), 300);
      return () => { clearTimeout(timer); scannerRef.current?.stop().catch(() => {}); };
    }
  }, [isOpen, mode, startScanner]);

  const handleCheckin = async (qrData?: string, code?: string) => {
    if (typeof document === 'undefined' || !document.cookie.includes('gao_logged_in=1')) { toast.error('Please login first'); return; }

    setChecking(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qr_data: qrData, code }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult({ name: data.data.target_name, points: data.data.trust_points });
        toast.success(data.data.message);
      } else {
        setError(data.error?.message || 'Check-in failed');
      }
    } catch {
      setError('Network error');
    } finally {
      setChecking(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.85)' }}
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          className="relative w-full max-w-sm rounded-3xl overflow-hidden"
          style={{ background: 'rgba(10,11,15,0.98)', border: '1px solid rgba(0,212,255,0.15)' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <h3 className="text-base font-bold text-white">Scan Check-In</h3>
            <button onClick={onClose} className="text-[#4a5068] cursor-pointer"><X size={18} /></button>
          </div>

          {/* Success state */}
          {result && (
            <div className="px-5 pb-6 flex flex-col items-center gap-3">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300 }}
              >
                <CheckCircle size={56} className="text-[#34d399]" />
              </motion.div>
              <h4 className="text-lg font-bold text-white">Checked In!</h4>
              <p className="text-sm text-[#a3adc3] text-center">{result.name}</p>
              <div className="flex items-center gap-1.5 px-4 py-2 rounded-full" style={{ background: 'rgba(52,211,153,0.12)' }}>
                <span className="text-sm font-bold text-[#34d399]">+{result.points} Trust 🛡</span>
              </div>
              <button onClick={onClose} className="mt-2 rounded-xl px-6 py-2.5 text-sm font-semibold cursor-pointer" style={{ background: 'rgba(0,212,255,0.15)', color: '#00d4ff' }}>Done</button>
            </div>
          )}

          {/* Scanner / Code input */}
          {!result && (
            <div className="px-5 pb-5">
              {/* Mode toggle */}
              <div className="flex gap-2 mb-4">
                <button onClick={() => { scannerRef.current?.stop().catch(() => {}); setMode('scan'); }} className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold cursor-pointer" style={mode === 'scan' ? { background: 'rgba(0,212,255,0.12)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.25)' } : { background: 'rgba(17,19,24,0.5)', color: '#4a5068', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <Camera size={14} /> Scan QR
                </button>
                <button onClick={() => { scannerRef.current?.stop().catch(() => {}); setMode('code'); }} className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold cursor-pointer" style={mode === 'code' ? { background: 'rgba(0,212,255,0.12)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.25)' } : { background: 'rgba(17,19,24,0.5)', color: '#4a5068', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <Keyboard size={14} /> Enter Code
                </button>
              </div>

              {/* QR Scanner */}
              {mode === 'scan' && (
                <div className="relative rounded-2xl overflow-hidden mb-4" style={{ background: '#000' }}>
                  <div id="qr-reader" className="w-full" style={{ minHeight: 280 }} />
                  {/* Scan frame overlay */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-56 h-56 border-2 border-[#00d4ff] rounded-2xl opacity-50" />
                  </div>
                  <p className="text-center text-[10px] text-[#4a5068] py-2">Point camera at QR code</p>
                </div>
              )}

              {/* Manual code input */}
              {mode === 'code' && (
                <div className="mb-4">
                  <p className="text-xs text-[#4a5068] mb-2">Enter the 6-digit code displayed at the location</p>
                  <input
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value.toUpperCase().slice(0, 6))}
                    placeholder="ABC123"
                    maxLength={6}
                    className="w-full rounded-xl px-4 py-3 text-center text-2xl font-bold tracking-[0.3em] text-white outline-none uppercase"
                    style={{ background: 'rgba(17,19,24,0.8)', border: '1px solid rgba(0,212,255,0.15)', letterSpacing: '0.3em' }}
                    autoFocus
                  />
                  <button
                    onClick={() => { if (manualCode.length >= 4) handleCheckin(undefined, manualCode); }}
                    disabled={manualCode.length < 4 || checking}
                    className="w-full mt-3 rounded-xl py-3 text-sm font-bold cursor-pointer disabled:opacity-40"
                    style={{ background: 'linear-gradient(135deg, #00d4ff, #22C55E)', color: '#0a0b0f' }}
                  >
                    {checking ? <Loader2 size={16} className="inline animate-spin mr-1" /> : null}
                    {checking ? 'Checking in…' : 'Check In'}
                  </button>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 mb-3" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
                  <AlertCircle size={14} className="text-[#f87171] shrink-0" />
                  <p className="text-xs text-[#f87171]">{error}</p>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
