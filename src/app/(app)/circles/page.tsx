'use client';

import { useState } from 'react';
import { Search, Plus, TrendingUp, Users } from 'lucide-react';
import CircleCard from '@/components/cards/CircleCard';
import CircleDetailSheet from '@/components/circles/CircleDetailSheet';
import type { Circle } from '@/types';

const SEED_CIRCLES: Circle[] = [
  {
    id: 'circle_1', name: 'Dallas Foodies', slug: 'dallas-foodies', category: 'Food',
    city: 'Dallas', owner_id: 'user_system', visibility: 'public', verification_level: 1,
    trust_score: 72, trust_level: 'trusted', badges: ['active_community'],
    member_count: 184, event_count: 12, status: 'active', created_at: '', updated_at: '',
  },
  {
    id: 'circle_2', name: 'DFW Tech Builders', slug: 'dfw-tech-builders', category: 'Tech',
    city: 'Dallas', owner_id: 'user_system', visibility: 'public', verification_level: 1,
    trust_score: 65, trust_level: 'trusted', badges: [],
    member_count: 97, event_count: 5, status: 'active', created_at: '', updated_at: '',
  },
  {
    id: 'circle_3', name: 'Beauty & Wellness DFW', slug: 'beauty-wellness-dfw', category: 'Beauty',
    city: 'Dallas', owner_id: 'user_system', visibility: 'public', verification_level: 0,
    trust_score: 48, trust_level: 'verified', badges: [],
    member_count: 63, event_count: 3, status: 'active', created_at: '', updated_at: '',
  },
  {
    id: 'circle_4', name: 'DFW Fitness Crew', slug: 'dfw-fitness-crew', category: 'Fitness',
    city: 'Dallas', owner_id: 'user_system', visibility: 'public', verification_level: 0,
    trust_score: 55, trust_level: 'verified', badges: [],
    member_count: 41, event_count: 2, status: 'active', created_at: '', updated_at: '',
  },
  {
    id: 'circle_5', name: 'Crypto Dallas', slug: 'crypto-dallas', category: 'Crypto',
    city: 'Dallas', owner_id: 'user_system', visibility: 'public', verification_level: 1,
    trust_score: 70, trust_level: 'trusted', badges: ['active_community'],
    member_count: 128, event_count: 8, status: 'active', created_at: '', updated_at: '',
  },
];

const CATEGORIES = ['All', 'Food', 'Tech', 'Beauty', 'Fitness', 'Crypto'] as const;

export default function CirclesPage() {
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCircle, setSelectedCircle] = useState<Circle | null>(null);

  const filtered = SEED_CIRCLES.filter((c) => {
    if (activeCategory !== 'All' && c.category !== activeCategory) return false;
    if (searchQuery && !c.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="h-full overflow-y-auto relative">
      {/* Aurora */}
      <div className="aurora-gradient absolute inset-x-0 top-0 h-56 pointer-events-none" />

      {/* Header */}
      <div className="relative px-4 lg:px-8 pt-[env(safe-area-inset-top,12px)] lg:pt-6 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Circles</h1>
            <p className="mt-0.5 text-sm" style={{ color: '#4a5068' }}>
              Communities, groups, and builder rooms
            </p>
          </div>
          <button
            className="flex h-10 w-10 items-center justify-center rounded-xl transition-colors"
            style={{ background: 'rgba(0,212,255,0.1)', color: '#00d4ff' }}
          >
            <Plus size={18} />
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#4a5068' }} />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search circles..."
            className="w-full rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-[#2d3548] outline-none transition-all focus:ring-1"
            style={{
              background: 'rgba(17,19,24,0.6)',
              border: '1px solid rgba(255,255,255,0.05)',
            }}
          />
        </div>

        {/* Category filters */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className="shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all"
              style={activeCategory === cat ? {
                background: 'linear-gradient(135deg, rgba(0,212,255,0.2), rgba(99,102,241,0.15))',
                border: '1px solid rgba(0,212,255,0.3)',
                color: '#00d4ff',
              } : {
                background: 'rgba(24,28,36,0.5)',
                border: '1px solid rgba(255,255,255,0.04)',
                color: '#4a5068',
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Stats summary */}
      <div className="relative flex gap-3 px-4 lg:px-8 mb-4">
        <div
          className="flex flex-1 items-center gap-2.5 rounded-xl px-3.5 py-2.5"
          style={{ background: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.1)' }}
        >
          <Users size={14} style={{ color: '#00d4ff' }} />
          <div>
            <p className="text-xs font-semibold text-white">{SEED_CIRCLES.reduce((s, c) => s + c.member_count, 0)}</p>
            <p className="text-[10px]" style={{ color: '#4a5068' }}>Total members</p>
          </div>
        </div>
        <div
          className="flex flex-1 items-center gap-2.5 rounded-xl px-3.5 py-2.5"
          style={{ background: 'rgba(52,211,153,0.05)', border: '1px solid rgba(52,211,153,0.1)' }}
        >
          <TrendingUp size={14} style={{ color: '#34d399' }} />
          <div>
            <p className="text-xs font-semibold text-white">{SEED_CIRCLES.length}</p>
            <p className="text-[10px]" style={{ color: '#4a5068' }}>Active circles</p>
          </div>
        </div>
      </div>

      {/* Circle cards — grid on desktop */}
      <div className="relative px-4 lg:px-8 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.length > 0 ? (
            filtered.map((circle) => (
              <CircleCard key={circle.id} circle={circle} onClick={() => setSelectedCircle(circle)} />
            ))
          ) : (
            <div className="col-span-full flex flex-col items-center gap-3 py-12 text-center">
              <p className="text-sm" style={{ color: '#4a5068' }}>No circles found</p>
              <button
                onClick={() => { setActiveCategory('All'); setSearchQuery(''); }}
                className="text-xs font-medium"
                style={{ color: '#00d4ff' }}
              >
                Clear filters
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Circle detail sheet */}
      {selectedCircle && (
        <CircleDetailSheet
          circle={selectedCircle}
          onClose={() => setSelectedCircle(null)}
        />
      )}
    </div>
  );
}
