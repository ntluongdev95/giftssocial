import { genId } from './db';

// Match `#word` where word can contain unicode letters/digits (so Vietnamese
// diacritics and Chinese chars work), underscores, dashes. 1–50 chars.
const TAG_REGEX = /#([\p{L}\p{N}_-]{1,50})/gu;

const MAX_TAGS_PER_POST = 20;

export function extractTagsFromText(text: string | null | undefined): string[] {
  if (!text) return [];
  const found = new Set<string>();
  for (const m of text.matchAll(TAG_REGEX)) {
    const raw = m[1];
    if (raw) found.add(raw);
    if (found.size >= MAX_TAGS_PER_POST) break;
  }
  return Array.from(found);
}

// "Phở Bò" → "pho-bo", "Món Ngon!" → "mon-ngon", "café" → "cafe"
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export type TaggableEntity = {
  type: 'review' | 'checkin' | 'event';
  id: string;
  authorId?: string | null;
};

// Upsert each raw tag into `tags`, then link it to the entity. Idempotent:
// re-tagging the same entity does not double-count. Returns the slugs
// successfully linked, in input order.
export async function upsertAndLinkTags(
  db: D1Database,
  rawTags: string[],
  entity: TaggableEntity,
): Promise<string[]> {
  const linkedSlugs: string[] = [];

  for (const raw of rawTags) {
    const slug = slugify(raw);
    if (!slug) continue;

    const newId = genId('tag_');
    await db
      .prepare('INSERT OR IGNORE INTO tags (id, slug, display_name) VALUES (?, ?, ?)')
      .bind(newId, slug, raw)
      .run();

    const tag = await db
      .prepare('SELECT id FROM tags WHERE slug = ?')
      .bind(slug)
      .first<{ id: string }>();
    if (!tag) continue;

    const linkRes = await db
      .prepare(
        `INSERT OR IGNORE INTO tag_links (tag_id, entity_type, entity_id, author_id)
         VALUES (?, ?, ?, ?)`,
      )
      .bind(tag.id, entity.type, entity.id, entity.authorId ?? null)
      .run();

    const changes = (linkRes.meta as { changes?: number } | undefined)?.changes ?? 0;
    if (changes > 0) {
      await db
        .prepare(
          "UPDATE tags SET use_count = use_count + 1, updated_at = datetime('now') WHERE id = ?",
        )
        .bind(tag.id)
        .run();
    }
    linkedSlugs.push(slug);
  }

  return linkedSlugs;
}
