'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, Bell, CheckCircle, Calendar, Shield, Star, Users, Wallet, Loader2, MessageCircle, UserPlus } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { parseUTC } from '@/lib/date';
import { useState } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import { useNotifications } from '@/hooks/useNotifications';
import PrivateChat from '@/components/chat/PrivateChat';
import EventChat from '@/components/events/EventChat';
import SignalSheet from '@/components/map/SignalSheet';
import CircleDetailSheet from '@/components/circles/CircleDetailSheet';
import EventDetailPage from '@/components/events/EventDetailPage';
import BusinessDetailPage from '@/components/business/BusinessDetailPage';
import PromoDetailSheet from '@/components/promo/PromoDetailSheet';
import type { Circle, Event, Business } from '@/types';

// Shape matches GET /api/v1/promo-templates/[id] response.
interface PromoDetail {
  id: string;
  business_id: string;
  business_name?: string | null;
  business_cover?: string | null;
  name: string;
  description?: string;
  background_color: string;
  background_image?: string | null;
  background_gradient_to?: string | null;
  elements_json: string;
  gift_card_template_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

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
  capsule_received: { icon: <span className="text-base leading-none">💌</span>, color: '#a855f7' },
  capsule_opened: { icon: <span className="text-base leading-none">💝</span>, color: '#ec4899' },
  marketplace_application_pending: { icon: <Shield size={16} />, color: '#a855f7' },
  marketplace_approved: { icon: <Shield size={16} />, color: '#34d399' },
  marketplace_rejected: { icon: <Shield size={16} />, color: '#f87171' },
  system: { icon: <Bell size={16} />, color: '#4a5068' },
};

// Lightweight current-user fetch — only used to personalise the greeting
// in PromoDetailSheet ("Dear <name>,").
interface MeRow { fullName?: string | null; username?: string | null }

