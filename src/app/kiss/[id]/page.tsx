import { redirect } from 'next/navigation';
import { getDB } from '@/lib/db';
import type { Metadata } from 'next';
import { getTemplate } from '@/components/reveals/_registry';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.gao.social';

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;

  try {
    const db = getDB();
    const k = await db.prepare(
      `SELECT k.emoji, k.kiss_type, k.template_id, k.visibility,
              s.display_name AS sender_name
       FROM kisses k
       LEFT JOIN users s ON s.id = k.sender_id
       WHERE k.id = ? OR k.slug = ?`
    ).bind(id, id).first<{ emoji: string; kiss_type: string; template_id: string | null; visibility: string; sender_name: string }>();

    if (!k || k.visibility === 'private') {
      return { title: 'Kiss on LoVi' };
    }

    // Deliberately a teaser, not a spoiler — never surface k.message here.
    // The whole point of the share card is to make people curious enough
    // to tap, not to give the surprise away in the FB/Zalo/Twitter preview.
    const senderName = k.sender_name || 'Someone';
    const isDeclaration = k.kiss_type === 'declaration';
    const tpl = getTemplate(k.template_id);
    const title = isDeclaration
      ? `${k.emoji} ${senderName} declared love to the world 🌍`
      : `${k.emoji} ${senderName} sent you a secret gift`;
    const description = tpl
      ? `A "${tpl.name}" surprise is waiting for you. Tap to open it 🎁✨`
      : `Something special is waiting for you. Tap to open it 🎁✨`;
    const ogImage = `${BASE_URL}/api/og/kiss/${id}`;

    return {
      title,
      description,
      metadataBase: new URL(BASE_URL),
      openGraph: {
        title,
        description,
        type: 'website',
        url: `${BASE_URL}/kiss/${id}`,
        siteName: 'LoVi',
        images: [{ url: ogImage, width: 1200, height: 630 }],
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [ogImage],
      },
    };
  } catch {
    return { title: 'Kiss on LoVi' };
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
  let maxOpens = 20;
  // The URL segment may be a custom slug or the raw kiss ID — resolve to
  // the canonical ID so the /world?kiss= redirect target matches what the
  // map's already-loaded kiss list keys on.
  let canonicalId = id;
  try {
    const db = getDB();
    const row = await db.prepare(
      `SELECT k.id, k.emoji, k.open_count, k.max_opens, s.display_name AS sender_name
       FROM kisses k
       LEFT JOIN users s ON s.id = k.sender_id
       WHERE k.id = ? OR k.slug = ?`
    ).bind(id, id).first<{ id: string; emoji: string; open_count: number; max_opens: number; sender_name: string }>();
    if (row) {
      canonicalId = row.id;
      maxOpens = row.max_opens ?? 20;
      exhausted = (row.open_count ?? 0) >= maxOpens;
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
            but it has already been opened {maxOpens} times 💝
          </p>
          <a href="/world" style={{ display: 'inline-block', padding: '12px 28px', borderRadius: 12, background: 'linear-gradient(135deg, #f472b6, #ec4899)', color: '#fff', textDecoration: 'none', fontWeight: 700, fontSize: 13 }}>
            Back to home
          </a>
        </div>
      </div>
    );
  }

  redirect(`/world?kiss=${canonicalId}`);
}
