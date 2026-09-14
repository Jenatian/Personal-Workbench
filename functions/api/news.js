import { jsonResponse, errorResponse, corsHeaders, parseRSS, translateWithAI } from '../_utils';

const FEEDS = [
  { source: '量子位', url: 'https://www.qbitai.com/feed', lang: 'zh' },
  { source: '极客公园', url: 'https://www.geekpark.net/rss', lang: 'zh' },
  { source: 'IT之家', url: 'https://www.ithome.com/rss/', lang: 'zh' },
  { source: '虎嗅', url: 'https://rsshub.app/huxiu/article', lang: 'zh' },
  { source: 'OpenAI', url: 'https://openai.com/blog/rss.xml', lang: 'en' },
  { source: 'TechCrunch', url: 'https://techcrunch.com/category/artificial-intelligence/feed/', lang: 'en' },
];

const STOP_WORDS = new Set([
  '的', '了', '在', '是', '和', '与', '或', '等', '一个', '这个', '那个',
  '我们', '他们', '可以', '已经', '正在', '就是', '也是', '还是', '但是',
  '因为', '所以', '如果', '虽然', '不过', '然后', '这样', '那样',
  '什么', '怎么', '为什么', '多少', '哪些',
  '进行', '通过', '关于', '对于', '根据', '目前', '未来', '之后',
  '表示', '认为', '指出', '宣布', '发布', '推出', '上线', '开放',
  '今日', '昨日', '今天', '昨天', '今年', '明年',
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'are', 'was',
  'will', 'new', 'says', 'has', 'its', 'not', 'but', 'all', 'can',
  'how', 'why', 'what', 'who', 'via', 'into', 'ai', 'artificial',
  'intelligence', 'more', 'than', 'has', 'have', 'been', 'also',
]);

function extractKeywords(text) {
  const lower = (text || '').toLowerCase();
  const matches = lower.match(/[\u4e00-\u9fa5]{2,6}|[a-z][a-z0-9]{2,}/g) || [];
  const keywords = [];
  const seen = new Set();
  for (const w of matches) {
    if (STOP_WORDS.has(w) || seen.has(w)) continue;
    seen.add(w);
    keywords.push(w);
  }
  return keywords;
}

function computeHeat(items) {
  const allKeywords = items.map((item) =>
    extractKeywords((item.title || '') + ' ' + (item.summary || ''))
  );

  items.forEach((item, i) => {
    let heat = 1;
    const sourceSet = new Set([item.source]);

    for (let j = 0; j < items.length; j++) {
      if (j === i) continue;
      if (items[j].source === item.source) continue;

      const overlap = allKeywords[i].filter((k) => allKeywords[j].indexOf(k) !== -1);
      if (overlap.length >= 1) {
        heat += overlap.length;
        sourceSet.add(items[j].source);
      }
    }

    item.heat = heat;
    item.heatSources = sourceSet.size;
    item.heatLevel = sourceSet.size >= 3 ? 'high' : (sourceSet.size >= 2 ? 'medium' : 'normal');
  });
}

function isWithinDays(dateStr, days) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  const now = new Date();
  const diff = (now - d) / (1000 * 60 * 60 * 24);
  return diff >= 0 && diff <= days;
}

const AI_MODELS = [
  '@cf/zai-org/glm-4.7-flash',
  '@cf/qwen/qwq-32b',
];

function cleanAISummary(text) {
  if (!text) return '';
  let cleaned = text.trim();

  // Remove <think>...</think> blocks
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '');
  // Remove <thinking>...</thinking> blocks
  cleaned = cleaned.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');

  // If still very long, likely contains reasoning - take last paragraph
  if (cleaned.length > 300) {
    const paras = cleaned.split(/\n\s*\n/).filter((p) => p.trim().length > 20);
    if (paras.length > 1) {
      cleaned = paras[paras.length - 1].trim();
    }
  }

  // Remove common reasoning prefixes
  cleaned = cleaned.replace(/^(好的|首先|那么|嗯|根据|综合|总结来说|总的来说)[，,。]/i, '');
  cleaned = cleaned.trim();

  // If still too long, take last 2-3 sentences
  if (cleaned.length > 200) {
    const sentences = cleaned.split(/[。！？\n]/).filter((s) => s.trim().length > 5);
    if (sentences.length > 3) {
      cleaned = sentences.slice(-3).join('。') + '。';
    }
  }

  return cleaned.trim();
}

