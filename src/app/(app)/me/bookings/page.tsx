'use client';

import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { ArrowLeft, Loader2, Store, Calendar, CheckCircle, XCircle, Clock, Star } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useState } from 'react';

const fetcher = (url: string) => fetch(url, {
  headers: { Authorization: `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('access_token') || '' : ''}` },
}).then(r => r.json());

const STATUS_CONFIG: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
  pending: { color: '#fbbf24', label: 'Pending', icon: <Clock size={12} /> },
  confirmed: { color: '#00d4ff', label: 'Confirmed', icon: <CheckCircle size={12} /> },
  completed: { color: '#34d399', label: 'Completed', icon: <CheckCircle size={12} /> },
  canceled: { color: '#f87171', label: 'Canceled', icon: <XCircle size={12} /> },
  no_show: { color: '#4a5068', label: 'No Show', icon: <XCircle size={12} /> },
};

export default function MyBookingsPage() {
  const router = useRouter();
  const { data, isLoading, mutate } = useSWR('/api/v1/bookings/me', fetcher);
  const bookings = (data?.data || []) as Record<string, unknown>[];
  const [acting, setActing] = useState<string | null>(null);
  const [showReview, setShowReview] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [reviewBody, setReviewBody] = useState('');

  const updateStatus = async (id: string, status: string) => {
    setActing(id);
    try {
      const res = await fetch(`/api/v1/bookings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('access_token') || ''}` },
        body: JSON.stringify({ status }),
      });
      if (res.ok) { toast.success(`Booking ${status}`); mutate(); }
      else toast.error('Failed to update');
    } catch { toast.error('Network error'); }
    finally { setActing(null); }
  };

  const checkin = async (id: string) => {
    setActing(id);
    try {
      const res = await fetch(`/api/v1/bookings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('access_token') || ''}` },
        body: JSON.stringify({ checkin: true }),
      });
      if (res.ok) { toast.success('Checked in! Proof earned 🛡'); mutate(); }
      else toast.error('Failed to check in');
    } catch { toast.error('Network error'); }
    finally { setActing(null); }
  };

  const submitReview = async (bookingId: string, businessId: string | null, eventId: string | null) => {
    try {
      const res = await fetch('/api/v1/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('access_token') || ''}` },
        body: JSON.stringify({ business_id: businessId, event_id: eventId, booking_id: bookingId, rating, body: reviewBody }),
      });
      if (res.ok) { toast.success('Review submitted! Trust +2 🛡'); setShowReview(null); setReviewBody(''); setRating(5); }
      else toast.error('Failed to submit review');
    } catch { toast.error('Network error'); }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="sticky top-0 z-10 flex items-center gap-3 px-4 lg:px-8 py-3" style={{ background: 'rgba(10,11,15,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-[#a3adc3] cursor-pointer"><ArrowLeft size={18} /> Back</button>
        <h1 className="text-sm font-bold text-white">My Bookings</h1>
        <span className="ml-auto text-[11px] text-[#4a5068]">{bookings.length} booking{bookings.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="max-w-lg lg:max-w-2xl mx-auto px-4 lg:px-8 py-4 pb-24 space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[#00d4ff]" /></div>
        ) : bookings.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-sm text-[#4a5068]">No bookings yet</p>
            <button onClick={() => router.push('/nearby')} className="text-xs font-semibold text-[#00d4ff] cursor-pointer">Explore nearby businesses</button>
          </div>
        ) : (
          bookings.map((b) => {
            const st = STATUS_CONFIG[b.status as string] || STATUS_CONFIG.pending;
            const isBusiness = !!b.business_id;
            const name = (isBusiness ? b.business_name : b.event_title) as string || 'Booking';
            const isActive = b.status === 'pending' || b.status === 'confirmed';
            const isCompleted = b.status === 'completed';

            return (
              <div key={b.id as string} className="rounded-2xl p-4" style={{ background: 'rgba(17,19,24,0.5)', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: isBusiness ? 'rgba(0,212,255,0.1)' : 'rgba(239,68,68,0.1)' }}>
                    {isBusiness ? <Store size={18} className="text-[#00d4ff]" /> : <Calendar size={18} className="text-[#f87171]" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-semibold text-white truncate">{name}</h3>
                      <span className="flex items-center gap-1 text-[9px] font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ background: `${st.color}15`, color: st.color }}>
                        {st.icon} {st.label}
                      </span>
                    </div>
                    {b.service_name && <p className="text-[11px] text-[#a3adc3]">{b.service_name as string}</p>}
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-[#4a5068]">
                      {b.amount && Number(b.amount) > 0 && <span>${Number(b.amount).toFixed(0)}</span>}
                      <span>{format(new Date(b.created_at as string), 'MMM d, h:mm a')}</span>
                      {b.checkin_verified && <span className="text-[#34d399]">✓ Checked in</span>}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 mt-3">
                      {isActive && !b.checkin_verified && (
                        <button onClick={() => checkin(b.id as string)} disabled={acting === b.id} className="rounded-lg px-3 py-1.5 text-[10px] font-semibold cursor-pointer" style={{ background: 'rgba(0,212,255,0.1)', color: '#00d4ff' }}>
                          Check In
                        </button>
                      )}
                      {b.status === 'confirmed' && (
                        <button onClick={() => updateStatus(b.id as string, 'completed')} disabled={acting === b.id} className="rounded-lg px-3 py-1.5 text-[10px] font-semibold cursor-pointer" style={{ background: 'rgba(52,211,153,0.1)', color: '#34d399' }}>
                          Mark Complete
                        </button>
                      )}
                      {isActive && (
                        <button onClick={() => updateStatus(b.id as string, 'canceled')} disabled={acting === b.id} className="rounded-lg px-3 py-1.5 text-[10px] font-semibold cursor-pointer" style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171' }}>
                          Cancel
                        </button>
                      )}
                      {isCompleted && !showReview && (
                        <button onClick={() => setShowReview(b.id as string)} className="rounded-lg px-3 py-1.5 text-[10px] font-semibold cursor-pointer" style={{ background: 'rgba(251,191,36,0.1)', color: '#fbbf24' }}>
                          <Star size={10} className="inline mr-1" /> Leave Review
                        </button>
                      )}
                    </div>

                    {/* Inline review form */}
                    {showReview === b.id && (
                      <div className="mt-3 space-y-2 rounded-xl p-3" style={{ background: 'rgba(10,11,15,0.5)', border: '1px solid rgba(255,255,255,0.04)' }}>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map(i => (
                            <button key={i} onClick={() => setRating(i)} className="cursor-pointer">
                              <Star size={20} className={i <= rating ? 'text-[#fbbf24]' : 'text-[#2d3548]'} fill={i <= rating ? '#fbbf24' : 'none'} />
                            </button>
                          ))}
                        </div>
                        <textarea
                          value={reviewBody}
                          onChange={(e) => setReviewBody(e.target.value)}
                          placeholder="How was your experience?"
                          rows={2}
                          className="w-full rounded-lg px-3 py-2 text-xs text-white outline-none resize-none placeholder:text-[#2d3548]"
                          style={{ background: 'rgba(17,19,24,0.8)', border: '1px solid rgba(255,255,255,0.07)' }}
                        />
                        <div className="flex gap-2">
                          <button onClick={() => submitReview(b.id as string, b.business_id as string | null, b.event_id as string | null)} className="rounded-lg px-3 py-1.5 text-[10px] font-semibold cursor-pointer" style={{ background: '#00d4ff', color: '#0a0b0f' }}>Submit</button>
                          <button onClick={() => setShowReview(null)} className="text-[10px] text-[#4a5068] cursor-pointer">Cancel</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
