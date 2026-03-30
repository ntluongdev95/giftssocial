'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { useMapStore } from '@/stores/mapStore';
import { ENTITY_MARKER_CONFIG, TRUST_BANDS } from '@/styles/tokens';
import type { EntityType, TrustLevel } from '@/types';

// ─── Trust Level Pill ─────────────────────────────────────────────────────

function TrustLevelPill({ level, score }: { level: TrustLevel; score: number }) {
  const band = TRUST_BANDS[level];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
      style={{
        border: `1.5px solid ${band.color}`,
        color: band.color,
        background: `${band.color}15`,
      }}
    >
      <span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ background: band.color }}
      />
      {band.label} · {score}
    </span>
  );
}

// ─── Action Button ────────────────────────────────────────────────────────

function ActionBtn({
  label,
  variant = 'secondary',
  onClick,
}: {
  label: string;
  variant?: 'primary' | 'secondary';
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
        variant === 'primary'
          ? 'bg-[#00d4ff] text-[#0a0b0f] hover:bg-[#00d4ff]/80'
          : 'border border-[#181c24] bg-[#111318]/50 text-[#f0f4ff] hover:bg-[#111318]'
      }`}
    >
      {label}
    </button>
  );
}

// ─── Entity Icon ──────────────────────────────────────────────────────────

function EntityIcon({ type }: { type: EntityType }) {
  const config = ENTITY_MARKER_CONFIG[type];
  const icons: Record<string, string> = {
    circle: '●',
    square: '■',
    triangle: '▲',
    diamond: '◆',
    shield: '🛡',
    hexagon: '⬡',
    cluster: '⦿',
    pulse: '⊙',
  };
  return (
    <span
      className="flex h-10 w-10 items-center justify-center rounded-lg text-lg"
      style={{ background: `${config.color}20`, color: config.color }}
    >
      {icons[config.shape] || '●'}
    </span>
  );
}

// ─── Content by entity type ───────────────────────────────────────────────

function BusinessContent({ data }: { data: Record<string, unknown> }) {
  return (
    <>
      <div className="flex items-start gap-3">
        <EntityIcon type="business" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-[#f0f4ff]">
            {data.name as string}
          </h3>
          <p className="text-xs text-[#4a5068]">
            {data.category as string} · {data.distance as string}
          </p>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <TrustLevelPill
          level={(data.trust_level as TrustLevel) || 'new'}
          score={(data.trust_score as number) || 0}
        />
        <span className="text-xs text-[#4a5068]">
          {data.proof_count as number} proofs · ★ {data.rating_avg as string}
        </span>
      </div>
      <div className="mt-4 flex gap-2">
        <ActionBtn label="Chat" />
        <ActionBtn label="Book" variant="primary" />
        <ActionBtn label="Save" />
      </div>
    </>
  );
}

function EventContent({ data }: { data: Record<string, unknown> }) {
  return (
    <>
      <div className="flex items-start gap-3">
        <EntityIcon type="event" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-[#f0f4ff]">
            {data.title as string}
          </h3>
          <p className="text-xs text-[#4a5068]">
            Hosted by: {data.host_name as string}
          </p>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <TrustLevelPill
          level={(data.trust_level as TrustLevel) || 'new'}
          score={(data.trust_score as number) || 0}
        />
        <span className="text-xs text-[#4a5068]">
          {data.time as string} · {data.distance as string}
        </span>
      </div>
      <p className="mt-1 text-xs text-[#4a5068]">
        {data.joined_count as number} joined ·{' '}
        {data.spots_left as number} spots left
      </p>
      <div className="mt-4 flex gap-2">
        <ActionBtn label="Join" variant="primary" />
        <ActionBtn label="Chat" />
        <ActionBtn label="Save" />
      </div>
    </>
  );
}

function AgentContent({ data }: { data: Record<string, unknown> }) {
  const caps = (data.capabilities as string[]) || [];
  return (
    <>
      <div className="flex items-start gap-3">
        <EntityIcon type="agent" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-[#f0f4ff]">
            {data.name as string}
          </h3>
          <p className="text-xs text-[#4a5068]">
            {data.type_label as string}
          </p>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <TrustLevelPill
          level={(data.trust_level as TrustLevel) || 'new'}
          score={(data.trust_score as number) || 0}
        />
        <span className="text-xs text-[#4a5068]">
          {data.action_count as number} successful actions · ★{' '}
          {data.rating as string}
        </span>
      </div>
      {caps.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {caps.slice(0, 2).map((c) => (
            <span
              key={c}
              className="rounded bg-[#A855F7]/10 px-2 py-0.5 text-[10px] text-[#A855F7]"
            >
              {c.replace(/_/g, ' ')}
            </span>
          ))}
        </div>
      )}
      <p className="mt-2 text-[10px] text-[#F59E0B]">
        ⚠ Requires approval for bookings
      </p>
      <div className="mt-4 flex gap-2">
        <ActionBtn label="Chat" />
        <ActionBtn label="Execute Task" variant="primary" />
        <ActionBtn label="Save" />
      </div>
    </>
  );
}

function OfferContent({ data }: { data: Record<string, unknown> }) {
  return (
    <>
      <div className="flex items-start gap-3">
        <EntityIcon type="offer" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-[#f0f4ff]">
            {data.title as string}
          </h3>
          <p className="text-xs text-[#4a5068]">
            {data.business_name as string} · {data.distance as string}
          </p>
        </div>
      </div>
      <p className="mt-2 text-sm text-[#EAB308]">
        {data.discount as string}
      </p>
      <p className="mt-1 text-xs text-[#4a5068]">
        Expires {data.expires as string}
      </p>
      <div className="mt-4 flex gap-2">
        <ActionBtn label="Claim" variant="primary" />
        <ActionBtn label="Book" />
      </div>
    </>
  );
}

function CircleContent({ data }: { data: Record<string, unknown> }) {
  return (
    <>
      <div className="flex items-start gap-3">
        <EntityIcon type="circle" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-[#f0f4ff]">
            {data.name as string}
          </h3>
          <p className="text-xs text-[#4a5068]">
            {data.category as string} · {data.member_count as number} members
          </p>
        </div>
      </div>
      <div className="mt-4">
        <ActionBtn label="Join Circle" variant="primary" />
      </div>
    </>
  );
}

// ─── Content Router ───────────────────────────────────────────────────────

function SheetContent({
  entityType,
  data,
}: {
  entityType: EntityType;
  data: Record<string, unknown>;
}) {
  switch (entityType) {
    case 'business':
      return <BusinessContent data={data} />;
    case 'event':
      return <EventContent data={data} />;
    case 'agent':
      return <AgentContent data={data} />;
    case 'offer':
      return <OfferContent data={data} />;
    case 'circle':
      return <CircleContent data={data} />;
    default:
      return <BusinessContent data={data} />;
  }
}

// ─── Main Sheet ───────────────────────────────────────────────────────────

interface MarkerDetailSheetProps {
  entityType: EntityType;
  data: Record<string, unknown>;
}

export default function MarkerDetailSheet({
  entityType,
  data,
}: MarkerDetailSheetProps) {
  const { selectedMarkerId, setSelectedMarker } = useMapStore();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(selectedMarkerId !== null);
  }, [selectedMarkerId]);

  const handleClose = () => {
    setOpen(false);
    setTimeout(() => setSelectedMarker(null), 300);
  };

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > 80) {
      handleClose();
    }
  };

  return (
    <AnimatePresence>
      {open && selectedMarkerId && (
        <>
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 z-40 bg-black/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
          />

          {/* Sheet */}
          <motion.div
            className="absolute bottom-0 left-0 right-0 z-50 max-h-[60vh] overflow-y-auto rounded-t-2xl border-t border-[#181c24]/40 bg-[#0a0b0f]/95 backdrop-blur-xl"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={0.2}
            onDragEnd={handleDragEnd}
          >
            {/* Drag handle */}
            <div className="flex justify-center py-3">
              <div className="h-1 w-10 rounded-full bg-[#181c24]" />
            </div>

            {/* Content */}
            <div className="px-4 pb-6">
              <SheetContent entityType={entityType} data={data} />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
