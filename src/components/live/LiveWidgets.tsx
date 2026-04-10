'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, RefreshCw, HelpCircle, X, ExternalLink } from 'lucide-react';

/* ─── Proxy fetch — all external APIs go through /api/v1/live ─── */
const apiFetch = (type: string) => fetch(`/api/v1/live?type=${type}`).then(r => { if (!r.ok) throw new Error(); return r.json(); });

/* ─── Mini sparkline SVG ─── */
function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 80, h = 28;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(' ');
  return (
    <svg width={w} height={h} className="opacity-60">
      <polyline fill="none" stroke={color} strokeWidth={1.5} points={points} />
    </svg>
  );
}

/* ─── Types ─── */
interface CryptoItem {
  id: string; symbol: string; name: string; current_price: number;
  price_change_percentage_24h: number; sparkline_in_7d?: { price: number[] };
  image: string;
}

interface NewsItem {
  title: string; link: string; pubDate: string; source: string;
  thumbnail?: string; description?: string;
}

/* ═══════════════════════════════════════════
   CRYPTO WIDGET
   ═══════════════════════════════════════════ */
export function CryptoWidget() {
  const [coins, setCoins] = useState<CryptoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchCrypto = async () => {
    setLoading(true); setError(false);
    try {
      setCoins(await apiFetch('crypto'));
    } catch {
      setError(true);
    }
    setLoading(false);
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchCrypto(); }, []);

  return (
    <WidgetSection title="CRYPTO" icon="₿" onRefresh={fetchCrypto} loading={loading} error={error}>
      <div className="grid grid-cols-3 gap-2">
        {coins.map(c => {
          const up = c.price_change_percentage_24h >= 0;
          return (
            <div key={c.id} className="rounded-xl p-3 flex flex-col gap-1.5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-1.5">
                <img src={c.image} alt="" className="h-4 w-4 rounded-full" />
                <span className="text-[9px] font-bold text-[#8892a8] uppercase">{c.symbol}</span>
              </div>
              <Sparkline data={c.sparkline_in_7d?.price?.slice(-24) || []} color={up ? '#22c55e' : '#ef4444'} />
              <span className="text-sm font-bold text-white">${formatPrice(c.current_price)}</span>
              <span className={`text-[10px] font-semibold flex items-center gap-0.5 ${up ? 'text-green-400' : 'text-red-400'}`}>
                {up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                {up ? '+' : ''}{c.price_change_percentage_24h?.toFixed(2)}%
              </span>
            </div>
          );
        })}
      </div>
    </WidgetSection>
  );
}

/* ═══════════════════════════════════════════
   METALS / TOKENIZED ASSETS WIDGET
   ═══════════════════════════════════════════ */
export function MetalsWidget() {
  const [coins, setCoins] = useState<CryptoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchMetals = async () => {
    setLoading(true); setError(false);
    try {
      setCoins(await apiFetch('metals'));
    } catch {
      setError(true);
    }
    setLoading(false);
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchMetals(); }, []);

  return (
    <WidgetSection title="TOKENIZED ASSETS" icon="💰" onRefresh={fetchMetals} loading={loading} error={error}>
      <div className="grid grid-cols-3 gap-2">
        {coins.map(c => {
          const up = c.price_change_percentage_24h >= 0;
          return (
            <div key={c.id} className="rounded-xl p-3 flex flex-col gap-1.5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-1.5">
                <img src={c.image} alt="" className="h-4 w-4 rounded-full" />
                <span className="text-[9px] font-bold text-[#8892a8] uppercase">{c.symbol}</span>
              </div>
              <Sparkline data={c.sparkline_in_7d?.price?.slice(-24) || []} color={up ? '#22c55e' : '#ef4444'} />
              <span className="text-sm font-bold text-white">${formatPrice(c.current_price)}</span>
              <span className={`text-[10px] font-semibold ${up ? 'text-green-400' : 'text-red-400'}`}>
                {up ? '+' : ''}{c.price_change_percentage_24h?.toFixed(2)}%
              </span>
            </div>
          );
        })}
      </div>
    </WidgetSection>
  );
}

/* ═══════════════════════════════════════════
   NEWS WIDGET
   ═══════════════════════════════════════════ */
