import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { HeartView } from './HeartView';

// Public viewer for the 3D-heart Gao Gift template. No auth required —
// the URL is meant to be shared cold with friends & partners. We fetch
// the row from our own API for OG meta then hand off to the client
// component for the canvas + message rain.

type HeartApi = {
  data: {
    id: string;
    kind: string;
    data: {
      recipientName?: string;
      senderName?: string;
      senderRole?: 'anh' | 'em';
      heartColor?: 'pink' | 'red' | 'gold';
      photoUrls?: string[];
    };
    view_count: number;
    created_at: string;
  };
};

async function fetchHeart(id: string): Promise<HeartApi['data'] | null> {
  const h = await headers();
  const host = h.get('host');
  const proto = h.get('x-forwarded-proto') || 'http';
  const origin = host ? `${proto}://${host}` : (process.env.NEXT_PUBLIC_APP_URL || '');
  if (!origin) return null;
  try {
    const r = await fetch(`${origin}/api/v1/gifts/hearts/${encodeURIComponent(id)}`, {
      cache: 'no-store',
    });
    if (!r.ok) return null;
    const j = (await r.json()) as HeartApi;
    return j.data;
  } catch {
    return null;
  }
}

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> },
): Promise<Metadata> {
  const { id } = await params;
  const heart = await fetchHeart(id);
  if (!heart) return { title: 'Gao Gift · 3D Heart' };
  const name = heart.data.recipientName || 'người thương';
  const title = `Gửi ${name} — trái tim 3D`;
  const description = 'Một trái tim ba chiều được tạo riêng, bên trong là hàng chục lời yêu thương. Bấm vào để xem.';
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

export default async function PublicHeartPage(
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const heart = await fetchHeart(id);
  if (!heart || heart.kind !== 'heart_3d') notFound();

  return (
    <HeartView
      id={heart.id}
      recipientName={heart.data.recipientName || 'Người thương'}
      senderName={heart.data.senderName || ''}
      senderRole={heart.data.senderRole || 'anh'}
      heartColor={heart.data.heartColor || 'pink'}
      photoUrls={heart.data.photoUrls ?? []}
      viewCount={heart.view_count}
      createdAt={heart.created_at}
    />
  );
}
