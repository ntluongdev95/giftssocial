'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { ArrowLeft, Hash, Loader2, Star, ShieldCheck, MapPin } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { parseUTC } from '@/lib/date';
import { HashtagText } from '@/components/HashtagText';

type TagDetail = {
  tag: { slug: string; display_name: string; description: string; use_count: number };
  items: ReviewItem[];
  next_cursor: string | null;
};

type ReviewItem = {
  type: 'review';
  id: string;
  author: { id: string; name: string; username: string; avatar: string | null };
  business: { id: string; name: string; city: string | null; cover: string | null } | null;
  event_id: string | null;
  rating: number;
  title: string;
  body: string;
  verified_visit: boolean;
  helpful_count: number;
  created_at: string;
  tagged_at: string;
};

const fetcher = (url: string) =>
  fetch(url).then(async r => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json() as Promise<{ data: TagDetail }>;
  });

// Pink/magenta accent for hashtags — matches SearchOverlay's tag color.
const TAG_COLOR = '#ec4899';

export default function TopicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const [cursor] = useState<string | null>(null);

  const url = `/api/v1/tags/${encodeURIComponent(slug)}?limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
  const { data, error, isLoading } = useSWR(url, fetcher);

  const tag = data?.data.tag;
  const items = data?.data.items ?? [];

  return (
    <div className="min-h-screen bg-[#0a0b0f] text-white">
      {/* Sticky dark header — matches /notifications & SearchOverlay */}
      <header
        className="sticky top-0 z-10"
        style={{
          background: 'rgba(10,11,15,0.95)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        <div className="flex items-center gap-3 px-4 lg:px-8 h-14 max-w-2xl lg:max-w-4xl mx-auto">
          <button
            onClick={() => router.push('/world')}
            className="flex items-center gap-2 text-sm text-[#a3adc3] cursor-pointer"
          >
            <ArrowLeft size={18} /> Back
          </button>
          <div className="flex items-center gap-1.5 min-w-0 ml-auto mr-auto" style={{ color: TAG_COLOR }}>
            <Hash size={16} className="shrink-0" />
            <span className="text-sm font-bold truncate">
              {tag?.display_name ?? slug}
            </span>
          </div>
          {/* Spacer to keep title visually centred */}
          <div className="w-[56px]" />
        </div>
      </header>

      <main className="max-w-2xl lg:max-w-4xl mx-auto px-4 lg:px-8 py-4 pb-24">
        {/* Hero card — dark with pink accent */}
        <section
          className="mb-4 rounded-2xl p-5"
          style={{
            background: `linear-gradient(135deg, ${TAG_COLOR}10, rgba(168,85,247,0.06))`,
            border: `1px solid ${TAG_COLOR}26`,
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="h-12 w-12 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: `${TAG_COLOR}1f`, border: `1px solid ${TAG_COLOR}33` }}
            >
              <Hash size={22} style={{ color: TAG_COLOR }} />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-bold text-white truncate">
                #{tag?.display_name ?? slug}
              </h1>
              <p className="text-xs text-[#8892a8] mt-0.5">
                {(tag?.use_count ?? 0).toLocaleString()} {(tag?.use_count ?? 0) === 1 ? 'post' : 'posts'}
              </p>
            </div>
          </div>
          {tag?.description ? (
            <p className="text-sm text-[#a3adc3] mt-3">{tag.description}</p>
          ) : null}
        </section>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-12 text-[#4a5068]">
            <Loader2 className="animate-spin text-[#00d4ff]" size={24} />
          </div>
        )}

        {/* Error */}
        {error && (
          <div
            className="rounded-xl p-4 text-sm"
            style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.2)', color: '#fca5a5' }}
          >
            Couldn&apos;t load this tag. {String(error.message ?? error)}
          </div>
        )}

        {/* Empty */}
        {!isLoading && !error && items.length === 0 && (
          <div
            className="rounded-2xl p-10 text-center"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}
          >
            <Hash size={32} className="mx-auto mb-3 text-[#2d3548]" />
            <p className="font-medium text-[#a3adc3] mb-1">No posts yet</p>
            <p className="text-xs text-[#4a5068]">
              Be the first to use #{tag?.display_name ?? slug}
            </p>
          </div>
        )}

        {/* Feed */}
        <ul className="space-y-3">
          {items.map(item => (
            <li
              key={item.id}
              className="rounded-2xl p-4"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
            >
              {/* Author row */}
              <div className="flex items-center gap-3 mb-2.5">
                {item.author.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.author.avatar}
                    alt={item.author.name}
                    className="w-9 h-9 rounded-full object-cover"
                  />
                ) : (
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium text-[#a3adc3]"
                    style={{ background: 'rgba(255,255,255,0.05)' }}
                  >
                    {(item.author.name || '?').charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-[13px] text-white truncate">
                      {item.author.name || item.author.username || 'User'}
                    </span>
                    {item.verified_visit && (
                      <ShieldCheck size={13} className="text-[#34d399] shrink-0" />
                    )}
                  </div>
                  <div className="text-[10px] text-[#4a5068]">
                    {(() => {
                      const d = parseUTC(item.created_at);
                      return d ? formatDistanceToNow(d, { addSuffix: true }) : '';
                    })()}
                  </div>
                </div>
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      size={13}
                      className={i < item.rating ? 'fill-amber-400 text-amber-400' : 'text-[#2d3548]'}
                    />
                  ))}
                </div>
              </div>

              {/* Title + body — hashtags become links */}
              {item.title && (
                <h3 className="font-semibold text-sm text-white mb-1">
                  <HashtagText
                    text={item.title}
                    tagClassName="text-[#ec4899] hover:underline cursor-pointer"
                  />
                </h3>
              )}
              {item.body && (
                <div className="text-sm text-[#a3adc3] mb-2 leading-relaxed">
                  <HashtagText
                    text={item.body}
                    tagClassName="text-[#ec4899] hover:underline cursor-pointer"
                  />
                </div>
              )}

              {/* Business card — dark variant */}
              {item.business && (
                <Link
                  href={`/businesses/${item.business.id}`}
                  className="flex items-center gap-2.5 mt-3 p-2.5 rounded-xl cursor-pointer transition-colors"
                  style={{ background: 'rgba(0,212,255,0.04)', border: '1px solid rgba(0,212,255,0.1)' }}
                >
                  {item.business.cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.business.cover}
                      alt={item.business.name}
                      className="w-10 h-10 rounded-lg object-cover shrink-0"
                    />
                  ) : (
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: 'rgba(0,212,255,0.1)' }}
                    >
                      <MapPin size={16} className="text-[#00d4ff]" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-white truncate">
                      {item.business.name}
                    </div>
                    {item.business.city && (
                      <div className="text-[10px] text-[#4a5068] truncate">{item.business.city}</div>
                    )}
                  </div>
                </Link>
              )}
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