export function NewsWidget() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchNews = async () => {
    setLoading(true); setError(false);
    try {
      const data = await apiFetch('news');
      setNews(
        (data.items || []).map((it: { title: string; link: string; pubDate: string; thumbnail?: string; description?: string }) => ({
          title: it.title,
          link: it.link.split('?')[0], // strip tracking params
          pubDate: it.pubDate,
          source: 'BBC World',
          thumbnail: it.thumbnail || '',
          description: it.description || '',
        }))
      );
    } catch {
      setError(true);
    }
    setLoading(false);
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchNews(); }, []);

  const featured = news[0];
  const rest = news.slice(1);

  return (
    <WidgetSection title="WORLD NEWS" icon="📰" onRefresh={fetchNews} loading={loading} error={error}>
      <div className="flex flex-col gap-3">
        {/* Featured article */}
        {featured && (
          <div
            onClick={() => window.open(featured.link, '_blank', 'noopener,noreferrer')}
            className="group block rounded-xl overflow-hidden cursor-pointer transition-all"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            {featured.thumbnail && (
              <div className="relative w-full overflow-hidden" style={{ aspectRatio: '16/8' }}>
                <img src={featured.thumbnail} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(10,11,15,0.9) 0%, transparent 60%)' }} />
                <div className="absolute bottom-3 left-3 right-3">
                  <p className="text-sm font-bold text-white leading-snug line-clamp-2">{featured.title}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">LATEST</span>
                    <span className="text-[9px] text-[#8892a8]">{featured.source}</span>
                    <span className="text-[9px] text-[#4a5068]">{timeAgo(featured.pubDate)}</span>
                  </div>
                </div>
              </div>
            )}
            {!featured.thumbnail && (
              <div className="p-4">
                <p className="text-sm font-bold text-white leading-snug">{featured.title}</p>
                <p className="text-[10px] text-[#8892a8] mt-1.5 line-clamp-2">{featured.description}</p>
              </div>
            )}
          </div>
        )}

        {/* Grid of remaining articles */}
        <div className="grid grid-cols-2 gap-2">
          {rest.map((n, i) => (
            <div
              key={i}
              onClick={() => window.open(n.link, '_blank', 'noopener,noreferrer')}
              className="group rounded-xl overflow-hidden cursor-pointer transition-all hover:border-white/10"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              {n.thumbnail && (
                <div className="relative w-full overflow-hidden" style={{ aspectRatio: '16/9' }}>
                  <img src={n.thumbnail} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(10,11,15,0.85) 0%, transparent 50%)' }} />
                  <div className="absolute bottom-0 left-0 right-0 p-2.5">
                    <p className="text-[10px] font-semibold text-white leading-snug line-clamp-2">{n.title}</p>
                  </div>
                </div>
              )}
              {!n.thumbnail && (
                <div className="p-3">
                  <p className="text-[10px] font-semibold text-white leading-snug line-clamp-2">{n.title}</p>
                </div>
              )}
              <div className="flex items-center gap-2 px-2.5 pb-2 pt-1">
                <span className="text-[8px] font-bold text-[#4a5068]">{n.source}</span>
                <span className="text-[8px] text-[#4a5068]">{timeAgo(n.pubDate)}</span>
                <ExternalLink size={8} className="ml-auto text-[#4a5068] opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </WidgetSection>
  );
}

/* ═══════════════════════════════════════════
   TRENDING COINS WIDGET
   ═══════════════════════════════════════════ */
export function TrendingWidget() {
  const [items, setItems] = useState<{ name: string; symbol: string; thumb: string; market_cap_rank: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchTrending = async () => {
    setLoading(true); setError(false);
    try {
      const data = await apiFetch('trending');
      setItems((data.coins || []).slice(0, 9).map((c: { item: { name: string; symbol: string; thumb: string; market_cap_rank: number } }) => ({
        name: c.item.name,
        symbol: c.item.symbol,
        thumb: c.item.thumb,
        market_cap_rank: c.item.market_cap_rank,
      })));
    } catch {
      setError(true);
    }
    setLoading(false);
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchTrending(); }, []);

  return (
    <WidgetSection title="TRENDING" icon="🔥" onRefresh={fetchTrending} loading={loading} error={error}>
      <div className="grid grid-cols-3 gap-2">
        {items.map((t, i) => (
          <div key={i} className="rounded-xl p-3 flex flex-col items-center gap-1.5 text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <img src={t.thumb} alt="" className="h-8 w-8 rounded-full" />
            <span className="text-[10px] font-bold text-white truncate w-full">{t.symbol}</span>
            <span className="text-[8px] text-[#8892a8]">Rank #{t.market_cap_rank || '—'}</span>
          </div>
        ))}
      </div>
    </WidgetSection>
  );
}

/* ═══════════════════════════════════════════
   STOCK MARKET WIDGET
   ═══════════════════════════════════════════ */
interface StockItem {
  symbol: string; name: string; price: number;
  change: number; changePercent: number;
  prevClose?: number; spark?: number[];
  high52w?: number; low52w?: number; marketCap?: number;
}

const INDEX_SYMBOLS = ['^GSPC', '^IXIC', '^DJI', '^RUT', '^N225', '^HSI', '^FTSE', '^GDAXI'];
const INDEX_NAMES: Record<string, string> = {
  '^GSPC': 'S&P 500', '^IXIC': 'NASDAQ', '^DJI': 'Dow Jones', '^RUT': 'Russell 2K',
  '^N225': 'Nikkei 225', '^HSI': 'Hang Seng', '^FTSE': 'FTSE 100', '^GDAXI': 'DAX',
};

