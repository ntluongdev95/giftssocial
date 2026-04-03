'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Radio, Tv, BarChart3, Newspaper } from 'lucide-react';
import { CryptoWidget, MetalsWidget, NewsWidget, StocksWidget } from './LiveWidgets';

const LIVE_CHANNELS = [
  { id: 'france24', name: 'France 24 EN', category: 'news', embedUrl: 'https://www.youtube.com/embed/live_stream?channel=UCQfwfsi5VrQ8yKZ-UWmAEFg&autoplay=1&mute=1&enablejsapi=1', color: '#3b82f6', icon: '🇫🇷' },
  { id: 'dw', name: 'DW News', category: 'news', embedUrl: 'https://www.youtube.com/embed/live_stream?channel=UCknLrEdhRCp1aegoMqRaCZg&autoplay=1&mute=1&enablejsapi=1', color: '#00d4ff', icon: '🇩🇪' },
  { id: 'aljazeera', name: 'Al Jazeera EN', category: 'news', embedUrl: 'https://www.youtube.com/embed/live_stream?channel=UCNye-wNBqNL5ZzHSJj3l8Bg&autoplay=1&mute=1&enablejsapi=1', color: '#f59e0b', icon: '🌍' },
  { id: 'abc', name: 'ABC News', category: 'news', embedUrl: 'https://www.youtube.com/embed/live_stream?channel=UCBi2mrWuNuyYy4gbM6fU18Q&autoplay=1&mute=1&enablejsapi=1', color: '#f97316', icon: '🇺🇸' },
  { id: 'euronews', name: 'Euronews', category: 'news', embedUrl: 'https://www.youtube.com/embed/live_stream?channel=UCW2QcKZiU8aUGg4yxCIditg&autoplay=1&mute=1&enablejsapi=1', color: '#22c55e', icon: '🇪🇺' },
  { id: 'cgtn', name: 'CGTN', category: 'news', embedUrl: 'https://www.youtube.com/embed/live_stream?channel=UCgrNz-aDmcr2uuto8_DL2jg&autoplay=1&mute=1&enablejsapi=1', color: '#ef4444', icon: '🇨🇳' },
  { id: 'nasa', name: 'NASA Live', category: 'webcams', embedUrl: 'https://www.youtube.com/embed/live_stream?channel=UCLA_DiR1FfKNvjuUpBHmylQ&autoplay=1&mute=1&enablejsapi=1', color: '#3b82f6', icon: '🚀' },
  { id: 'lofi', name: 'Lofi Radio', category: 'webcams', embedUrl: 'https://www.youtube.com/embed/live_stream?channel=UCSJ4gkVC6NrvII8umztf0A&autoplay=1&mute=1&enablejsapi=1', color: '#a78bfa', icon: '🎵' },
];

const DESKTOP_TABS = [
  { id: 'live', label: 'Live TV', Icon: Tv },
  { id: 'crypto', label: 'Crypto', Icon: BarChart3 },
  { id: 'news', label: 'News', Icon: Newspaper },
] as const;

const MOBILE_CATEGORIES = ['All', 'News', 'Webcams'] as const;

