'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { MessageCircle, CalendarCheck, Bookmark, MapPin, Shield, Star, Users, Zap, Tag, ChevronRight, Radio, Clock, Globe, Send } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useMapStore } from '@/stores/mapStore';
import { ENTITY_MARKER_CONFIG, TRUST_BANDS } from '@/styles/tokens';
import type { EntityType, TrustLevel } from '@/types';

// ─── Trust Badge ─────────────────────────────────────────────────────────

function TrustBadge({ level, score }: { level: TrustLevel; score: number }) {
  const band = TRUST_BANDS[level];
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold" style={{ border: `1px solid ${band.color}30`, color: band.color, background: `${band.color}10` }}>
      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: band.color }} />
      {band.label} · {score}
    </span>
  );
}

// ─── Entity Avatar ───────────────────────────────────────────────────────

function EntityAvatar({ type, name, image }: { type: EntityType; name: string; image?: string }) {
  const config = ENTITY_MARKER_CONFIG[type];
  return (
    <div className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0 text-lg font-bold overflow-hidden" style={{ background: `${config.color}15`, color: config.color, border: `1.5px solid ${config.color}30` }}>
      {image ? <img src={image} alt={name} className="w-full h-full object-cover" /> : name?.charAt(0)?.toUpperCase() || '?'}
    </div>
  );
}

// ─── Action Button ───────────────────────────────────────────────────────

function ActionBtn({ icon, label, primary, onClick }: { icon: React.ReactNode; label: string; primary?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all active:scale-95 cursor-pointer"
      style={primary
        ? { background: 'linear-gradient(135deg, rgba(0,212,255,0.2), rgba(99,102,241,0.12))', border: '1px solid rgba(0,212,255,0.3)', color: '#00d4ff' }
        : { background: 'rgba(17,19,24,0.8)', border: '1px solid rgba(255,255,255,0.06)', color: '#a3adc3' }
      }
    >
      {icon}{label}
    </button>
  );
}

// ─── Business ────────────────────────────────────────────────────────────

function BusinessContent({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <EntityAvatar type="business" name={data.name as string} />
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold text-white truncate">{data.name as string}</h3>
          <p className="text-[11px] text-[#4a5068]">{data.category as string}{data.distance ? ` · ${data.distance}` : ''}</p>
        </div>
        <ChevronRight size={16} className="text-[#4a5068] shrink-0" />
      </div>
      <div className="flex items-center gap-2">
        <TrustBadge level={(data.trust_level as TrustLevel) || 'new'} score={(data.trust_score as number) || 0} />
        {(data.proof_count as number) > 0 && <span className="text-[10px] text-[#4a5068]"><Shield size={9} className="inline" /> {data.proof_count as number} proofs</span>}
        {data.rating_avg && <span className="text-[10px] text-[#EAB308]"><Star size={9} className="inline" /> {data.rating_avg as string}</span>}
      </div>
      <div className="flex gap-2">
        <ActionBtn icon={<MessageCircle size={13} />} label="Chat" />
        <ActionBtn icon={<CalendarCheck size={13} />} label="Book" primary />
        <ActionBtn icon={<Bookmark size={13} />} label="Save" />
      </div>
    </div>
  );
}

// ─── Event ───────────────────────────────────────────────────────────────

function EventContent({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <EntityAvatar type="event" name={data.title as string} />
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold text-white truncate">{data.title as string}</h3>
          <p className="text-[11px] text-[#4a5068]">{data.host_name ? `by ${data.host_name}` : ''}{data.time ? ` · ${data.time}` : ''}</p>
        </div>
      </div>
      <div className="flex items-center gap-3 text-[10px] text-[#4a5068]">
        <TrustBadge level={(data.trust_level as TrustLevel) || 'new'} score={(data.trust_score as number) || 0} />
        {data.distance && <span><MapPin size={9} className="inline" /> {data.distance as string}</span>}
        <span><Users size={9} className="inline" /> {data.joined_count as number} joined · {data.spots_left as number} left</span>
      </div>
      <div className="flex gap-2">
        <ActionBtn icon={<Users size={13} />} label="Join" primary />
        <ActionBtn icon={<MessageCircle size={13} />} label="Chat" />
        <ActionBtn icon={<Bookmark size={13} />} label="Save" />
      </div>
    </div>
  );
}

