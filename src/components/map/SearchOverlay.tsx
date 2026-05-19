'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, X, MapPin, Store, Users, Calendar, Globe, Loader2, Star, Clock, Shield, Navigation, History, Trash2, Hash, Route, Map as MapIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useSearch } from '@/hooks/useSearch';

const TABS = [
  { id: 'top', label: 'Top', Icon: Search },
  { id: 'trips', label: 'Trips', Icon: MapIcon },
  { id: 'tags', label: 'Tags', Icon: Hash },
  { id: 'people', label: 'People', Icon: Users },
  { id: 'businesses', label: 'Businesses', Icon: Store },
  { id: 'events', label: 'Events', Icon: Calendar },
  { id: 'circles', label: 'Circles', Icon: Shield },
  { id: 'places', label: 'Places', Icon: Globe },
] as const;

interface SearchResult {
  id: string;
  type: 'people' | 'business' | 'event' | 'circle' | 'place' | 'tag' | 'trip';
  title: string;
  subtitle?: string;
  image?: string;
  lat?: number;
  lng?: number;
  distance?: number | null;
  rating?: number;
  reviewCount?: number;
  startTime?: string;
  status?: string;
  memberCount?: number;
  slug?: string;
  stopCount?: number;
}

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (result: SearchResult, action: 'detail' | 'flyto') => void;
}

const HISTORY_KEY = 'gao_search_history';
const MAX_HISTORY = 10;

function getHistory(): SearchResult[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch { return []; }
}

function addToHistory(item: SearchResult) {
  const history = getHistory().filter(h => h.id !== item.id);
  history.unshift(item);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
}

