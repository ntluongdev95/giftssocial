'use client';

import { useEffect, useState } from 'react';
import { X, MapPin, MessageCircle, UserPlus, UserCheck, Loader2, Star, MapPinCheck, PenLine, Lock, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useFollow } from '@/hooks/useFollow';
import { useAuthStore } from '@/stores/auth-store';
import AuthPopup from '@/components/ui/AuthPopup';
import PrivateChat from '@/components/chat/PrivateChat';

interface SignalItem { id: string; type: string; title: string; category?: string; created_at: string }
interface ReviewItem { id: string; rating: number; title?: string; body?: string; created_at: string; verified_visit?: boolean; business_name?: string; business_avatar?: string }
interface CheckinItem { id: string; target_type: string; target_id?: string; target_name?: string; created_at: string }

interface UserData {
  id: string;
  username: string;
  display_name: string;
  avatar_url?: string;
  bio?: string;
  photos?: string[];
  city?: string;
  trust_level?: string;
  trust_score?: number;
  followers_count?: number;
  following_count?: number;
  created_at?: string;
  signals?: SignalItem[];
  reviews?: ReviewItem[];
  checkins?: CheckinItem[];
}

interface Props {
  userId: string;
  preview?: { title: string; subtitle?: string; image?: string };
  onClose: () => void;
}

const SIGNAL_EMOJI: Record<string, string> = { presence: '📍', intent: '🔍', offer: '🏷', event: '🎉', update: '📣', proof: '🛡' };
const SIGNAL_COLOR: Record<string, string> = { presence: '#3B82F6', intent: '#a78bfa', offer: '#fbbf24', event: '#f87171', update: '#00d4ff', proof: '#f0f4ff' };

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

// Max items visible for guests before the blur gate
const GUEST_PHOTO_LIMIT = 2;
const GUEST_ACTIVITY_LIMIT = 2;

