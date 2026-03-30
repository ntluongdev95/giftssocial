// ─── Gao Social V3 — Design Tokens ────────────────────────────────────────

import type { SignalType, EntityType, AgentType, TrustLevel } from '@/types';

// ─── Colors ───────────────────────────────────────────────────────────────

export const COLORS = {
  // ── Gao Brand (standardized) ──────────────────────────
  navy: '#0a0b0f',
  cyan: '#00d4ff',
  cyanDim: 'rgba(0,212,255,0.15)',
  slate: '#111318',
  steel: '#181c24',
  border: 'rgba(255,255,255,0.07)',
  gray: '#4a5068',
  lightGray: '#f0f4ff',

  // Text
  textPrimary: '#f0f4ff',
  textSecondary: '#a3adc3',
  textMuted: '#4a5068',

  // Entity
  people: '#3B82F6',
  business: '#34d399',
  event: '#f87171',
  offer: '#fbbf24',
  proof: '#f0f4ff',
  alert: '#f87171',
  agent: '#a78bfa',
  circle: '#00d4ff',

  // Agent sub-colors
  agentSystem: '#00d4ff',
  agentMerchant: '#a78bfa',
  agentPersonal: '#34d399',
  agentCircle: '#c4b5fd',

  // Event states
  eventLive: '#f87171',
  eventUpcoming: '#fbbf24',

  // Gao semantic
  accent: '#00d4ff',
  success: '#34d399',
  warning: '#fbbf24',
  error: '#f87171',
} as const;

// ─── Trust Bands ──────────────────────────────────────────────────────────

export const TRUST_BANDS: Record<TrustLevel, { min: number; max: number; color: string; label: string }> = {
  new:            { min: 0,  max: 29,  color: '#4a5068', label: 'New' },
  verified:       { min: 30, max: 59,  color: '#3B82F6', label: 'Verified' },
  trusted:        { min: 60, max: 84,  color: '#22C55E', label: 'Trusted' },
  highly_trusted: { min: 85, max: 100, color: '#EAB308', label: 'Highly Trusted' },
} as const;

// ─── Signal Labels ────────────────────────────────────────────────────────

export const SIGNAL_LABELS: Record<SignalType, string> = {
  presence: "I'm here",
  intent: 'I need something',
  offer: 'I offer something',
  event: 'Create event',
  update: 'Share update',
  proof: 'Add proof',
} as const;

// ─── Signal Icons ─────────────────────────────────────────────────────────

export const SIGNAL_ICONS: Record<SignalType, string> = {
  presence: '📍',
  intent: '🔍',
  offer: '🏷',
  event: '🎉',
  update: '📣',
  proof: '🛡',
} as const;

// ─── Entity Marker Config ─────────────────────────────────────────────────

export const ENTITY_MARKER_CONFIG: Record<EntityType, { shape: string; color: string; label: string }> = {
  people:   { shape: 'circle',   color: COLORS.people,   label: 'People' },
  business: { shape: 'square',   color: COLORS.business, label: 'Business' },
  event:    { shape: 'triangle', color: COLORS.event,    label: 'Event' },
  offer:    { shape: 'diamond',  color: COLORS.offer,    label: 'Offer' },
  proof:    { shape: 'shield',   color: COLORS.proof,    label: 'Proof' },
  alert:    { shape: 'pulse',    color: COLORS.alert,    label: 'Alert' },
  agent:    { shape: 'hexagon',  color: COLORS.agent,    label: 'Agent' },
  circle:   { shape: 'cluster',  color: COLORS.circle,   label: 'Circle' },
  friend:   { shape: 'circle',   color: COLORS.accent,   label: 'Friend' },
  developer:{ shape: 'hexagon',  color: '#34d399',       label: 'Developer' },
  profile:  { shape: 'circle',   color: '#3B82F6',       label: 'Profiles' },
} as const;

// ─── Agent Colors ─────────────────────────────────────────────────────────

export const AGENT_COLORS: Record<AgentType, string> = {
  system:   COLORS.agentSystem,
  merchant: COLORS.agentMerchant,
  personal: COLORS.agentPersonal,
  circle:   COLORS.agentCircle,
} as const;

// ─── Typography ───────────────────────────────────────────────────────────

export const TYPOGRAPHY = {
  fontFamily: {
    body: "'Inter', system-ui, sans-serif",
    heading: "'Space Grotesk', 'Inter', system-ui, sans-serif",
  },
  fontSize: {
    xs: '0.75rem',
    sm: '0.875rem',
    base: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.875rem',
  },
  lineHeight: '1.5',
} as const;

// ─── Spacing ──────────────────────────────────────────────────────────────

export const LAYOUT = {
  bottomNavHeight: 64,
  topBarHeight: 56,
  cardBorderRadius: 12,
  sheetCollapsedHeight: 64,
} as const;
