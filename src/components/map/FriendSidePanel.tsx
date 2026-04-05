'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, MapPin, Send, Globe, Radio, Clock, X, Shield, Navigation, Phone, Lock, UserPlus } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { TrustLevel } from '@/types';
import { TRUST_BANDS } from '@/styles/tokens';
import { useMapStore } from '@/stores/mapStore';
import { useAuthStore } from '@/stores/auth-store';
import AuthPopup from '@/components/ui/AuthPopup';
import PrivateChat from '@/components/chat/PrivateChat';

interface FriendSidePanelProps {
  data: Record<string, unknown>;
}

export default function FriendSidePanel({ data }: FriendSidePanelProps) {
  const { selectedMarkerId, setSelectedMarker } = useMapStore();
  const myUserId = useAuthStore(s => s.user?.id);
  const isAuthed = useAuthStore(s => s.isAuthed) || (typeof document !== 'undefined' && document.cookie.includes('gao_logged_in=1'));
  const [showAuth, setShowAuth] = useState(false);
  const [showChat, setShowChat] = useState(false);

  const friendUserId = (data.user_id as string) || selectedMarkerId || '';
  const name = (data.name as string) || 'Unknown';
  const avatarUrl = data.avatar_url as string | undefined;
  const gaoDomain = data.gao_domain as string | undefined;
  const isOnline = data.is_online as boolean;
  const trustLevel = (data.trust_level as TrustLevel) || 'new';
  const trustScore = (data.trust_score as number) || 0;
  const lastSeen = data.last_seen_at as string | undefined;
  const band = TRUST_BANDS[trustLevel];

  const handleClose = () => setSelectedMarker(null);

  return (
    <>
    <AnimatePresence>
      {selectedMarkerId && (
        <>
          {/* ── Mobile: Bottom sheet ── */}
          <div className="lg:hidden">
            <motion.div className="absolute inset-0 z-40 bg-black/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={handleClose} />
            <motion.div
              className="absolute bottom-0 left-0 right-0 z-50 rounded-t-3xl overflow-hidden"
              style={{ background: 'rgba(10,11,15,0.97)', backdropFilter: 'blur(20px)', borderTop: '1px solid rgba(0,212,255,0.15)' }}
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            >
              <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg, transparent, rgba(0,212,255,0.5), transparent)' }} />
              <div className="flex justify-center py-3">
                <div className="h-1 w-10 rounded-full" style={{ background: 'rgba(255,255,255,0.1)' }} />
              </div>
              <div className="px-5 pb-8">
                <MobileContent name={name} avatarUrl={avatarUrl} gaoDomain={gaoDomain} isOnline={isOnline} trustLevel={trustLevel} trustScore={trustScore} lastSeen={lastSeen} band={band} onChat={() => isAuthed ? setShowChat(true) : setShowAuth(true)} isAuthed={isAuthed} />
              </div>
            </motion.div>
          </div>

          {/* ── Desktop: Right side panel ── */}
          <div className="hidden lg:block">
            <motion.div
              className="absolute top-0 right-0 bottom-0 z-50 w-[380px] overflow-y-auto"
              style={{ background: 'rgba(10,11,15,0.97)', backdropFilter: 'blur(24px)', borderLeft: '1px solid rgba(0,212,255,0.1)', boxShadow: '-8px 0 40px rgba(0,0,0,0.5)' }}
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            >
              {/* Accent */}
              <div className="w-0.5 h-full absolute left-0 top-0" style={{ background: 'linear-gradient(180deg, #00d4ff, transparent 60%)' }} />

              {/* Close */}
              <div className="flex items-center justify-between px-5 pt-5 pb-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#00d4ff]">Friend</span>
                <button onClick={handleClose} className="h-8 w-8 rounded-full flex items-center justify-center cursor-pointer transition-colors hover:bg-white/5 text-[#4a5068]">
                  <X size={16} />
                </button>
              </div>

              {/* Cover */}
              <div className="h-28 mx-5 rounded-2xl relative overflow-hidden mb-[-40px]" style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.15), rgba(99,102,241,0.1), rgba(167,139,250,0.08))' }}>
                {isOnline && (
                  <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: 'rgba(10,11,15,0.7)', backdropFilter: 'blur(8px)' }}>
                    <div className="h-2 w-2 rounded-full bg-[#34d399] animate-pulse" />
                    <span className="text-[9px] font-semibold text-[#34d399]">Online</span>
                  </div>
                )}
              </div>

              {/* Avatar */}
              <div className="px-5">
                <div className="relative inline-block">
                  <div className="h-20 w-20 rounded-2xl flex items-center justify-center text-2xl font-bold overflow-hidden" style={{ background: '#111318', border: '3px solid rgba(0,212,255,0.3)', color: '#00d4ff', boxShadow: isOnline ? '0 0 20px rgba(0,212,255,0.25)' : 'none' }}>
                    {avatarUrl ? <img src={avatarUrl} alt={name} className="w-full h-full object-cover" /> : name.charAt(0).toUpperCase()}
                  </div>
                  <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full flex items-center justify-center" style={{ background: '#0a0b0f', border: '2px solid #0a0b0f' }}>
                    <div className="h-3 w-3 rounded-full" style={{ background: isOnline ? '#34d399' : '#4a5068', boxShadow: isOnline ? '0 0 8px rgba(52,211,153,0.6)' : 'none' }} />
                  </div>
                </div>

                {/* Name */}
                <h2 className="text-xl font-bold text-white mt-3">{name}</h2>
                {gaoDomain && (
                  <p className="text-xs mt-1 flex items-center gap-1" style={{ color: '#00d4ff' }}>
                    <Globe size={11} /> {gaoDomain}
                  </p>
                )}

                {/* Status */}
                <p className="text-[11px] text-[#4a5068] mt-1.5 flex items-center gap-1.5">
                  {isOnline ? (
                    <><Radio size={10} className="text-[#34d399]" /> <span className="text-[#34d399] font-medium">Active now</span></>
                  ) : lastSeen ? (
                    <><Clock size={10} /> Last seen {formatDistanceToNow(new Date(lastSeen), { addSuffix: true })}</>
                  ) : (
                    <><Clock size={10} /> Offline</>
                  )}
                </p>

                {/* Trust card */}
                <div className="mt-5 rounded-xl p-4" style={{ background: 'rgba(17,19,24,0.6)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[#4a5068]"><Shield size={10} className="inline mr-1" />Trust</span>
                    <span className="text-xs font-bold" style={{ color: band.color }}>{band.label}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                        <div className="h-full rounded-full transition-all" style={{ width: `${trustScore}%`, background: `linear-gradient(90deg, ${band.color}80, ${band.color})` }} />
                      </div>
                    </div>
                    <span className="text-sm font-bold text-white tabular-nums">{trustScore}</span>
                  </div>
                </div>

                {/* Quick actions */}
                <div className="mt-5 grid grid-cols-3 gap-2">
                  <ActionCard icon={isAuthed ? <MessageCircle size={18} /> : <Lock size={18} />} label="Message" color="#00d4ff" onClick={() => isAuthed ? setShowChat(true) : setShowAuth(true)} />
                  <ActionCard icon={<Phone size={18} />} label="Call" color="#34d399" />
                  <ActionCard icon={<Navigation size={18} />} label="Navigate" color="#a78bfa" />
                </div>

                {/* Secondary actions */}
                <div className="mt-3 flex gap-2">
                  <button className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold cursor-pointer" style={{ background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.15)', color: '#00d4ff' }}>
                    <Send size={12} /> Send Payment
                  </button>
                  <button className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold cursor-pointer" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: '#a3adc3' }}>
                    <MapPin size={12} /> Share Location
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>

    <AuthPopup open={showAuth} onClose={() => setShowAuth(false)} />

    {showChat && friendUserId && (
      <PrivateChat
        roomId={`dm_${[myUserId, friendUserId].sort().join('_')}`}
        title={name}
        subtitle={gaoDomain || 'Direct message'}
        avatar={avatarUrl}
        onClose={() => setShowChat(false)}
      />
    )}
    </>
  );
}

