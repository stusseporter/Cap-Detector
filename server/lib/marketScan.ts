interface TickerData {
  ticker: string;
  price: number | null;
  change_pct: number | null;
  open: number | null;
  prev_close: number | null;
  day_high: number | null;
  day_low: number | null;
  week52_high: number | null;
  week52_low: number | null;
  volume: number | null;
  avg_volume: number | null;
  news_headlines: string[];
}

async function fetchTickerData(ticker: string): Promise<TickerData> {
  const result: TickerData = {
    ticker,
    price: null,
    change_pct: null,
    open: null,
    prev_close: null,
    day_high: null,
    day_low: null,
    week52_high: null,
    week52_low: null,
    volume: null,
    avg_volume: null,
    news_headlines: [],
  };

  try {
    const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=5d`;
    const chartRes = await fetch(chartUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });

    if (chartRes.ok) {
      const chartData = await chartRes.json() as Record<string, unknown>;
      const chartResult = (chartData as { chart?: { result?: unknown[] } }).chart?.result?.[0] as Record<string, unknown> | undefined;
      if (chartResult) {
        const meta = chartResult.meta as Record<string, unknown> | undefined;
        if (meta) {
          result.price = (meta.regularMarketPrice as number) ?? null;
          result.prev_close = (meta.previousClose as number) ?? null;
          result.open = (meta.regularMarketOpen as number) ?? null;
          result.day_high = (meta.regularMarketDayHigh as number) ?? null;
          result.day_low = (meta.regularMarketDayLow as number) ?? null;
          result.week52_high = (meta.fiftyTwoWeekHigh as number) ?? null;
          result.week52_low = (meta.fiftyTwoWeekLow as number) ?? null;
          result.volume = (meta.regularMarketVolume as number) ?? null;
          if (result.price && result.prev_close) {
            result.change_pct = ((result.price - result.prev_close) / result.prev_close) * 100;
          }
        }
      }
    }
  } catch {
    // silently continue
  }

  try {
    const newsUrl = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(ticker)}&newsCount=5`;
    const newsRes = await fetch(newsUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });

    if (newsRes.ok) {
      const newsData = await newsRes.json() as Record<string, unknown>;
      const newsItems = (newsData as { news?: Array<{ title?: string }> }).news ?? [];
      result.news_headlines = newsItems
        .map((n) => n.title ?? '')
        .filter(Boolean)
        .slice(0, 5);
    }
  } catch {
    // silently continue
  }

  return result;
}

function fmt(val: number | null, decimals = 2): string {
  if (val === null) return 'N/A';
  return val.toFixed(decimals);
}

function fmtVol(val: number | null): string {
  if (val === null) return 'N/A';
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(0)}K`;
  return String(val);
}

export async function marketScan(tickers: string[]): Promise<string> {
  const timestamp = new Date().toUTCString();
  const lines: string[] = [`=== MARKET SCAN — ${timestamp} ===\n`];

  const results = await Promise.allSettled(tickers.map(fetchTickerData));

  for (const result of results) {
    if (result.status === 'fulfilled') {
      const d = result.value;
      const changePct = d.change_pct !== null ? `${d.change_pct >= 0 ? '+' : ''}${fmt(d.change_pct)}%` : 'N/A';
      lines.push(`[${d.ticker}]`);
      lines.push(`  Price: $${fmt(d.price)}  Change: ${changePct}`);
      lines.push(`  Open: $${fmt(d.open)}  Prev Close: $${fmt(d.prev_close)}`);
      lines.push(`  Day Range: $${fmt(d.day_low)} – $${fmt(d.day_high)}`);
      lines.push(`  52W Range: $${fmt(d.week52_low)} – $${fmt(d.week52_high)}`);
      lines.push(`  Volume: ${fmtVol(d.volume)}  Avg Volume: ${fmtVol(d.avg_volume)}`);
      if (d.news_headlines.length > 0) {
        lines.push(`  Recent News:`);
        d.news_headlines.forEach((h) => lines.push(`    • ${h}`));
      }
      lines.push('');
    } else {
      const ticker = tickers[results.indexOf(result)];
      lines.push(`[${ticker}] Market scan failed for ${ticker} — agents will proceed with available context.\n`);
    }
  }

  return lines.join('\n');
}
