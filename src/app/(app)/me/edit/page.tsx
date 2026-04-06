'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, Camera, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth-store';

export default function EditProfilePage() {
  const router = useRouter();
  const { user, hydrateFromMe } = useAuthStore();
  const [saving, setSaving] = useState(false);

  const [displayName, setDisplayName] = useState(user?.fullName || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [avatarPreview, setAvatarPreview] = useState(user?.avatarUrl || '');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [photos, setPhotos] = useState<(string | null)[]>([null, null, null, null]);
  const [photoFiles, setPhotoFiles] = useState<(File | null)[]>([null, null, null, null]);

  // Load existing data from DB
  useEffect(() => {
    fetch('/api/v1/users/me', {
      headers: { Authorization: `Bearer ${localStorage.getItem('access_token') || ''}` },
    })
      .then(r => r.json())
      .then(res => {
        if (res.data) {
          const d = res.data;
          if (d.display_name) setDisplayName(d.display_name);
          if (d.bio) setBio(d.bio);
          if (d.avatar_url) setAvatarPreview(d.avatar_url);
          if (d.photos && d.photos.length > 0) {
            const loaded: (string | null)[] = [null, null, null, null];
            d.photos.forEach((url: string, i: number) => { if (i < 4) loaded[i] = url; });
            setPhotos(loaded);
          }
        }
      })
      .catch(() => {});
  }, []);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handlePhotoChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const newPhotos = [...photos];
    newPhotos[index] = URL.createObjectURL(file);
    setPhotos(newPhotos);
    const newFiles = [...photoFiles];
    newFiles[index] = file;
    setPhotoFiles(newFiles);
  };

  const removePhoto = (index: number) => {
    const newPhotos = [...photos];
    newPhotos[index] = null;
    setPhotos(newPhotos);
    const newFiles = [...photoFiles];
    newFiles[index] = null;
    setPhotoFiles(newFiles);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Upload avatar if changed
      let avatarUrl = user?.avatarUrl || '';
      if (avatarFile) {
        const formData = new FormData();
        formData.append('file', avatarFile);
        const uploadRes = await fetch('/api/v1/upload', {
          method: 'POST',
          headers: { Authorization: `Bearer ${localStorage.getItem('access_token') || ''}` },
          body: formData,
        });
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          avatarUrl = uploadData.data?.url || avatarUrl;
        }
      }

      // Upload photos
      const photoUrls: string[] = [];
      for (let i = 0; i < photoFiles.length; i++) {
        if (photoFiles[i]) {
          const fd = new FormData();
          fd.append('file', photoFiles[i]!);
          const pRes = await fetch('/api/v1/upload', {
            method: 'POST',
            headers: { Authorization: `Bearer ${localStorage.getItem('access_token') || ''}` },
            body: fd,
          });
          if (pRes.ok) {
            const pData = await pRes.json();
            photoUrls.push(pData.data?.url);
          }
        } else if (photos[i]) {
          // Keep existing preview URL (already uploaded)
          photoUrls.push(photos[i]!);
        }
      }

      // Update profile
      const res = await fetch('/api/v1/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('access_token') || ''}` },
        body: JSON.stringify({
          display_name: displayName,
          full_name: displayName,
          bio,
          avatar_url: avatarUrl,
          photos: photoUrls.filter(Boolean),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        hydrateFromMe(data);
        // Update last user for "Welcome back" UX
        try {
          localStorage.setItem('gao_last_user', JSON.stringify({
            display_name: displayName || data.display_name || data.fullName || '',
            avatar_url: avatarUrl || data.avatar_url || data.avatarUrl || '',
            email: data.email || '',
          }));
        } catch { /* ignore */ }
        toast.success('Profile updated!');
        router.back();
      } else {
        toast.error('Failed to update profile');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 lg:px-8 pt-[calc(env(safe-area-inset-top,0px)+12px)] pb-3" style={{ background: 'rgba(10,11,15,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-[#a3adc3] cursor-pointer">
          <ArrowLeft size={18} /> Cancel
        </button>
        <h1 className="text-sm font-bold text-white">Edit Profile</h1>
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold cursor-pointer" style={{ background: 'rgba(0,212,255,0.15)', color: '#00d4ff' }}>
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
        </button>
      </div>

      <div className="max-w-lg lg:max-w-4xl mx-auto px-4 lg:px-8 py-6 pb-24">
        {/* Desktop: single card layout */}
        <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(17,19,24,0.5)', border: '1px solid rgba(255,255,255,0.04)' }}>
          {/* Banner area */}
          <div className="h-32 relative" style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.15), rgba(99,102,241,0.1))' }}>
            <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 lg:left-8 lg:translate-x-0">
              <div className="relative">
                <div className="h-24 w-24 rounded-full overflow-hidden flex items-center justify-center" style={{ background: '#0a0b0f', border: '4px solid #0a0b0f', boxShadow: '0 0 0 2px rgba(0,212,255,0.3)' }}>
                  {avatarPreview
                    ? <img src={avatarPreview} alt="" className="h-full w-full object-cover" />
                    : <span className="text-4xl text-[#4a5068]">👤</span>
                  }
                </div>
                <label className="absolute bottom-0 right-0 h-8 w-8 rounded-full flex items-center justify-center cursor-pointer" style={{ background: '#00d4ff', color: '#0a0b0f', boxShadow: '0 2px 8px rgba(0,212,255,0.4)' }}>
                  <Camera size={14} />
                  <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
                </label>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="pt-16 lg:pt-6 px-6 pb-6">
            <div className="lg:flex lg:gap-10 lg:pl-32">
              {/* Form fields */}
              <div className="flex-1 min-w-0 space-y-5">
                {/* Display Name */}
                <div className="lg:grid lg:grid-cols-2 lg:gap-4 space-y-4 lg:space-y-0">
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-[#4a5068] mb-1.5 block">Display Name</label>
                    <input
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Your name"
                      className="w-full rounded-xl px-4 py-3 text-sm text-white outline-none placeholder:text-[#2d3548]"
                      style={{ background: 'rgba(10,11,15,0.8)', border: '1px solid rgba(255,255,255,0.07)' }}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-[#4a5068] mb-1.5 block">Gao ID</label>
                    <input
                      value={user?.username || ''}
                      disabled
                      className="w-full rounded-xl px-4 py-3 text-sm text-[#4a5068] outline-none"
                      style={{ background: 'rgba(10,11,15,0.4)', border: '1px solid rgba(255,255,255,0.04)' }}
                    />
                  </div>
                </div>

                {/* Bio */}
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-[#4a5068] mb-1.5 block">Bio</label>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Tell others about yourself..."
                    rows={3}
                    maxLength={300}
                    className="w-full rounded-xl px-4 py-3 text-sm text-white outline-none resize-none placeholder:text-[#2d3548]"
                    style={{ background: 'rgba(10,11,15,0.8)', border: '1px solid rgba(255,255,255,0.07)' }}
                  />
                  <p className="text-[10px] text-[#4a5068] text-right mt-0.5">{bio.length}/300</p>
                </div>

                {/* Photos */}
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-[#4a5068] mb-2 block">My Photos</label>
                  <div className="grid grid-cols-4 gap-3">
                    {photos.map((photo, i) => (
                      <div key={i} className="relative aspect-square rounded-xl overflow-hidden" style={{ background: 'rgba(10,11,15,0.8)', border: '1px dashed rgba(255,255,255,0.08)' }}>
                        {photo ? (
                          <>
                            <img src={photo} alt="" className="h-full w-full object-cover" />
                            <button
                              onClick={() => removePhoto(i)}
                              className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full flex items-center justify-center cursor-pointer text-white text-[10px] font-bold"
                              style={{ background: 'rgba(239,68,68,0.85)' }}
                            >
                              ✕
                            </button>
                          </>
                        ) : (
                          <label className="flex flex-col items-center justify-center h-full cursor-pointer gap-1.5">
                            <Camera size={20} className="text-[#4a5068]" />
                            <span className="text-[9px] text-[#4a5068]">Add photo</span>
                            <input type="file" accept="image/*" onChange={(e) => handlePhotoChange(i, e)} className="hidden" />
                          </label>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
