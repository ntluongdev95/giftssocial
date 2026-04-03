import { NextRequest, NextResponse } from 'next/server';

const ENDPOINTS: Record<string, string> = {
  crypto: 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=12&sparkline=true&price_change_percentage=24h',
  metals: 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=tether-gold,pax-gold,wrapped-bitcoin,staked-ether,dai,usd-coin&sparkline=true',
  trending: 'https://api.coingecko.com/api/v3/search/trending',
  news: 'https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Ffeeds.bbci.co.uk%2Fnews%2Fworld%2Frss.xml',
};

// Yahoo Finance quote symbols for stocks endpoint
const STOCK_SYMBOLS = [
  // Major indices
  '^GSPC', '^IXIC', '^DJI', '^RUT',
  // Top stocks
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'BRK-B',
  // Asia & EU indices
  '^N225', '^HSI', '^FTSE', '^GDAXI',
];

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get('type');

  // Stock market — special handler using Yahoo Finance
  if (type === 'stocks') {
    return handleStocks();
  }

  const url = type ? ENDPOINTS[type] : null;
  if (!url) return NextResponse.json({ error: 'invalid type' }, { status: 400 });

  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 60 },
    });
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    const data = await res.json();
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}

async function handleStocks() {
  try {
    const symbols = STOCK_SYMBOLS.join(',');
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols)}&fields=symbol,shortName,regularMarketPrice,regularMarketChangePercent,regularMarketChange,regularMarketPreviousClose,fiftyTwoWeekHigh,fiftyTwoWeekLow,marketCap`;

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        Accept: 'application/json',
      },
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      // Fallback: try v6 endpoint
      return handleStocksFallback();
    }

    const data = await res.json();
    const quotes = data?.quoteResponse?.result || [];

    const result = quotes.map((q: Record<string, unknown>) => ({
      symbol: q.symbol,
      name: q.shortName || q.symbol,
      price: q.regularMarketPrice,
      change: q.regularMarketChange,
      changePercent: q.regularMarketChangePercent,
      prevClose: q.regularMarketPreviousClose,
      high52w: q.fiftyTwoWeekHigh,
      low52w: q.fiftyTwoWeekLow,
      marketCap: q.marketCap,
    }));

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
    });
  } catch {
    return handleStocksFallback();
  }
}

// Fallback using Yahoo Finance v8 spark endpoint for mini charts
async function handleStocksFallback() {
  try {
    const symbols = STOCK_SYMBOLS.join(',');
    const url = `https://query1.finance.yahoo.com/v8/finance/spark?symbols=${encodeURIComponent(symbols)}&range=1d&interval=5m`;

    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
      next: { revalidate: 120 },
    });

    if (!res.ok) throw new Error(`yahoo ${res.status}`);
    const data = await res.json();

    const result = Object.entries(data).map(([symbol, val]: [string, unknown]) => {
      const v = val as { close?: number[]; previousClose?: number };
      const closes = v.close || [];
      const last = closes[closes.length - 1] || 0;
      const prev = v.previousClose || closes[0] || last;
      const change = last - prev;
      const changePercent = prev ? (change / prev) * 100 : 0;
      return {
        symbol,
        name: symbol,
        price: last,
        change,
        changePercent,
        prevClose: prev,
        spark: closes,
      };
    });

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300' },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
