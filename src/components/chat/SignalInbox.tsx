'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { X, MessageCircle, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import PrivateChat from '@/components/chat/PrivateChat';

interface Conversation {
  room_id: string;
  sender_name: string;
  last_message: string;
  last_message_at: string;
  message_count: number;
}

interface Props {
  signalId: string;
  signalTitle: string;
  onClose: () => void;
}

const fetcher = (url: string) => fetch(url, {
  
}).then(r => r.json());

export default function SignalInbox({ signalId, signalTitle, onClose }: Props) {
  const { data } = useSWR<{ data: Conversation[] }>(
    `/api/v1/messages/conversations?signal_id=${signalId}`,
    fetcher,
    { refreshInterval: 5000, fallbackData: { data: [] } }
  );

  const conversations = data?.data ?? [];
  const [selectedRoom, setSelectedRoom] = useState<{ roomId: string; name: string } | null>(null);

  if (selectedRoom) {
    return (
      <PrivateChat
        roomId={selectedRoom.roomId}
        title={selectedRoom.name}
        subtitle={signalTitle}
        onBack={() => setSelectedRoom(null)}
        onClose={onClose}
      />
    );
  }

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
          className="w-full max-w-[520px] max-h-[80dvh] lg:max-h-[600px] rounded-t-3xl lg:rounded-3xl flex flex-col overflow-hidden"
          style={{ background: '#0a0b0f', border: '1px solid rgba(0,212,255,0.08)' }}
        >
          {/* Header */}
          <div className="shrink-0 flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="flex items-center gap-3">
              <MessageCircle size={18} className="text-[#00d4ff]" />
              <div>
                <h2 className="text-sm font-bold text-white">Messages</h2>
                <p className="text-[10px] text-[#4a5068]">{conversations.length} conversation{conversations.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
            <button onClick={onClose} className="h-8 w-8 rounded-lg flex items-center justify-center cursor-pointer" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <X size={16} className="text-[#4a5068]" />
            </button>
          </div>

          {/* Conversation list */}
          <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <MessageCircle size={28} className="text-[#4a5068]" />
                <p className="text-xs text-[#4a5068]">No messages yet</p>
                <p className="text-[10px] text-[#4a5068]">When someone messages you about this signal, it will appear here</p>
              </div>
            ) : (
              conversations.map((conv) => (
                <button
                  key={conv.room_id}
                  onClick={() => setSelectedRoom({ roomId: conv.room_id, name: conv.sender_name })}
                  className="w-full flex items-center gap-3 px-5 py-4 text-left cursor-pointer transition-colors hover:bg-white/[0.02]"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                >
                  <div className="h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0" style={{ background: 'linear-gradient(135deg, #3B82F6, #00d4ff)', color: 'white' }}>
                    {(conv.sender_name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-white truncate">{conv.sender_name}</p>
                      <span className="text-[9px] text-[#4a5068] shrink-0 ml-2">
                        {formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-xs text-[#4a5068] truncate mt-0.5">{conv.last_message}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {conv.message_count > 0 && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(0,212,255,0.15)', color: '#00d4ff' }}>
                        {conv.message_count}
                      </span>
                    )}
                    <ChevronRight size={14} className="text-[#4a5068]" />
                  </div>
                </button>
              ))
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
