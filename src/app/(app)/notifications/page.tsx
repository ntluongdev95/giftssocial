'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, Bell, CheckCircle, Calendar, Shield, Star, Users, Wallet, Loader2, MessageCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useState } from 'react';
import { useNotifications } from '@/hooks/useNotifications';
import PrivateChat from '@/components/chat/PrivateChat';
import EventChat from '@/components/events/EventChat';

const ICON_MAP: Record<string, { icon: React.ReactNode; color: string }> = {
  booking_confirmed: { icon: <Calendar size={16} />, color: '#00d4ff' },
  booking_reminder: { icon: <Calendar size={16} />, color: '#fbbf24' },
  booking_canceled: { icon: <Calendar size={16} />, color: '#f87171' },
  event_reminder: { icon: <Calendar size={16} />, color: '#f87171' },
  event_starting: { icon: <Calendar size={16} />, color: '#f87171' },
  signal_response: { icon: <Bell size={16} />, color: '#a78bfa' },
  signal_matched: { icon: <Bell size={16} />, color: '#00d4ff' },
  circle_invite: { icon: <Users size={16} />, color: '#00d4ff' },
  circle_activity: { icon: <Users size={16} />, color: '#34d399' },
  proof_earned: { icon: <Shield size={16} />, color: '#fbbf24' },
  trust_upgraded: { icon: <Star size={16} />, color: '#fbbf24' },
  review_received: { icon: <Star size={16} />, color: '#fbbf24' },
  follow_new: { icon: <Users size={16} />, color: '#00d4ff' },
  new_message: { icon: <MessageCircle size={16} />, color: '#3B82F6' },
  system: { icon: <Bell size={16} />, color: '#4a5068' },
};

export default function NotificationsPage() {
  const router = useRouter();
  const { notifications, unreadCount, markAllRead, markRead, clearAll } = useNotifications();
  const [openChat, setOpenChat] = useState<{ type: string; id: string; title: string } | null>(null);

  return (
    <div className="h-full overflow-y-auto">
      <div className="sticky top-0 z-10 flex items-center gap-3 px-4 lg:px-8 py-3" style={{ background: 'rgba(10,11,15,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-[#a3adc3] cursor-pointer"><ArrowLeft size={18} /> Back</button>
        <h1 className="text-sm font-bold text-white">Notifications</h1>
        <div className="flex items-center gap-3 ml-auto">
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="text-[11px] font-semibold text-[#00d4ff] cursor-pointer">Mark all read</button>
          )}
          {notifications.length > 0 && (
            <button onClick={clearAll} className="text-[11px] font-semibold text-[#f87171] cursor-pointer">Clear all</button>
          )}
        </div>
      </div>

      <div className="max-w-lg lg:max-w-4xl mx-auto px-4 lg:px-8 py-4 pb-24">
        {/* Unread count summary */}
        {unreadCount > 0 && (
          <div className="flex items-center gap-3 mb-4 rounded-2xl px-5 py-3" style={{ background: 'rgba(0,212,255,0.04)', border: '1px solid rgba(0,212,255,0.1)' }}>
            <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(0,212,255,0.1)' }}>
              <Bell size={18} className="text-[#00d4ff]" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-white">{unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}</p>
              <p className="text-[10px] text-[#4a5068]">Tap to view details</p>
            </div>
            <button onClick={markAllRead} className="rounded-lg px-3 py-1.5 text-[10px] font-semibold cursor-pointer" style={{ background: 'rgba(0,212,255,0.1)', color: '#00d4ff' }}>
              Read all
            </button>
          </div>
        )}

        {notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <div className="h-16 w-16 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(0,212,255,0.06)' }}>
              <Bell size={28} className="text-[#4a5068]" />
            </div>
            <p className="text-sm font-medium text-[#a3adc3]">No notifications yet</p>
            <p className="text-xs text-[#4a5068]">When someone messages, follows, or interacts with you, it will show here</p>
          </div>
        ) : (
          <div className="lg:grid lg:grid-cols-2 gap-3 space-y-3 lg:space-y-0">
            {notifications.map((n) => {
              const cfg = ICON_MAP[n.type as string] || ICON_MAP.system;
              const isUnread = !n.read;
              return (
                <div
                  key={n.id as string}
                  className="flex items-start gap-3.5 rounded-2xl px-5 py-4 cursor-pointer transition-all hover:scale-[1.01]"
                  style={{
                    background: isUnread ? 'rgba(0,212,255,0.03)' : 'rgba(17,19,24,0.5)',
                    border: isUnread ? '1px solid rgba(0,212,255,0.12)' : '1px solid rgba(255,255,255,0.04)',
                  }}
                  onClick={() => {
                    if (isUnread) markRead(n.id as string);
                    if (n.type === 'new_message' && n.ref_id) {
                      setOpenChat({ type: n.ref_type as string, id: n.ref_id as string, title: n.title as string });
                    }
                  }}
                >
                  <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${cfg.color}12`, color: cfg.color }}>
                    {cfg.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm ${isUnread ? 'font-bold text-white' : 'font-medium text-[#a3adc3]'}`}>{n.title as string}</p>
                      {isUnread && <div className="h-2 w-2 rounded-full bg-[#00d4ff] shrink-0 animate-pulse" />}
                    </div>
                    {n.body && <p className="text-xs text-[#4a5068] mt-1 line-clamp-2">{n.body as string}</p>}
                    <p className="text-[10px] text-[#2d3548] mt-1.5">
                      {n.created_at ? formatDistanceToNow(new Date(n.created_at as string), { addSuffix: true }) : ''}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {openChat && openChat.type === 'event' && (
        <EventChat eventId={openChat.id} eventTitle={openChat.title} onClose={() => setOpenChat(null)} />
      )}
      {openChat && openChat.type === 'dm' && (
        <PrivateChat roomId={openChat.id} title={openChat.title} onClose={() => setOpenChat(null)} />
      )}
    </div>
  );
}
