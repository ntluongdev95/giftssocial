'use client';

import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { PushPermissionButton } from './PushPermissionButton';

type Props = {
  enabled: boolean;
  time: string;          // 'HH:MM'
  timezone: string;      // IANA tz
  onChangeEnabled: (enabled: boolean) => void;
  onChangeTime: (time: string) => void;
  onChangeTimezone: (tz: string) => void;
};

/** Composer section for daily reminders. Auto-detects timezone from the
 *  browser; the user can override but we don't surface a TZ picker — most
 *  users never need it. */
export function ReminderSection({
  enabled,
  time,
  timezone,
  onChangeEnabled,
  onChangeTime,
  onChangeTimezone,
}: Props) {
  // Pre-fill timezone from the browser on first mount.
  useEffect(() => {
    if (!timezone) {
      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (tz) onChangeTimezone(tz);
      } catch {
        onChangeTimezone('UTC');
      }
    }
    // Intentionally empty deps — we only auto-fill once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [tzEdit, setTzEdit] = useState(false);

  return (
    <div className="space-y-2.5">
      <button
        onClick={() => onChangeEnabled(!enabled)}
        className="w-full flex items-center gap-2 rounded-xl px-3 py-3 cursor-pointer"
        style={
          enabled
            ? { background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.25)' }
            : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }
        }
      >
        <Clock size={16} className={enabled ? 'text-[#00d4ff]' : 'text-[#4a5068]'} />
        <span className="flex-1 text-left text-sm font-medium text-white">
          Daily reminder
        </span>
        <Toggle on={enabled} />
      </button>

      {enabled && (
        <>
          <div className="flex items-center gap-2 rounded-xl px-3 py-2.5"
            style={{ background: 'rgba(17,19,24,0.8)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <label className="text-[10px] text-[#a3adc3] shrink-0">Remind at</label>
            <input
              type="time"
              value={time}
              onChange={e => onChangeTime(e.target.value)}
              className="flex-1 bg-transparent text-sm text-white outline-none [color-scheme:dark]"
            />
            <button
              onClick={() => setTzEdit(v => !v)}
              className="text-[10px] text-[#00d4ff] cursor-pointer"
              type="button"
            >
              {timezone || 'set timezone'}
            </button>
          </div>

          {tzEdit && (
            <input
              value={timezone}
              onChange={e => onChangeTimezone(e.target.value)}
              placeholder="Asia/Ho_Chi_Minh"
              className="w-full rounded-xl px-3 py-2 text-xs text-white outline-none placeholder:text-[#4a5068]"
              style={{ background: 'rgba(17,19,24,0.8)', border: '1px solid rgba(255,255,255,0.07)' }}
            />
          )}

          {/* Web Push opt-in — required for OS-level popups, otherwise
              reminders only show in-app on /notifications. */}
          <PushPermissionButton />
        </>
      )}
    </div>
  );
}

function Toggle({ on }: { on: boolean }) {
  return (
    <span
      className="inline-block h-5 w-9 rounded-full relative shrink-0"
      style={{
        background: on ? 'rgba(0,212,255,0.3)' : 'rgba(255,255,255,0.08)',
        border: on ? '1px solid rgba(0,212,255,0.5)' : '1px solid rgba(255,255,255,0.1)',
      }}
    >
      <span
        className="absolute top-0.5 h-3.5 w-3.5 rounded-full transition-all"
        style={{
          left: on ? 18 : 2,
          background: on ? '#00d4ff' : '#a3adc3',
        }}
      />
    </span>
  );
}