interface LivePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LivePanel({ isOpen, onClose }: LivePanelProps) {
  const [activeChannel, setActiveChannel] = useState(LIVE_CHANNELS[0]);
  const [desktopTab, setDesktopTab] = useState<string>('live');
  const [mobileCategory, setMobileCategory] = useState<string>('All');
  const [unavailable, setUnavailable] = useState<Set<string>>(new Set());
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handleMessage = useCallback((e: MessageEvent) => {
    if (e.origin !== 'https://www.youtube.com') return;
    try {
      const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
      if (data?.event === 'onError' || data?.info?.playerState === -1) {
        setUnavailable(prev => new Set(prev).add(activeChannel.id));
        const available = LIVE_CHANNELS.filter(c => !unavailable.has(c.id) && c.id !== activeChannel.id);
        if (available.length > 0) setActiveChannel(available[0]);
      }
    } catch { /* ignore */ }
  }, [activeChannel.id, unavailable]);

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleMessage]);

  const availableChannels = LIVE_CHANNELS.filter(c => !unavailable.has(c.id));
  const mobileFiltered = (mobileCategory === 'All' ? availableChannels : availableChannels.filter(c => c.category === mobileCategory.toLowerCase()));

  if (!isOpen) return null;

  /* ── Channel strip (shared) ── */
  const channelStrip = (channels: typeof LIVE_CHANNELS) => (
    <div className="flex gap-2 overflow-x-auto px-4 py-2" style={{ scrollbarWidth: 'none' }}>
      {channels.map(ch => {
        const isActive = activeChannel.id === ch.id;
        return (
          <button
            key={ch.id}
            onClick={() => setActiveChannel(ch)}
            className="shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl transition-all cursor-pointer"
            style={{
              background: isActive ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.03)',
              border: isActive ? '1px solid rgba(239,68,68,0.35)' : '1px solid rgba(255,255,255,0.06)',
              boxShadow: isActive ? '0 0 12px rgba(239,68,68,0.15)' : 'none',
            }}
          >
            <span className="text-base">{ch.icon}</span>
            <div className="flex flex-col items-start">
              <span className={`text-[11px] font-semibold whitespace-nowrap ${isActive ? 'text-white' : 'text-[#8892a8]'}`}>{ch.name}</span>
              <div className="flex items-center gap-1">
                <span className="text-[7px] font-bold uppercase px-1 py-px rounded" style={{
                  background: ch.category === 'news' ? 'rgba(59,130,246,0.15)' : 'rgba(168,85,247,0.15)',
                  color: ch.category === 'news' ? '#60a5fa' : '#c084fc',
                }}>{ch.category}</span>
                {isActive && (
                  <span className="flex items-center gap-0.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-[7px] font-bold text-red-400">LIVE</span>
                  </span>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );

  /* ── Desktop widget content ── */
  const desktopContent = () => {
    switch (desktopTab) {
      case 'live':
        return (
          <div className="flex flex-col h-full">
            <div className="flex-1 min-h-0 px-4 py-2">
              <div className="relative rounded-xl overflow-hidden w-full h-full" style={{ background: '#000' }}>
                <iframe
                  ref={iframeRef}
                  key={activeChannel.id}
                  src={activeChannel.embedUrl}
                  className="w-full h-full"
                  allow="autoplay; encrypted-media"
                  allowFullScreen
                />
                <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-lg" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
                  <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-[11px] font-bold text-white">{activeChannel.name}</span>
                </div>
              </div>
            </div>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              {channelStrip(availableChannels)}
            </div>
          </div>
        );
      case 'crypto':
        return (
          <div className="flex-1 overflow-y-auto px-4 py-3">
            <CryptoWidget />
            <StocksWidget />
            <MetalsWidget />
          </div>
        );
      case 'news':
        return (
          <div className="flex-1 overflow-y-auto px-4 py-3">
            <NewsWidget />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <AnimatePresence>
      {/* ── Desktop: Side panel ── */}
      <div className="hidden lg:block">
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 250 }}
          className="fixed top-0 right-0 bottom-0 z-50 flex flex-col"
          style={{
            width: '60vw',
            background: 'rgba(10,11,15,0.98)',
            borderLeft: '1px solid rgba(239,68,68,0.15)',
            backdropFilter: 'blur(20px)',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center gap-2">
              <Radio size={14} className="text-red-500 animate-pulse" />
              <span className="text-sm font-bold text-white">LIVE</span>
              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400">{availableChannels.length} channels</span>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1">
              {DESKTOP_TABS.map(tab => {
                const active = desktopTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setDesktopTab(tab.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold cursor-pointer transition-colors"
                    style={active
                      ? { background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)' }
                      : { background: 'transparent', color: '#4a5068', border: '1px solid transparent' }
                    }
                  >
                    <tab.Icon size={12} />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <button onClick={onClose} className="h-7 w-7 rounded-lg flex items-center justify-center cursor-pointer text-[#4a5068] hover:text-white" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <X size={14} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 min-h-0 flex flex-col">
            {desktopContent()}
          </div>
        </motion.div>
      </div>

      {/* ── Mobile: Full screen modal ── */}
      <div className="lg:hidden">
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 250 }}
          className="fixed inset-0 z-[100] flex flex-col"
          style={{ background: 'rgba(10,11,15,0.99)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top,12px)+8px)] pb-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center gap-2">
              <Radio size={14} className="text-red-500 animate-pulse" />
              <span className="text-sm font-bold text-white">LIVE</span>
              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400">{mobileFiltered.length} channels</span>
            </div>
            <button onClick={onClose} className="h-8 w-8 rounded-lg flex items-center justify-center cursor-pointer text-[#4a5068] hover:text-white" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <X size={16} />
            </button>
          </div>

          {/* Category tabs */}
          <div className="flex gap-1.5 px-4 py-2">
            {MOBILE_CATEGORIES.map(cat => (
              <button key={cat} onClick={() => setMobileCategory(cat)} className="px-3 py-1.5 rounded-lg text-[10px] font-semibold cursor-pointer transition-colors" style={mobileCategory === cat ? { background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)' } : { background: 'rgba(17,19,24,0.5)', color: '#4a5068', border: '1px solid rgba(255,255,255,0.04)' }}>
                {cat}
              </button>
            ))}
          </div>

          {/* Video player */}
          <div className="px-4 py-2 flex-1 min-h-0">
            <div className="relative rounded-xl overflow-hidden w-full h-full" style={{ background: '#000' }}>
              <iframe
                key={activeChannel.id}
                src={activeChannel.embedUrl}
                className="w-full h-full"
                allow="autoplay; encrypted-media"
                allowFullScreen
              />
              <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded-lg" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
                <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-[10px] font-bold text-white">{activeChannel.name}</span>
              </div>
            </div>
          </div>

          {/* Channel strip */}
          <div className="pb-[calc(env(safe-area-inset-bottom,0px)+8px)]" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            {channelStrip(mobileFiltered)}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
