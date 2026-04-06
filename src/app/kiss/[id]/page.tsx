import { redirect } from 'next/navigation';
import { pgPool } from '@/lib/db';
import type { Metadata } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.gao.social';

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;

  try {
    const result = await pgPool.query(
      `SELECT k.emoji, k.message, k.visibility,
              s.display_name AS sender_name, s.avatar_url AS sender_avatar,
              r.display_name AS receiver_name
       FROM kisses k
       LEFT JOIN users s ON s.id = k.sender_id
       LEFT JOIN users r ON r.id = k.receiver_id
       WHERE k.id = $1`,
      [id]
    );

    if (result.rows.length === 0 || result.rows[0].visibility === 'private') {
      return { title: 'Kiss on Gao Social' };
    }

    const k = result.rows[0];
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

export default async function KissSharePage({ params }: Props) {
  const { id } = await params;
  redirect(`/world?kiss=${id}`);
}
