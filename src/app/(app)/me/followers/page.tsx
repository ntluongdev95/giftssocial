'use client';

import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { ArrowLeft, Loader2, Users, MessageCircle, UserPlus, Search, Heart } from 'lucide-react';
import { useState } from 'react';
import UserProfileSheet from '@/components/profiles/UserProfileSheet';
import { useFollow } from '@/hooks/useFollow';

const fetcher = (url: string) => fetch(url, {
  
}).then(r => r.json());

export default function FollowersPage() {
  const router = useRouter();
  const { data, isLoading } = useSWR('/api/v1/follows?type=followers', fetcher);
  const followers = (data?.data || []) as Record<string, unknown>[];
  const { followingUserIds, isFriend, follow, unfollow, refresh } = useFollow();
  const [selectedUser, setSelectedUser] = useState<Record<string, unknown> | null>(null);
  const [search, setSearch] = useState('');

  const friendCount = followers.filter(f => isFriend((f.follower_id || f.id) as string)).length;
  const notFollowingBack = followers.filter(f => !followingUserIds.has((f.follower_id || f.id) as string)).length;

  const filtered = search
    ? followers.filter(f => ((f.display_name as string) || '').toLowerCase().includes(search.toLowerCase()))
    : followers;

  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 pt-[calc(env(safe-area-inset-top,44px)+8px)] pb-3 px-5" style={{ background: 'rgba(10,11,15,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="h-8 w-8 rounded-full flex items-center justify-center cursor-pointer" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <ArrowLeft size={16} className="text-[#a3adc3]" />
          </button>
          <div className="flex-1">
            <h1 className="text-[15px] font-bold text-white">Followers</h1>
            <p className="text-[10px] text-[#4a5068]">{followers.length} follower{followers.length !== 1 ? 's' : ''}</p>
          </div>
        </div>

        {/* Stats */}
        {!isLoading && followers.length > 0 && (
          <div className="flex gap-2 mt-3">
            <StatPill icon={<Users size={11} />} value={followers.length} label="Total" color="#a78bfa" />
            <StatPill icon={<Heart size={11} />} value={friendCount} label="Mutual" color="#34d399" />
            {notFollowingBack > 0 && <StatPill icon={<UserPlus size={11} />} value={notFollowingBack} label="Follow back" color="#f59e0b" />}
          </div>
        )}

        {/* Search */}
        {followers.length > 5 && (
          <div className="mt-3 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4a5068]" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search followers..."
              className="w-full rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-[#4a5068] outline-none"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
            />
          </div>
        )}
      </div>

      <div className="max-w-lg lg:max-w-3xl mx-auto px-4 lg:px-8 py-4 pb-24">
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[#00d4ff]" /></div>
        ) : followers.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <div className="h-16 w-16 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <Users size={36} className="text-[#4a5068]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#8892a8]">No followers yet</p>
              <p className="text-xs text-[#4a5068] mt-1">Create signals and engage to grow your network</p>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            {filtered.map((f) => {
              const fUserId = (f.follower_id || f.id) as string;
              const isFollowingBack = followingUserIds.has(fUserId);
              const mutual = isFriend(fUserId);
              return (
                <div
                  key={f.id as string}
                  onClick={() => setSelectedUser(f)}
                  className="flex items-center gap-3.5 rounded-2xl px-4 py-3.5 cursor-pointer transition-all hover:bg-white/[0.03] active:scale-[0.99]"
                  style={{ background: 'rgba(17,19,24,0.4)', border: '1px solid rgba(255,255,255,0.04)' }}
                >
                  <div className="relative">
                    <div className="h-12 w-12 rounded-2xl flex items-center justify-center text-sm font-bold shrink-0 overflow-hidden" style={{ background: 'linear-gradient(135deg, #a78bfa, #00d4ff)', color: 'white' }}>
                      {(f.avatar_url as string)
                        ? <img src={f.avatar_url as string} alt="" className="h-full w-full object-cover rounded-2xl" />
                        : ((f.display_name as string) || '?').charAt(0).toUpperCase()
                      }
                    </div>
                    {mutual && <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-[#0a0b0f] flex items-center justify-center"><Heart size={9} className="text-[#34d399]" fill="#34d399" /></div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] font-semibold text-white truncate">{(f.display_name as string) || 'User'}</p>
                      {mutual && <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399' }}>Friend</span>}
                    </div>
                    {!!f.username && <p className="text-[10px] text-[#4a5068]">@{f.username as string}</p>}
                    {!!f.bio && <p className="text-[10px] text-[#a3adc3] truncate mt-0.5">{f.bio as string}</p>}
                  </div>
                  <div className="flex gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                    <button onClick={() => setSelectedUser(f)} className="h-9 w-9 rounded-xl flex items-center justify-center cursor-pointer" style={{ background: 'rgba(0,212,255,0.08)', color: '#00d4ff' }}>
                      <MessageCircle size={14} />
                    </button>
                    {!isFollowingBack ? (
                      <button
                        onClick={async () => { await follow({ user_id: fUserId }); refresh(); }}
                        className="flex items-center gap-1 rounded-xl px-3 py-2 text-[10px] font-semibold cursor-pointer"
                        style={{ background: 'rgba(0,212,255,0.1)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.2)' }}
                      >
                        <UserPlus size={11} /> Follow
                      </button>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] text-[#34d399] font-semibold px-2 py-2">
                        <Heart size={10} fill="#34d399" /> Mutual
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            {search && filtered.length === 0 && (
              <p className="text-center text-sm text-[#4a5068] py-8">No results for &ldquo;{search}&rdquo;</p>
            )}
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

function StatPill({ icon, value, label, color }: { icon: React.ReactNode; value: number; label: string; color: string }) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg" style={{ background: `${color}10`, border: `1px solid ${color}20` }}>
      <span style={{ color }}>{icon}</span>
      <span className="text-[11px] font-bold text-white">{value}</span>
      <span className="text-[9px] text-[#4a5068]">{label}</span>
    </div>
  );
}
