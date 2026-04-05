'use client';

import { X, MessageCircle, UserMinus, UserPlus, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import PrivateChat from '@/components/chat/PrivateChat';
import { useAuthStore } from '@/stores/auth-store';

interface UserData {
  id: string;
  display_name?: string;
  username?: string;
  avatar_url?: string;
  bio?: string;
  photos?: string[];
  city?: string;
}

interface Props {
  user: UserData;
  isFollowing: boolean;
  isFriend?: boolean;
  onFollow: () => void;
  onUnfollow: () => void;
  onClose: () => void;
}

export default function UserProfileSheet({ user: u, isFollowing, isFriend, onFollow, onUnfollow, onClose }: Props) {
  const [showChat, setShowChat] = useState(false);
  const [fullUser, setFullUser] = useState(u);

  // Fetch full user data (bio, photos) if not provided
  useEffect(() => {
    if (u.bio || (u.photos && u.photos.length > 0)) return;
    fetch(`/api/v1/users/${u.id}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('access_token') || ''}` },
    })
      .then(r => r.json())
      .then(d => { if (d.data) setFullUser(prev => ({ ...prev, bio: d.data.bio, photos: d.data.photos, city: d.data.city })); })
      .catch(() => {});
  }, [u.id, u.bio, u.photos]);

  const photos = fullUser.photos || [];

  return (
    <>
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-end justify-center lg:items-center"
        style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
        onClick={(ev) => ev.target === ev.currentTarget && onClose()}
      >
        <motion.div
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 280 }}
          className="w-full max-w-[480px] max-h-[85dvh] rounded-t-3xl lg:rounded-3xl flex flex-col overflow-hidden"
          style={{ background: '#0a0b0f', border: '1px solid rgba(0,212,255,0.08)' }}
        >
          {/* Header */}
          <div className="relative shrink-0 px-5 pt-5 pb-4">
            <div className="absolute inset-x-0 top-0 h-24 opacity-40 rounded-t-3xl" style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.2), rgba(0,212,255,0.1))' }} />
            <button onClick={onClose} className="absolute top-4 right-4 z-10 h-8 w-8 rounded-lg flex items-center justify-center cursor-pointer" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <X size={16} className="text-[#4a5068]" />
            </button>

            <div className="relative flex flex-col items-center text-center">
              <div className="h-20 w-20 rounded-full flex items-center justify-center overflow-hidden mb-3" style={{ background: '#111318', border: '3px solid rgba(0,212,255,0.2)' }}>
                {fullUser.avatar_url
                  ? <img src={fullUser.avatar_url} alt="" className="h-full w-full object-cover" />
                  : <span className="text-2xl font-bold" style={{ color: '#00d4ff' }}>{(u.display_name || '?').charAt(0).toUpperCase()}</span>
                }
              </div>
              <h2 className="text-lg font-bold text-white">{fullUser.display_name || 'User'}</h2>
              {fullUser.username && <p className="text-xs text-[#4a5068] mt-0.5">@{fullUser.username}</p>}
              {isFriend && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-0.5 rounded-full mt-1.5" style={{ background: 'rgba(52,211,153,0.15)', color: '#34d399' }}>
                  ✓ Friend
                </span>
              )}
              {fullUser.city && (
                <p className="flex items-center gap-1 text-[10px] text-[#a3adc3] mt-1">
                  <MapPin size={10} /> {fullUser.city}
                </p>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-4">
            {/* Bio */}
            {fullUser.bio && (
              <div>
                <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[#4a5068] mb-1.5">About</h3>
                <p className="text-sm text-[#a3adc3] leading-relaxed">{fullUser.bio}</p>
              </div>
            )}

            {/* Photos */}
            {photos.length > 0 && (
              <div>
                <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[#4a5068] mb-2">Photos</h3>
                <div className="grid grid-cols-2 gap-2">
                  {photos.map((url, i) => (
                    <div key={i} className="aspect-square rounded-xl overflow-hidden">
                      <img src={url} alt="" className="h-full w-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="shrink-0 px-5 pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+16px)] lg:pb-4 flex gap-2" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <button
              onClick={() => setShowChat(true)}
              className="flex-1 rounded-xl py-3 text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer"
              style={{ background: '#00d4ff', color: '#0a0b0f' }}
            >
              <MessageCircle size={15} /> Chat
            </button>
            <button
              onClick={() => {
                if (isFollowing) { onUnfollow(); toast('Unfollowed'); }
                else { onFollow(); toast.success('Following!'); }
              }}
              className="rounded-xl py-3 px-5 text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer"
              style={isFriend
                ? { background: 'rgba(52,211,153,0.15)', color: '#34d399', border: '1px solid rgba(52,211,153,0.2)' }
                : isFollowing
                ? { background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.15)' }
                : { background: 'rgba(0,212,255,0.1)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.2)' }
              }
            >
              {isFriend ? <>✓ Friends</> : isFollowing ? <><UserMinus size={14} /> Unfollow</> : <><UserPlus size={14} /> Follow</>}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>

    {showChat && (
      <PrivateChat
        roomId={`dm_${[useAuthStore.getState().user?.id, u.id].sort().join('_')}`}
        title={fullUser.display_name || 'User'}
        subtitle="Direct message"
        onClose={() => setShowChat(false)}
      />
    )}
    </>
  );
}
