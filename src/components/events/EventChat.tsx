'use client';

import { useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import { X, Send, MessageCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { parseUTC } from '@/lib/date';
import { useAuthStore } from '@/stores/auth-store';

interface Message {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_avatar: string | null;
  body: string;
  created_at: string;
}

interface Props {
  eventId: string;
  eventTitle: string;
  onClose: () => void;
}

const fetcher = (url: string) => fetch(url, {
  headers: { Authorization: `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('access_token') || '' : ''}` },
}).then(r => r.json());

export default function EventChat({ eventId, eventTitle, onClose }: Props) {
  const { data, mutate } = useSWR<{ data: Message[] }>(
    `/api/v1/messages?room_type=event&room_id=${eventId}`,
    fetcher,
    { refreshInterval: 3000, fallbackData: { data: [] } }
  );

  const messages = data?.data ?? [];
  const myUserId = useAuthStore(s => s.user?.id);
  const myAvatar = useAuthStore(s => s.user?.avatarUrl);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const userName = useAuthStore(s => s.user?.fullName || s.user?.firstName || 'You');

  const handleSend = async () => {
    const input = inputRef.current;
    const val = input?.value || '';
    if (!val.trim() || sending) return;
    const msgText = val.trim();

    // Clear input immediately + after next frame
    if (input) { input.value = ''; requestAnimationFrame(() => { input.value = ''; }); }

    // Optimistic update
    const optimistic: Message = {
      id: `temp_${Date.now()}`,
      sender_id: myUserId || '',
      sender_name: userName,
      sender_avatar: null,
      body: msgText,
      created_at: new Date().toISOString(),
    };
    mutate((prev: { data: Message[] } | undefined) => ({
      data: [...(prev?.data || []), optimistic],
    }), { revalidate: false });

    setSending(true);
    try {
      await fetch('/api/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('access_token') || ''}` },
        body: JSON.stringify({ room_type: 'event', room_id: eventId, body: msgText }),
      });
      mutate();
      inputRef.current?.focus();
    } catch {}
    finally { setSending(false); }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[300] flex items-end justify-center lg:items-center"
        style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
        onClick={(ev) => ev.target === ev.currentTarget && onClose()}
      >
        <motion.div
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 280 }}
          className="w-full max-w-[520px] h-[80dvh] lg:h-[600px] rounded-t-3xl lg:rounded-3xl flex flex-col overflow-hidden"
          style={{ background: '#0a0b0f', border: '1px solid rgba(0,212,255,0.08)' }}
        >
          {/* Header */}
          <div className="shrink-0 flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="flex items-center gap-3">
              <MessageCircle size={18} className="text-[#00d4ff]" />
              <div>
                <h2 className="text-sm font-bold text-white truncate max-w-[280px]">{eventTitle}</h2>
                <p className="text-[10px] text-[#4a5068]">{messages.length} messages</p>
              </div>
            </div>
            <button onClick={onClose} className="h-8 w-8 rounded-lg flex items-center justify-center cursor-pointer" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <X size={16} className="text-[#4a5068]" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <MessageCircle size={28} className="text-[#4a5068]" />
                <p className="text-xs text-[#4a5068]">No messages yet. Start the conversation!</p>
              </div>
            )}
            {messages.map((msg) => {
              const isMe = msg.sender_id === myUserId;
              const isAuto = msg.sender_id === 'system_auto';

              // Auto-reply: centered, styled differently
              if (isAuto) {
                return (
                  <div key={msg.id} className="flex justify-center">
                    <div className="max-w-[85%] rounded-2xl px-4 py-2.5 text-xs text-center" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.15)', color: '#fbbf24' }}>
                      <p className="text-[9px] font-semibold mb-1">{msg.sender_name}</p>
                      {msg.body}
                    </div>
                  </div>
                );
              }

              return (
                <div key={msg.id} className={`flex gap-2.5 ${isMe ? 'flex-row-reverse' : ''}`}>
                  <div className="h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 overflow-hidden" style={{ background: isMe ? '#00d4ff' : '#3B82F6', color: 'white' }}>
                    {(() => {
                      const avatar = isMe ? (myAvatar || msg.sender_avatar) : (msg.sender_avatar || '');
                      return avatar && avatar.length > 1
                        ? <img src={avatar} alt="" className="h-full w-full object-cover" />
                        : (msg.sender_name || '?').charAt(0).toUpperCase();
                    })()}
                  </div>
                  <div className={`max-w-[70%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    <div className={`flex items-center gap-2 mb-0.5 ${isMe ? 'flex-row-reverse' : ''}`}>
                      <span className="text-[10px] font-semibold" style={{ color: isMe ? '#00d4ff' : '#a3adc3' }}>{isMe ? 'You' : msg.sender_name}</span>
                      <span className="text-[9px] text-[#4a5068]">{formatDistanceToNow(parseUTC(msg.created_at)!, { addSuffix: true })}</span>
                    </div>
                    <div
                      className={`rounded-2xl px-3.5 py-2 text-sm ${isMe ? 'rounded-tr-md' : 'rounded-tl-md'}`}
                      style={{
                        background: isMe ? 'rgba(0,212,255,0.15)' : 'rgba(17,19,24,0.8)',
                        border: `1px solid ${isMe ? 'rgba(0,212,255,0.2)' : 'rgba(255,255,255,0.04)'}`,
                        color: '#f0f4ff',
                      }}
                    >
                      {msg.body}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="shrink-0 px-4 py-3 flex gap-2" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <input
              ref={inputRef}
              defaultValue=""
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSend(); } }}
              placeholder="Type a message..."
              className="flex-1 rounded-xl px-4 py-2.5 text-sm text-white outline-none placeholder:text-[#4a5068]"
              style={{ background: 'rgba(17,19,24,0.8)', border: '1px solid rgba(255,255,255,0.07)' }}
              autoFocus
            />
            <button
              onClick={handleSend}
              disabled={sending}
              className="rounded-xl px-4 py-2.5 cursor-pointer disabled:opacity-30"
              style={{ background: '#00d4ff', color: '#0a0b0f' }}
            >
              <Send size={16} />
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
