import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { PublicCardView } from './PublicCardView';

// Public viewer for a Gao Gift card. No auth required — the page is
// intentionally shareable. On load we fetch the card from our own API
// and render it full-screen with big share/CTA affordances so the
// viewer's friends want to make their own → viral loop.

type CardApi = {
  data: {
    id: string;
    kind: string;
    data: {
      name1?: string;
      name2?: string;
      cardId?: string;
      issueDate?: string;
      expiryDate?: string;
      variant?: 'classic' | 'noir' | 'rose';
      togetherSince?: string | null;
      milestones?: Array<{ emoji: string; date: string; label: string }>;
    };
    photo_url: string | null;
    view_count: number;
    created_at: string;
  };
};

async function fetchCard(id: string): Promise<CardApi['data'] | null> {
  // Resolve the origin from the request headers so it works locally,
  // on preview, and on prod — NEXT_PUBLIC_APP_URL may not be set.
  const h = await headers();
  const host = h.get('host');
  const proto = h.get('x-forwarded-proto') || 'http';
  const origin = host ? `${proto}://${host}` : (process.env.NEXT_PUBLIC_APP_URL || '');
  if (!origin) return null;
  try {
    const r = await fetch(`${origin}/api/v1/gifts/cards/${encodeURIComponent(id)}`, {
      cache: 'no-store',
    });
    if (!r.ok) return null;
    const j = (await r.json()) as CardApi;
    return j.data;
  } catch {
    return null;
  }
}

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> },
): Promise<Metadata> {
  const { id } = await params;
  const card = await fetchCard(id);
  if (!card) return { title: 'Gao Gift Card' };

  const n1 = card.data.name1 || 'Someone';
  const n2 = card.data.name2 || 'their love';
  const title = `${n1} & ${n2} — Official Couple Card`;
  const description = `Our official couple membership card. Made on Gao Gifts — make yours in 30 seconds.`;
  const image = card.photo_url || undefined;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: image ? [{ url: image }] : undefined,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function PublicGiftCardPage(
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const card = await fetchCard(id);
  if (!card || card.kind !== 'couple_card') notFound();

  return (
    <PublicCardView
      id={card.id}
      name1={card.data.name1 || ''}
      name2={card.data.name2 || ''}
      cardId={card.data.cardId || '0000 0000 0000'}
      issueDate={card.data.issueDate || ''}
      expiryDate={card.data.expiryDate || ''}
      variant={card.data.variant || 'noir'}
      togetherSince={card.data.togetherSince ?? null}
      milestones={card.data.milestones ?? []}
      photoUrl={card.photo_url}
      viewCount={card.view_count}
      createdAt={card.created_at}
    />
  );
}
