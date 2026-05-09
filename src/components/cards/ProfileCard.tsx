'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Briefcase, X, GraduationCap, Globe, MapPin, Clock, Languages as LangIcon, ExternalLink, DollarSign, Bookmark } from 'lucide-react';
import { toast } from 'sonner';
import type { Profile } from '@/types';
import AuthPopup from '@/components/ui/AuthPopup';

interface ProfileCardProps {
  profile: Profile;
}

function parseJsonField<T>(val: unknown): T[] {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') { try { const p = JSON.parse(val); return Array.isArray(p) ? p : []; } catch { return []; } }
  return [];
}

export default function ProfileCard({ profile }: ProfileCardProps) {
  const [showDetail, setShowDetail] = useState(false);
  const [showAuth, setShowAuth] = useState(false);

  const handleContact = () => {
    const loggedIn = typeof document !== 'undefined' && document.cookie.includes('gao_logged_in=1');
    if (!loggedIn) { setShowAuth(true); return; }
    // TODO: wire to private chat with profile.user_id once contact UX exists.
    toast.success('Contact request sent');
  };

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
        <button
          onClick={() => setShowDetail(true)}
          className="flex-1 rounded-lg border border-[#00d4ff]/40 py-1.5 text-xs font-medium text-[#00d4ff] transition-colors hover:bg-[#00d4ff]/10 cursor-pointer"
        >
          View Profile
        </button>
        <button
          onClick={handleContact}
          className="flex-1 rounded-lg bg-[#00d4ff] py-1.5 text-xs font-medium text-[#0a0b0f] transition-colors hover:bg-[#00d4ff]/80 cursor-pointer"
        >
          Contact
        </button>
      </div>

      {/* Detail sheet — shows full bio, experience, education, languages */}
      <AnimatePresence>
        {showDetail && (
          <ProfileDetailSheet
            profile={profile}
            skills={skills}
            languages={languages}
            experience={experience}
            onContact={() => { setShowDetail(false); handleContact(); }}
            onClose={() => setShowDetail(false)}
          />
        )}
      </AnimatePresence>

      {/* Auth gate — opens when a guest taps Contact */}
      <AuthPopup open={showAuth} onClose={() => setShowAuth(false)} />
    </div>
  );
}

function formatSalary(range?: { min: number; max: number; currency: string }): string | null {
  if (!range) return null;
  const fmt = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
    if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
    return String(n);
  };
  const cur = range.currency?.toUpperCase() || 'USD';
  const symbol = cur === 'USD' ? '$' : cur === 'VND' ? '₫' : `${cur} `;
  return `${symbol}${fmt(range.min)}–${symbol}${fmt(range.max)}`;
}