export function StocksWidget() {
  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchStocks = async () => {
    setLoading(true); setError(false);
    try {
      setStocks(await apiFetch('stocks'));
    } catch {
      setError(true);
    }
    setLoading(false);
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchStocks(); }, []);

  const indices = stocks.filter(s => INDEX_SYMBOLS.includes(s.symbol));
  const topStocks = stocks.filter(s => !INDEX_SYMBOLS.includes(s.symbol));

  return (
    <>
      <WidgetSection title="INDICES" icon="📊" onRefresh={fetchStocks} loading={loading} error={error}>
        <div className="grid grid-cols-4 gap-2">
          {indices.map(s => {
            const up = s.changePercent >= 0;
            return (
              <div key={s.symbol} className="rounded-xl p-3 flex flex-col gap-1" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <span className="text-[9px] font-bold text-[#8892a8]">{INDEX_NAMES[s.symbol] || s.name}</span>
                {s.spark && <Sparkline data={s.spark} color={up ? '#22c55e' : '#ef4444'} />}
                <span className="text-sm font-bold text-white">{formatPrice(s.price)}</span>
                <div className="flex items-center gap-1">
                  {up ? <TrendingUp size={9} className="text-green-400" /> : <TrendingDown size={9} className="text-red-400" />}
                  <span className={`text-[9px] font-semibold ${up ? 'text-green-400' : 'text-red-400'}`}>
                    {up ? '+' : ''}{s.changePercent?.toFixed(2)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </WidgetSection>

      {topStocks.length > 0 && (
        <WidgetSection title="TOP STOCKS" icon="🏢" loading={false} error={false}>
          <div className="grid grid-cols-4 gap-2">
            {topStocks.map(s => {
              const up = s.changePercent >= 0;
              return (
                <div key={s.symbol} className="rounded-xl p-3 flex flex-col gap-1" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <span className="text-[9px] font-bold text-[#8892a8]">{s.symbol}</span>
                  {s.spark && <Sparkline data={s.spark} color={up ? '#22c55e' : '#ef4444'} />}
                  <span className="text-[11px] font-bold text-white">${formatPrice(s.price)}</span>
                  <div className="flex items-center gap-1">
                    {up ? <TrendingUp size={9} className="text-green-400" /> : <TrendingDown size={9} className="text-red-400" />}
                    <span className={`text-[9px] font-semibold ${up ? 'text-green-400' : 'text-red-400'}`}>
                      {up ? '+' : ''}{s.changePercent?.toFixed(2)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </WidgetSection>
      )}
    </>
  );
}

/* ─── Shared section wrapper ─── */
function WidgetSection({ title, icon, onRefresh, loading, error, children }: {
  title: string; icon: string; onRefresh?: () => void; loading: boolean; error: boolean; children: React.ReactNode;
}) {
  const [showInfo, setShowInfo] = useState(false);
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <span className="text-sm">{icon}</span>
          <span className="text-[11px] font-bold text-white tracking-wider">{title}</span>
          <button onClick={() => setShowInfo(!showInfo)} className="text-[#4a5068] hover:text-white cursor-pointer"><HelpCircle size={11} /></button>
        </div>
        <div className="flex items-center gap-1.5">
          {onRefresh && (
            <button onClick={onRefresh} className="text-[#4a5068] hover:text-white cursor-pointer" disabled={loading}>
              <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
            </button>
          )}
          {showInfo && (
            <button onClick={() => setShowInfo(false)} className="text-[#4a5068] hover:text-white cursor-pointer"><X size={11} /></button>
          )}
        </div>
      </div>
      {showInfo && (
        <div className="mb-2 px-3 py-2 rounded-lg text-[9px] text-[#8892a8] leading-relaxed" style={{ background: 'rgba(255,255,255,0.03)' }}>
          Live data refreshes on demand. Prices from CoinGecko. News from BBC RSS.
        </div>
      )}
      {error ? (
        <div className="flex flex-col items-center py-6 gap-2">
          <span className="text-[10px] text-[#4a5068]">Failed to load</span>
          {onRefresh && (
            <button onClick={onRefresh} className="text-[9px] font-semibold text-red-400 px-3 py-1 rounded-lg cursor-pointer" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
              Retry
            </button>
          )}
        </div>
      ) : loading ? (
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl p-3 h-24 animate-pulse" style={{ background: 'rgba(255,255,255,0.03)' }} />
          ))}
        </div>
      ) : (
        children
      )}
    </div>
  );
}

/* ─── Helpers ─── */
function formatPrice(n: number) {
  if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (n >= 1) return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
