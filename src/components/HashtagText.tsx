import Link from 'next/link';

// Same regex as src/lib/tags.ts but kept inline because slugify lives there.
// Keep these in sync if you change the rules.
const TAG_REGEX = /#([\p{L}\p{N}_-]{1,50})/gu;

function slugify(input: string): string {
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

type Props = {
  text: string | null | undefined;
  className?: string;
  tagClassName?: string;
};

// Render plain text with `#hashtag` segments turned into <Link> elements
// pointing at /t/<slug>. Non-tag text is preserved as-is, including newlines.
export function HashtagText({ text, className, tagClassName }: Props) {
  if (!text) return null;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let i = 0;

  for (const m of text.matchAll(TAG_REGEX)) {
    const start = m.index ?? 0;
    if (start > lastIndex) parts.push(text.slice(lastIndex, start));
    const raw = m[1];
    const slug = slugify(raw);
    if (slug) {
      parts.push(
        <Link
          key={`tag-${i++}-${slug}`}
          href={`/t/${slug}`}
          className={tagClassName ?? 'text-pink-600 hover:underline cursor-pointer'}
        >
          #{raw}
        </Link>,
      );
    } else {
      parts.push(m[0]);
    }
    lastIndex = start + m[0].length;
  }

  if (lastIndex < text.length) parts.push(text.slice(lastIndex));

  return <span className={className} style={{ whiteSpace: 'pre-wrap' }}>{parts}</span>;
}