// ── Desktop action card ──
function ActionCard({ icon, label, color, onClick }: { icon: React.ReactNode; label: string; color: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1.5 rounded-xl py-3 cursor-pointer transition-all hover:scale-105" style={{ background: `${color}08`, border: `1px solid ${color}15` }}>
      <span style={{ color }}>{icon}</span>
      <span className="text-[10px] font-semibold" style={{ color: '#a3adc3' }}>{label}</span>
    </button>
  );
}

// ── Mobile compact content ──
function MobileContent({ name, avatarUrl, gaoDomain, isOnline, trustLevel, trustScore, lastSeen, band, onChat, isAuthed }: { name: string; avatarUrl?: string; gaoDomain?: string; isOnline: boolean; trustLevel: TrustLevel; trustScore: number; lastSeen?: string; band: { color: string; label: string }; onChat?: () => void; isAuthed?: boolean }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3.5">
        <div className="relative">
          <div className="h-14 w-14 rounded-full flex items-center justify-center text-xl font-bold overflow-hidden" style={{ background: 'rgba(0,212,255,0.1)', color: '#00d4ff', border: '2.5px solid rgba(0,212,255,0.3)', boxShadow: isOnline ? '0 0 16px rgba(0,212,255,0.3)' : 'none' }}>
            {avatarUrl ? <img src={avatarUrl} alt={name} className="w-full h-full object-cover" /> : name.charAt(0).toUpperCase()}
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full flex items-center justify-center" style={{ background: '#0a0b0f' }}>
            <div className="h-2.5 w-2.5 rounded-full" style={{ background: isOnline ? '#34d399' : '#4a5068' }} />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold text-white truncate">{name}</h3>
          {gaoDomain && <p className="text-[11px] flex items-center gap-1" style={{ color: '#00d4ff' }}><Globe size={10} /> {gaoDomain}</p>}
          <p className="text-[10px] text-[#4a5068] mt-0.5 flex items-center gap-1">
            {isOnline ? <><Radio size={9} className="text-[#34d399]" /> <span className="text-[#34d399]">Online</span></> : lastSeen ? <><Clock size={9} /> {formatDistanceToNow(new Date(lastSeen), { addSuffix: true })}</> : <><Clock size={9} /> Offline</>}
          </p>
        </div>
      </div>

      {trustScore > 0 && (
        <div className="flex items-center gap-3">
          <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full" style={{ background: `${band.color}15`, color: band.color, border: `1px solid ${band.color}30` }}>{band.label} · {trustScore}</span>
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={onChat} className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold cursor-pointer" style={{ background: 'rgba(0,212,255,0.12)', color: '#00d4ff' }}>{isAuthed ? <MessageCircle size={13} /> : <Lock size={13} />} {isAuthed ? 'Message' : 'Sign in'}</button>
        <button className="flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold cursor-pointer" style={{ background: 'rgba(255,255,255,0.04)', color: '#a3adc3' }}><Navigation size={13} /> Navigate</button>
      </div>
    </div>
  );
}
