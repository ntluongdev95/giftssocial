'use client';

// Kiss Chain hackathon demo — standalone page, deliberately separate
// from the production gift-sending flow. Connects a real NEAR wallet
// to the deployed testnet contract (kiss-chain-demo-2026.testnet) and
// exercises mint -> reciprocate -> claim -> relay end to end.

import { useCallback, useEffect, useRef, useState } from 'react';
import '@near-wallet-selector/modal-ui/styles.css';
import maplibregl from 'maplibre-gl';
import {
  Heart, Wallet, Send, Sparkles, Clock, Users, Gift, Flower2,
  ExternalLink, Loader2, CheckCircle2, AlertCircle, LogOut, Flame, MapPin, Award,
} from 'lucide-react';
import { getSelector, getModal, getSignedInAccountId, signOut, CONTRACT_ID } from '@/lib/near/wallet';
import {
  mintKiss, reciprocate, claim, relay, reclaimIfWilted,
  getKiss, nftTokensForOwner, yoctoToNear, extractReturnValue,
  getJourney, getBadge, type KissInfo, type JourneyHop, type BadgeInfo,
} from '@/lib/near/kiss-contract';

// Stamps a real browser location onto each hop (see get_journey in
// lib.rs) — falls back to (0,0) on denial/timeout rather than ever
// blocking a mint/relay over a permission prompt.
async function getBrowserCoords(): Promise<{ lat: number; lng: number }> {
  try {
    const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 5000 })
    );
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch {
    return { lat: 0, lng: 0 };
  }
}

// nft_tokens_for_owner only returns kisses this wallet currently OWNS
// (i.e. received) — a kiss someone sent is owned by the RECEIVER the
// instant it's minted, so the sender has no on-chain-indexed way to
// find their own sent kisses back again (no sender-side index exists
// in the contract). Tracked here client-side instead: every token_id
// this browser has minted/relayed gets remembered per-account, so the
// sender can still see and reclaim their own pending/wilted kisses.
function sentKey(accountId: string) { return `kiss-chain-sent:${accountId}`; }
function loadSentIds(accountId: string): string[] {
  try { return JSON.parse(localStorage.getItem(sentKey(accountId)) ?? '[]'); } catch { return []; }
}
function saveSentId(accountId: string, tokenId: string) {
  const ids = loadSentIds(accountId);
  if (!ids.includes(tokenId)) localStorage.setItem(sentKey(accountId), JSON.stringify([tokenId, ...ids]));
}

const EXPLORER = 'https://explorer.testnet.near.org/transactions';
const ACCENT = '#e11d48';

interface KissRow extends KissInfo {
  token_id: string;
}

interface ToastState {
  kind: 'success' | 'error';
  message: string;
  txHash?: string;
}

// ── Small presentational helpers ────────────────────────────────────

function statusMeta(status: KissInfo['status']) {
  if (status === 'Bloomed') return { color: '#4ade80', bg: 'rgba(74,222,128,0.12)', Icon: Flower2, label: 'Bloomed' };
  if (status === 'Wilted') return { color: '#71717a', bg: 'rgba(113,113,122,0.12)', Icon: Flame, label: 'Wilted' };
  return { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)', Icon: Clock, label: 'Pending' };
}

function msUntil(nanos: string): number {
  return Number(BigInt(nanos) / BigInt(1_000_000)) - Date.now();
}