async function generateAISummary(env, topItems) {
  if (!env.AI || topItems.length === 0) return '';

  const newsText = topItems.slice(0, 10).map((item, i) =>
    (i + 1) + '. [' + item.source + '] ' + item.title +
    (item.summary ? ' - ' + item.summary : '')
  ).join('\n');

  const prompt = '以下是最新的AI行业新闻。请直接给出2-3句话的中文总结，概括今天AI圈的核心动态。直接输出总结内容，不要输出思考过程：\n\n' + newsText;

  for (const model of AI_MODELS) {
    try {
      const aiRes = await env.AI.run(model, {
        messages: [
          { role: 'system', content: '你直接输出新闻总结，不输出任何思考过程、分析步骤或"好的""首先"等开头语。直接给出总结段落。' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 1000,
      });

      let result = '';
      if (typeof aiRes === 'string') result = aiRes;
      else if (aiRes && aiRes.response) result = aiRes.response;
      else if (aiRes && aiRes.result) result = aiRes.result;

      result = cleanAISummary(result);
      if (result.length > 10 && result.length < 500) return result;
      if (result.length >= 500) return result.slice(0, 300);
    } catch (e) {
      // try next model
    }
  }

  return '';
}

export async function onRequestGet(context) {
  const { request, env, waitUntil } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(request.url);
  const forceRefresh = url.searchParams.get('refresh') === '1';

  try {
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
    const sourceStatus = {};

    const fetchHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    };

    const fetchTasks = FEEDS.map(async (feed) => {
      try {
        const res = await fetch(feed.url, {
          cf: { cacheTtl: 1800 },
          headers: fetchHeaders,
        });
        if (!res.ok) {
          sourceStatus[feed.source] = 'fail:' + res.status;
          return;
        }
        const xml = await res.text();
        const parsed = parseRSS(xml);
        sourceStatus[feed.source] = 'ok:' + parsed.length;

        const feedItems = parsed.slice(0, 6).map((item) => ({
          source: feed.source,
          title: item.title,
          summary: (item.summary || '').slice(0, 200),
          link: item.link,
          date: item.date,
          lang: feed.lang,
        }));

        if (feed.lang === 'en' && env.AI) {
          for (const item of feedItems) {
            try {
              item.title = await translateWithAI(env, item.title);
              item.summary = await translateWithAI(env, item.summary);
            } catch (e) {
              // keep original
            }
          }
        }

        items.push(...feedItems);
      } catch (e) {
        sourceStatus[feed.source] = 'error';
      }
    });
    await Promise.all(fetchTasks);

    // Filter to last 2 days; relax to 7 if too few
    let filtered = items.filter((item) => isWithinDays(item.date, 2));
    if (filtered.length < 5) {
      filtered = items.filter((item) => isWithinDays(item.date, 7));
    }
    // If still too few, use all items
    if (filtered.length < 3) {
      filtered = items;
    }

    // Compute heat scores
    computeHeat(filtered);

    // Sort: heat desc, then date desc
    filtered.sort((a, b) => {
      if (b.heat !== a.heat) return b.heat - a.heat;
      return (b.date || '').localeCompare(a.date || '');
    });

    const top = filtered.slice(0, 15);

    // Generate AI summary
    let summary = await generateAISummary(env, top);
    let aiModelUsed = summary ? true : false;

    if (!summary) {
      const sources = [...new Set(top.slice(0, 5).map((i) => i.source))];
      const titles = top.slice(0, 3).map((i) => i.title);
      summary = '今日AI热点来自' + sources.join('、') + '等来源。关注：' + titles.join('；') + '。';
    }

    const data = {
      summary,
      aiSummary: aiModelUsed,
      items: top,
      date: today,
      fetchedAt: Date.now(),
      sources: sourceStatus,
    };

    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const ttl = Math.ceil((tomorrow - now) / 1000);
    waitUntil(env.WORKBENCH_KV.put(cacheKey, JSON.stringify(data), { expirationTtl: ttl }));

    return jsonResponse({ ok: true, ...data });
  } catch (err) {
    return errorResponse(err.message);
  }
}
