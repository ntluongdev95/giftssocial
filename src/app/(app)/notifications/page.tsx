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
  const { notifications, unreadCount, markAllRead, markRead } = useNotifications();
  const [openChat, setOpenChat] = useState<{ type: string; id: string; title: string } | null>(null);

  return (
    <div className="h-full overflow-y-auto">
      <div className="sticky top-0 z-10 flex items-center gap-3 px-4 lg:px-8 py-3" style={{ background: 'rgba(10,11,15,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-[#a3adc3] cursor-pointer"><ArrowLeft size={18} /> Back</button>
        <h1 className="text-sm font-bold text-white">Notifications</h1>
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="ml-auto text-[11px] font-semibold text-[#00d4ff] cursor-pointer">Mark all read</button>
        )}
      </div>

      <div className="max-w-lg lg:max-w-2xl mx-auto px-4 lg:px-8 py-4 pb-24">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <Bell size={24} className="text-[#4a5068]" />
            <p className="text-sm text-[#4a5068]">No notifications yet</p>
          </div>
        ) : (
          <div className="space-y-1">
            {notifications.map((n) => {
              const cfg = ICON_MAP[n.type as string] || ICON_MAP.system;
              const isUnread = !n.read;
              return (
                <div
                  key={n.id as string}
                  className="flex items-start gap-3 rounded-xl px-4 py-3 cursor-pointer transition-colors hover:bg-white/[0.02]"
                  style={{ background: isUnread ? 'rgba(0,212,255,0.03)' : 'transparent', borderLeft: isUnread ? '2px solid #00d4ff' : '2px solid transparent' }}
                  onClick={() => {
                    if (isUnread) markRead(n.id as string);
                    if (n.type === 'new_message' && n.ref_id) {
                      setOpenChat({ type: n.ref_type as string, id: n.ref_id as string, title: n.title as string });
                    }
                  }}
                >
                  <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: `${cfg.color}12`, color: cfg.color }}>
                    {cfg.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${isUnread ? 'font-semibold text-white' : 'text-[#a3adc3]'}`}>{n.title as string}</p>
                    {n.body && <p className="text-[11px] text-[#4a5068] mt-0.5">{n.body as string}</p>}
                    <p className="text-[10px] text-[#2d3548] mt-1">
                      {n.created_at ? formatDistanceToNow(new Date(n.created_at as string), { addSuffix: true }) : ''}
                    </p>
                  </div>
                  {isUnread && <div className="h-2 w-2 rounded-full bg-[#00d4ff] shrink-0 mt-2" />}
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
