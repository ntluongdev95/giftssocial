'use client';

import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { ArrowLeft, Loader2, UserCheck, UserMinus, MessageCircle, Store, Search, Users, Heart } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';
import UserSheet from '@/components/map/UserSheet';
import PrivateChat from '@/components/chat/PrivateChat';
import { useAuthStore } from '@/stores/auth-store';
import { useFollow } from '@/hooks/useFollow';

const fetcher = (url: string) => fetch(url, {
  
}).then(r => r.json());

export default function FollowingPage() {
  const router = useRouter();
  const { data, isLoading, mutate } = useSWR('/api/v1/follows?type=following', fetcher);
  const follows = (data?.data || []) as Record<string, unknown>[];
  const { follow, unfollow, isFriend } = useFollow();
  const [selectedUser, setSelectedUser] = useState<Record<string, unknown> | null>(null);
  const [chatUser, setChatUser] = useState<Record<string, unknown> | null>(null);
  const myUserId = useAuthStore(s => s.user?.id);
  const [search, setSearch] = useState('');

  const userFollows = follows.filter(f => f.following_user_id);
  const bizFollows = follows.filter(f => f.following_business_id);
  const friendCount = userFollows.filter(f => isFriend(f.following_user_id as string)).length;

  const filteredUsers = search
    ? userFollows.filter(f => ((f.user_name as string) || '').toLowerCase().includes(search.toLowerCase()))
    : userFollows;
  const filteredBiz = search
    ? bizFollows.filter(f => ((f.biz_name as string) || '').toLowerCase().includes(search.toLowerCase()))
    : bizFollows;

  const handleUnfollowUser = async (targetId: string) => {
    await unfollow({ user_id: targetId });
    toast.success('Unfollowed');
    mutate();
  };

  const handleUnfollowBiz = async (targetId: string) => {
    await unfollow({ business_id: targetId });
    toast.success('Unfollowed');
    mutate();
  };

  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 pt-[calc(env(safe-area-inset-top,44px)+8px)] pb-3 px-5" style={{ background: 'rgba(10,11,15,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="h-8 w-8 rounded-full flex items-center justify-center cursor-pointer" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <ArrowLeft size={16} className="text-[#a3adc3]" />
          </button>
          <div className="flex-1">
            <h1 className="text-[15px] font-bold text-white">Following</h1>
            <p className="text-[10px] text-[#4a5068]">{follows.length} total</p>
          </div>
        </div>

        {/* Stats */}
        {!isLoading && follows.length > 0 && (
          <div className="flex gap-2 mt-3">
            <StatPill icon={<Users size={11} />} value={userFollows.length} label="People" color="#3b82f6" />
            <StatPill icon={<Store size={11} />} value={bizFollows.length} label="Businesses" color="#22c55e" />
            <StatPill icon={<Heart size={11} />} value={friendCount} label="Friends" color="#a78bfa" />
          </div>
        )}

        {/* Search */}
        {follows.length > 5 && (
          <div className="mt-3 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4a5068]" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search following..."
              className="w-full rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-[#4a5068] outline-none"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
            />
          </div>
        )}
      </div>

      <div className="max-w-lg lg:max-w-3xl mx-auto px-4 lg:px-8 py-4 pb-24">
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[#00d4ff]" /></div>
        ) : follows.length === 0 ? (
          <EmptyState icon={<UserCheck size={36} />} title="Not following anyone yet" sub="Discover people and businesses nearby" action={() => router.push('/nearby')} actionLabel="Explore" />
        ) : (
          <>
            {/* Business follows */}
            {filteredBiz.length > 0 && (
              <Section icon={<Store size={12} className="text-[#22c55e]" />} title="Businesses" count={filteredBiz.length}>
                {filteredBiz.map((f) => (
                  <Card
                    key={f.id as string}
                    avatar={<div className="h-12 w-12 rounded-2xl flex items-center justify-center text-base font-bold shrink-0" style={{ background: 'linear-gradient(135deg, #22C55E, #10b981)', color: 'white' }}>{((f.biz_name as string) || 'B').charAt(0).toUpperCase()}</div>}
                    name={(f.biz_name as string) || 'Business'}
                    sub={f.biz_category as string}
                    badge={<span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e' }}>Business</span>}
                    onClick={() => router.push(`/businesses/${f.following_business_id}`)}
                    actions={
                      <button onClick={(e) => { e.stopPropagation(); handleUnfollowBiz(f.following_business_id as string); }} className="flex items-center gap-1 rounded-xl px-3 py-2 text-[10px] font-semibold cursor-pointer transition-colors" style={{ background: 'rgba(239,68,68,0.06)', color: '#f87171', border: '1px solid rgba(239,68,68,0.1)' }}>
                        <UserMinus size={11} /> Unfollow
                      </button>
                    }
                  />
                ))}
              </Section>
            )}

            {/* User follows */}
            {filteredUsers.length > 0 && (
              <Section icon={<UserCheck size={12} className="text-[#3b82f6]" />} title="People" count={filteredUsers.length}>
                {filteredUsers.map((f) => {
                  const mutual = isFriend(f.following_user_id as string);
                  return (
                    <Card
                      key={f.id as string}
                      avatar={
                        <div className="relative">
                          <div className="h-12 w-12 rounded-2xl flex items-center justify-center text-sm font-bold shrink-0 overflow-hidden" style={{ background: 'linear-gradient(135deg, #3B82F6, #00d4ff)', color: 'white' }}>
                            {(f.user_avatar as string)
                              ? <img src={f.user_avatar as string} alt="" className="h-full w-full object-cover rounded-2xl" />
                              : ((f.user_name as string) || '?').charAt(0).toUpperCase()
                            }
                          </div>
                          {mutual && <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-[#0a0b0f] flex items-center justify-center"><Heart size={9} className="text-[#a78bfa]" fill="#a78bfa" /></div>}
                        </div>
                      }
                      name={(f.user_name as string) || 'User'}
                      sub={f.user_username ? `@${f.user_username as string}` : (f.user_bio as string) || ''}
                      badge={mutual ? <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(167,139,250,0.12)', color: '#a78bfa' }}>Friend</span> : undefined}
                      onClick={() => setSelectedUser(f)}
                      actions={
                        <div className="flex gap-1.5" onClick={e => e.stopPropagation()}>
                          <button onClick={() => setChatUser(f)} className="h-9 w-9 rounded-xl flex items-center justify-center cursor-pointer" style={{ background: 'rgba(0,212,255,0.08)', color: '#00d4ff' }}>
                            <MessageCircle size={14} />
                          </button>
                          <button onClick={() => handleUnfollowUser(f.following_user_id as string)} className="flex items-center gap-1 rounded-xl px-3 py-2 text-[10px] font-semibold cursor-pointer" style={{ background: 'rgba(239,68,68,0.06)', color: '#f87171', border: '1px solid rgba(239,68,68,0.1)' }}>
                            <UserMinus size={11} /> Unfollow
                          </button>
                        </div>
                      }
                    />
                  );
                })}
              </Section>
            )}

            {search && filteredUsers.length === 0 && filteredBiz.length === 0 && (
              <p className="text-center text-sm text-[#4a5068] py-8">No results for &ldquo;{search}&rdquo;</p>
            )}
          </>
        )}
      </div>

      {selectedUser && (
        <UserSheet
          userId={(selectedUser.following_user_id || selectedUser.id) as string}
          preview={{
            title: (selectedUser.user_name || selectedUser.display_name || 'User') as string,
            subtitle: selectedUser.user_username ? `@${selectedUser.user_username as string}` : undefined,
            image: (selectedUser.user_avatar || selectedUser.avatar_url) as string,
          }}
          onClose={() => setSelectedUser(null)}
        />
      )}

      {chatUser && (
        <PrivateChat
          roomId={`dm_${[myUserId, (chatUser.following_user_id || chatUser.id) as string].sort().join('_')}`}
          title={(chatUser.user_name || chatUser.display_name || 'User') as string}
          subtitle={chatUser.user_username ? `@${chatUser.user_username as string}` : 'Direct message'}
          avatar={(chatUser.user_avatar || chatUser.avatar_url) as string}
          onClose={() => setChatUser(null)}
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

function Section({ icon, title, count, children }: { icon: React.ReactNode; title: string; count: number; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-2.5 px-1">
        {icon}
        <span className="text-[10px] font-semibold text-[#4a5068] uppercase tracking-wider">{title}</span>
        <span className="text-[10px] text-[#4a5068]">· {count}</span>
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Card({ avatar, name, sub, badge, onClick, actions }: { avatar: React.ReactNode; name: string; sub?: string; badge?: React.ReactNode; onClick: () => void; actions: React.ReactNode }) {
  return (
    <div onClick={onClick} className="flex items-center gap-3.5 rounded-2xl px-4 py-3.5 cursor-pointer transition-all hover:bg-white/[0.03] active:scale-[0.99]" style={{ background: 'rgba(17,19,24,0.4)', border: '1px solid rgba(255,255,255,0.04)' }}>
      {avatar}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-[13px] font-semibold text-white truncate">{name}</p>
          {badge}
        </div>
        {sub && <p className="text-[10px] text-[#4a5068] truncate mt-0.5">{sub}</p>}
      </div>
      {actions}
    </div>
  );
}

function EmptyState({ icon, title, sub, action, actionLabel }: { icon: React.ReactNode; title: string; sub: string; action: () => void; actionLabel: string }) {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <div className="h-16 w-16 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <span className="text-[#4a5068]">{icon}</span>
      </div>
      <div>
        <p className="text-sm font-semibold text-[#8892a8]">{title}</p>
        <p className="text-xs text-[#4a5068] mt-1">{sub}</p>
      </div>
      <button onClick={action} className="text-xs font-semibold px-5 py-2 rounded-xl cursor-pointer" style={{ background: 'rgba(0,212,255,0.1)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.2)' }}>
        {actionLabel}
      </button>
    </div>
  );
}
