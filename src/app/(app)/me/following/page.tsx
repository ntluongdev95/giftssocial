'use client';

import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { ArrowLeft, Loader2, UserCheck, UserMinus, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';
import UserProfileSheet from '@/components/profiles/UserProfileSheet';
import { useFollow } from '@/hooks/useFollow';

const fetcher = (url: string) => fetch(url, {
  headers: { Authorization: `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('access_token') || '' : ''}` },
}).then(r => r.json());

export default function FollowingPage() {
  const router = useRouter();
  const { data, isLoading, mutate } = useSWR('/api/v1/follows?type=following', fetcher);
  const follows = (data?.data || []) as Record<string, unknown>[];
  const { follow, unfollow, isFriend } = useFollow();
  const [selectedUser, setSelectedUser] = useState<Record<string, unknown> | null>(null);

  const handleUnfollow = async (targetId: string) => {
    await unfollow({ user_id: targetId });
    toast.success('Unfollowed');
    mutate();
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="sticky top-0 z-10 flex items-center gap-3 px-4 lg:px-8 py-3" style={{ background: 'rgba(10,11,15,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-[#a3adc3] cursor-pointer"><ArrowLeft size={18} /> Back</button>
        <h1 className="text-sm font-bold text-white">Following</h1>
        <span className="ml-auto text-[11px] text-[#4a5068]">{follows.length} following</span>
      </div>

      <div className="max-w-lg lg:max-w-3xl mx-auto px-4 lg:px-8 py-4 pb-24">
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[#00d4ff]" /></div>
        ) : follows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <UserCheck size={32} className="text-[#4a5068]" />
            <p className="text-sm text-[#4a5068]">Not following anyone yet</p>
            <button onClick={() => router.push('/nearby')} className="text-xs font-semibold text-[#00d4ff] cursor-pointer">Discover people nearby</button>
          </div>
        ) : (
          <div className="space-y-2">
            {follows.map((f) => (
              <div
                key={f.id as string}
                className="flex items-center gap-3 rounded-2xl px-4 py-3 cursor-pointer transition-colors hover:bg-white/[0.02]"
                style={{ background: 'rgba(17,19,24,0.5)', border: '1px solid rgba(255,255,255,0.04)' }}
                onClick={() => setSelectedUser(f)}
              >
                <div className="h-11 w-11 rounded-full flex items-center justify-center text-sm font-bold shrink-0 overflow-hidden" style={{ background: 'linear-gradient(135deg, #3B82F6, #00d4ff)', color: 'white' }}>
                  {(f.user_avatar as string)
                    ? <img src={f.user_avatar as string} alt="" className="h-full w-full object-cover" />
                    : ((f.user_name as string) || '?').charAt(0).toUpperCase()
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{(f.user_name as string) || 'User'}</p>
                  {f.user_username && <p className="text-[10px] text-[#4a5068]">@{f.user_username as string}</p>}
                  {f.user_bio && <p className="text-[10px] text-[#a3adc3] truncate mt-0.5">{f.user_bio as string}</p>}
                </div>
                <div className="flex gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => setSelectedUser(f)}
                    className="h-8 w-8 rounded-lg flex items-center justify-center cursor-pointer"
                    style={{ background: 'rgba(0,212,255,0.1)', color: '#00d4ff' }}
                  >
                    <MessageCircle size={14} />
                  </button>
                  <button
                    onClick={() => handleUnfollow(f.following_user_id as string)}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-semibold cursor-pointer"
                    style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171' }}
                  >
                    <UserMinus size={11} /> Unfollow
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedUser && (
        <UserProfileSheet
          user={{
            id: (selectedUser.following_user_id || selectedUser.id) as string,
            display_name: (selectedUser.user_name || selectedUser.display_name) as string,
            username: (selectedUser.user_username || selectedUser.username) as string,
            avatar_url: (selectedUser.user_avatar || selectedUser.avatar_url) as string,
            bio: (selectedUser.user_bio || selectedUser.bio) as string,
            photos: (selectedUser.user_photos || selectedUser.photos) as string[],
          }}
          isFollowing={true}
          isFriend={isFriend((selectedUser.following_user_id || selectedUser.id) as string)}
          onFollow={() => { follow({ user_id: (selectedUser.following_user_id || selectedUser.id) as string }); mutate(); }}
          onUnfollow={() => { handleUnfollow((selectedUser.following_user_id || selectedUser.id) as string); }}
          onClose={() => setSelectedUser(null)}
        />
      )}
    </div>
  );
}