function formatCountdown(nanos: string, status: KissInfo['status']): string {
  const ms = msUntil(nanos);
  if (status === 'Bloomed') return 'reciprocated';
  if (status === 'Wilted' || ms <= 0) return 'window closed';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m left to bloom` : `${m}m left to bloom`;
}

function short(accountId: string): string {
  return accountId.length > 24 ? `${accountId.slice(0, 10)}…${accountId.slice(-8)}` : accountId;
}

function StepCard({ n, Icon, title, body }: { n: number; Icon: typeof Heart; title: string; body: string }) {
  return (
    <div className="flex-1 rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex items-center gap-2 mb-1.5">
        <div className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: `${ACCENT}33`, color: ACCENT }}>
          {n}
        </div>
        <Icon size={14} style={{ color: ACCENT }} />
      </div>
      <div className="text-xs font-bold mb-0.5">{title}</div>
      <div className="text-[11px] text-white/50 leading-relaxed">{body}</div>
    </div>
  );
}

// 'owned': this wallet is the current NFT owner (from nft_tokens_for_owner)
//          — can Reciprocate/Claim/Relay.
// 'sent':  this wallet minted/relayed it but someone else owns it now
//          (tracked client-side, see sentKey note above) — can only
//          Reclaim once it's wilted; all other actions require being
//          the owner, which the sender isn't.
function KissCard({
  k, perspective, busy, relayTarget, setRelayTarget, onAction,
}: {
  k: KissRow;
  perspective: 'owned' | 'sent';
  busy: string | null;
  relayTarget: Record<string, { receiverId: string; depositNear: string }>;
  setRelayTarget: (v: Record<string, { receiverId: string; depositNear: string }>) => void;
  onAction: (actionKey: string, fn: () => Promise<unknown>, successMsg: string) => void;
}) {
  const meta = statusMeta(k.status);
  const rt = relayTarget[k.token_id] ?? { receiverId: '', depositNear: '1' };
  const [journeyOpen, setJourneyOpen] = useState(false);
  const [journey, setJourney] = useState<JourneyHop[] | null>(null);
  const [journeyLoading, setJourneyLoading] = useState(false);
  const toggleJourney = async () => {
    if (journeyOpen) { setJourneyOpen(false); return; }
    setJourneyOpen(true);
    if (journey) return;
    setJourneyLoading(true);
    try { setJourney(await getJourney(k.token_id)); } catch { setJourney([]); }
    finally { setJourneyLoading(false); }
  };
  return (
    <div
      className="rounded-xl p-3.5 text-xs"
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.06)',
        // Depth reads as a chain: each relay level nudges right and
        // gets a faint left accent border.
        marginLeft: Math.min(k.depth, 4) * 14,
        borderLeft: k.depth > 0 ? `2px solid ${ACCENT}55` : undefined,
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 font-bold">
          {k.depth > 0 && <span className="text-white/30">↳</span>}
          {k.token_id}
        </div>
        <span
          className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
          style={{ background: meta.bg, color: meta.color }}
        >
          <meta.Icon size={10} /> {meta.label}
        </span>
      </div>

      <div className="text-white/50 space-y-1">
        {perspective === 'owned' && (
          <div className="flex justify-between">
            <span>From</span>
            <span className="text-white/70 font-mono">{short(k.sender_id)}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span>Locked</span>
          <span className="text-white/70">{yoctoToNear(k.locked_amount)} NEAR</span>
        </div>
        {Number(k.royalty_amount) > 0 && (
          <div className="flex justify-between">
            <span>Royalty pending</span>
            <span style={{ color: '#fbbf24' }}>{yoctoToNear(k.royalty_amount)} NEAR → root</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="flex items-center gap-1"><Clock size={10} /> {formatCountdown(k.expires_at, k.status)}</span>
          <span>relay slots: {k.relay_slots_remaining}</span>
        </div>
      </div>

      <div className="flex gap-2 mt-3 flex-wrap">
        {perspective === 'owned' && k.status === 'Pending' && (
          <button
            disabled={!!busy}
            onClick={() => onAction(k.token_id + ':reciprocate', () => reciprocate(k.token_id), 'Reciprocated — it bloomed! 🌸')}
            className="flex items-center gap-1 text-[11px] px-3 py-1.5 rounded-lg cursor-pointer disabled:opacity-40 hover:brightness-110 transition-all"
            style={{ background: '#4ade80', color: '#052e16' }}
          >
            {busy === k.token_id + ':reciprocate' ? <Loader2 size={11} className="animate-spin" /> : <Flower2 size={11} />}
            Reciprocate
          </button>
        )}
        {perspective === 'owned' && k.status === 'Bloomed' && Number(k.locked_amount) > 0 && (
          <button
            disabled={!!busy}
            onClick={() => onAction(k.token_id + ':claim', () => claim(k.token_id), 'Claimed!')}
            className="flex items-center gap-1 text-[11px] px-3 py-1.5 rounded-lg cursor-pointer disabled:opacity-40 hover:brightness-110 transition-all"
            style={{ background: '#fbbf24', color: '#451a03' }}
          >
            {busy === k.token_id + ':claim' ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
            Claim
          </button>
        )}
        {perspective === 'sent' && k.status === 'Pending' && msUntil(k.expires_at) <= 0 && (
          <button
            disabled={!!busy}
            onClick={() => onAction(k.token_id + ':reclaim', () => reclaimIfWilted(k.token_id), 'Reclaimed.')}
            className="flex items-center gap-1 text-[11px] px-3 py-1.5 rounded-lg cursor-pointer disabled:opacity-40 hover:bg-white/15 transition-all"
            style={{ background: 'rgba(255,255,255,0.1)' }}
          >
            Reclaim (wilted)
          </button>
        )}
      </div>

      {perspective === 'owned' && k.status === 'Bloomed' && k.relay_slots_remaining > 0 && (
        <div className="flex gap-2 mt-2.5 pt-2.5" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <input
            value={rt.receiverId}
            onChange={(e) => setRelayTarget({ ...relayTarget, [k.token_id]: { ...rt, receiverId: e.target.value } })}
            placeholder="relay to: account.testnet"
            className="text-[11px] px-2.5 py-2 rounded-lg bg-black/40 border border-white/10 focus:border-white/30 outline-none flex-1 transition-colors"
          />
          <input
            value={rt.depositNear}
            onChange={(e) => setRelayTarget({ ...relayTarget, [k.token_id]: { ...rt, depositNear: e.target.value } })}
            placeholder="NEAR"
            className="text-[11px] px-2.5 py-2 rounded-lg bg-black/40 border border-white/10 focus:border-white/30 outline-none w-16 transition-colors"
          />
          <button
            disabled={!!busy || !rt.receiverId}
            onClick={() => onAction(
              k.token_id + ':relay',
              async () => {
                const { lat, lng } = await getBrowserCoords();
                return relay(k.token_id, rt.receiverId, 'passing it on', 48, rt.depositNear || '0', lat, lng);
              },
              'Relayed onward!',
            )}
            className="flex items-center gap-1 text-[11px] px-3 py-2 rounded-lg cursor-pointer disabled:opacity-40 hover:brightness-110 transition-all shrink-0"
            style={{ background: '#a78bfa', color: '#2e1065' }}
          >
            {busy === k.token_id + ':relay' ? <Loader2 size={11} className="animate-spin" /> : <Users size={11} />}
            Relay
          </button>
        </div>
      )}

      <button
        onClick={toggleJourney}
        className="flex items-center gap-1 text-[10px] text-white/40 hover:text-white/70 mt-2.5 cursor-pointer transition-colors"
      >
        <MapPin size={10} /> {journeyOpen ? 'Hide journey' : 'View journey on the map'}
      </button>
      {journeyOpen && (
        journeyLoading
          ? <div className="text-[10px] text-white/30 mt-1.5">Loading…</div>
          : journey && journey.length > 0
            ? <JourneyMap hops={journey} />
            : <div className="text-[10px] text-white/30 mt-1.5">No journey data for this kiss (pre-journey-map or geolocation was denied).</div>
      )}
    </div>
  );
}

// A relayed kiss's chain, root first, as an actual path across the
// globe (get_journey in lib.rs) — same tile style the production
// world map uses, so it looks like part of the same product, not a
// bolted-on demo widget.
function JourneyMap({ hops }: { hops: JourneyHop[] }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || hops.length === 0) return;
    const key = process.env.NEXT_PUBLIC_MAPTILER_KEY || '';
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: `https://api.maptiler.com/maps/hybrid/style.json?key=${key}`,
      center: [hops[0].lng, hops[0].lat],
      zoom: 2,
      interactive: true,
      attributionControl: false,
    });
    map.on('load', () => {
      map.addSource('journey-route', {
        type: 'geojson',
        data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: hops.map((h) => [h.lng, h.lat]) } },
      });
      map.addLayer({
        id: 'journey-route-line', type: 'line', source: 'journey-route',
        paint: { 'line-color': ACCENT, 'line-width': 2.5, 'line-dasharray': [1, 1.5] },
      });
      hops.forEach((h, i) => {
        const el = document.createElement('div');
        el.style.cssText = `width:14px;height:14px;border-radius:50%;background:${i === 0 ? ACCENT : '#fff'};border:2px solid ${ACCENT};box-shadow:0 0 8px rgba(0,0,0,0.4);`;
        new maplibregl.Marker({ element: el })
          .setLngLat([h.lng, h.lat])
          .setPopup(new maplibregl.Popup({ offset: 14 }).setText(`${h.account_id} — depth ${h.depth}`))
          .addTo(map);
      });
      if (hops.length > 1) {
        const bounds = hops.reduce(
          (b, h) => b.extend([h.lng, h.lat]),
          new maplibregl.LngLatBounds([hops[0].lng, hops[0].lat], [hops[0].lng, hops[0].lat])
        );
        map.fitBounds(bounds, { padding: 36, maxZoom: 6 });
      }
    });

    return () => map.remove();
  }, [hops]);

  return <div ref={containerRef} className="w-full h-44 rounded-lg overflow-hidden mt-1.5" style={{ border: '1px solid rgba(255,255,255,0.08)' }} />;
}

