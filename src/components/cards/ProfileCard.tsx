'use client';

import { MapPin, CheckCircle, Briefcase } from 'lucide-react';
import type { Profile } from '@/types';

interface ProfileCardProps {
  profile: Profile;
}

function parseJsonField<T>(val: unknown): T[] {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') { try { const p = JSON.parse(val); return Array.isArray(p) ? p : []; } catch { return []; } }
  return [];
}

export default function ProfileCard({ profile }: ProfileCardProps) {
  const skills = parseJsonField<string>(profile.skills);
  const languages = parseJsonField<string>(profile.languages);
  const experience = parseJsonField<{ start_year: number; title?: string; company?: string }>(profile.experience);
  const yearsExp = experience.length > 0
    ? new Date().getFullYear() - Math.min(...experience.map((e) => e.start_year))
    : 0;
  const latestRole = experience[0];

  return (
    <div className="rounded-xl border border-[#181c24]/30 bg-[#111318]/60 p-4">
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg font-bold"
          style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.3), rgba(0,212,255,0.2))', color: '#3B82F6' }}
        >
          {profile.headline.charAt(0).toUpperCase()}
        </div>

        <div className="min-w-0 flex-1">
          {/* Title */}
          <div className="flex items-center justify-between">
            <h3 className="truncate text-sm font-semibold text-[#f0f4ff]">{profile.headline}</h3>
            {profile.available && (
              <span className="ml-2 shrink-0 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-[#22C55E]/15 text-[#22C55E]">
                <CheckCircle size={10} /> Available
              </span>
            )}
          </div>

          {/* Industry + city */}
          <p className="mt-0.5 text-xs text-[#4a5068] capitalize">
            {profile.industry}
            {profile.city ? ` · ${profile.city}` : ''}
          </p>

          {/* Latest role */}
          {latestRole && (
            <p className="mt-1 flex items-center gap-1 text-xs text-[#a3adc3]">
              <Briefcase size={11} className="shrink-0" />
              {latestRole.title} @ {latestRole.company}
            </p>
          )}

          {/* Skills preview */}
          {skills?.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {skills.slice(0, 4).map((skill) => (
                <span
                  key={skill}
                  className="rounded px-1.5 py-0.5 text-[10px] font-medium"
                  style={{ background: 'rgba(0,212,255,0.08)', color: '#00d4ff' }}
                >
                  {skill}
                </span>
              ))}
              {skills.length > 4 && (
                <span className="text-[10px] text-[#4a5068]">+{skills.length - 4}</span>
              )}
            </div>
          )}

          {/* Meta */}
          <div className="mt-2 flex items-center gap-3 text-[10px] text-[#4a5068]">
            {yearsExp > 0 && <span>{yearsExp} yrs exp</span>}
            <span className="capitalize">{profile.work_type}</span>
            {languages?.length > 0 && <span>{languages.join(', ')}</span>}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-3 flex gap-2">
        <button className="flex-1 rounded-lg border border-[#00d4ff]/40 py-1.5 text-xs font-medium text-[#00d4ff] transition-colors hover:bg-[#00d4ff]/10 cursor-pointer">
          View Profile
        </button>
        <button className="flex-1 rounded-lg bg-[#00d4ff] py-1.5 text-xs font-medium text-[#0a0b0f] transition-colors hover:bg-[#00d4ff]/80 cursor-pointer">
          Contact
        </button>
      </div>
    </div>
  );
}
