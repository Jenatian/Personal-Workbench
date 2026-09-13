import { jsonResponse, errorResponse, corsHeaders, parseRSS } from '../_utils';

const SPEAKING_FEEDS = [
  { source: 'CommonSense ESL', url: 'https://commonsense-esl.com/feed/' },
  { source: 'Culips ESL', url: 'https://esl.culips.com/feed/podcast' },
  { source: 'All ESL', url: 'https://www.alesl.com/feed/' },
  { source: 'ESL Pod', url: 'https://eslpod.libsyn.com/rss' },
];

const READING_FEEDS = [
  { source: 'CommonSense ESL', url: 'https://commonsense-esl.com/feed/' },
  { source: 'Breaking News', url: 'https://breakingnewsenglish.com/rss.xml' },
  { source: 'News in Levels', url: 'https://www.newsinlevels.com/feed/' },
  { source: 'All ESL', url: 'https://www.alesl.com/feed/' },
];

function cleanTitle(title) {
  return (title || '')
    .replace(/^[\s\u2022\u2023\u25E6\u25AA\u25AB\u2043\u2219]+/, '') // 去掉开头的项目符号
    .replace(/^[•\-\*]\s*/, '')
    .trim();
}

function cleanExcerpt(text) {
  return (text || '').replace(/\s+/g, ' ').trim();
}

function isHomepageLink(link, feedUrl) {
  if (!link) return true;
  try {
    const u = new URL(link);
    const path = u.pathname.replace(/\/+$/, '');
    // 只有域名根路径(/)或空路径,算首页链接
    if (path === '' || path === '/') return true;
    return false;
  } catch (e) {
    return true;
  }
}

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
    const seenTitles = new Set();

    const fetchTasks = feeds.map(async (feed) => {
      try {
        const res = await fetch(feed.url, { cf: { cacheTtl: 600 } });
        if (!res.ok) return;
        const xml = await res.text();
        const parsed = parseRSS(xml);
        let count = 0;
        for (const item of parsed) {
          if (count >= 4) break;
          const title = cleanTitle(item.title);
          if (!title || title.length < 5) continue;
          // 过滤掉只有首页链接的文章
          if (isHomepageLink(item.link, feed.url)) continue;
          // 去重
          const titleKey = title.toLowerCase().slice(0, 50);
          if (seenTitles.has(titleKey)) continue;
          seenTitles.add(titleKey);

          const excerpt = cleanExcerpt(item.summary || '');
          const words = excerpt.split(/\s+/).length;
          items.push({
            source: feed.source,
            title: title,
            excerpt: excerpt.slice(0, 300),
            link: item.link,
            date: item.date,
            readTime: Math.max(1, Math.ceil(words / 150)),
          });
          count++;
        }
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
