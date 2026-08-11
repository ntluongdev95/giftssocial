'use client';

import { useMemo } from 'react';
import { addDays, isScheduledDay, localDateKey, parseSchedule } from '@/lib/streaks';

type Props = {
  ticks: string[];                // dates the user has ticked
  scheduleJson?: string | null;   // raw schedule_json from server
  scheduleDays?: number[];        // OR explicit weekday array
  days?: number;                  // window length (default 84 = 12 weeks)
  todayKey?: string;
  showLabels?: boolean;
};

const DAY_LABELS = ['Mon', 'Wed', 'Fri'];

/** GitHub-style heatmap: 12 weeks × 7 days, columns are weeks (oldest left),
 * rows are weekdays (Mon top, Sun bottom). Ticked days are cyan; scheduled
 * but missed days are dim red; off-schedule days are blank. */
export function StreakHeatmap({
  ticks,
  scheduleJson,
  scheduleDays,
  days = 84,
  todayKey,
  showLabels = true,
}: Props) {
  const today = todayKey || localDateKey();
  const tickSet = useMemo(() => new Set(ticks), [ticks]);
  const schedule = useMemo(
    () =>
      scheduleDays
        ? new Set(scheduleDays)
        : parseSchedule(scheduleJson ?? '[0,1,2,3,4,5,6]'),
    [scheduleDays, scheduleJson],
  );

  // Align to Monday — find Monday of the week containing `today - days + 1`.
  const startKey = addDays(today, -(days - 1));
  const startDate = new Date(`${startKey}T00:00:00`);
  const startWeekday = startDate.getDay(); // 0=Sun
  const mondayOffset = (startWeekday + 6) % 7; // Mon=0..Sun=6
  const gridStart = addDays(startKey, -mondayOffset);

  // 13 weeks × 7 days = 91 cells; we render however many cells fit until today.
  const cells: Array<{ date: string; scheduled: boolean; ticked: boolean; future: boolean }> = [];
  let cursor = gridStart;
  for (let i = 0; i < 91; i++) {
    const isFuture = cursor > today;
    cells.push({
      date: cursor,
      scheduled: isScheduledDay(cursor, schedule),
      ticked: tickSet.has(cursor),
      future: isFuture,
    });
    cursor = addDays(cursor, 1);
  }

  // Reshape into columns (weeks) × 7 rows (Mon..Sun)
  const weeks: typeof cells[] = [];
  for (let w = 0; w < cells.length / 7; w++) {
    weeks.push(cells.slice(w * 7, w * 7 + 7));
  }

  return (
    <div className="flex items-start gap-1.5">
      {showLabels && (
        <div className="flex flex-col gap-0.5 mr-1 pt-0.5">
          {[0, 1, 2, 3, 4, 5, 6].map(idx => (
            <div
              key={idx}
              className="h-3 text-[9px] text-[#4a5068]"
              style={{ lineHeight: '12px' }}
            >
              {idx === 0 ? DAY_LABELS[0] : idx === 2 ? DAY_LABELS[1] : idx === 4 ? DAY_LABELS[2] : ''}
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-0.5">
        {weeks.map((wk, wi) => (
          <div key={wi} className="flex flex-col gap-0.5">
            {wk.map((c, ri) => {
              let bg = 'rgba(255,255,255,0.04)'; // off-schedule
              let title = c.date;
              if (c.future) {
                bg = 'transparent';
                title = '';
              } else if (c.ticked) {
                bg = '#00d4ff';
                title = `${c.date} · ✓`;
              } else if (c.scheduled) {
                bg = 'rgba(248,113,113,0.18)'; // missed scheduled day
                title = `${c.date} · missed`;
              } else {
                title = `${c.date} · off`;
              }
              const isToday = c.date === today;
              return (
                <div
                  key={ri}
                  className="h-3 w-3 rounded-[3px]"
                  title={title}
                  style={{
                    background: bg,
                    outline: isToday ? '1px solid rgba(0,212,255,0.7)' : undefined,
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
