import { jsonResponse, errorResponse, corsHeaders, parseRSS, translateWithAI } from '../_utils';

const FEEDS = [
  { source: '机器之心', url: 'https://www.jiqizhixin.com/rss', lang: 'zh' },
  { source: '36氪AI', url: 'https://36kr.com/feed', lang: 'zh' },
  { source: 'InfoQ', url: 'https://www.infoq.cn/rss.xml', lang: 'zh' },
  { source: 'OpenAI', url: 'https://openai.com/blog/rss.xml', lang: 'en' },
  { source: 'MIT Tech', url: 'https://www.technologyreview.com/feed/', lang: 'en' },
];

export async function onRequestGet(context) {
  const { request, env, waitUntil } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(request.url);
  const forceRefresh = url.searchParams.get('refresh') === '1';

  try {
    // 缓存
    const cacheKey = 'cache:news';
    if (!forceRefresh) {
      const cached = await env.WORKBENCH_KV.get(cacheKey);
      if (cached) {
        const data = JSON.parse(cached);
        if (Date.now() - data.fetchedAt < 3600000) {
          return jsonResponse({ ok: true, ...data, cached: true });
        }
      }
    }

    const items = [];
    const fetchTasks = FEEDS.map(async (feed) => {
      try {
        const res = await fetch(feed.url, { cf: { cacheTtl: 300 } });
        if (!res.ok) return;
        const xml = await res.text();
        const parsed = parseRSS(xml);
        parsed.slice(0, 3).forEach((item) => {
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

    // 翻译英文文章
    const translateTasks = top.map(async (item) => {
      if (item.lang === 'en') {
        try {
          item.titleZh = await translateWithAI(env, item.title);
          item.summaryZh = await translateWithAI(env, item.summary);
        } catch (e) {
          item.titleZh = item.title;
          item.summaryZh = item.summary;
        }
      } else {
        item.titleZh = item.title;
        item.summaryZh = item.summary;
      }
    });
    await Promise.all(translateTasks);

    // 生成速览
    const sources = [...new Set(top.slice(0, 5).map((i) => i.source))];
    const titles = top.slice(0, 3).map((i) => i.titleZh || i.title);
    const summary = '今日AI热点来自' + sources.join('、') + '等来源。关注：' + titles.join('；') + '。';

    const data = {
      summary,
      items: top,
      fetchedAt: Date.now(),
    };

    waitUntil(env.WORKBENCH_KV.put(cacheKey, JSON.stringify(data)));

    return jsonResponse({ ok: true, ...data });
  } catch (err) {
    return errorResponse(err.message);
  }
}
