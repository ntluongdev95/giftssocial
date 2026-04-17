import { NextRequest, NextResponse } from 'next/server';

// CoinGecko public endpoints — User-Agent required as of 2026-04
const COINGECKO_ENDPOINTS: Record<string, string> = {
  crypto:   'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=12&sparkline=true&price_change_percentage=24h',
  metals:   'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=tether-gold,pax-gold,wrapped-bitcoin,staked-ether,dai,usd-coin&sparkline=true',
  trending: 'https://api.coingecko.com/api/v3/search/trending',
};

const COINGECKO_HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'GaoSocial/1.0',
};

// BBC World News RSS — direct fetch, no third-party bridge
const BBC_RSS_URL = 'https://feeds.bbci.co.uk/news/world/rss.xml';

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get('type');

  if (type === 'news')   return handleNews();
  if (type === 'stocks') return handleStocks();

  const url = type ? COINGECKO_ENDPOINTS[type] : null;
  if (!url) return NextResponse.json({ error: 'invalid type' }, { status: 400 });

  try {
    const res = await fetch(url, {
      headers: COINGECKO_HEADERS,
      next: { revalidate: 60 },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '(unreadable)');
      console.error(`[live] upstream error type=${type} status=${res.status} url=${url} body=${body.slice(0, 300)}`);
      throw new Error(`upstream ${res.status}`);
    }
    const data = await res.json();
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
    });
  } catch (e) {
    console.error(`[live] fetch failed type=${type} error=${String(e)}`);
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}

// ── News: direct BBC RSS parse — no third-party rate limits ──────────────────

function extractRssText(block: string, tag: string): string | null {
  // Handles plain text and CDATA-wrapped values
  const re = new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`);
  const m = block.match(re);
  return m ? m[1].trim() : null;
}

async function handleNews(): Promise<NextResponse> {
  try {
    const res = await fetch(BBC_RSS_URL, {
      headers: { Accept: 'application/rss+xml, application/xml, text/xml' },
      next: { revalidate: 60 },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '(unreadable)');
      console.error(`[live] upstream error type=news status=${res.status} url=${BBC_RSS_URL} body=${body.slice(0, 300)}`);
      throw new Error(`upstream ${res.status}`);
    }

    const xml = await res.text();
    const items: { title: string; link: string; pubDate: string; thumbnail?: string; description?: string }[] = [];
    const itemRe = /<item>([\s\S]*?)<\/item>/g;
    let m: RegExpExecArray | null;

    while ((m = itemRe.exec(xml)) !== null) {
      const block = m[1];
      const title = extractRssText(block, 'title');
      const link  = extractRssText(block, 'link');
      if (!title || !link) continue;

      const pubDate     = extractRssText(block, 'pubDate') ?? '';
      const description = extractRssText(block, 'description') ?? undefined;
      const thumbMatch  = block.match(/<media:thumbnail[^>]+url="([^"]+)"/);

      items.push({
        title,
        link,
        pubDate,
        description,
        thumbnail: thumbMatch ? thumbMatch[1] : undefined,
      });
    }

    // Preserve { items: [...] } shape — same contract as former RSS2JSON response
    return NextResponse.json({ items }, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
    });
  } catch (e) {
    console.error(`[live] fetch failed type=news error=${String(e)}`);
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}

// ── Stocks: Yahoo Finance v7/v8 revoked auth — return empty array ────────────
// Preserves StockItem[] contract; consumers handle empty array gracefully.
// Replace this function when a free authenticated provider is available.

function handleStocks(): NextResponse {
  return NextResponse.json([], {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
  });
}
