'use client';

import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { ArrowLeft, Loader2, Users, MessageCircle } from 'lucide-react';
import { useState } from 'react';
import UserProfileSheet from '@/components/profiles/UserProfileSheet';
import { useFollow } from '@/hooks/useFollow';

const fetcher = (url: string) => fetch(url, {
  headers: { Authorization: `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('access_token') || '' : ''}` },
}).then(r => r.json());

export default function FollowersPage() {
  const router = useRouter();
  const { data, isLoading } = useSWR('/api/v1/follows?type=followers', fetcher);
  const followers = (data?.data || []) as Record<string, unknown>[];
  const { followingUserIds, isFriend, follow, unfollow, refresh } = useFollow();
  const [selectedUser, setSelectedUser] = useState<Record<string, unknown> | null>(null);

  return (
    <div className="h-full overflow-y-auto">
      <div className="sticky top-0 z-10 flex items-center gap-3 px-4 lg:px-8 py-3" style={{ background: 'rgba(10,11,15,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-[#a3adc3] cursor-pointer"><ArrowLeft size={18} /> Back</button>
        <h1 className="text-sm font-bold text-white">Followers</h1>
        <span className="ml-auto text-[11px] text-[#4a5068]">{followers.length} follower{followers.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="max-w-lg lg:max-w-3xl mx-auto px-4 lg:px-8 py-4 pb-24">
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[#00d4ff]" /></div>
        ) : followers.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <Users size={32} className="text-[#4a5068]" />
            <p className="text-sm text-[#4a5068]">No followers yet</p>
            <p className="text-xs text-[#4a5068]">Create signals and engage to grow your network</p>
          </div>
        ) : (
          <div className="space-y-2">
            {followers.map((f) => {
              const fUserId = (f.follower_id || f.id) as string;
              const isFollowingBack = followingUserIds.has(fUserId);
              return (
                <div
                  key={f.id as string}
                  className="flex items-center gap-3 rounded-2xl px-4 py-3 cursor-pointer transition-colors hover:bg-white/[0.02]"
                  style={{ background: 'rgba(17,19,24,0.5)', border: '1px solid rgba(255,255,255,0.04)' }}
                  onClick={() => setSelectedUser(f)}
                >
                  <div className="h-11 w-11 rounded-full flex items-center justify-center text-sm font-bold shrink-0 overflow-hidden" style={{ background: 'linear-gradient(135deg, #a78bfa, #00d4ff)', color: 'white' }}>
                    {(f.avatar_url as string)
                      ? <img src={f.avatar_url as string} alt="" className="h-full w-full object-cover" />
                      : ((f.display_name as string) || '?').charAt(0).toUpperCase()
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{(f.display_name as string) || 'User'}</p>
                    {f.username && <p className="text-[10px] text-[#4a5068]">@{f.username as string}</p>}
                    {f.bio && <p className="text-[10px] text-[#a3adc3] truncate mt-0.5">{f.bio as string}</p>}
                  </div>
                  <div className="flex gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => setSelectedUser(f)}
                      className="h-8 w-8 rounded-lg flex items-center justify-center cursor-pointer"
                      style={{ background: 'rgba(0,212,255,0.1)', color: '#00d4ff' }}
                    >
                      <MessageCircle size={14} />
                    </button>
                    {!isFollowingBack && (
                      <button
                        onClick={async () => { await follow({ user_id: fUserId }); refresh(); }}
                        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-semibold cursor-pointer"
                        style={{ background: 'rgba(0,212,255,0.1)', color: '#00d4ff' }}
                      >
                        Follow back
                      </button>
                    )}
                    {isFollowingBack && (
                      <span className="text-[10px] text-[#34d399] font-semibold px-2 py-1.5">Following</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedUser && (
        <UserProfileSheet
          user={{
            id: (selectedUser.follower_id || selectedUser.id) as string,
            display_name: selectedUser.display_name as string,
            username: selectedUser.username as string,
            avatar_url: selectedUser.avatar_url as string,
            bio: selectedUser.bio as string,
            photos: selectedUser.photos as string[],
          }}
          isFollowing={followingUserIds.has((selectedUser.follower_id || selectedUser.id) as string)}
          isFriend={isFriend((selectedUser.follower_id || selectedUser.id) as string)}
          onFollow={() => { follow({ user_id: (selectedUser.follower_id || selectedUser.id) as string }); refresh(); }}
          onUnfollow={() => { unfollow({ user_id: (selectedUser.follower_id || selectedUser.id) as string }); refresh(); }}
          onClose={() => setSelectedUser(null)}
        />
      )}
    </div>
  );
}