// ─── Agent ───────────────────────────────────────────────────────────────

function AgentContent({ data }: { data: Record<string, unknown> }) {
  const caps = (data.capabilities as string[]) || [];
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <EntityAvatar type="agent" name={data.name as string} />
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold text-white truncate">{data.name as string}</h3>
          <p className="text-[11px] text-[#4a5068]">{data.type_label as string}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <TrustBadge level={(data.trust_level as TrustLevel) || 'new'} score={(data.trust_score as number) || 0} />
        <span className="text-[10px] text-[#4a5068]">{data.action_count as number} actions · <Star size={9} className="inline" /> {data.rating as string}</span>
      </div>
      {caps.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {caps.slice(0, 3).map((c) => (
            <span key={c} className="rounded-full px-2 py-0.5 text-[9px] font-medium" style={{ background: 'rgba(167,139,250,0.1)', color: '#A855F7' }}>{c.replace(/_/g, ' ')}</span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <ActionBtn icon={<Zap size={13} />} label="Execute" primary />
        <ActionBtn icon={<MessageCircle size={13} />} label="Chat" />
        <ActionBtn icon={<Bookmark size={13} />} label="Save" />
      </div>
    </div>
  );
}

// ─── Offer ───────────────────────────────────────────────────────────────

function OfferContent({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <EntityAvatar type="offer" name={data.title as string} />
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold text-white truncate">{data.title as string}</h3>
          <p className="text-[11px] text-[#4a5068]">{data.business_name as string}{data.distance ? ` · ${data.distance}` : ''}</p>
        </div>
      </div>
      {data.discount && <p className="text-sm font-bold" style={{ color: '#EAB308' }}><Tag size={12} className="inline mr-1" />{data.discount as string}</p>}
      {data.expires && <p className="text-[10px] text-[#4a5068]">Expires {data.expires as string}</p>}
      <div className="flex gap-2">
        <ActionBtn icon={<Tag size={13} />} label="Claim" primary />
        <ActionBtn icon={<CalendarCheck size={13} />} label="Book" />
      </div>
    </div>
  );
}

// ─── Circle ──────────────────────────────────────────────────────────────

function CircleContent({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <EntityAvatar type="circle" name={data.name as string} />
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold text-white truncate">{data.name as string}</h3>
          <p className="text-[11px] text-[#4a5068]">{data.category as string} · <Users size={9} className="inline" /> {data.member_count as number} members</p>
        </div>
      </div>
      <div className="flex gap-2">
        <ActionBtn icon={<Users size={13} />} label="Join Circle" primary />
      </div>
    </div>
  );
}

// ─── Friend ──────────────────────────────────────────────────────────────

function FriendContent({ data }: { data: Record<string, unknown> }) {
  const isOnline = data.is_online as boolean;
  const trustScore = (data.trust_score as number) || 0;
  const lastSeen = data.last_seen_at as string | undefined;
  const gaoDomain = data.gao_domain as string | undefined;

  return (
    <div className="space-y-4">
      {/* Profile header */}
      <div className="flex items-center gap-3.5">
        <div className="relative">
          <div className="h-14 w-14 rounded-full flex items-center justify-center text-xl font-bold overflow-hidden" style={{ background: 'rgba(0,212,255,0.1)', color: '#00d4ff', border: '2.5px solid rgba(0,212,255,0.3)', boxShadow: isOnline ? '0 0 16px rgba(0,212,255,0.3)' : 'none' }}>
            {data.avatar_url ? <img src={data.avatar_url as string} alt={data.name as string} className="w-full h-full object-cover" /> : (data.name as string)?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full flex items-center justify-center" style={{ background: '#0a0b0f' }}>
            <div className="h-2.5 w-2.5 rounded-full" style={{ background: isOnline ? '#34d399' : '#4a5068', boxShadow: isOnline ? '0 0 8px rgba(52,211,153,0.6)' : 'none' }} />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold text-white truncate">{data.name as string}</h3>
          {gaoDomain && (
            <p className="text-[11px] mt-0.5 flex items-center gap-1" style={{ color: '#00d4ff' }}>
              <Globe size={10} /> {gaoDomain}
            </p>
          )}
          <p className="text-[10px] text-[#4a5068] mt-0.5 flex items-center gap-1">
            {isOnline ? (
              <><Radio size={9} className="text-[#34d399]" /> <span className="text-[#34d399]">Online now</span></>
            ) : lastSeen ? (
              <><Clock size={9} /> Last seen {formatDistanceToNow(new Date(lastSeen), { addSuffix: true })}</>
            ) : (
              <><Clock size={9} /> Offline</>
            )}
          </p>
        </div>
      </div>

      {/* Trust progress */}
      {trustScore > 0 && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] text-[#4a5068]">Trust Score</span>
            <span className="text-[10px] font-semibold text-white">{trustScore}/100</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${trustScore}%`, background: trustScore >= 60 ? '#34d399' : trustScore >= 30 ? '#3B82F6' : '#4a5068' }} />
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <TrustBadge level={(data.trust_level as TrustLevel) || 'new'} score={trustScore} />
        {isOnline && <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(52,211,153,0.1)', color: '#34d399' }}>Active</span>}
      </div>

      <div className="flex gap-2">
        <ActionBtn icon={<MessageCircle size={13} />} label="Message" primary />
        <ActionBtn icon={<Send size={13} />} label="Send" />
        <ActionBtn icon={<MapPin size={13} />} label="Directions" />
      </div>
    </div>
  );
}

// ─── People (signal) ─────────────────────────────────────────────────────

function PeopleContent({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <EntityAvatar type="people" name={data.name as string || data.title as string || '?'} />
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold text-white truncate">{data.name as string || data.title as string}</h3>
          <p className="text-[11px] text-[#4a5068]">{data.type as string}{data.category ? ` · ${data.category}` : ''}</p>
        </div>
      </div>
      <TrustBadge level={(data.trust_level as TrustLevel) || 'new'} score={(data.trust_score as number) || 0} />
      <div className="flex gap-2">
        <ActionBtn icon={<MessageCircle size={13} />} label="Chat" primary />
        <ActionBtn icon={<Bookmark size={13} />} label="Save" />
      </div>
    </div>
  );
}

// ─── Content Router ──────────────────────────────────────────────────────

function SheetContent({ entityType, data }: { entityType: EntityType; data: Record<string, unknown> }) {
  switch (entityType) {
    case 'business': return <BusinessContent data={data} />;
    case 'event': return <EventContent data={data} />;
    case 'agent': return <AgentContent data={data} />;
    case 'offer': return <OfferContent data={data} />;
    case 'circle': return <CircleContent data={data} />;
    case 'friend': return <FriendContent data={data} />;
    case 'people': return <PeopleContent data={data} />;
    default: return <PeopleContent data={data} />;
  }
}

// ─── Main Sheet ──────────────────────────────────────────────────────────

interface MarkerDetailSheetProps {
  entityType: EntityType;
  data: Record<string, unknown>;
}

export default function MarkerDetailSheet({ entityType, data }: MarkerDetailSheetProps) {
  const { selectedMarkerId, setSelectedMarker } = useMapStore();
  const [open, setOpen] = useState(false);

  useEffect(() => { setOpen(selectedMarkerId !== null); }, [selectedMarkerId]);

  const handleClose = () => { setOpen(false); setTimeout(() => setSelectedMarker(null), 300); };
  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => { if (info.offset.y > 80) handleClose(); };

  const config = ENTITY_MARKER_CONFIG[entityType];

  return (
    <AnimatePresence>
      {open && selectedMarkerId && (
        <>
          <motion.div className="absolute inset-0 z-40 bg-black/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={handleClose} />
          <motion.div
            className="absolute bottom-0 left-0 right-0 z-50 rounded-t-3xl overflow-hidden"
            style={{ background: 'rgba(10,11,15,0.97)', backdropFilter: 'blur(20px)', borderTop: `1px solid ${config.color}20` }}
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            drag="y" dragConstraints={{ top: 0 }} dragElastic={0.2} onDragEnd={handleDragEnd}
          >
            <div className="h-0.5 w-full" style={{ background: `linear-gradient(90deg, transparent, ${config.color}60, transparent)` }} />
            <div className="flex justify-center py-3">
              <div className="h-1 w-10 rounded-full" style={{ background: 'rgba(255,255,255,0.1)' }} />
            </div>
            <div className="px-5 pb-8">
              <SheetContent entityType={entityType} data={data} />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