function removeFromHistory(id: string) {
  const history = getHistory().filter(h => h.id !== id);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

function clearHistory() {
  localStorage.removeItem(HISTORY_KEY);
}

export default function SearchOverlay({ isOpen, onClose, onSelect }: SearchOverlayProps) {
  const { query, tab, results, loading, handleInput, handleTabChange, clear } = useSearch();
  const [history, setHistory] = useState<SearchResult[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHistory(getHistory());
    } else {
      clear();
    }
  }, [isOpen, clear]);

  const handleSelect = (item: SearchResult, action: 'detail' | 'flyto') => {
    addToHistory(item);
    // Tags bypass the map/detail dispatch and go straight to the topic page.
    if (item.type === 'tag' && item.slug) {
      router.push(`/t/${item.slug}`);
      onClose();
      return;
    }
    // Trips → detail page, not map/detail sheet.
    if (item.type === 'trip') {
      router.push(`/trips/${item.id}`);
      onClose();
      return;
    }
    onSelect(item, action);
    onClose();
  };

  const typedResults = results as unknown as Record<string, SearchResult[]>;
  const allResults = tab === 'top'
    ? Object.entries(typedResults).flatMap(([, items]) => items)
    : typedResults[tab === 'businesses' ? 'businesses' : tab] || [];

  const groupedTop = tab === 'top' ? typedResults : null;
  const hasResults = allResults.length > 0;

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex flex-col"
        style={{ background: 'rgba(10,11,15,0.98)' }}
      >
        {/* Header */}
        <div className="pt-[calc(env(safe-area-inset-top,44px)+8px)] px-4 pb-3">
          {/* Search input */}
          <div className="flex items-center gap-2.5">
            <div
              className="flex-1 flex items-center gap-2.5 rounded-2xl px-4 py-3"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(0,212,255,0.15)' }}
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin text-[#00d4ff] shrink-0" />
              ) : (
                <Search size={16} className="text-[#4a5068] shrink-0" />
              )}
              <input
                ref={inputRef}
                value={query}
                onChange={e => handleInput(e.target.value)}
                placeholder="Search people, businesses, events..."
                className="flex-1 bg-transparent text-sm text-white placeholder:text-[#4a5068] outline-none"
              />
              {query && (
                <button onClick={clear} className="text-[#4a5068] cursor-pointer">
                  <X size={14} />
                </button>
              )}
            </div>
            <button onClick={onClose} className="text-[11px] font-medium text-[#a3adc3] py-2 cursor-pointer">
              Cancel
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-3 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {TABS.map(t => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => handleTabChange(t.id)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[10px] font-semibold whitespace-nowrap cursor-pointer transition-all shrink-0"
                  style={active
                    ? { background: 'rgba(0,212,255,0.12)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.2)' }
                    : { background: 'rgba(255,255,255,0.03)', color: '#4a5068', border: '1px solid rgba(255,255,255,0.04)' }
                  }
                >
                  <t.Icon size={12} />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom,0px)+80px)]">
          {!query && history.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2 px-1">
                <div className="flex items-center gap-2">
                  <History size={12} className="text-[#4a5068]" />
                  <span className="text-[11px] font-semibold text-[#4a5068] uppercase tracking-wider">Recent</span>
                </div>
                <button
                  onClick={() => { clearHistory(); setHistory([]); }}
                  className="flex items-center gap-1 text-[10px] text-[#4a5068] hover:text-[#a3adc3] cursor-pointer transition-colors"
                >
                  <Trash2 size={10} /> Clear
                </button>
              </div>
              <div className="space-y-0.5">
                {history.map(item => (
                  <div key={item.id} className="flex items-center group">
                    <div className="flex-1 min-w-0">
                      <ResultItem item={item} onSelect={handleSelect} />
                    </div>
                    <button
                      onClick={() => { removeFromHistory(item.id); setHistory(h => h.filter(x => x.id !== item.id)); }}
                      className="shrink-0 mr-2 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity text-[#4a5068] hover:text-white"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!query && history.length === 0 && (
            <div className="flex flex-col items-center justify-center pt-20 text-center">
              <Search size={32} className="text-[#2d3548] mb-3" />
              <p className="text-sm text-[#4a5068]">Search across Gao</p>
              <p className="text-[10px] text-[#2d3548] mt-1">People, businesses, events and places</p>
            </div>
          )}

          {query && !loading && !hasResults && (
            <div className="flex flex-col items-center justify-center pt-20 text-center">
              <p className="text-sm text-[#4a5068]">No results for &ldquo;{query}&rdquo;</p>
              <p className="text-[10px] text-[#2d3548] mt-1">Try different keywords</p>
            </div>
          )}

          {/* Top tab — grouped sections */}
          {groupedTop && query && (
            <>
              {groupedTop.trips?.length > 0 && (
                <ResultSection title="Trips" icon={<MapIcon size={12} />} color="#a855f7" items={groupedTop.trips} onSelect={handleSelect} onMore={() => handleTabChange('trips')} />
              )}
              {groupedTop.tags?.length > 0 && (
                <ResultSection title="Tags" icon={<Hash size={12} />} color="#ec4899" items={groupedTop.tags} onSelect={handleSelect} onMore={() => handleTabChange('tags')} />
              )}
              {groupedTop.people?.length > 0 && (
                <ResultSection title="People" icon={<Users size={12} />} color="#3b82f6" items={groupedTop.people} onSelect={handleSelect} onMore={() => handleTabChange('people')} />
              )}
              {groupedTop.businesses?.length > 0 && (
                <ResultSection title="Businesses" icon={<Store size={12} />} color="#22c55e" items={groupedTop.businesses} onSelect={handleSelect} onMore={() => handleTabChange('businesses')} />
              )}
              {groupedTop.events?.length > 0 && (
                <ResultSection title="Events" icon={<Calendar size={12} />} color="#ef4444" items={groupedTop.events} onSelect={handleSelect} onMore={() => handleTabChange('events')} />
              )}
              {groupedTop.circles?.length > 0 && (
                <ResultSection title="Circles" icon={<Shield size={12} />} color="#a855f7" items={groupedTop.circles} onSelect={handleSelect} onMore={() => handleTabChange('circles')} />
              )}
              {groupedTop.places?.length > 0 && (
                <ResultSection title="Places" icon={<Globe size={12} />} color="#f59e0b" items={groupedTop.places} onSelect={handleSelect} onMore={() => handleTabChange('places')} />
              )}
            </>
          )}

          {/* Specific tab — flat list */}
          {!groupedTop && query && hasResults && (
            <div className="space-y-1">
              {allResults.map(item => (
                <ResultItem key={item.id} item={item} onSelect={handleSelect} />
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ── Section with title + "See all" ── */
function ResultSection({ title, icon, color, items, onSelect, onMore }: {
  title: string; icon: React.ReactNode; color: string;
  items: SearchResult[]; onSelect: (r: SearchResult, action: 'detail' | 'flyto') => void; onMore: () => void;
}) {
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-2">
          <span style={{ color }}>{icon}</span>
          <span className="text-[11px] font-semibold text-[#8892a8] uppercase tracking-wider">{title}</span>
        </div>
        {items.length >= 3 && (
          <button onClick={onMore} className="text-[10px] font-semibold text-[#00d4ff] cursor-pointer">See all</button>
        )}
      </div>
      <div className="space-y-1">
        {items.map(item => (
          <ResultItem key={item.id} item={item} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}

/* ── Single result item ── */
function ResultItem({ item, onSelect }: { item: SearchResult; onSelect: (r: SearchResult, action: 'detail' | 'flyto') => void }) {
  // Place → flyTo, tag/trip → dedicated page (handled in handleSelect), entity → detail.
  const isEntity = item.type !== 'place' && item.type !== 'tag' && item.type !== 'trip';
  const typeConfig: Record<string, { icon: React.ReactNode; color: string }> = {
    people: { icon: <Users size={14} />, color: '#3b82f6' },
    business: { icon: <Store size={14} />, color: '#22c55e' },
    event: { icon: <Calendar size={14} />, color: '#ef4444' },
    circle: { icon: <Shield size={14} />, color: '#a855f7' },
    place: { icon: <MapPin size={14} />, color: '#f59e0b' },
    tag: { icon: <Hash size={14} />, color: '#ec4899' },
    trip: { icon: <MapIcon size={14} />, color: '#a855f7' },
  };
  const config = typeConfig[item.type] || typeConfig.place;

  return (
    <div className="flex items-center gap-1 rounded-xl transition-all hover:bg-white/[0.03]">
      {/* Main clickable area — entity: detail popup, place: flyTo */}
      <button
        onClick={() => onSelect(item, isEntity ? 'detail' : 'flyto')}
        className="flex-1 flex items-center gap-3 px-3 py-3 cursor-pointer active:scale-[0.99] text-left min-w-0"
      >
        {/* Avatar / Icon */}
        {item.image ? (
          <div className="shrink-0 h-10 w-10 rounded-xl overflow-hidden">
            <img src={item.image} alt="" className="h-full w-full object-cover" />
          </div>
        ) : (
          <div className="shrink-0 h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: `${config.color}12`, border: `1px solid ${config.color}20` }}>
            <span style={{ color: config.color }}>{config.icon}</span>
          </div>
        )}

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-white truncate">{item.title}</p>
          <div className="flex items-center gap-2 mt-0.5">
            {item.subtitle && <p className="text-[10px] text-[#4a5068] truncate">{item.subtitle}</p>}
            {item.rating && (
              <span className="flex items-center gap-0.5 text-[9px] text-[#f59e0b]">
                <Star size={8} fill="#f59e0b" /> {item.rating}
              </span>
            )}
            {item.memberCount && (
              <span className="flex items-center gap-0.5 text-[9px] text-[#a855f7]">
                <Users size={8} /> {item.memberCount}
              </span>
            )}
            {item.startTime && (
              <span className="flex items-center gap-0.5 text-[9px] text-[#4a5068]">
                <Clock size={8} /> {new Date(item.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            )}
          </div>
        </div>

        {/* Distance */}
        {item.distance != null && item.distance > 0 && (
          <span className="shrink-0 text-[9px] font-semibold text-[#4a5068]">
            {item.distance < 1 ? `${Math.round(item.distance * 1000)}m` : `${item.distance}km`}
          </span>
        )}
      </button>

      {/* FlyTo button for entities (separate from detail tap) */}
      {isEntity && item.lat && item.lng && (
        <button
          onClick={(e) => { e.stopPropagation(); onSelect(item, 'flyto'); }}
          className="shrink-0 mr-2 p-2 rounded-lg cursor-pointer transition-all hover:bg-white/[0.06] active:scale-95"
          style={{ border: '1px solid rgba(0,212,255,0.15)' }}
          title="Fly to location"
        >
          <Navigation size={14} className="text-[#00d4ff]" />
        </button>
      )}

      {/* Directions — only places (and entities with coords) get this. Opens
          Google Maps in a new tab using lat,lng so the user's current
          location is used as origin automatically. */}
      {item.type === 'place' && item.lat && item.lng && (
        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${item.lat},${item.lng}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="shrink-0 mr-2 p-2 rounded-lg cursor-pointer transition-all hover:bg-white/[0.06] active:scale-95"
          style={{ border: '1px solid rgba(34,197,94,0.18)' }}
          title="Get directions"
        >
          <Route size={14} className="text-[#22c55e]" />
        </a>
      )}
    </div>
  );
}
