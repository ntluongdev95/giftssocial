'use client';

import { createPortal } from 'react-dom';
import { X, Eye, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { parseUTC } from '@/lib/date';
import { useStoryViewers } from '@/hooks/useStories';

type Props = {
  storyId: string | null;
  open: boolean;
  onClose: () => void;
};

/** Author-only sheet listing who has viewed the story. Same modal pattern
 * as StoryComposer: bottom sheet on mobile, centered modal on desktop. */
export function StoryViewersSheet({ storyId, open, onClose }: Props) {
  const { items, count, isLoading, error } = useStoryViewers(open ? storyId : null);

  if (!open || !storyId) return null;
  // Portal to document.body so the sheet stays above any parent's stacking
  // context (matches StoryViewer / StoryComposer behaviour).
  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-350 flex items-end justify-center lg:items-center lg:p-6"
        style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      >
        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 30, stiffness: 280 }}
          onClick={e => e.stopPropagation()}
          className="w-full lg:w-auto lg:max-w-md lg:min-w-95 max-h-[80vh] overflow-y-auto rounded-t-3xl lg:rounded-3xl flex flex-col"
          style={{
            background: '#0a0b0f',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 20px 60px -10px rgba(0,0,0,0.6)',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between p-4 sticky top-0"
            style={{ background: '#0a0b0f', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
          >
            <div className="flex items-center gap-2 text-white">
              <Eye size={16} className="text-[#00d4ff]" />
              <span className="text-sm font-semibold">
                Viewers · {count}
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-full cursor-pointer hover:bg-white/10"
            >
              <X size={18} className="text-white" />
            </button>
          </div>

          {/* Body */}
          <div className="px-2 py-2 min-h-30">
            {isLoading && (
              <div className="flex items-center justify-center py-8 text-[#4a5068]">
                <Loader2 size={18} className="animate-spin text-[#00d4ff]" />
              </div>
            )}

            {error && !isLoading && (
              <div className="px-4 py-6 text-center text-xs text-[#fca5a5]">
                Couldn&apos;t load viewers.
              </div>
            )}

            {!isLoading && !error && items.length === 0 && (
              <div className="px-4 py-10 text-center">
                <Eye size={24} className="mx-auto mb-2 text-[#2d3548]" />
                <p className="text-sm font-medium text-[#a3adc3] mb-1">No views yet</p>
                <p className="text-[10px] text-[#4a5068]">
                  When friends watch your story, they&apos;ll appear here.
                </p>
              </div>
            )}

            {!isLoading && !error && items.length > 0 && (
              <ul>
                {items.map(v => {
                  const ago = (() => {
                    const d = parseUTC(v.viewed_at);
                    return d ? formatDistanceToNow(d, { addSuffix: true }) : '';
                  })();
                  return (
                    <li
                      key={v.id}
                      className="flex items-center gap-3 px-2 py-2.5 rounded-xl"
                    >
                      {v.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={v.avatar}
                          alt=""
                          className="h-10 w-10 rounded-full object-cover shrink-0"
                        />
                      ) : (
                        <div
                          className="h-10 w-10 rounded-full flex items-center justify-center text-sm font-medium text-[#a3adc3] shrink-0"
                          style={{ background: 'rgba(255,255,255,0.05)' }}
                        >
                          {(v.name || '?').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-white truncate">
                          {v.name}
                        </div>
                        {v.username && (
                          <div className="text-[10px] text-[#4a5068] truncate">
                            @{v.username}
                          </div>
                        )}
                      </div>
                      <div className="text-[10px] text-[#4a5068] shrink-0">{ago}</div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}