// ── Kiss Tree — a real graph, not just the flat indented list above ──
// Built from whatever this wallet can see (its owned kisses + the
// ones it's sent, tracked client-side — see the sentKey note). There's
// no on-chain "get the whole tree" query, so a node this wallet never
// touched (e.g. a grandchild someone ELSE relayed onward) won't show
// up here; that's an honest gap, not a bug, flagged in the caption
// under the heading rather than hidden.
function buildForest(nodes: KissRow[]): { roots: KissRow[]; childrenOf: Map<string, KissRow[]> } {
  const byId = new Map(nodes.map((n) => [n.token_id, n]));
  const childrenOf = new Map<string, KissRow[]>();
  const roots: KissRow[] = [];
  for (const n of nodes) {
    const parent = n.parent_token_id;
    if (parent && byId.has(parent)) {
      const list = childrenOf.get(parent) ?? [];
      list.push(n);
      childrenOf.set(parent, list);
    } else {
      // No parent, or parent isn't something this wallet can see —
      // treat as a root for display purposes either way.
      roots.push(n);
    }
  }
  return { roots, childrenOf };
}

function TreeNode({ node, childrenOf, isRoot }: { node: KissRow; childrenOf: Map<string, KissRow[]>; isRoot: boolean }) {
  const meta = statusMeta(node.status);
  const kids = childrenOf.get(node.token_id) ?? [];
  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <div
          className="shrink-0 h-9 w-9 rounded-full flex items-center justify-center"
          style={{ background: meta.bg, border: `1.5px solid ${meta.color}` }}
          title={`${node.token_id} — ${meta.label}`}
        >
          <meta.Icon size={14} style={{ color: meta.color }} />
        </div>
        <div className="min-w-0">
          <div className="text-[11px] font-bold flex items-center gap-1.5">
            {node.token_id}
            {isRoot && <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: `${ACCENT}33`, color: ACCENT }}>ROOT</span>}
          </div>
          <div className="text-[10px] text-white/40">{yoctoToNear(node.locked_amount)} NEAR · {kids.length > 0 ? `${kids.length} relayed` : 'not relayed yet'}</div>
        </div>
      </div>
      {kids.length > 0 && (
        <div className="ml-[17px] pl-5 mt-1.5 flex flex-col gap-3" style={{ borderLeft: '1.5px dashed rgba(255,255,255,0.15)' }}>
          {kids.map((child) => (
            <TreeNode key={child.token_id} node={child} childrenOf={childrenOf} isRoot={false} />
          ))}
        </div>
      )}
    </div>
  );
}

