'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, Bell, CheckCircle, Calendar, Shield, Star, Users, Wallet, Loader2, MessageCircle, UserPlus } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { parseUTC } from '@/lib/date';
import { useState } from 'react';
import { toast } from 'sonner';
import { useNotifications } from '@/hooks/useNotifications';
import PrivateChat from '@/components/chat/PrivateChat';
import EventChat from '@/components/events/EventChat';
import SignalSheet from '@/components/map/SignalSheet';
import CircleDetailSheet from '@/components/circles/CircleDetailSheet';
import EventDetailPage from '@/components/events/EventDetailPage';
import BusinessDetailPage from '@/components/business/BusinessDetailPage';
import type { Circle, Event, Business } from '@/types';

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
  circle_join_request: { icon: <UserPlus size={16} />, color: '#EAB308' },
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
  const [detailSignal, setDetailSignal] = useState<Record<string, unknown> | null>(null);
  const [detailCircle, setDetailCircle] = useState<Circle | null>(null);
  const [detailEvent, setDetailEvent] = useState<Event | null>(null);
  const [detailBusiness, setDetailBusiness] = useState<Business | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleNotificationClick = async (n: Record<string, unknown>) => {
    if (!n.read) markRead(n.id as string);

    const refType = n.ref_type as string;
    const refId = n.ref_id as string;
    const token = localStorage.getItem('access_token') || '';
    const headers = { Authorization: `Bearer ${token}` };

    // Chat notifications
    if (n.type === 'new_message' && refId) {
      setOpenChat({ type: refType, id: refId, title: n.title as string });
      return;
    }

    // Circle join request
    if (n.type === 'circle_join_request') {
      router.push('/me/circles');
      return;
    }

    // Kiss notification
    if (refType === 'kiss' && refId) {
      const body = (n.body as string) || '';
      const needsLocation = body.includes('share your location') || body.includes('Tap here');
      if (needsLocation) {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            if (token) {
              const lat = pos.coords.latitude;
              const lng = pos.coords.longitude;
              await fetch('/api/v1/users/me', { method: 'PATCH', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ location_lat: lat, location_lng: lng }) }).catch(() => {});
              await fetch('/api/v1/kisses', { method: 'PATCH', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ id: refId, receiver_lat: lat, receiver_lng: lng }) }).catch(() => {});
              toast.success('Location shared! Opening map...');
            }
            router.push(`/world?kiss=${refId}`);
          },
          () => router.push(`/world?kiss=${refId}&nofly=1`),
          { enableHighAccuracy: true, timeout: 10000 }
        );
        return;
      }
      router.push(`/world?kiss=${refId}`);
      return;
    }

    // Fetch detail based on ref_type
    if (!refId) return;
    setLoadingId(n.id as string);
    try {
      if (refType === 'signal') {
        const res = await fetch(`/api/v1/signals/${refId}`, { headers });
        if (res.ok) { const data = await res.json(); setDetailSignal(data.data); }
      } else if (refType === 'circle') {
        const res = await fetch(`/api/v1/circles/${refId}`, { headers });
        if (res.ok) { const data = await res.json(); setDetailCircle(data.data); }
      } else if (refType === 'event') {
        const res = await fetch(`/api/v1/events/${refId}`, { headers });
        if (res.ok) { const data = await res.json(); setDetailEvent(data.data); }
      } else if (refType === 'business') {
        const res = await fetch(`/api/v1/businesses/${refId}`, { headers });
        if (res.ok) { const data = await res.json(); setDetailBusiness(data.data); }
      } else if (refType === 'user') {
        router.push(`/world?flyTo=${refId}`);
      }
    } catch { /* ignore */ }
    setLoadingId(null);
  };

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
                  onClick={() => handleNotificationClick(n)}
                >
                  <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${cfg.color}12`, color: cfg.color }}>
                    {cfg.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm ${isUnread ? 'font-bold text-white' : 'font-medium text-[#a3adc3]'}`}>{n.title as string}</p>
                      {isUnread && <div className="h-2 w-2 rounded-full bg-[#00d4ff] shrink-0 animate-pulse" />}
                    </div>
                    {n.body ? <p className="text-xs text-[#4a5068] mt-1 line-clamp-2">{String(n.body)}</p> : null}
                    <div className="flex items-center gap-2 mt-1.5">
                      <p className="text-[10px] text-[#2d3548]">
                        {n.created_at ? formatDistanceToNow(parseUTC(n.created_at as string)!, { addSuffix: true }) : ''}
                      </p>
                      {!!n.ref_type && <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(0,212,255,0.06)', color: '#4a5068' }}>Tap for details</span>}
                    </div>
                  </div>
                  {loadingId === n.id && <Loader2 size={14} className="text-[#00d4ff] animate-spin shrink-0" />}
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

      {detailSignal && (
        <SignalSheet
          signal={{
            id: detailSignal.id as string,
            title: detailSignal.title as string,
            type: detailSignal.type as string,
            description: detailSignal.description as string,
            category: detailSignal.category as string,
            owner_id: detailSignal.author_id as string,
            author_id: detailSignal.author_id as string,
            author_name: detailSignal.author_name as string,
            author_username: detailSignal.author_username as string,
            author_avatar: detailSignal.author_avatar as string,
            author_trust_level: detailSignal.author_trust_level as string,
            created_at: detailSignal.created_at as string,
            expires_at: detailSignal.expires_at as string,
          }}
          onClose={() => setDetailSignal(null)}
        />
      )}
      {detailCircle && <CircleDetailSheet circle={detailCircle} onClose={() => setDetailCircle(null)} />}
      {detailEvent && <EventDetailPage event={detailEvent} onClose={() => setDetailEvent(null)} />}
      {detailBusiness && <BusinessDetailPage business={detailBusiness} onClose={() => setDetailBusiness(null)} />}
    </div>
  );
}