export default function UserSheet({ userId, preview, onClose }: Props) {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [photoViewer, setPhotoViewer] = useState<string | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const { followingUserIds, follow, unfollow } = useFollow();
  const storeAuthed = useAuthStore((s) => s.isAuthed);
  const hasCookie = typeof document !== 'undefined' && document.cookie.includes('gao_logged_in=1');
  const isAuthed = storeAuthed || hasCookie;
  const isFollowing = isAuthed && followingUserIds.has(userId);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') || '' : '';
    fetch(`/api/v1/users/${userId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => { if (data.data) setUser(data.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  const toggleFollow = async () => {
    if (!isAuthed) { setShowAuth(true); return; }
    if (isFollowing) {
      await unfollow({ user_id: userId });
      setUser(prev => prev ? { ...prev, followers_count: Math.max(0, (prev.followers_count ?? 1) - 1) } : prev);
      toast.info('Unfollowed');
    } else {
      await follow({ user_id: userId });
      setUser(prev => prev ? { ...prev, followers_count: (prev.followers_count ?? 0) + 1 } : prev);
      toast.success('Following!');
    }
  };

  const displayName = user?.display_name || preview?.title || 'User';
  const avatar = user?.avatar_url || preview?.image;
  const username = user?.username;
  const bio = user?.bio || preview?.subtitle;

  const trustColors: Record<string, string> = { new: '#6b7280', verified: '#3b82f6', trusted: '#22c55e', highly_trusted: '#eab308' };
  const trustColor = trustColors[user?.trust_level || 'new'] || '#6b7280';

  const photos = user?.photos?.filter(Boolean) || [];
  const signals = user?.signals || [];
  const reviews = user?.reviews || [];
  const checkins = user?.checkins || [];
  const allActivity = [
    ...signals.map((s, i) => ({ key: `s-${s.id || i}`, type: 'signal' as const, data: s, time: s.created_at })),
    ...reviews.map((r, i) => ({ key: `r-${r.id || i}`, type: 'review' as const, data: r, time: r.created_at })),
    ...checkins.map((c, i) => ({ key: `c-${c.id || i}`, type: 'checkin' as const, data: c, time: c.created_at })),
  ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  const hasActivity = allActivity.length > 0;

  // Guest limits
  const visiblePhotos = isAuthed ? photos : photos.slice(0, GUEST_PHOTO_LIMIT);
  const hiddenPhotoCount = isAuthed ? 0 : Math.max(0, photos.length - GUEST_PHOTO_LIMIT);
  const visibleActivity = isAuthed ? allActivity : allActivity.slice(0, GUEST_ACTIVITY_LIMIT);
  const hiddenActivityCount = isAuthed ? 0 : Math.max(0, allActivity.length - GUEST_ACTIVITY_LIMIT);

  return (
    <>
    <AnimatePresence>
      <motion.div
        key="user-sheet"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-end justify-center lg:items-center"
        style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 280 }}
          className="w-full max-w-[440px] max-h-[85dvh] rounded-t-3xl lg:rounded-3xl flex flex-col overflow-hidden"
          style={{
            background: 'rgba(10,11,15,0.97)',
            border: '1px solid rgba(59,130,246,0.1)',
            boxShadow: '0 -8px 60px rgba(0,0,0,0.6), 0 0 30px rgba(59,130,246,0.06)',
          }}
        >
          {/* Header */}
          <div className="relative px-5 pt-5 pb-4 shrink-0">
            <div className="absolute inset-x-0 top-0 h-24 pointer-events-none rounded-t-3xl" style={{ background: 'linear-gradient(180deg, rgba(59,130,246,0.08) 0%, transparent 100%)' }} />

            <button onClick={onClose} className="absolute top-4 right-4 z-10 flex h-8 w-8 items-center justify-center rounded-lg text-[#4a5068] hover:text-white transition-colors cursor-pointer" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <X size={16} />
            </button>

            {loading && !preview ? (
              <div className="flex justify-center py-8">
                <Loader2 size={24} className="animate-spin text-[#00d4ff]" />
              </div>
            ) : (
              <div className="relative flex items-start gap-4">
                {avatar ? (
                  <img src={avatar} alt="" className="h-16 w-16 rounded-2xl object-cover shrink-0" style={{ border: `2px solid ${trustColor}`, boxShadow: `0 0 16px ${trustColor}33` }} />
                ) : (
                  <div className="h-16 w-16 rounded-2xl flex items-center justify-center text-2xl font-bold shrink-0" style={{ background: 'linear-gradient(135deg, #3B82F6, #00d4ff)', color: 'white' }}>
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                )}

                <div className="flex-1 min-w-0 pt-1">
                  <h2 className="text-lg font-bold text-white truncate">{displayName}</h2>
                  {username && <p className="text-sm text-[#3B82F6] font-medium">@{username}</p>}
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    {user?.city && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(0,212,255,0.1)', color: '#00d4ff' }}>
                        <MapPin size={10} /> {user.city}
                      </span>
                    )}
                    {user?.trust_level && user.trust_level !== 'new' && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize" style={{ background: `${trustColor}15`, color: trustColor }}>
                        {user.trust_level}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-4" style={{ scrollbarWidth: 'none' }}>
            {/* Bio */}
            {bio && <p className="text-sm text-[#a3adc3] leading-relaxed">{bio}</p>}

            {/* Stats */}
            {user && (
              <div className="flex gap-4">
                <div className="text-center">
                  <p className="text-sm font-bold text-white">{user.followers_count ?? 0}</p>
                  <p className="text-[10px] text-[#4a5068]">Followers</p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-white">{user.following_count ?? 0}</p>
                  <p className="text-[10px] text-[#4a5068]">Following</p>
                </div>
                {user.trust_score != null && user.trust_score > 0 && (
                  <div className="text-center">
                    <p className="text-sm font-bold text-white">{user.trust_score}</p>
                    <p className="text-[10px] text-[#4a5068]">Trust</p>
                  </div>
                )}
              </div>
            )}

            {/* Photos gallery */}
            {photos.length > 0 && (
              <div>
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#4a5068] mb-2">Photos</h3>
                <div className="relative">
                  <div className="grid grid-cols-4 gap-1.5">
                    {visiblePhotos.slice(0, 8).map((photo, i) => (
                      <button key={i} onClick={() => isAuthed ? setPhotoViewer(photo) : setShowAuth(true)} className="aspect-square rounded-xl overflow-hidden cursor-pointer hover:opacity-80 transition-opacity">
                        <img src={photo} alt="" className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                  {/* Blur gate for guest photos */}
                  {hiddenPhotoCount > 0 && (
                    <button
                      onClick={() => setShowAuth(true)}
                      className="mt-2 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl cursor-pointer transition-all hover:bg-white/[0.04]"
                      style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.12)' }}
                    >
                      <Eye size={13} className="text-[#3B82F6]" />
                      <span className="text-[11px] font-semibold text-[#3B82F6]">Sign in to see {hiddenPhotoCount} more photo{hiddenPhotoCount > 1 ? 's' : ''}</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Activity section */}
            {hasActivity && (
              <div>
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#4a5068] mb-2">Activity</h3>
                <div className="space-y-2">
                  {visibleActivity.map(item => {
                    if (item.type === 'signal') {
                      const s = item.data as SignalItem;
                      return (
                        <div key={item.key} className="flex items-start gap-2.5 rounded-xl px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                          <span className="text-base mt-0.5">{SIGNAL_EMOJI[s.type] || '📣'}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full capitalize" style={{ background: `${SIGNAL_COLOR[s.type] || '#3B82F6'}15`, color: SIGNAL_COLOR[s.type] || '#3B82F6' }}>
                                {s.type}
                              </span>
                              {s.category && <span className="text-[9px] text-[#4a5068]">{s.category}</span>}
                            </div>
                            <p className="text-[12px] font-medium text-[#e0e4ec] mt-1 truncate">{s.title}</p>
                          </div>
                          <span className="text-[9px] text-[#4a5068] shrink-0 mt-1">{timeAgo(s.created_at)}</span>
                        </div>
                      );
                    }
                    if (item.type === 'review') {
                      const r = item.data as ReviewItem;
                      return (
                        <div key={item.key} className="flex items-start gap-2.5 rounded-xl px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                          <div className="shrink-0 mt-0.5">
                            {r.business_avatar ? (
                              <img src={r.business_avatar} alt="" className="h-7 w-7 rounded-lg object-cover" />
                            ) : (
                              <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(234,179,8,0.1)' }}>
                                <PenLine size={12} className="text-[#eab308]" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-0.5">
                                {Array.from({ length: 5 }).map((_, i) => (
                                  <Star key={i} size={9} fill={i < r.rating ? '#eab308' : 'transparent'} className={i < r.rating ? 'text-[#eab308]' : 'text-[#2d3548]'} />
                                ))}
                              </div>
                              {r.verified_visit && <span className="text-[8px] font-semibold text-[#22c55e]">Verified</span>}
                            </div>
                            {r.business_name && <p className="text-[10px] text-[#00d4ff] mt-0.5">{r.business_name}</p>}
                            {r.title && <p className="text-[12px] font-medium text-[#e0e4ec] mt-0.5 truncate">{r.title}</p>}
                            {r.body && <p className="text-[11px] text-[#6b7a94] mt-0.5 line-clamp-2">{r.body}</p>}
                          </div>
                          <span className="text-[9px] text-[#4a5068] shrink-0 mt-1">{timeAgo(r.created_at)}</span>
                        </div>
                      );
                    }
                    // checkin
                    const c = item.data as CheckinItem;
                    return (
                      <div key={item.key} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                        <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(52,211,153,0.1)' }}>
                          <MapPinCheck size={13} className="text-[#34d399]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-medium text-[#e0e4ec] truncate">
                            Checked in{c.target_name ? ` at ${c.target_name}` : ''}
                          </p>
                          <p className="text-[10px] text-[#4a5068] capitalize">{c.target_type}</p>
                        </div>
                        <span className="text-[9px] text-[#4a5068] shrink-0">{timeAgo(c.created_at)}</span>
                      </div>
                    );
                  })}
                </div>

                {/* "Follow to see more" gate */}
                {hiddenActivityCount > 0 && (
                  <div className="relative mt-2">
                    {/* Blurred preview of next item */}
                    {allActivity[GUEST_ACTIVITY_LIMIT] && (
                      <div className="rounded-xl px-3 py-2.5 select-none pointer-events-none" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', filter: 'blur(6px)', opacity: 0.5 }}>
                        <div className="flex items-center gap-2.5">
                          <div className="h-7 w-7 rounded-lg bg-white/5" />
                          <div className="flex-1 space-y-1.5">
                            <div className="h-2.5 w-16 rounded bg-white/5" />
                            <div className="h-3 w-40 rounded bg-white/5" />
                          </div>
                        </div>
                      </div>
                    )}
                    {/* CTA overlay */}
                    <button
                      onClick={() => isAuthed ? toggleFollow() : setShowAuth(true)}
                      className="absolute inset-0 flex items-center justify-center gap-2 rounded-xl cursor-pointer transition-all hover:bg-white/[0.02]"
                    >
                      <div className="flex items-center gap-2 px-4 py-2.5 rounded-full" style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)' }}>
                        {isAuthed ? (
                          <>
                            <UserPlus size={13} className="text-[#3B82F6]" />
                            <span className="text-[11px] font-semibold text-[#3B82F6]">Follow to see {hiddenActivityCount} more</span>
                          </>
                        ) : (
                          <>
                            <Lock size={12} className="text-[#3B82F6]" />
                            <span className="text-[11px] font-semibold text-[#3B82F6]">Sign in to see {hiddenActivityCount} more</span>
                          </>
                        )}
                      </div>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Loading */}
            {loading && (
              <div className="flex justify-center py-3">
                <Loader2 size={16} className="animate-spin text-[#2d3548]" />
              </div>
            )}
          </div>

          {/* Footer CTA */}
          <div className="shrink-0 px-5 pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+16px)] lg:pb-4 flex gap-2" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <button
              onClick={toggleFollow}
              className="rounded-xl py-3 px-5 text-sm font-semibold flex items-center gap-2 cursor-pointer transition-all"
              style={isFollowing ? { background: 'rgba(52,211,153,0.12)', color: '#34d399' } : { background: 'rgba(0,212,255,0.1)', color: '#00d4ff' }}
            >
              {isFollowing ? <><UserCheck size={15} /> Following</> : <><UserPlus size={15} /> Follow</>}
            </button>
            <button
              onClick={() => isAuthed ? setShowChat(true) : setShowAuth(true)}
              className="btn-primary flex-1 rounded-xl py-3 text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer"
            >
              {isAuthed ? (
                <><MessageCircle size={15} /> Message</>
              ) : (
                <><Lock size={14} /> Sign in to message</>
              )}
            </button>
          </div>
        </motion.div>

        {/* Photo viewer overlay */}
        {photoViewer && (
          <motion.div
            key="photo-viewer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-center justify-center p-6"
            style={{ background: 'rgba(0,0,0,0.9)' }}
            onClick={() => setPhotoViewer(null)}
          >
            <button onClick={() => setPhotoViewer(null)} className="absolute top-6 right-6 flex h-10 w-10 items-center justify-center rounded-full text-white/60 hover:text-white transition-colors cursor-pointer" style={{ background: 'rgba(255,255,255,0.1)' }}>
              <X size={20} />
            </button>
            <img src={photoViewer} alt="" className="max-w-full max-h-full rounded-2xl object-contain" />
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>

    {/* Auth popup — outside AnimatePresence */}
    <AuthPopup open={showAuth} onClose={() => setShowAuth(false)} />

    {/* Private chat — outside AnimatePresence */}
    {showChat && (
      <PrivateChat
        roomId={`dm_${[useAuthStore.getState().user?.id, userId].sort().join('_')}`}
        title={displayName}
        subtitle={username ? `@${username}` : 'Direct message'}
        avatar={avatar}
        onClose={() => setShowChat(false)}
      />
    )}
    </>
  );
}
