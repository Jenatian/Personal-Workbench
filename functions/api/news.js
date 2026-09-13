import { jsonResponse, errorResponse, corsHeaders, parseRSS } from '../_utils';

const FEEDS = [
  { source: '机器之心', url: 'https://www.jiqizhixin.com/rss', lang: 'zh' },
  { source: '36氪AI', url: 'https://36kr.com/feed', lang: 'zh' },
  { source: '量子位', url: 'https://www.qbitai.com/feed', lang: 'zh' },
  { source: 'InfoQ AI', url: 'https://www.infoq.cn/topic/ai/rss', lang: 'zh' },
  { source: '极客公园', url: 'https://www.geekpark.net/rss', lang: 'zh' },
];

export async function onRequestGet(context) {
  const { request, env, waitUntil } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(request.url);
  const forceRefresh = url.searchParams.get('refresh') === '1';

  try {
    // 按日期缓存,每天 0 点自动刷新
    const today = new Date().toISOString().slice(0, 10);
    const cacheKey = 'cache:news:' + today;

    if (!forceRefresh) {
      const cached = await env.WORKBENCH_KV.get(cacheKey);
      if (cached) {
        const data = JSON.parse(cached);
        return jsonResponse({ ok: true, ...data, cached: true });
      }
    }

    const items = [];
    const fetchTasks = FEEDS.map(async (feed) => {
      try {
        const res = await fetch(feed.url, { cf: { cacheTtl: 1800 } });
        if (!res.ok) return;
        const xml = await res.text();
        const parsed = parseRSS(xml);
        parsed.slice(0, 4).forEach((item) => {
          items.push({
            source: feed.source,
            title: item.title,
            summary: (item.summary || '').slice(0, 200),
            link: item.link,
            date: item.date,
            lang: feed.lang,
          });
        });
      } catch (e) {
        // 忽略单个源失败
      }
    });
    await Promise.all(fetchTasks);

    items.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const top = items.slice(0, 15);

    // 生成速览
    const sources = [...new Set(top.slice(0, 5).map((i) => i.source))];
    const titles = top.slice(0, 3).map((i) => i.title);
    const summary = '今日AI热点来自' + sources.join('、') + '等来源。关注：' + titles.join('；') + '。';

    const data = {
      summary,
      items: top,
      date: today,
      fetchedAt: Date.now(),
    };

    // 缓存到当天结束(秒)
    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const ttl = Math.ceil((tomorrow - now) / 1000);
    waitUntil(env.WORKBENCH_KV.put(cacheKey, JSON.stringify(data), { expirationTtl: ttl }));

    return jsonResponse({ ok: true, ...data });
  } catch (err) {
    return errorResponse(err.message);
  }
}
