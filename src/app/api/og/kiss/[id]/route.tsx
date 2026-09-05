import { ImageResponse } from 'next/og';
import { getDB } from '@/lib/db';
import { getTemplate } from '@/components/reveals/_registry';

// ─── GET /api/og/kiss/:id — dynamic share-card image ────────────────────
// Rendered as the og:image / twitter:image for /kiss/[id] links. Deliberately
// teases (sender name + gift emoji + template mood) without revealing the
// message — the whole point is to make people curious enough to tap.

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let emoji = '💝';
  let senderName = 'Someone';
  let thumbnailBg = 'linear-gradient(135deg, #1a0b18, #ec4899, #f472b6)';
  let isDeclaration = false;

  try {
    const db = getDB();
    const row = await db.prepare(
      `SELECT k.emoji, k.kiss_type, k.template_id, k.visibility, s.display_name AS sender_name
       FROM kisses k
       LEFT JOIN users s ON s.id = k.sender_id
       WHERE (k.id = ? OR k.slug = ?) AND k.visibility != 'private'`
    ).bind(id, id).first<{ emoji: string; kiss_type: string; template_id: string | null; sender_name: string }>();

    if (row) {
      emoji = row.emoji || emoji;
      senderName = row.sender_name || senderName;
      isDeclaration = row.kiss_type === 'declaration';
      const tpl = getTemplate(row.template_id);
      if (tpl?.thumbnailBg) thumbnailBg = tpl.thumbnailBg;
    }
  } catch { /* fall back to teaser defaults below */ }

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: thumbnailBg,
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div style={{ fontSize: 200, lineHeight: 1, display: 'flex', filter: 'drop-shadow(0 8px 30px rgba(0,0,0,0.45))' }}>
          {emoji}
        </div>
        <div
          style={{
            marginTop: 28,
            fontSize: 46,
            fontWeight: 800,
            color: '#fff',
            textShadow: '0 3px 14px rgba(0,0,0,0.55)',
            display: 'flex',
          }}
        >
          {isDeclaration ? `${senderName} declared love to the world` : `${senderName} sent you a gift`}
        </div>
        <div
          style={{
            marginTop: 14,
            fontSize: 26,
            color: 'rgba(255,255,255,0.88)',
            textShadow: '0 2px 10px rgba(0,0,0,0.5)',
            display: 'flex',
          }}
        >
          Tap to open and see what&apos;s inside ✨
        </div>
        <div
          style={{
            position: 'absolute',
            bottom: 36,
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: 4,
            color: 'rgba(255,255,255,0.7)',
            display: 'flex',
          }}
        >
          LOVI
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