function ProfileDetailSheet({
  profile,
  skills,
  languages,
  experience,
  onContact,
  onClose,
}: {
  profile: Profile;
  skills: string[];
  languages: string[];
  experience: Array<{ start_year: number; title?: string; company?: string; end_year?: number | null; description?: string }>;
  onContact: () => void;
  onClose: () => void;
}) {
  const education = parseJsonField<{ degree: string; school: string; year: number }>(profile.education);
  const yearsExp = experience.length > 0
    ? new Date().getFullYear() - Math.min(...experience.map((e) => e.start_year))
    : 0;
  const salary = formatSalary(profile.salary_range);
  const initial = profile.headline.charAt(0).toUpperCase();
  const [saved, setSaved] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
    >
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 20, opacity: 0 }}
        className="w-full max-w-md max-h-[90vh] overflow-hidden rounded-3xl flex flex-col"
        style={{ background: '#0a0b0f', border: '1px solid rgba(255,255,255,0.06)' }}
      >
        {/* Hero header */}
        <div className="relative px-5 pt-5 pb-4" style={{ background: 'linear-gradient(180deg, rgba(0,212,255,0.06) 0%, transparent 100%)' }}>
          <button onClick={onClose} className="absolute top-4 right-4 z-10 flex h-8 w-8 items-center justify-center rounded-full cursor-pointer text-[#4a5068] hover:text-white" style={{ background: 'rgba(10,11,15,0.6)' }}>
            <X size={16} />
          </button>

          <div className="flex items-start gap-4 pr-10">
            {/* Avatar */}
            <div
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-2xl font-bold"
              style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.5), rgba(0,212,255,0.3))', color: '#fff' }}
            >
              {initial}
            </div>

            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold text-[#f0f4ff] leading-tight">{profile.headline}</h2>
              <p className="mt-1 text-xs font-medium" style={{ color: '#00d4ff' }}>{profile.industry}</p>

              {/* Pills */}
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {profile.city && (
                  <span className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium" style={{ background: 'rgba(0,212,255,0.1)', color: '#00d4ff' }}>
                    <MapPin size={10} /> {profile.city}
                  </span>
                )}
                {profile.available && (
                  <span className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium bg-[#22C55E]/15 text-[#22C55E]">
                    <CheckCircle size={10} /> Open to Work
                  </span>
                )}
                <span className="inline-flex items-center rounded-full px-2 py-1 text-[10px] font-medium capitalize text-[#a3adc3]" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  {profile.work_type}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {profile.bio && (
            <p className="text-sm text-[#a3adc3] leading-relaxed mb-5">{profile.bio}</p>
          )}

          {/* 3 stat cards */}
          <div className="grid grid-cols-3 gap-2 mb-5">
            <Stat icon={<Clock size={14} />} value={yearsExp > 0 ? `${yearsExp} yrs` : '—'} label="Experience" />
            <Stat icon={<MapPin size={14} />} value={profile.city || '—'} label="Location" />
            <Stat icon={<LangIcon size={14} />} value={languages.length > 0 ? String(languages.length) : '—'} label="Languages" />
          </div>

          {/* Salary */}
          {salary && (
            <Section title="Salary expectation">
              <div className="flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)' }}>
                <DollarSign size={16} className="text-[#22C55E]" />
                <span className="text-sm font-semibold text-[#22C55E]">{salary}</span>
                <span className="text-xs text-[#4a5068]">/year</span>
              </div>
            </Section>
          )}

          {skills.length > 0 && (
            <Section title="Skills">
              <div className="flex flex-wrap gap-1.5">
                {skills.map((s) => (
                  <span key={s} className="rounded-md px-2 py-1 text-xs font-medium" style={{ background: 'rgba(0,212,255,0.1)', color: '#00d4ff' }}>{s}</span>
                ))}
              </div>
            </Section>
          )}

          {experience.length > 0 && (
            <Section title="Experience">
              <ul className="space-y-3">
                {experience.map((e, i) => (
                  <li key={i} className="relative pl-4">
                    <span className={`absolute left-0 top-1.5 h-2 w-2 rounded-full ${i === 0 ? 'bg-[#00d4ff]' : 'border border-[#00d4ff]/40'}`} />
                    <p className="text-sm font-semibold text-[#f0f4ff]">{e.title}</p>
                    {e.company && <p className="text-xs text-[#a3adc3]">{e.company}</p>}
                    <p className="text-[11px] text-[#4a5068] mt-0.5">{e.start_year} — {e.end_year ?? 'Present'}</p>
                    {e.description && <p className="text-xs text-[#a3adc3] mt-1 leading-relaxed">{e.description}</p>}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {education.length > 0 && (
            <Section title="Education">
              <ul className="space-y-2.5">
                {education.map((e, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <GraduationCap size={14} className="mt-0.5 text-[#00d4ff] shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-[#f0f4ff]">{e.degree}</p>
                      <p className="text-xs text-[#4a5068]">{e.school} · {e.year}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {languages.length > 0 && (
            <Section title="Languages">
              <div className="flex flex-wrap gap-1.5">
                {languages.map((l) => (
                  <span key={l} className="rounded-md px-2 py-1 text-xs font-medium" style={{ background: 'rgba(168,85,247,0.12)', color: '#c084fc' }}>{l}</span>
                ))}
              </div>
            </Section>
          )}

          {profile.portfolio_url && (
            <a href={profile.portfolio_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-[#00d4ff] hover:underline mb-2">
              <ExternalLink size={12} /> {profile.portfolio_url.replace(/^https?:\/\//, '')}
            </a>
          )}
        </div>

        {/* Bottom action bar */}
        <div className="flex items-center gap-2 px-5 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <button
            onClick={onContact}
            className="flex-1 rounded-xl py-3 text-sm font-bold cursor-pointer transition-colors"
            style={{ background: 'rgba(0,212,255,0.12)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.3)' }}
          >
            Contact
          </button>
          <button
            onClick={() => { setSaved((s) => !s); toast.success(saved ? 'Removed from saved' : 'Saved'); }}
            aria-label="Save profile"
            className="flex h-12 w-12 items-center justify-center rounded-xl cursor-pointer transition-colors"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <Bookmark size={16} className={saved ? 'fill-[#00d4ff] text-[#00d4ff]' : 'text-[#a3adc3]'} />
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-5">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#4a5068] mb-2.5">{title}</h3>
      {children}
    </section>
  );
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="rounded-xl px-2 py-3 text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
      <div className="flex justify-center text-[#00d4ff] mb-1">{icon}</div>
      <p className="text-sm font-bold text-[#f0f4ff] truncate">{value}</p>
      <p className="text-[10px] text-[#4a5068]">{label}</p>
    </div>
  );
}
