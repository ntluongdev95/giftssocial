'use client';

import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { ArrowLeft, Loader2, Calendar, Store, Heart, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useState } from 'react';
import EventDetailPage from '@/components/events/EventDetailPage';
import BusinessDetailPage from '@/components/business/BusinessDetailPage';
import type { Event, Business } from '@/types';

const fetcher = (url: string) => fetch(url, {
  headers: { Authorization: `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('access_token') || '' : ''}` },
}).then(r => r.json());

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  event: { icon: <Calendar size={18} />, color: '#f87171', label: 'Event' },
  business: { icon: <Store size={18} />, color: '#34d399', label: 'Business' },
  signal: { icon: <Heart size={18} />, color: '#3B82F6', label: 'Signal' },
};

export default function SavedPage() {
  const router = useRouter();
  const { data, isLoading, mutate } = useSWR('/api/v1/saved', fetcher);
  const items = (data?.data || []) as Record<string, unknown>[];
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);

  const handleUnsave = async (itemType: string, itemId: string) => {
    try {
      await fetch('/api/v1/saved', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('access_token') || ''}` },
        body: JSON.stringify({ item_type: itemType, item_id: itemId }),
      });
      toast.success('Removed from saved');
      mutate();
    } catch { toast.error('Failed to unsave'); }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="sticky top-0 z-10 flex items-center gap-3 px-4 lg:px-8 pt-[calc(env(safe-area-inset-top,44px)+8px)] pb-3" style={{ background: 'rgba(10,11,15,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-[#a3adc3] cursor-pointer"><ArrowLeft size={18} /> Back</button>
        <h1 className="text-sm font-bold text-white">Saved Items</h1>
        <span className="ml-auto text-[11px] text-[#4a5068]">{items.length} item{items.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="max-w-lg lg:max-w-5xl mx-auto px-4 lg:px-8 py-4 pb-24">
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[#00d4ff]" /></div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <Heart size={32} className="text-[#4a5068]" />
            <p className="text-sm text-[#4a5068]">No saved items yet</p>
            <p className="text-xs text-[#4a5068]">Save events and businesses to find them here</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
            {items.map((item) => {
              const cfg = TYPE_CONFIG[item.item_type as string] || TYPE_CONFIG.signal;
              return (
                <div
                  key={item.id as string}
                  className="rounded-2xl overflow-hidden cursor-pointer transition-colors hover:bg-white/[0.02]"
                  style={{ background: 'rgba(17,19,24,0.5)', border: '1px solid rgba(255,255,255,0.04)' }}
                  onClick={() => {
                    if (item.item_type === 'event') {
                      setSelectedEvent({ id: item.item_id, title: item.event_title || '', description: '', start_time: item.event_start_time || '', end_time: item.event_start_time || '', status: 'scheduled', visibility: 'public', joined_count: 0, checkin_count: 0, location_name: '', city: item.event_city || '' } as Event);
                    } else if (item.item_type === 'business') {
                      setSelectedBusiness({ id: item.item_id, name: item.business_name || '', category: item.business_category || '', city: item.business_city || '', status: 'active', trust_score: 0 } as Business);
                    }
                  }}
                >
                  <div className="h-1" style={{ background: cfg.color }} />
                  <div className="p-5">
                    <div className="flex items-start gap-3.5 mb-3">
                      <div className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${cfg.color}15` }}>
                        <span style={{ color: cfg.color }}>{cfg.icon}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: `${cfg.color}15`, color: cfg.color }}>{cfg.label}</span>
                        <h3 className="text-sm font-bold text-white mt-1">{(item.event_title || item.business_name || item.item_id) as string}</h3>
                        {!!(item.event_city || item.business_city) && <p className="text-[10px] text-[#a3adc3]">{(item.event_city || item.business_city) as string}</p>}
                        <p className="text-[10px] text-[#4a5068] mt-0.5">
                          Saved {item.created_at ? format(new Date(item.created_at as string), 'MMM d, h:mm a') : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                      <button
                        onClick={(ev) => { ev.stopPropagation(); handleUnsave(item.item_type as string, item.item_id as string); }}
                        className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold cursor-pointer"
                        style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171' }}
                      >
                        <Heart size={12} /> Unsave
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedEvent && (
        <EventDetailPage event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      )}
      {selectedBusiness && (
        <BusinessDetailPage business={selectedBusiness} onClose={() => setSelectedBusiness(null)} />
      )}
    </div>
  );
}
