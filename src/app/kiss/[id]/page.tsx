import { redirect } from 'next/navigation';
import { getDB } from '@/lib/db';
import type { Metadata } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.gao.social';

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;

  try {
    const db = getDB();
    const k = await db.prepare(
      `SELECT k.emoji, k.message, k.visibility,
              s.display_name AS sender_name, s.avatar_url AS sender_avatar,
              r.display_name AS receiver_name
       FROM kisses k
       LEFT JOIN users s ON s.id = k.sender_id
       LEFT JOIN users r ON r.id = k.receiver_id
       WHERE k.id = ?`
    ).bind(id).first<{ emoji: string; message: string; visibility: string; sender_name: string; sender_avatar: string; receiver_name: string }>();

    if (!k || k.visibility === 'private') {
      return { title: 'Kiss on Gao Social' };
    }
    const title = `${k.emoji} ${k.sender_name} sent a kiss to ${k.receiver_name} on Gao Social`;
    const description = k.message || `${k.sender_name} sent a ${k.emoji} kiss! Watch the journey on Gao Social.`;

    return {
      title,
      description,
      metadataBase: new URL(BASE_URL),
      openGraph: {
        title,
        description,
        type: 'website',
        url: `${BASE_URL}/kiss/${id}`,
        siteName: 'Gao Social',
        images: k.sender_avatar ? [{ url: k.sender_avatar.startsWith('/') ? `${BASE_URL}${k.sender_avatar}` : k.sender_avatar, width: 200, height: 200 }] : [],
      },
      twitter: {
        card: 'summary',
        title,
        description,
      },
    };
  } catch {
    return { title: 'Kiss on Gao Social' };
  }
}

// Revalidate every 10 min — gift expires in 24h, this ensures freshness
export const revalidate = 600;

export default async function KissSharePage({ params }: Props) {
  const { id } = await params;

  // Check the kiss's open-limit status server-side. If it's exhausted
  // (open_count >= max_opens), render a friendly "gift used up" page
  // instead of redirecting to the map animation. QR scanners get a
  // clear explanation instead of a broken silent redirect.
  let exhausted = false;
  let senderName = '';
  let emoji = '💝';
  try {
    const db = getDB();
    const row = await db.prepare(
      `SELECT k.emoji, k.open_count, k.max_opens, s.display_name AS sender_name
       FROM kisses k
       LEFT JOIN users s ON s.id = k.sender_id
       WHERE k.id = ?`
    ).bind(id).first<{ emoji: string; open_count: number; max_opens: number; sender_name: string }>();
    if (row) {
      exhausted = (row.open_count ?? 0) >= (row.max_opens ?? 5);
      senderName = row.sender_name || '';
      emoji = row.emoji || '💝';
    }
  } catch {}

  if (exhausted) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', background: 'radial-gradient(ellipse at center, #1a0b18 0%, #0a0b0f 60%)', color: '#fff', fontFamily: 'system-ui, -apple-system, sans-serif', textAlign: 'center' }}>
        <div style={{ maxWidth: 400 }}>
          <div style={{ fontSize: 80, marginBottom: 20 }}>{emoji}</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 10 }}>This gift is all used up</h1>
          <p style={{ fontSize: 14, color: '#a3adc3', lineHeight: 1.6, marginBottom: 24 }}>
            {senderName ? <><b style={{ color: '#f472b6' }}>{senderName}</b> sent a special gift,<br /></> : null}
            but it has already been opened 5 times 💝
          </p>
          <a href="/world" style={{ display: 'inline-block', padding: '12px 28px', borderRadius: 12, background: 'linear-gradient(135deg, #f472b6, #ec4899)', color: '#fff', textDecoration: 'none', fontWeight: 700, fontSize: 13 }}>
            Back to home
          </a>
        </div>
      </div>
    );
  }

  redirect(`/world?kiss=${id}`);
}
