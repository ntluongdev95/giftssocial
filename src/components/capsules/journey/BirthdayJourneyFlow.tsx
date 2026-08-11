'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import CapsuleRevealOverlay from '@/components/capsules/CapsuleRevealOverlay';

// Three.js + a generous offscreen canvas budget — only load when actually
// playing. ssr:false prevents Next from rendering WebGL on the server.
const JourneyDroneShow = dynamic(
  () => import('./JourneyDroneShow').then(m => m.JourneyDroneShow),
  { ssr: false },
);

type Capsule = {
  id: string;
  title: string;
  message: string;
  photos: string[];
  location_lat: number;
  location_lng: number;
  location_name?: string;
  buried_at: string;
  unlock_at: string;
  unlock_radius: number;
  opened_at?: string;
  my_opened_at?: string | null;
  theme?: string;
  role?: 'sender' | 'recipient';
  sender_name?: string;
  sender_username?: string;
  sender_avatar?: string;
  recipient_names?: string[];
};

type Props = {
  capsule: Capsule;
  onClose: () => void;
  onOpened?: (c: Capsule) => void;
};

/** Plays the journey drone show (❤️ → bicycle → motorbike → car → cake →
 * photo carousel → dissolve) before handing off to the classic capsule
 * reveal. Only fires for `theme === 'birthday'` capsules that the current
 * viewer hasn't opened yet — re-opens skip straight to the reveal. */
export function BirthdayJourneyFlow({ capsule, onClose, onOpened }: Props) {
  const shouldPlay =
    capsule.theme === 'birthday' &&
    capsule.role !== 'sender' &&
    !capsule.my_opened_at;

  const [phase, setPhase] = useState<'show' | 'reveal'>(shouldPlay ? 'show' : 'reveal');

  if (phase === 'show') {
    const recipientName =
      capsule.recipient_names && capsule.recipient_names[0]
        ? capsule.recipient_names[0]
        : null;

    // Use up to 3 photos for the carousel. If the capsule has none we skip
    // the photos stage so we don't sit on an empty frame.
    const photoUrls = (capsule.photos || []).slice(0, 3);
    const hasPhotos = photoUrls.length > 0;

    const stages = [
      { kind: 'scatter' as const, durationMs: 1800, label: 'Opening...' },
      { kind: 'scene' as const, sceneKey: 'heart' as const, durationMs: 3200, label: 'Câu chuyện của hai đứa...' },
      { kind: 'scene' as const, sceneKey: 'bicycle' as const, durationMs: 3800, label: 'Đèo nhau đi học' },
      { kind: 'scene' as const, sceneKey: 'motorbike' as const, durationMs: 3800, label: 'Đèo nhau lớn lên' },
      { kind: 'scene' as const, sceneKey: 'car' as const, durationMs: 3500, label: 'Đi xa cùng nhau' },
      { kind: 'scene' as const, sceneKey: 'cake' as const, durationMs: 3000, label: 'Và hôm nay...' },
      ...(recipientName
        ? [{ kind: 'text' as const, value: 'HAPPY BIRTHDAY', fontPx: 90, durationMs: 2800 }]
        : []),
      ...(recipientName
        ? [{ kind: 'text' as const, value: recipientName.toUpperCase(), fontPx: 110, durationMs: 2800 }]
        : []),
      ...(hasPhotos
        ? [{
            kind: 'photos' as const,
            urls: photoUrls,
            durationMs: Math.max(4000, photoUrls.length * 2200),
            label: 'Kỷ niệm của chúng ta',
          }]
        : []),
      { kind: 'dissolve' as const, durationMs: 2000, label: 'Mở thư...' },
    ];

    return <JourneyDroneShow stages={stages} onDone={() => setPhase('reveal')} />;
  }

  return <CapsuleRevealOverlay capsule={capsule} onClose={onClose} onOpened={onOpened} />;
}
