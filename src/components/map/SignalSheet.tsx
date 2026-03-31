'use client';

import { X, MapPin, Clock, MessageCircle, Share2, Bookmark, User, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { useState } from 'react';
import { toast } from 'sonner';

interface SignalData {
  id: string;
  title: string;
  type: string;
  description?: string;
  category?: string;
  author_name?: string;
  author_username?: string;
  author_avatar?: string;
  author_trust_level?: string;
  created_at?: string;
  expires_at?: string;
  metadata?: Record<string, unknown>;
}

interface Props {
  signal: SignalData;
  onClose: () => void;
}

const TYPE_CONFIG: Record<string, { emoji: string; color: string; label: string }> = {
  presence: { emoji: '📍', color: '#3B82F6', label: "I'm Here" },
  intent:   { emoji: '🔍', color: '#a78bfa', label: 'Looking For' },
  offer:    { emoji: '🏷', color: '#fbbf24', label: 'Offer' },
  event:    { emoji: '🎉', color: '#f87171', label: 'Event' },
  update:   { emoji: '📣', color: '#00d4ff', label: 'Update' },
  proof:    { emoji: '🛡', color: '#f0f4ff', label: 'Proof' },
};

export default function SignalSheet({ signal, onClose }: Props) {
  const cfg = TYPE_CONFIG[signal.type] || TYPE_CONFIG.presence;
  const timeAgo = signal.created_at ? formatDistanceToNow(new Date(signal.created_at), { addSuffix: true }) : '';
  const expiresIn = signal.expires_at ? formatDistanceToNow(new Date(signal.expires_at), { addSuffix: true }) : '';
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleChat = () => {
    toast.info(`Chat with ${signal.author_name || 'author'} coming soon!`);
  };

  const handleShare = async () => {
    const shareData = { title: signal.title, text: `${cfg.label}: ${signal.title}`, url: window.location.href };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(`${signal.title} — ${window.location.href}`);
        toast.success('Link copied!');
      }
    } catch { /* user canceled */ }
  };

  const handleSave = async () => {
    if (saving || saved) return;
    setSaving(true);
    try {
      const res = await fetch('/api/v1/saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('access_token') || ''}` },
        body: JSON.stringify({ item_type: 'signal', item_id: signal.id }),
      });
      if (res.ok) {
        setSaved(true);
        toast.success('Signal saved!');
      } else {
        toast.error('Failed to save');
      }
    } catch {
      toast.error('Network error');
    } finally { setSaving(false); }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-end justify-center lg:items-center"
        style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 280 }}
          className="w-full max-w-[420px] max-h-[80dvh] rounded-t-3xl lg:rounded-3xl flex flex-col overflow-hidden"
          style={{ background: 'rgba(10,11,15,0.97)', border: `1px solid ${cfg.color}15`, boxShadow: `0 -8px 60px rgba(0,0,0,0.6), 0 0 20px ${cfg.color}10` }}
        >
          {/* Header */}
          <div className="relative px-5 pt-5 pb-4">
            <button onClick={onClose} className="absolute top-4 right-4 z-10 flex h-8 w-8 items-center justify-center rounded-lg text-[#4a5068] hover:text-white transition-colors cursor-pointer" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <X size={16} />
            </button>

            {/* Type badge + emoji */}
            <div className="flex items-center gap-3 mb-4">
              <div className="h-12 w-12 rounded-2xl flex items-center justify-center text-2xl" style={{ background: `${cfg.color}15`, border: `1px solid ${cfg.color}25` }}>
                {cfg.emoji}
              </div>
              <div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: `${cfg.color}15`, color: cfg.color }}>
                  {cfg.label}
                </span>
                {timeAgo && <p className="text-[10px] text-[#4a5068] mt-1">{timeAgo}</p>}
              </div>
            </div>

            {/* Title */}
            <h2 className="text-lg font-bold text-white">{signal.title}</h2>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-4">
            {signal.description && (
              <p className="text-sm text-[#a3adc3] leading-relaxed">{signal.description}</p>
            )}

            {/* Author */}
            <div className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: 'rgba(17,19,24,0.6)', border: '1px solid rgba(255,255,255,0.04)' }}>
              <div className="h-9 w-9 rounded-full flex items-center justify-center overflow-hidden" style={{ background: 'rgba(0,212,255,0.1)' }}>
                {signal.author_avatar
                  ? <img src={signal.author_avatar} alt="" className="h-full w-full rounded-full object-cover" />
                  : <User size={16} className="text-[#00d4ff]" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{signal.author_name || signal.author_username || 'Anonymous'}</p>
                {signal.author_trust_level && (
                  <p className="text-[10px] capitalize" style={{ color: '#00d4ff' }}>{signal.author_trust_level}</p>
                )}
              </div>
            </div>

            {/* Meta */}
            <div className="space-y-2">
              {signal.category && signal.category !== 'general' && (
                <div className="flex items-center gap-2 text-xs text-[#a3adc3]">
                  <MapPin size={13} className="text-[#4a5068]" />
                  <span className="capitalize">{signal.category}</span>
                </div>
              )}
              {expiresIn && (
                <div className="flex items-center gap-2 text-xs text-[#a3adc3]">
                  <Clock size={13} className="text-[#4a5068]" />
                  <span>Expires {expiresIn}</span>
                </div>
              )}
            </div>
          </div>

          {/* Actions — fixed at bottom, never scrolls away */}
          <div className="shrink-0 px-5 pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+16px)] lg:pb-4 flex gap-2" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <button onClick={handleChat} className="flex-1 rounded-xl py-3 text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer" style={{ background: '#00d4ff', color: '#0a0b0f' }}>
              <MessageCircle size={15} /> Chat
            </button>
            <button onClick={handleShare} className="rounded-xl py-3 px-4 cursor-pointer" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: '#a3adc3' }}>
              <Share2 size={15} />
            </button>
            <button onClick={handleSave} className="rounded-xl py-3 px-4 cursor-pointer" style={{ background: saved ? 'rgba(0,212,255,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${saved ? 'rgba(0,212,255,0.3)' : 'rgba(255,255,255,0.06)'}`, color: saved ? '#00d4ff' : '#a3adc3' }}>
              {saved ? <Check size={15} /> : <Bookmark size={15} />}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
