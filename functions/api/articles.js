import { jsonResponse, errorResponse, corsHeaders, parseRSS } from '../_utils';

const SPEAKING_FEEDS = [
  { source: 'VOA Everyday', url: 'https://learningenglish.voanews.com/rss/' },
  { source: 'Culips ESL', url: 'https://esl.culips.com/feed/podcast' },
  { source: 'CommonSense ESL', url: 'https://commonsense-esl.com/feed/' },
];

const READING_FEEDS = [
  { source: 'VOA Learning', url: 'https://learningenglish.voanews.com/rss/' },
  { source: 'CommonSense ESL', url: 'https://commonsense-esl.com/feed/' },
  { source: 'Culips ESL', url: 'https://esl.culips.com/feed/podcast' },
];

export async function onRequestGet(context) {
  const { request, env, waitUntil } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(request.url);
  const category = url.searchParams.get('cat') || 'speaking';
  const forceRefresh = url.searchParams.get('refresh') === '1';

  try {
    const cacheKey = 'cache:articles:' + category;
    if (!forceRefresh) {
      const cached = await env.WORKBENCH_KV.get(cacheKey);
      if (cached) {
        const data = JSON.parse(cached);
        if (Date.now() - data.fetchedAt < 7200000) {
          return jsonResponse({ ok: true, ...data, cached: true });
        }
      }
    }

    const feeds = category === 'reading' ? READING_FEEDS : SPEAKING_FEEDS;
    const items = [];

    const fetchTasks = feeds.map(async (feed) => {
      try {
        const res = await fetch(feed.url, { cf: { cacheTtl: 600 } });
        if (!res.ok) return;
        const xml = await res.text();
        const parsed = parseRSS(xml);
        parsed.slice(0, 4).forEach((item) => {
          const words = (item.summary || '').split(/\s+/).length;
          items.push({
            source: feed.source,
            title: item.title,
            excerpt: (item.summary || '').slice(0, 300),
            link: item.link,
            date: item.date,
            readTime: Math.max(1, Math.ceil(words / 150)),
          });
        });
      } catch (e) {
        // 忽略单个源失败
      }
    });
    await Promise.all(fetchTasks);

    items.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    const data = {
      category,
      items: items.slice(0, 10),
      fetchedAt: Date.now(),
    };

    waitUntil(env.WORKBENCH_KV.put(cacheKey, JSON.stringify(data)));

    return jsonResponse({ ok: true, ...data });
  } catch (err) {
    return errorResponse(err.message);
  }
}
