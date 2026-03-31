'use client';

import { X, MapPin, Clock, Briefcase, GraduationCap, Languages, ExternalLink, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import type { Profile } from '@/types';
import { useFollow } from '@/hooks/useFollow';

interface Props {
  profile: Profile;
  onClose: () => void;
}

export default function ProfileSheet({ profile: p, onClose }: Props) {
  const { followingUserIds, follow, unfollow } = useFollow();
  const isFollowing = followingUserIds.has(p.user_id);

  const toggleFollow = async () => {
    if (isFollowing) { await unfollow({ user_id: p.user_id }); toast.info('Unfollowed'); }
    else { await follow({ user_id: p.user_id }); toast.success('Following!'); }
  };
  const yearsExp = p.experience.length > 0
    ? new Date().getFullYear() - Math.min(...p.experience.map((e) => e.start_year))
    : 0;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-end justify-center lg:items-center"
        style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 280 }}
          className="w-full max-w-[520px] max-h-[90dvh] rounded-t-3xl lg:rounded-3xl flex flex-col overflow-hidden"
          style={{
            background: 'rgba(10,11,15,0.97)',
            border: '1px solid rgba(59,130,246,0.1)',
            boxShadow: '0 -8px 60px rgba(0,0,0,0.6), 0 0 30px rgba(59,130,246,0.06)',
          }}
        >
          {/* Header */}
          <div className="relative px-5 pt-5 pb-4">
            <div className="aurora-gradient absolute inset-x-0 top-0 h-32 pointer-events-none rounded-t-3xl" />

            <button onClick={onClose} className="absolute top-4 right-4 z-10 flex h-8 w-8 items-center justify-center rounded-lg text-[#4a5068] hover:text-white transition-colors cursor-pointer" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <X size={16} />
            </button>

            <div className="relative flex items-start gap-4">
              <div
                className="h-16 w-16 rounded-2xl flex items-center justify-center text-2xl font-bold shrink-0"
                style={{ background: 'linear-gradient(135deg, #3B82F6, #00d4ff)', boxShadow: '0 0 20px rgba(59,130,246,0.3)', color: 'white' }}
              >
                {p.headline.charAt(0).toUpperCase()}
              </div>

              <div className="flex-1 min-w-0 pt-1">
                <h2 className="text-lg font-bold text-white truncate">{p.headline}</h2>
                <p className="text-sm text-[#3B82F6] font-medium capitalize">{p.industry}</p>

                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {p.city && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(0,212,255,0.1)', color: '#00d4ff' }}>
                      <MapPin size={10} /> {p.city}
                    </span>
                  )}
                  {p.available && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(52,211,153,0.15)', color: '#34d399' }}>
                      <CheckCircle size={10} /> Open to Work
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize" style={{ background: 'rgba(255,255,255,0.05)', color: '#a3adc3' }}>
                    {p.work_type}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-4">
            {p.bio && <p className="text-sm text-[#a3adc3] leading-relaxed">{p.bio}</p>}

            {/* Quick stats */}
            <div className="grid grid-cols-3 gap-2">
              <StatCard icon={<Clock size={14} />} label="Experience" value={`${yearsExp} yrs`} />
              <StatCard icon={<MapPin size={14} />} label="Location" value={p.city.split(',')[0] || '—'} />
              <StatCard icon={<Languages size={14} />} label="Languages" value={`${p.languages.length}`} />
            </div>

            {/* Skills */}
            {p.skills.length > 0 && (
              <Section title="Skills">
                <div className="flex flex-wrap gap-1.5">
                  {p.skills.map((skill) => (
                    <span key={skill} className="rounded-lg px-2.5 py-1 text-[11px] font-medium" style={{ background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.15)', color: '#00d4ff' }}>
                      {skill}
                    </span>
                  ))}
                </div>
              </Section>
            )}

            {/* Experience */}
            {p.experience.length > 0 && (
              <Section title="Experience">
                <div className="space-y-3">
                  {p.experience.map((w, i) => (
                    <div key={i} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="h-2 w-2 rounded-full mt-1.5" style={{ background: i === 0 ? '#3B82F6' : '#181c24', border: '2px solid #3B82F6' }} />
                        {i < p.experience.length - 1 && <div className="flex-1 w-px my-1" style={{ background: 'rgba(59,130,246,0.15)' }} />}
                      </div>
                      <div className="pb-1">
                        <p className="text-sm font-semibold text-white">{w.title}</p>
                        <p className="text-xs text-[#a3adc3]">{w.company}</p>
                        <p className="text-[10px] text-[#4a5068]">{w.start_year} — {w.end_year || 'Present'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Education */}
            {p.education.length > 0 && (
              <Section title="Education">
                {p.education.map((e, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <GraduationCap size={14} className="mt-0.5 shrink-0" style={{ color: '#a78bfa' }} />
                    <div>
                      <p className="text-sm font-medium text-white">{e.degree}</p>
                      <p className="text-xs text-[#4a5068]">{e.school} · {e.year}</p>
                    </div>
                  </div>
                ))}
              </Section>
            )}

            {/* Languages */}
            {p.languages.length > 0 && (
              <Section title="Languages">
                <div className="flex gap-2">
                  {p.languages.map((lang) => (
                    <span key={lang} className="text-xs px-2.5 py-1 rounded-lg" style={{ background: 'rgba(167,139,250,0.1)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.15)' }}>
                      {lang}
                    </span>
                  ))}
                </div>
              </Section>
            )}

            {/* Portfolio */}
            {p.portfolio_url && (
              <Section title="Links">
                <a href={p.portfolio_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors hover:bg-white/5"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: '#a3adc3' }}>
                  <ExternalLink size={13} /> Portfolio
                </a>
              </Section>
            )}
          </div>

          {/* Footer CTA */}
          <div className="shrink-0 px-5 pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+16px)] lg:pb-4 flex gap-2" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <button onClick={toggleFollow} className="rounded-xl py-3 px-5 text-sm font-semibold cursor-pointer" style={isFollowing ? { background: 'rgba(52,211,153,0.12)', color: '#34d399' } : { background: 'rgba(0,212,255,0.1)', color: '#00d4ff' }}>
              {isFollowing ? '✓ Following' : '+ Follow'}
            </button>
            <button className="btn-primary flex-1 rounded-xl py-3 text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer">
              <Briefcase size={15} /> Contact
            </button>
            <button
              className="rounded-xl py-3 px-5 text-sm font-semibold transition-colors cursor-pointer"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: '#a3adc3' }}
            >
              Save
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: '#4a5068' }}>{title}</h3>
      {children}
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(17,19,24,0.6)', border: '1px solid rgba(255,255,255,0.04)' }}>
      <div className="flex justify-center mb-1" style={{ color: '#3B82F6' }}>{icon}</div>
      <p className="text-xs font-bold text-white">{value}</p>
      <p className="text-[10px]" style={{ color: '#4a5068' }}>{label}</p>
    </div>
  );
}
