'use client';

import { useMemo, useState } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { useStoriesRail, type StoryDTO } from '@/hooks/useStories';
import { StoryViewer } from './StoryViewer';

type Props = {
  onOpenComposer: () => void;
  myUserId?: string | null;
};

/** Horizontal avatar rail. The leading button opens the composer; each
 * avatar opens the fullscreen viewer focused on that author's stories.
 *
 * Visual: cyan ring = active story, amber ring = expires < 4h. Matches
 * the SearchOverlay tab colour palette so it feels native to /world. */
export function StoriesRail({ onOpenComposer, myUserId }: Props) {
  const { stories, isLoading, refresh } = useStoriesRail();
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  // Author-grouped + sorted: own → unseen others → seen others. Within each
  // bucket, the most recent group is leftmost. Stories within a group are
  // chronological so the viewer plays them oldest → newest like IG.
  const grouped = useMemo(
    () => sortGroups(groupByAuthor(stories), myUserId ?? null),
    [stories, myUserId],
  );

  return (
    <div className="px-3 lg:px-4 pt-2">
      <div
        className="flex gap-3 overflow-x-auto pb-2"
        style={{ scrollbarWidth: 'none' }}
      >
        {/* Compose button — always first */}
        <button
          onClick={onOpenComposer}
          className="flex flex-col items-center gap-1 shrink-0 cursor-pointer"
          aria-label="Post a new story"
        >
          <div
            className="relative h-14 w-14 rounded-full flex items-center justify-center"
            style={{
              background: 'rgba(0,212,255,0.08)',
              border: '1.5px dashed rgba(0,212,255,0.4)',
            }}
          >
            <Plus size={20} className="text-[#00d4ff]" />
          </div>
          <span className="text-[10px] text-[#a3adc3]">Now</span>
        </button>

        {/* Loading skeleton */}
        {isLoading && stories.length === 0 && (
          <div className="flex items-center px-4 text-[#4a5068]">
            <Loader2 size={14} className="animate-spin" />
          </div>
        )}

        {/* Author rings */}
        {grouped.map(([authorId, group], i) => {
          const head = group[0];
          const isMine = authorId === myUserId;
          // Group is "seen" when EVERY story in it has been viewed. Own
          // stories never go to the seen state — the rail acts as a
          // "your story" reminder for the author.
          const allSeen =
            !isMine && group.length > 0 && group.every(s => s.viewed_by_me === 1);
          // Snapshot "now" once per render — re-renders pick up freshness
          // naturally as the SWR feed refreshes. Acceptable impurity for a
          // visual cue that doesn't drive any state.
          // eslint-disable-next-line react-hooks/purity
          const nowMs = Date.now();
          const expiresSoon =
            !allSeen &&
            new Date(head.expires_at).getTime() - nowMs < 4 * 3600 * 1000;

          // Ring: gray gradient when seen, amber when expiring, cyan otherwise.
          const ringStyle = allSeen
            ? { background: 'linear-gradient(135deg, #3a4153, #2d3548)' }
            : expiresSoon
              ? { background: 'linear-gradient(135deg, #fbbf24, #a855f7)' }
              : { background: 'linear-gradient(135deg, #00d4ff, #a855f7)' };

          return (
            <button
              key={authorId}
              onClick={() => setOpenIdx(i)}
              className="flex flex-col items-center gap-1 shrink-0 cursor-pointer"
            >
              <div
                className="h-14 w-14 rounded-full flex items-center justify-center"
                style={{
                  padding: 2,
                  ...ringStyle,
                }}
              >
                <div
                  className="h-full w-full rounded-full overflow-hidden bg-[#1a1d27] flex items-center justify-center"
                  style={{ border: '2px solid #0a0b0f' }}
                >
                  {head.author_avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={head.author_avatar}
                      alt={head.author_name || ''}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-xs text-[#a3adc3]">
                      {(head.author_name || head.author_username || '?').charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
              </div>
              <span className="text-[10px] text-white max-w-15 truncate">
                {isMine ? 'You' : head.author_name || head.author_username || 'User'}
              </span>
            </button>
          );
        })}
      </div>

      {/* Viewer overlay */}
      {openIdx != null && (
        <StoryViewer
          groups={grouped.map(([, g]) => g)}
          startGroupIdx={openIdx}
          myUserId={myUserId ?? null}
          onClose={() => {
            setOpenIdx(null);
            // Re-pull rail so newly-viewed stories transition to the
            // gray "seen" ring immediately.
            refresh();
          }}
        />
      )}
    </div>
  );
}

function groupByAuthor(list: StoryDTO[]): Array<[string, StoryDTO[]]> {
  const map = new Map<string, StoryDTO[]>();
  for (const s of list) {
    const arr = map.get(s.author_id);
    if (arr) arr.push(s);
    else map.set(s.author_id, [s]);
  }
  // Chronological inside each group → viewer plays oldest → newest.
  for (const arr of map.values()) {
    arr.sort((a, b) => a.posted_at.localeCompare(b.posted_at));
  }
  return Array.from(map.entries());
}

// IG-style ordering: own → unseen → seen. Within each bucket, the author
// whose newest story is most recent wins.
function sortGroups(
  groups: Array<[string, StoryDTO[]]>,
  myUserId: string | null,
): Array<[string, StoryDTO[]]> {
  const rank = (entry: [string, StoryDTO[]]): number => {
    const [authorId, stories] = entry;
    if (authorId === myUserId) return 0;
    const allSeen = stories.length > 0 && stories.every(s => s.viewed_by_me === 1);
    return allSeen ? 2 : 1;
  };
  const latestAt = (stories: StoryDTO[]): string =>
    stories.reduce((acc, s) => (s.posted_at > acc ? s.posted_at : acc), '');
  return [...groups].sort((a, b) => {
    const r = rank(a) - rank(b);
    if (r !== 0) return r;
    return latestAt(b[1]).localeCompare(latestAt(a[1]));
  });
}