export default function NotificationsPage() {
  const router = useRouter();
  const { notifications, unreadCount, markAllRead, markRead, clearAll } = useNotifications();
  const { data: meData } = useSWR<{ data: MeRow }>('/api/v1/users/me', (url: string) => fetch(url, { credentials: 'same-origin' }).then((r) => r.json()));
  const recipientName = meData?.data?.fullName || meData?.data?.username || null;
  const [openChat, setOpenChat] = useState<{ type: string; id: string; title: string } | null>(null);
  const [detailSignal, setDetailSignal] = useState<Record<string, unknown> | null>(null);
  const [detailCircle, setDetailCircle] = useState<Circle | null>(null);
  const [detailEvent, setDetailEvent] = useState<Event | null>(null);
  const [detailBusiness, setDetailBusiness] = useState<Business | null>(null);
  const [detailPromo, setDetailPromo] = useState<PromoDetail | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleNotificationClick = async (n: Record<string, unknown>) => {
    if (!n.read) markRead(n.id as string);

    const refType = n.ref_type as string;
    const refId = n.ref_id as string;
    const headers = {  };

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

    // Gift notifications — go to gifts list (server returns full capsule on PATCH open)
    if (n.type === 'capsule_received' || n.type === 'capsule_opened') {
      router.push('/me/gifts');
      return;
    }

    // Marketplace gating notifications. Admin → review console; applicant → status page.
    if (n.type === 'marketplace_application_pending') {
      router.push('/admin/marketplace');
      return;
    }
    if (n.type === 'marketplace_approved' || n.type === 'marketplace_rejected') {
      router.push('/me/marketplace');
      return;
    }

    // Gift-card notification — sender/transfer endpoints set ref_type='gift_card'
    // and ref_id=card.id. Drop the user into their wallet (with the card
    // id as a query so the wallet can auto-open the detail sheet later).
    if (refType === 'gift_card') {
      router.push(refId ? `/me/wallet?card=${refId}` : '/me/wallet');
      return;
    }

    // Streak notification — verification asks go to /verify; everything
    // else (tick celebration, invite accept/decline, etc.) opens the
    // streak detail page.
    if (refType === 'streak' && refId) {
      const title = (n.title as string) || '';
      const body = (n.body as string) || '';
      const isVerifyAsk =
        /needs your help verifying/i.test(title) ||
        /needs your vote/i.test(title) ||
        /can you confirm/i.test(body);
      router.push(isVerifyAsk ? `/streaks/${refId}/verify` : `/streaks/${refId}`);
      return;
    }

    // Kiss notification
    if (refType === 'kiss' && refId) {
      const body = (n.body as string) || '';
      const needsLocation = body.includes('share your location') || body.includes('Tap here');
      if (needsLocation) {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            await fetch('/api/v1/users/me', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location_lat: lat, location_lng: lng }) }).catch(() => {});
            await fetch('/api/v1/kisses', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: refId, receiver_lat: lat, receiver_lng: lng }) }).catch(() => {});
            toast.success('Location shared! Opening map...');
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
      } else if (refType === 'promo') {
        const res = await fetch(`/api/v1/promo-templates/${refId}`, { headers, credentials: 'same-origin' });
        if (res.ok) { const data = await res.json(); setDetailPromo(data.data as PromoDetail); }
        else toast.error('Promo này không còn khả dụng');
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

      <div className="max-w-lg lg:max-w-7xl 2xl:max-w-375 mx-auto px-4 lg:px-8 xl:px-12 py-4 lg:pt-8 xl:pt-10 pb-24">
        {/* Unread count summary — gradient accent on desktop so it doesn't
            look like a plain banner */}
        {unreadCount > 0 && (
          <div
            className="flex items-center gap-3 lg:gap-4 mb-4 lg:mb-6 rounded-2xl px-5 lg:px-6 py-3 lg:py-4"
            style={{
              background:
                'linear-gradient(135deg, rgba(0,212,255,0.08), rgba(168,85,247,0.05))',
              border: '1px solid rgba(0,212,255,0.2)',
            }}
          >
            <div
              className="h-10 w-10 lg:h-12 lg:w-12 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(0,212,255,0.15)', border: '1px solid rgba(0,212,255,0.3)' }}
            >
              <Bell size={18} className="text-[#00d4ff]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm lg:text-base font-semibold text-white">
                {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
              </p>
              <p className="text-[10px] lg:text-xs text-[#a3adc3]">Tap any card to view details</p>
            </div>
            <button
              onClick={markAllRead}
              className="rounded-lg px-3 lg:px-4 py-1.5 lg:py-2 text-[10px] lg:text-xs font-semibold cursor-pointer transition-colors"
              style={{ background: 'rgba(0,212,255,0.12)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.25)' }}
            >
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
          // Mobile: stack. md+: 2 col. xl+: 3 col so odd counts read better.
          <div className="lg:grid lg:grid-cols-2 xl:grid-cols-3 gap-3 xl:gap-4 space-y-3 lg:space-y-0">
            {notifications.map((n) => {
              const cfg = ICON_MAP[n.type as string] || ICON_MAP.system;
              const isUnread = !n.read;
              return (
                <div
                  key={n.id as string}
                  className="relative flex items-start gap-3.5 lg:gap-4 rounded-2xl px-5 lg:px-6 py-4 lg:py-5 cursor-pointer transition-colors hover:bg-white/2"
                  style={{
                    background: isUnread ? 'rgba(0,212,255,0.04)' : 'rgba(17,19,24,0.5)',
                    border: isUnread ? '1px solid rgba(0,212,255,0.18)' : '1px solid rgba(255,255,255,0.04)',
                  }}
                  onClick={() => handleNotificationClick(n)}
                >
                  {/* Subtle left-edge accent stripe for unread state — more
                      visible than the small dot at a glance */}
                  {isUnread && (
                    <div
                      className="absolute left-0 top-3 bottom-3 w-0.5 rounded-r-full"
                      style={{ background: 'linear-gradient(180deg, #00d4ff, #a855f7)' }}
                    />
                  )}
                  <div
                    className="h-10 w-10 lg:h-11 lg:w-11 rounded-xl flex items-center justify-center shrink-0"
                    style={{
                      background: `${cfg.color}14`,
                      color: cfg.color,
                      border: `1px solid ${cfg.color}26`,
                    }}
                  >
                    {cfg.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2">
                      <p className={`text-sm lg:text-[15px] leading-snug ${isUnread ? 'font-bold text-white' : 'font-medium text-[#a3adc3]'}`}>
                        {n.title as string}
                      </p>
                      {isUnread && <div className="h-2 w-2 rounded-full bg-[#00d4ff] shrink-0 mt-1.5 animate-pulse" />}
                    </div>
                    {n.body ? <p className="text-xs text-[#4a5068] mt-1.5 line-clamp-2">{String(n.body)}</p> : null}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <p className="text-[10px] text-[#2d3548]">
                        {n.created_at ? formatDistanceToNow(parseUTC(n.created_at as string)!, { addSuffix: true }) : ''}
                      </p>
                      {!!n.ref_type && (
                        <span
                          className="text-[9px] px-1.5 py-0.5 rounded font-medium"
                          style={{ background: 'rgba(0,212,255,0.08)', color: '#00d4ff' }}
                        >
                          Tap for details
                        </span>
                      )}
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
      {detailPromo && <PromoDetailSheet promo={detailPromo} recipientName={recipientName} onClose={() => setDetailPromo(null)} />}
    </div>
  );
}