function KissTree({ kisses, sentKisses }: { kisses: KissRow[]; sentKisses: KissRow[] }) {
  const all = Array.from(new Map([...kisses, ...sentKisses].map((k) => [k.token_id, k])).values());
  if (all.length === 0) return null;
  const { roots, childrenOf } = buildForest(all);
  return (
    <section className="mb-8">
      <h2 className="text-sm font-bold mb-1 flex items-center gap-1.5">
        <Users size={14} style={{ color: ACCENT }} /> Kiss Tree
      </h2>
      <p className="text-[11px] text-white/35 mb-3">
        The chain of relays this wallet can see — a node someone else relayed onward, outside this wallet, won&apos;t show up here.
      </p>
      <div className="rounded-xl p-4 flex flex-col gap-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
        {roots.map((root) => (
          <TreeNode key={root.token_id} node={root} childrenOf={childrenOf} isRoot />
        ))}
      </div>
    </section>
  );
}

export default function NearDemoPage() {
  const [accountId, setAccountId] = useState<string | null>(null);
  // Soulbound on-chain credential (see BadgeInfo/award_bloom in
  // lib.rs) — how many kisses this wallet has actually had
  // reciprocated or claimed, auto-tracked by the contract itself.
  const [badge, setBadge] = useState<BadgeInfo | null>(null);
  const refreshBadge = useCallback(async (id: string) => {
    try { setBadge(await getBadge(id)); } catch { setBadge(null); }
  }, []);
  const [loadingWallet, setLoadingWallet] = useState(true);
  const [busy, setBusy] = useState<string | null>(null); // which action is in flight, for per-button spinners
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [kisses, setKisses] = useState<KissRow[]>([]);
  const [sentKisses, setSentKisses] = useState<KissRow[]>([]);
  const [loadingKisses, setLoadingKisses] = useState(false);

  // Mint form
  const [receiverId, setReceiverId] = useState('');
  const [message, setMessage] = useState('');
  const [depositNear, setDepositNear] = useState('1');
  const [hours, setHours] = useState('48');

  // Relay form (per-row)
  const [relayTarget, setRelayTarget] = useState<Record<string, { receiverId: string; depositNear: string }>>({});

  const showToast = useCallback((t: ToastState) => {
    setToast(t);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 6000);
  }, []);

  const refreshKisses = useCallback(async (acc: string) => {
    setLoadingKisses(true);
    try {
      const tokens = await nftTokensForOwner(acc);
      const rows = await Promise.all(
        tokens.map(async (t) => {
          const info = await getKiss(t.token_id);
          return info ? { token_id: t.token_id, ...info } : null;
        }),
      );
      // Newest first, and group children right under their parent by
      // depth so the "chain" actually reads as a chain, not a jumble.
      const sorted = rows.filter((r): r is KissRow => r !== null)
        .sort((a, b) => Number(b.token_id.replace('kiss-', '')) - Number(a.token_id.replace('kiss-', '')));
      setKisses(sorted);
    } catch (e) {
      showToast({ kind: 'error', message: e instanceof Error ? e.message : 'Failed to load kisses' });
    } finally {
      setLoadingKisses(false);
    }
  }, [showToast]);

  const refreshSentKisses = useCallback(async (acc: string) => {
    const ids = loadSentIds(acc);
    const rows = await Promise.all(
      ids.map(async (id) => {
        const info = await getKiss(id);
        return info ? { token_id: id, ...info } : null;
      }),
    );
    setSentKisses(rows.filter((r): r is KissRow => r !== null));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const selector = await getSelector();
        const id = await getSignedInAccountId();
        if (cancelled) return;
        setAccountId(id);
        if (id) { await refreshKisses(id); await refreshSentKisses(id); await refreshBadge(id); }

        selector.on('signedIn', async ({ accounts }) => {
          const newId = accounts[0]?.accountId ?? null;
          setAccountId(newId);
          if (newId) { await refreshKisses(newId); await refreshSentKisses(newId); await refreshBadge(newId); }
        });
        selector.on('signedOut', () => {
          setAccountId(null);
          setKisses([]);
          setSentKisses([]);
          setBadge(null);
        });
      } catch (e) {
        if (!cancelled) showToast({ kind: 'error', message: e instanceof Error ? e.message : 'Wallet init failed' });
      } finally {
        if (!cancelled) setLoadingWallet(false);
      }
    })();
    return () => { cancelled = true; };
  }, [refreshKisses, refreshSentKisses, refreshBadge, showToast]);

  // actionKey 'mint'/'<id>:relay' are the two actions that CREATE a new
  // token owned by someone else — their return value is the new
  // TokenId, which we remember locally so the sender can find it again
  // (see the sentKey/loadSentIds/saveSentId note above `nftTokensForOwner`).
  const run = async (actionKey: string, fn: () => Promise<unknown>, successMsg: string) => {
    setBusy(actionKey);
    try {
      const result = await fn();
      const txHash = (result as { transaction_outcome?: { id?: string } } | void)?.transaction_outcome?.id;
      if (accountId && (actionKey === 'mint' || actionKey.endsWith(':relay'))) {
        const newTokenId = extractReturnValue<string>(result);
        if (newTokenId) saveSentId(accountId, newTokenId);
      }
      showToast({ kind: 'success', message: successMsg, txHash });
      if (accountId) { await refreshKisses(accountId); await refreshSentKisses(accountId); await refreshBadge(accountId); }
    } catch (e) {
      showToast({ kind: 'error', message: e instanceof Error ? e.message : 'Transaction failed' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-h-screen text-white px-5 py-8 pb-24" style={{ background: 'radial-gradient(ellipse at top, #1a0b14 0%, #0a0b0f 55%)' }}>
      <div className="max-w-xl mx-auto">
        {/* ── Hero ─────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 mb-2">
          <Heart size={28} fill={ACCENT} color={ACCENT} />
          <h1 className="text-2xl font-bold">Kiss Chain</h1>
          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider" style={{ background: 'rgba(74,222,128,0.15)', color: '#4ade80' }}>
            ● Live on NEAR Testnet
          </span>
        </div>
        <p className="text-sm text-white/60 mb-1 leading-relaxed">
          Each kiss is a real NFT that holds real NEAR — locked until the receiver reciprocates, relayed
          onward to spread, paying royalty back to whoever started the chain.
        </p>
        <p className="text-[11px] text-white/30 mb-5 font-mono">{CONTRACT_ID}</p>

        <div className="flex gap-2 mb-7">
          <StepCard n={1} Icon={Send} title="Mint" body="Lock NEAR inside an NFT sent to someone, with a deadline." />
          <StepCard n={2} Icon={Flower2} title="Bloom" body="They reciprocate before it closes — funds unlock, royalty pays out." />
          <StepCard n={3} Icon={Users} title="Relay" body="Pass it on to new people — the chain (and the royalty) grows." />
        </div>

        {/* ── Wallet ───────────────────────────────────────────── */}
        {loadingWallet ? (
          <div className="flex items-center gap-2 text-sm text-white/50 mb-6">
            <Loader2 size={14} className="animate-spin" /> Connecting to wallet selector…
          </div>
        ) : accountId ? (
          <div className="flex items-center justify-between mb-7 rounded-xl p-3.5" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <Wallet size={16} style={{ color: ACCENT }} className="shrink-0" />
              <span className="truncate">{accountId}</span>
            </div>
            <button
              onClick={() => run('signout', () => signOut(), 'Signed out')}
              className="shrink-0 flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg cursor-pointer hover:bg-white/10 transition-colors"
              style={{ background: 'rgba(255,255,255,0.08)' }}
            >
              <LogOut size={12} /> Disconnect
            </button>
          </div>
        ) : (
          <button
            onClick={async () => { const modal = await getModal(); modal.show(); }}
            className="w-full mb-7 flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold cursor-pointer hover:brightness-110 transition-all"
            style={{ background: `linear-gradient(135deg, ${ACCENT}, #fbbf24)`, boxShadow: `0 4px 20px ${ACCENT}44` }}
          >
            <Wallet size={16} /> Connect NEAR Wallet
          </button>
        )}

        {accountId && badge && (
          <div className="flex items-center gap-2.5 mb-7 rounded-xl p-3.5" style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.25)' }}>
            <Award size={18} style={{ color: '#fbbf24' }} className="shrink-0" />
            <div className="min-w-0">
              <div className="text-sm font-bold">{badge.level}</div>
              <div className="text-[10px] text-white/40">Soulbound on-chain credential — {badge.bloom_count} kiss{badge.bloom_count === 1 ? '' : 'es'} reciprocated or claimed</div>
            </div>
          </div>
        )}

        {accountId && (
          <>
            {/* ── Mint form ──────────────────────────────────────── */}
            <section className="mb-8 rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <h2 className="text-sm font-bold mb-3 flex items-center gap-1.5"><Send size={14} style={{ color: ACCENT }} /> Send a Kiss</h2>
              <div className="flex flex-col gap-2.5">
                <input
                  value={receiverId}
                  onChange={(e) => setReceiverId(e.target.value)}
                  placeholder="receiver.testnet"
                  className="text-sm px-3 py-2.5 rounded-lg bg-black/40 border border-white/10 focus:border-white/30 outline-none transition-colors"
                />
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Your message…"
                  rows={2}
                  className="text-sm px-3 py-2.5 rounded-lg bg-black/40 border border-white/10 focus:border-white/30 outline-none transition-colors resize-none"
                />
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-[10px] text-white/40 uppercase tracking-wide mb-1 block">NEAR to lock</label>
                    <input
                      value={depositNear}
                      onChange={(e) => setDepositNear(e.target.value)}
                      className="w-full text-sm px-3 py-2.5 rounded-lg bg-black/40 border border-white/10 focus:border-white/30 outline-none transition-colors"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] text-white/40 uppercase tracking-wide mb-1 block">Hours to bloom</label>
                    <input
                      value={hours}
                      onChange={(e) => setHours(e.target.value)}
                      className="w-full text-sm px-3 py-2.5 rounded-lg bg-black/40 border border-white/10 focus:border-white/30 outline-none transition-colors"
                    />
                  </div>
                </div>
                <button
                  disabled={busy === 'mint' || !receiverId || !message}
                  onClick={() => run(
                    'mint',
                    async () => {
                      const { lat, lng } = await getBrowserCoords();
                      return mintKiss(receiverId, message, Number(hours) || 48, depositNear || '0', lat, lng);
                    },
                    'Kiss sent!',
                  )}
                  className="flex items-center justify-center gap-2 rounded-lg py-3 text-sm font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 transition-all"
                  style={{ background: ACCENT }}
                >
                  {busy === 'mint' ? <Loader2 size={14} className="animate-spin" /> : <Heart size={14} fill="#fff" />}
                  Mint Kiss
                </button>
              </div>
            </section>

            <KissTree kisses={kisses} sentKisses={sentKisses} />

            {/* ── Kisses I own (received, or relayed-to-self) ─────── */}
            <section className="mb-8">
              <h2 className="text-sm font-bold mb-3 flex items-center gap-1.5">
                <Gift size={14} style={{ color: ACCENT }} /> My Kisses
                {loadingKisses
                  ? <Loader2 size={12} className="animate-spin text-white/40" />
                  : <span className="text-white/40 font-normal">({kisses.length})</span>}
              </h2>
              <div className="flex flex-col gap-3">
                {!loadingKisses && kisses.length === 0 && (
                  <p className="text-xs text-white/40 py-4 text-center">No kisses yet — mint one above to get started.</p>
                )}
                {kisses.map((k) => (
                  <KissCard key={k.token_id} k={k} perspective="owned" busy={busy} relayTarget={relayTarget} setRelayTarget={setRelayTarget} onAction={run} />
                ))}
              </div>
            </section>

            {/* ── Kisses I sent (owned by someone else now) ───────── */}
            {sentKisses.length > 0 && (
              <section>
                <h2 className="text-sm font-bold mb-3 flex items-center gap-1.5">
                  <Send size={14} style={{ color: ACCENT }} /> Sent by You
                  <span className="text-white/40 font-normal">({sentKisses.length})</span>
                </h2>
                <p className="text-[11px] text-white/35 mb-3 -mt-1">
                  These are owned by their receiver now — you can only reclaim one if its window closes unreciprocated.
                </p>
                <div className="flex flex-col gap-3">
                  {sentKisses.map((k) => (
                    <KissCard key={k.token_id} k={k} perspective="sent" busy={busy} relayTarget={relayTarget} setRelayTarget={setRelayTarget} onAction={run} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {/* ── Toast ────────────────────────────────────────────────── */}
      {toast && (
        <div
          className="fixed bottom-5 left-1/2 -translate-x-1/2 max-w-sm w-[calc(100%-2.5rem)] rounded-xl p-3.5 text-xs shadow-2xl z-50"
          style={{
            background: toast.kind === 'success' ? 'rgba(10,20,14,0.95)' : 'rgba(30,10,10,0.95)',
            border: `1px solid ${toast.kind === 'success' ? 'rgba(74,222,128,0.3)' : 'rgba(239,68,68,0.3)'}`,
            backdropFilter: 'blur(8px)',
          }}
        >
          <div className="flex items-start gap-2">
            {toast.kind === 'success'
              ? <CheckCircle2 size={16} style={{ color: '#4ade80' }} className="shrink-0 mt-0.5" />
              : <AlertCircle size={16} style={{ color: '#f87171' }} className="shrink-0 mt-0.5" />}
            <div className="min-w-0">
              <div style={{ color: toast.kind === 'success' ? '#86efac' : '#fca5a5' }}>{toast.message}</div>
              {toast.txHash && (
                <a
                  href={`${EXPLORER}/${toast.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 mt-1 text-white/50 hover:text-white/80 transition-colors"
                >
                  View on Explorer <ExternalLink size={10} />
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
