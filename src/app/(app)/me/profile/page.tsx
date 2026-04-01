'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { mutate } from 'swr';
import { useAuthStore } from '@/stores/auth-store';
import { useLocationStore } from '@/stores/locationStore';
import { useMapStore } from '@/stores/mapStore';
import {
  ArrowLeft,
  Save,
  Plus,
  X,
  Briefcase,
  GraduationCap,
  MapPin,
  Loader2,
  Clock,
  Languages,
  CheckCircle,
  ExternalLink,
  Eye,
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Industry options ────────────────────────────────────────────────────

const INDUSTRIES = [
  'Technology', 'Design', 'Marketing', 'Finance', 'Healthcare',
  'Education', 'Engineering', 'Sales', 'Legal', 'Real Estate',
  'Food & Beverage', 'Retail', 'Construction', 'Media', 'Logistics',
  'Consulting', 'Manufacturing', 'Hospitality', 'Beauty', 'Other',
];

const WORK_TYPES = [
  { value: 'onsite', label: 'On-site' },
  { value: 'remote', label: 'Remote' },
  { value: 'hybrid', label: 'Hybrid' },
] as const;

// ─── Types ───────────────────────────────────────────────────────────────

interface Experience {
  title: string;
  company: string;
  start_year: number;
  end_year: number | null;
  description: string;
}

interface Education {
  degree: string;
  school: string;
  year: number;
}

interface ProfileForm {
  headline: string;
  bio: string;
  industry: string;
  skills: string[];
  experience: Experience[];
  education: Education[];
  languages: string[];
  city: string;
  available: boolean;
  work_type: 'remote' | 'onsite' | 'hybrid';
  salary_min: string;
  salary_max: string;
  portfolio_url: string;
  contact_visible: boolean;
}

const EMPTY_EXPERIENCE: Experience = { title: '', company: '', start_year: new Date().getFullYear(), end_year: null, description: '' };
const EMPTY_EDUCATION: Education = { degree: '', school: '', year: new Date().getFullYear() };

// ─── Page ────────────────────────────────────────────────────────────────

export default function ProfileEditPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { lat, lng } = useLocationStore();
  const clearMarkers = useMapStore((s) => s.clearMarkers);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [skillInput, setSkillInput] = useState('');
  const [langInput, setLangInput] = useState('');

  const [form, setForm] = useState<ProfileForm>({
    headline: 'Founder & Full-Stack Architect',
    bio: 'Building Gao Internet — 8-layer sovereign internet stack. Expert in React, Next.js, Node.js, AI/ML, blockchain. Passionate about decentralized systems and privacy-first products.',
    industry: 'technology',
    skills: ['React', 'Next.js', 'TypeScript', 'Node.js', 'Solidity', 'AI/ML', 'MapLibre', 'PostgreSQL', 'MongoDB', 'Redis'],
    experience: [
      { title: 'Founder & CEO', company: 'Toii Labs', start_year: 2023, end_year: null, description: 'Building Gao Internet — sovereign infrastructure for the next web.' },
      { title: 'CTO', company: 'Tech Startup', start_year: 2020, end_year: 2023, description: 'Led engineering team of 12. Shipped mobile + web platform serving 50K+ users.' },
      { title: 'Senior Engineer', company: 'Enterprise Corp', start_year: 2016, end_year: 2020, description: 'Full-stack development, microservices architecture, cloud infrastructure.' },
    ],
    education: [
      { degree: 'BS Computer Science', school: 'University of Technology', year: 2016 },
    ],
    languages: ['English', 'Vietnamese'],
    city: 'Dallas, TX',
    available: true,
    work_type: 'hybrid',
    salary_min: '150000',
    salary_max: '250000',
    portfolio_url: 'https://luong.gao',
    contact_visible: true,
  });

  useEffect(() => {
    fetch('/api/v1/profiles/me', {
      headers: { Authorization: `Bearer ${localStorage.getItem('access_token') || ''}` },
    })
      .then((r) => r.json())
      .then((res) => {
        if (res.data) {
          const p = res.data;
          setForm({
            headline: p.headline || '',
            bio: p.bio || '',
            industry: p.industry || '',
            skills: p.skills || [],
            experience: p.experience?.length ? p.experience : [{ ...EMPTY_EXPERIENCE }],
            education: p.education || [],
            languages: p.languages || [],
            city: p.city || '',
            available: p.available ?? true,
            work_type: p.work_type || 'onsite',
            salary_min: p.salary_range?.min?.toString() || '',
            salary_max: p.salary_range?.max?.toString() || '',
            portfolio_url: p.portfolio_url || '',
            contact_visible: p.contact_visible ?? false,
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const updateField = <K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const addSkill = () => {
    const s = skillInput.trim();
    if (s && !form.skills.includes(s) && form.skills.length < 20) {
      updateField('skills', [...form.skills, s]);
      setSkillInput('');
    }
  };
  const removeSkill = (skill: string) => updateField('skills', form.skills.filter((s) => s !== skill));

  const addLang = () => {
    const l = langInput.trim();
    if (l && !form.languages.includes(l) && form.languages.length < 10) {
      updateField('languages', [...form.languages, l]);
      setLangInput('');
    }
  };
  const removeLang = (lang: string) => updateField('languages', form.languages.filter((l) => l !== lang));

  const updateExp = (idx: number, field: keyof Experience, value: string | number | null) => {
    const updated = [...form.experience];
    updated[idx] = { ...updated[idx], [field]: value };
    updateField('experience', updated);
  };
  const addExp = () => { if (form.experience.length < 10) updateField('experience', [...form.experience, { ...EMPTY_EXPERIENCE }]); };
  const removeExp = (idx: number) => { if (form.experience.length > 1) updateField('experience', form.experience.filter((_, i) => i !== idx)); };

  const updateEdu = (idx: number, field: keyof Education, value: string | number) => {
    const updated = [...form.education];
    updated[idx] = { ...updated[idx], [field]: value };
    updateField('education', updated);
  };
  const addEdu = () => { if (form.education.length < 5) updateField('education', [...form.education, { ...EMPTY_EDUCATION }]); };
  const removeEdu = (idx: number) => updateField('education', form.education.filter((_, i) => i !== idx));

  const handleSave = async () => {
    if (!form.headline || !form.industry) { toast.error('Headline and industry are required'); return; }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        headline: form.headline, bio: form.bio, industry: form.industry, skills: form.skills,
        experience: form.experience.filter((e) => e.title && e.company),
        education: form.education.filter((e) => e.degree && e.school),
        languages: form.languages,
        location: { type: 'Point' as const, coordinates: [lng || -96.797, lat || 32.7767] },
        city: form.city, available: form.available, work_type: form.work_type,
        portfolio_url: form.portfolio_url || undefined, contact_visible: form.contact_visible,
      };
      if (form.salary_min && form.salary_max) {
        payload.salary_range = { min: Number(form.salary_min), max: Number(form.salary_max), currency: 'USD' };
      }
      const res = await fetch('/api/v1/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('access_token') || ''}` },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error?.message || 'Failed to save'); }
      mutate((key: string) => typeof key === 'string' && key.includes('/api/v1/profiles'));
      clearMarkers();
      toast.success('Profile saved! Showing on map...');
      router.push('/world');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally { setSaving(false); }
  };

  const yearsExp = form.experience.length > 0
    ? new Date().getFullYear() - Math.min(...form.experience.filter(e => e.start_year).map((e) => e.start_year))
    : 0;

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#00d4ff]" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <div
        className="sticky top-0 z-10 flex items-center justify-between px-4 lg:px-8 py-3"
        style={{ background: 'rgba(10,11,15,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
      >
        <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-[#a3adc3] cursor-pointer">
          <ArrowLeft size={18} /> Back
        </button>
        <h1 className="text-sm font-bold text-white">Professional Profile</h1>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold cursor-pointer transition-all hover:scale-105"
          style={{ background: 'rgba(0,212,255,0.15)', color: '#00d4ff' }}
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Save
        </button>
      </div>

      {/* ── Desktop: 2-column / Mobile: single column ──── */}
      <div className="mx-auto max-w-7xl lg:flex lg:gap-10 px-4 lg:px-8 py-6 pb-32">

        {/* ── LEFT: Form ─────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-6 lg:max-w-3xl">

          {/* Basic Info + Industry — 2 col on desktop */}
          <Section title="Basic Info">
            <div className="lg:grid lg:grid-cols-2 lg:gap-4 space-y-3 lg:space-y-0">
              <div className="lg:col-span-2">
                <Input label="Headline" placeholder="e.g. Senior React Developer" value={form.headline} onChange={(v) => updateField('headline', v)} required />
              </div>
              <div className="lg:col-span-2">
                <Textarea label="Bio" placeholder="Tell employers about yourself..." value={form.bio} onChange={(v) => updateField('bio', v)} maxLength={1000} />
              </div>
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#4a5068] mb-1 block">Industry *</span>
                <select
                  value={form.industry}
                  onChange={(e) => updateField('industry', e.target.value)}
                  className="w-full rounded-xl px-4 py-2.5 text-sm text-white outline-none cursor-pointer"
                  style={{ background: 'rgba(17,19,24,0.8)', border: '1px solid rgba(255,255,255,0.07)' }}
                >
                  <option value="">Select industry</option>
                  {INDUSTRIES.map((ind) => (
                    <option key={ind} value={ind.toLowerCase()}>{ind}</option>
                  ))}
                </select>
              </label>
              <Input label="City" placeholder="e.g. Dallas, TX" value={form.city} onChange={(v) => updateField('city', v)} icon={<MapPin size={14} />} />
            </div>
          </Section>

          {/* Skills + Languages — side by side on desktop */}
          <div className="lg:grid lg:grid-cols-2 lg:gap-6 space-y-6 lg:space-y-0">
            <Section title={`Skills (${form.skills.length}/20)`}>
              <div className="flex gap-2">
                <input
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSkill())}
                  placeholder="Add a skill..."
                  className="flex-1 rounded-xl px-4 py-2.5 text-sm text-white outline-none"
                  style={{ background: 'rgba(17,19,24,0.8)', border: '1px solid rgba(255,255,255,0.07)' }}
                />
                <button onClick={addSkill} className="rounded-xl px-3 cursor-pointer" style={{ background: 'rgba(0,212,255,0.15)', color: '#00d4ff' }}>
                  <Plus size={16} />
                </button>
              </div>
              {form.skills.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {form.skills.map((skill) => (
                    <span key={skill} className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-medium" style={{ background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.15)', color: '#00d4ff' }}>
                      {skill}
                      <button onClick={() => removeSkill(skill)} className="cursor-pointer"><X size={12} /></button>
                    </span>
                  ))}
                </div>
              )}
            </Section>

            <Section title="Languages">
              <div className="flex gap-2">
                <input
                  value={langInput}
                  onChange={(e) => setLangInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addLang())}
                  placeholder="Add language..."
                  className="flex-1 rounded-xl px-4 py-2.5 text-sm text-white outline-none"
                  style={{ background: 'rgba(17,19,24,0.8)', border: '1px solid rgba(255,255,255,0.07)' }}
                />
                <button onClick={addLang} className="rounded-xl px-3 cursor-pointer" style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa' }}>
                  <Plus size={16} />
                </button>
              </div>
              {form.languages.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {form.languages.map((lang) => (
                    <span key={lang} className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-medium" style={{ background: 'rgba(167,139,250,0.1)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.15)' }}>
                      {lang}
                      <button onClick={() => removeLang(lang)} className="cursor-pointer"><X size={12} /></button>
                    </span>
                  ))}
                </div>
              )}
            </Section>
          </div>

          {/* Experience + Education — side by side on desktop */}
          <div className="lg:grid lg:grid-cols-2 lg:gap-6 space-y-6 lg:space-y-0">
            <Section title="Experience" action={form.experience.length < 10 ? { label: 'Add', onClick: addExp } : undefined}>
              <div className="space-y-3">
                {form.experience.map((exp, i) => (
                  <div key={i} className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(17,19,24,0.5)', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-[#00d4ff]">
                        <Briefcase size={14} />
                        <span className="text-[11px] font-semibold uppercase tracking-wider">Position {i + 1}</span>
                      </div>
                      {form.experience.length > 1 && (
                        <button onClick={() => removeExp(i)} className="text-[#4a5068] hover:text-[#f87171] cursor-pointer"><X size={14} /></button>
                      )}
                    </div>
                    <Input label="Job Title" placeholder="e.g. Full-Stack Developer" value={exp.title} onChange={(v) => updateExp(i, 'title', v)} />
                    <Input label="Company" placeholder="e.g. Toii Labs" value={exp.company} onChange={(v) => updateExp(i, 'company', v)} />
                    <div className="grid grid-cols-2 gap-3">
                      <Input label="Start Year" type="number" value={exp.start_year.toString()} onChange={(v) => updateExp(i, 'start_year', Number(v))} />
                      <Input label="End Year" type="number" placeholder="Present" value={exp.end_year?.toString() || ''} onChange={(v) => updateExp(i, 'end_year', v ? Number(v) : null)} />
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            <Section title="Education" action={{ label: 'Add', onClick: addEdu }}>
              {form.education.length === 0 && (
                <p className="text-xs text-[#4a5068]">No education added yet.</p>
              )}
              <div className="space-y-3">
                {form.education.map((edu, i) => (
                  <div key={i} className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(17,19,24,0.5)', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-[#a78bfa]">
                        <GraduationCap size={14} />
                        <span className="text-[11px] font-semibold uppercase tracking-wider">Education {i + 1}</span>
                      </div>
                      <button onClick={() => removeEdu(i)} className="text-[#4a5068] hover:text-[#f87171] cursor-pointer"><X size={14} /></button>
                    </div>
                    <Input label="Degree" placeholder="e.g. BS Computer Science" value={edu.degree} onChange={(v) => updateEdu(i, 'degree', v)} />
                    <Input label="School" placeholder="e.g. University of Technology" value={edu.school} onChange={(v) => updateEdu(i, 'school', v)} />
                    <Input label="Year" type="number" value={edu.year.toString()} onChange={(v) => updateEdu(i, 'year', Number(v))} />
                  </div>
                ))}
              </div>
            </Section>
          </div>

          {/* Work Preferences */}
          <Section title="Work Preferences">
            <div className="lg:grid lg:grid-cols-2 lg:gap-4 space-y-3 lg:space-y-0">
              <div className="lg:col-span-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#4a5068] mb-2 block">Work Type</span>
                <div className="flex gap-2">
                  {WORK_TYPES.map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => updateField('work_type', value)}
                      className="flex-1 rounded-xl py-2.5 text-xs font-semibold transition-all cursor-pointer"
                      style={{
                        background: form.work_type === value ? 'rgba(0,212,255,0.15)' : 'rgba(17,19,24,0.8)',
                        border: `1px solid ${form.work_type === value ? 'rgba(0,212,255,0.3)' : 'rgba(255,255,255,0.07)'}`,
                        color: form.work_type === value ? '#00d4ff' : '#a3adc3',
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <Toggle label="Open to Work" desc="Show as available on the map" value={form.available} onChange={(v) => updateField('available', v)} />
              <Toggle label="Show Contact Info" desc="Let recruiters see salary range" value={form.contact_visible} onChange={(v) => updateField('contact_visible', v)} />

              <Input label="Min Salary (USD)" type="number" placeholder="50000" value={form.salary_min} onChange={(v) => updateField('salary_min', v)} />
              <Input label="Max Salary (USD)" type="number" placeholder="120000" value={form.salary_max} onChange={(v) => updateField('salary_max', v)} />

              <div className="lg:col-span-2">
                <Input label="Portfolio URL" placeholder="https://yoursite.com" value={form.portfolio_url} onChange={(v) => updateField('portfolio_url', v)} />
              </div>
            </div>
          </Section>
        </div>

        {/* ── RIGHT: Live Preview (desktop only) ─────────── */}
        <div className="hidden lg:block w-[380px] shrink-0">
          <div className="sticky top-16">
            <div className="flex items-center gap-2 mb-3">
              <Eye size={14} className="text-[#4a5068]" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#4a5068]">Live Preview</span>
            </div>
            <div
              className="rounded-2xl overflow-hidden"
              style={{ background: 'rgba(10,11,15,0.97)', border: '1px solid rgba(0,212,255,0.08)', boxShadow: '0 8px 40px rgba(0,0,0,0.4)' }}
            >
              {/* Preview Header */}
              <div className="relative px-5 pt-5 pb-4">
                <div className="absolute inset-x-0 top-0 h-24 opacity-40" style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.2), rgba(99,102,241,0.2))' }} />
                <div className="relative flex items-start gap-4">
                  <div
                    className="h-14 w-14 rounded-2xl flex items-center justify-center text-xl font-bold shrink-0"
                    style={{ background: 'linear-gradient(135deg, #3B82F6, #00d4ff)', color: 'white' }}
                  >
                    {form.headline ? form.headline.charAt(0).toUpperCase() : '?'}
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <h3 className="text-base font-bold text-white truncate">{form.headline || 'Your Headline'}</h3>
                    <p className="text-xs text-[#00d4ff] font-medium capitalize">{form.industry || 'Industry'}</p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      {form.city && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(0,212,255,0.1)', color: '#00d4ff' }}>
                          <MapPin size={8} /> {form.city}
                        </span>
                      )}
                      {form.available && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(52,211,153,0.15)', color: '#34d399' }}>
                          <CheckCircle size={8} /> Open to Work
                        </span>
                      )}
                      <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full capitalize" style={{ background: 'rgba(255,255,255,0.05)', color: '#a3adc3' }}>
                        {form.work_type}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Preview Body */}
              <div className="px-5 pb-5 space-y-4">
                {form.bio && <p className="text-xs text-[#a3adc3] leading-relaxed line-clamp-3">{form.bio}</p>}

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2">
                  <PreviewStat icon={<Clock size={12} />} label="Experience" value={`${yearsExp} yrs`} />
                  <PreviewStat icon={<MapPin size={12} />} label="Location" value={form.city.split(',')[0] || '—'} />
                  <PreviewStat icon={<Languages size={12} />} label="Languages" value={`${form.languages.length}`} />
                </div>

                {/* Skills */}
                {form.skills.length > 0 && (
                  <div>
                    <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[#4a5068] mb-1.5">Skills</h4>
                    <div className="flex flex-wrap gap-1">
                      {form.skills.slice(0, 8).map((skill) => (
                        <span key={skill} className="rounded px-2 py-0.5 text-[10px] font-medium" style={{ background: 'rgba(0,212,255,0.08)', color: '#00d4ff' }}>
                          {skill}
                        </span>
                      ))}
                      {form.skills.length > 8 && (
                        <span className="text-[10px] text-[#4a5068]">+{form.skills.length - 8} more</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Experience */}
                {form.experience.filter(e => e.title).length > 0 && (
                  <div>
                    <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[#4a5068] mb-1.5">Experience</h4>
                    <div className="space-y-2">
                      {form.experience.filter(e => e.title).map((w, i) => (
                        <div key={i} className="flex gap-2.5">
                          <div className="flex flex-col items-center">
                            <div className="h-1.5 w-1.5 rounded-full mt-1.5" style={{ background: i === 0 ? '#00d4ff' : '#181c24', border: '1.5px solid #00d4ff' }} />
                            {i < form.experience.filter(e => e.title).length - 1 && <div className="flex-1 w-px my-0.5" style={{ background: 'rgba(0,212,255,0.15)' }} />}
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-white">{w.title}</p>
                            <p className="text-[10px] text-[#a3adc3]">{w.company}</p>
                            <p className="text-[9px] text-[#4a5068]">{w.start_year} — {w.end_year || 'Present'}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Education */}
                {form.education.filter(e => e.degree).length > 0 && (
                  <div>
                    <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[#4a5068] mb-1.5">Education</h4>
                    {form.education.filter(e => e.degree).map((e, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <GraduationCap size={12} className="mt-0.5 shrink-0" style={{ color: '#a78bfa' }} />
                        <div>
                          <p className="text-xs font-medium text-white">{e.degree}</p>
                          <p className="text-[10px] text-[#4a5068]">{e.school} · {e.year}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Languages */}
                {form.languages.length > 0 && (
                  <div>
                    <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[#4a5068] mb-1.5">Languages</h4>
                    <div className="flex gap-1.5">
                      {form.languages.map((lang) => (
                        <span key={lang} className="text-[10px] px-2 py-0.5 rounded" style={{ background: 'rgba(167,139,250,0.1)', color: '#a78bfa' }}>
                          {lang}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Portfolio */}
                {form.portfolio_url && (
                  <div className="flex items-center gap-1.5 text-[10px] text-[#a3adc3]">
                    <ExternalLink size={10} />
                    <span className="truncate">{form.portfolio_url}</span>
                  </div>
                )}
              </div>

              {/* Preview Footer */}
              <div className="px-5 py-3 flex gap-2" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="flex-1 rounded-xl py-2.5 text-center text-xs font-semibold" style={{ background: 'rgba(0,212,255,0.15)', color: '#00d4ff' }}>
                  Contact
                </div>
                <div className="rounded-xl py-2.5 px-4 text-xs font-semibold" style={{ background: 'rgba(255,255,255,0.04)', color: '#a3adc3' }}>
                  Save
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Reusable Components ─────────────────────────────────────────────────

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: { label: string; onClick: () => void } }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[#4a5068]">{title}</h2>
        {action && (
          <button onClick={action.onClick} className="flex items-center gap-1 text-[11px] font-semibold text-[#00d4ff] cursor-pointer">
            <Plus size={12} /> {action.label}
          </button>
        )}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Toggle({ label, desc, value, onChange }: { label: string; desc: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-xl px-4 py-3" style={{ background: 'rgba(17,19,24,0.8)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="text-[11px] text-[#4a5068]">{desc}</p>
      </div>
      <button
        onClick={() => onChange(!value)}
        className="h-6 w-11 rounded-full transition-colors cursor-pointer shrink-0 ml-3"
        style={{ background: value ? '#00d4ff' : 'rgba(255,255,255,0.1)' }}
      >
        <div className="h-5 w-5 rounded-full bg-white shadow transition-transform" style={{ transform: value ? 'translateX(21px)' : 'translateX(1px)' }} />
      </button>
    </div>
  );
}

function Input({ label, value, onChange, placeholder, type = 'text', required, icon, maxLength }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; required?: boolean; icon?: React.ReactNode; maxLength?: number;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-[#4a5068] mb-1 block">
        {label} {required && '*'}
      </span>
      <div className="relative">
        {icon && <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4a5068]">{icon}</div>}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          className="w-full rounded-xl px-4 py-2.5 text-sm text-white outline-none placeholder:text-[#2d3548]"
          style={{ background: 'rgba(17,19,24,0.8)', border: '1px solid rgba(255,255,255,0.07)', paddingLeft: icon ? '2.25rem' : undefined }}
        />
      </div>
    </label>
  );
}

function Textarea({ label, value, onChange, placeholder, maxLength }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; maxLength?: number;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-[#4a5068] mb-1 block">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        rows={3}
        className="w-full rounded-xl px-4 py-2.5 text-sm text-white outline-none resize-none placeholder:text-[#2d3548]"
        style={{ background: 'rgba(17,19,24,0.8)', border: '1px solid rgba(255,255,255,0.07)' }}
      />
      {maxLength && (
        <span className="text-[10px] text-[#2d3548] mt-0.5 block text-right">{value.length}/{maxLength}</span>
      )}
    </label>
  );
}

function PreviewStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg p-2 text-center" style={{ background: 'rgba(17,19,24,0.6)', border: '1px solid rgba(255,255,255,0.04)' }}>
      <div className="flex justify-center mb-0.5" style={{ color: '#00d4ff' }}>{icon}</div>
      <p className="text-[11px] font-bold text-white">{value}</p>
      <p className="text-[9px]" style={{ color: '#4a5068' }}>{label}</p>
    </div>
  );
}
