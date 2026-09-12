/**
 * 个人工作台 - Cloudflare Worker
 * 三合一: 数据同步 + RSS抓取 + 天气代理
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // CORS
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
      'Access-Control-Max-Age': '86400',
    };

    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const headers = Object.assign({}, corsHeaders, { 'Content-Type': 'application/json; charset=utf-8' });

    try {
      // ===== 路由 =====
      if (path === '/api/sync' && method === 'GET') {
        return await handleSyncGet(request, env, headers);
      }
      if (path === '/api/sync' && method === 'POST') {
        return await handleSyncPost(request, env, headers);
      }
      if (path === '/api/news' && method === 'GET') {
        return await handleNews(env, url, headers, ctx);
      }
      if (path === '/api/articles' && method === 'GET') {
        return await handleArticles(env, url, headers, ctx);
      }
      if (path === '/api/weather' && method === 'GET') {
        return await handleWeather(env, url, headers, ctx);
      }
      if (path === '/api/knowledge' && method === 'GET') {
        return await handleKnowledge(env, url, headers);
      }
      if (path === '/api/translate' && method === 'POST') {
        return await handleTranslate(request, env, headers);
      }

      // Pages 静态资源: 非 API 请求交给 Pages 托管
      return env.ASSETS.fetch(request);
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
    }
  },
};

// ===== 用户ID (简化版,正式版需鉴权) =====
function getUserId(request, url) {
  return url.searchParams.get('uid') || request.headers.get('X-User-Id') || 'default';
}

// ===== /api/sync GET - 拉取数据 =====
async function handleSyncGet(request, env, headers) {
  const url = new URL(request.url);
  const userId = getUserId(request, url);

  const data = {};
  const keys = ['schedule', 'accounting'];

  for (const key of keys) {
    const raw = await env.WORKBENCH_KV.get(userId + ':' + key);
    data[key] = raw ? JSON.parse(raw) : [];
  }

  return new Response(JSON.stringify({ ok: true, data }), { headers });
}

// ===== /api/sync POST - 推送数据 =====
async function handleSyncPost(request, env, headers) {
  const url = new URL(request.url);
  const userId = getUserId(request, url);
  const body = await request.json();

  const results = {};
  const keys = ['schedule', 'accounting'];

  for (const key of keys) {
    if (body[key] !== undefined) {
      await env.WORKBENCH_KV.put(userId + ':' + key, JSON.stringify(body[key]));
      results[key] = 'ok';
    }
  }

  return new Response(JSON.stringify({ ok: true, saved: results, syncedAt: new Date().toISOString() }), { headers });
}

// ===== /api/news - AI资讯RSS抓取 =====
async function handleNews(env, url, headers, ctx) {
  const forceRefresh = url.searchParams.get('refresh') === '1';

  // 检查缓存 (1小时过期)
  if (!forceRefresh) {
    const cached = await env.WORKBENCH_KV.get('cache:news');
    if (cached) {
      const data = JSON.parse(cached);
      if (Date.now() - data.fetchedAt < 3600000) {
        return new Response(JSON.stringify({ ok: true, ...data, cached: true }), { headers });
      }
    }
  }

  const feeds = [
    { source: '机器之心', url: 'https://www.jiqizhixin.com/rss', lang: 'zh' },
    { source: '36氪AI', url: 'https://36kr.com/feed', lang: 'zh' },
    { source: 'InfoQ', url: 'https://www.infoq.cn/rss.xml', lang: 'zh' },
    { source: 'OpenAI', url: 'https://openai.com/blog/rss.xml', lang: 'en' },
    { source: 'MIT Tech', url: 'https://www.technologyreview.com/feed/', lang: 'en' },
  ];

  const items = [];
  const fetchTasks = feeds.map(async (feed) => {
    try {
      const res = await fetch(feed.url, {
        headers: { 'User-Agent': 'Mozilla/5.0 WorkbenchBot/1.0' },
        cf: { cacheTtl: 300 },
      });
      if (!res.ok) return;
      const xml = await res.text();
      const parsed = parseRSS(xml);
      parsed.slice(0, 3).forEach((item) => {
        items.push({
          source: feed.source,
          title: item.title,
          summary: stripHtml(item.summary).slice(0, 200),
          link: item.link,
          date: item.date,
          lang: feed.lang,
        });
      });
    } catch (e) {
      // 静默跳过失败的源
    }
  });

  await Promise.all(fetchTasks);

  // 按日期排序,取前15条
  items.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const top = items.slice(0, 15);

  // 对英文文章翻译标题和摘要 (使用 Cloudflare Workers AI)
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

  // 生成速览总结
  const summary = generateNewsSummary(top);

  const data = {
    summary,
    items: top,
    fetchedAt: Date.now(),
  };

  // 写缓存
  ctx.waitUntil(env.WORKBENCH_KV.put('cache:news', JSON.stringify(data)));

  return new Response(JSON.stringify({ ok: true, ...data }), { headers });
}

// ===== /api/articles - 外语外刊RSS抓取 =====
async function handleArticles(env, url, headers, ctx) {
  const category = url.searchParams.get('cat') || 'speaking';
  const forceRefresh = url.searchParams.get('refresh') === '1';

  const cacheKey = 'cache:articles:' + category;
  if (!forceRefresh) {
    const cached = await env.WORKBENCH_KV.get(cacheKey);
    if (cached) {
      const data = JSON.parse(cached);
      if (Date.now() - data.fetchedAt < 7200000) {
        return new Response(JSON.stringify({ ok: true, ...data, cached: true }), { headers });
      }
    }
  }

  const feeds = category === 'reading'
    ? [
        { source: 'VOA Learning', url: 'https://learningenglish.voanews.com/rss/' },
        { source: 'CommonSense ESL', url: 'https://commonsense-esl.com/feed/' },
        { source: 'Culips ESL', url: 'https://esl.culips.com/feed/podcast' },
      ]
    : [
        { source: 'VOA Everyday', url: 'https://learningenglish.voanews.com/rss/' },
        { source: 'Culips ESL', url: 'https://esl.culips.com/feed/podcast' },
        { source: 'CommonSense ESL', url: 'https://commonsense-esl.com/feed/' },
      ];

  const items = [];
  const fetchTasks = feeds.map(async (feed) => {
    try {
      const res = await fetch(feed.url, {
        headers: { 'User-Agent': 'Mozilla/5.0 WorkbenchBot/1.0' },
        cf: { cacheTtl: 600 },
      });
      if (!res.ok) return;
      const xml = await res.text();
      const parsed = parseRSS(xml);
      parsed.slice(0, 5).forEach((item) => {
        const text = stripHtml(item.summary);
        items.push({
          source: feed.source,
          title: item.title,
          excerpt: text.slice(0, 150),
          link: item.link,
          date: item.date,
          readTime: Math.max(1, Math.ceil(text.split(' ').length / 200)),
        });
      });
    } catch (e) {
      // 静默跳过
    }
  });

  await Promise.all(fetchTasks);
  items.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const top = items.slice(0, 12);

  const data = {
    category,
    items: top,
    fetchedAt: Date.now(),
  };

  ctx.waitUntil(env.WORKBENCH_KV.put(cacheKey, JSON.stringify(data)));

  return new Response(JSON.stringify({ ok: true, ...data }), { headers });
}

// ===== /api/knowledge - AI PM 每日知识 =====
async function handleKnowledge(env, url, headers) {
  const today = new Date().toISOString().slice(0, 10);
  const cacheKey = 'cache:knowledge:' + today;

  const cached = await env.WORKBENCH_KV.get(cacheKey);
  if (cached) {
    return new Response(JSON.stringify({ ok: true, ...JSON.parse(cached), cached: true }), { headers });
  }

  // 预设知识库 (可后续扩展为从外部获取)
  const knowledgeBase = [
    {
      type: 'AI PM 知识',
      title: 'RAG（检索增强生成）原理与产品落地',
      desc: 'RAG = Retrieval-Augmented Generation，通过先从知识库检索相关信息、再让大模型基于检索结果生成回答，解决 LLM 幻觉和知识时效性问题。产品设计中需关注：文档分块策略、向量数据库选型、检索准确率评估、以及成本与延迟的平衡。',
      tags: ['检索增强', '向量数据库', '幻觉控制', '知识库'],
    },
    {
      type: '行业分析',
      title: 'AI 产品的核心指标体系搭建',
      desc: 'AI 产品不同于传统产品，需同时关注模型层指标（准确率、召回率、幻觉率）和产品层指标（用户满意度、采纳率、留存）。好的 AI PM 会在模型迭代和用户体验之间找到平衡点。',
      tags: ['产品指标', '模型评估', '用户留存'],
    },
    {
      type: 'AI PM 知识',
      title: 'Prompt Engineering 产品设计要点',
      desc: 'Prompt 是 AI 产品的"接口层"。好的 PM 需理解 system prompt、few-shot、chain-of-thought 等技术，并设计可迭代、可评估的 prompt 管理流程，而非硬编码在代码里。',
      tags: ['Prompt工程', 'System Prompt', 'Few-shot', 'CoT'],
    },
    {
      type: '行业分析',
      title: '大模型定价策略与成本控制',
      desc: 'Token 计费模式下，AI 产品需在用户体验和成本间平衡。关键策略：合理选择模型层级（大模型 vs 小模型）、缓存高频问答、压缩上下文、以及设计合理的免费/付费分层。',
      tags: ['Token成本', '模型选型', '分层定价', '缓存策略'],
    },
    {
      type: 'AI PM 知识',
      title: 'Agent（智能体）产品设计框架',
      desc: 'Agent = LLM + 工具调用 + 规划。产品设计需定义：可用工具集、任务分解策略、执行反馈机制、安全边界。典型应用：自动客服、数据分析助手、代码生成。',
      tags: ['Agent', '工具调用', '任务规划', '安全边界'],
    },
    {
      type: '行业分析',
      title: 'AI 产品合规与安全设计',
      desc: '国内外AI监管趋严。PM需关注：内容安全过滤、数据隐私合规（GDPR/个保法）、算法备案、生成内容标识、未成年人保护。合规不是阻碍，而是产品信任的基石。',
      tags: ['合规', '数据隐私', '算法备案', '内容安全'],
    },
    {
      type: 'AI PM 知识',
      title: 'Fine-tuning vs RAG: 何时用哪个',
      desc: 'Fine-tuning 适合：固定风格/格式输出、领域知识深度嵌入。RAG 适合：知识频繁更新、多文档检索、需引用来源。多数场景先用 RAG，效果不足再考虑 Fine-tuning。',
      tags: ['Fine-tuning', 'RAG', '模型微调', '知识更新'],
    },
    {
      type: '行业分析',
      title: 'AI Native 产品 vs AI Feature',
      desc: 'AI Native: 如果去掉 AI 产品就不存在（如 ChatGPT）。AI Feature: AI 是增强项，去掉后核心功能仍在（如搜索中的 AI 摘要）。PM 需明确产品定位，决定 AI 投入深度。',
      tags: ['AI Native', '产品定位', 'AI Feature'],
    },
  ];

  // 按日期轮换
  const dayIndex = Math.floor(Date.now() / 86400000) % knowledgeBase.length;
  const item = knowledgeBase[dayIndex];

  // 选两个: 今日知识 + 补充知识
  const item2 = knowledgeBase[(dayIndex + 1) % knowledgeBase.length];

  const data = {
    date: today,
    items: [item, item2],
  };

  // 缓存一天
  await env.WORKBENCH_KV.put(cacheKey, JSON.stringify(data), { expirationTtl: 86400 });

  return new Response(JSON.stringify({ ok: true, ...data }), { headers });
}

// ===== /api/weather - 和风天气代理 =====
async function handleWeather(env, url, headers, ctx) {
  const lat = url.searchParams.get('lat');
  const lon = url.searchParams.get('lon');
  const apiKey = env.QWEATHER_API_KEY;

  if (!apiKey) {
    return new Response(JSON.stringify({
      ok: false,
      error: '未配置和风天气 API Key',
      fallback: { city: '未配置', text: '未知', temp: '--', wind: '' },
    }), { headers });
  }

  if (!lat || !lon) {
    return new Response(JSON.stringify({ ok: false, error: '缺少经纬度参数' }), { status: 400, headers });
  }

  // 检查缓存 (30分钟)
  const cacheKey = 'cache:weather:' + lat + ':' + lon;
  const cached = await env.WORKBENCH_KV.get(cacheKey);
  if (cached) {
    const data = JSON.parse(cached);
    if (Date.now() - data.fetchedAt < 1800000) {
      return new Response(JSON.stringify({ ok: true, ...data, cached: true }), { headers });
    }
  }

  try {
    // 和风天气新版 API: 使用独立 API Host + v1 接口
    const apiHost = env.QWEATHER_API_HOST || 'abc.qweatherapi.com';
    // v1 实时天气接口: /weather/v1/current/{lat}/{lon}
    const weatherUrl = 'https://' + apiHost + '/weather/v1/current/' + lat + '/' + lon + '?key=' + apiKey;
    const wRes = await fetch(weatherUrl);
    const wJson = await wRes.json();

    let weatherData = { text: '未知', temp: '--', wind: '' };

    if (wJson && wJson.condition) {
      const windDir = wJson.wind?.direction?.compass || '';
      const windScale = wJson.wind?.scale || '';
      const windDirMap = { n: '北风', nne: '北东北风', ne: '东北风', ene: '东东北风', e: '东风', ese: '东东南风', se: '东南风', sse: '南东南风', s: '南风', ssw: '南西南风', sw: '西南风', wsw: '西西南风', w: '西风', wnw: '西西北风', nw: '西北风', nnw: '北西北风' };
      weatherData = {
        text: wJson.condition.text || '未知',
        temp: wJson.temperature?.value != null ? String(wJson.temperature.value) : '--',
        wind: (windDirMap[windDir] || windDir) + ' ' + windScale + '级',
        humidity: wJson.humidity != null ? String(Math.round(wJson.humidity * 100)) + '%' : '',
        feelsLike: wJson.feelsLike?.value != null ? String(wJson.feelsLike.value) : '',
      };
    }

    // 城市名: 通过 GeoAPI 反查
    let cityName = '当前位置';
    const cityUrl = 'https://' + apiHost + '/geo/v2/city/lookup?location=' + lon + ',' + lat + '&key=' + apiKey;
    const cityRes = await fetch(cityUrl);
    const cityData = await cityRes.json();
    if (cityData && cityData.location && cityData.location.length > 0) {
      cityName = cityData.location[0].name;
    }

    const data = {
      city: cityName,
      ...weatherData,
      fetchedAt: Date.now(),
    };

    ctx.waitUntil(env.WORKBENCH_KV.put(cacheKey, JSON.stringify(data), { expirationTtl: 1800 }));

    return new Response(JSON.stringify({ ok: true, ...data }), { headers });
  } catch (err) {
    return new Response(JSON.stringify({
      ok: false,
      error: '天气获取失败: ' + err.message,
      fallback: { city: '获取失败', text: '未知', temp: '--', wind: '' },
    }), { headers });
  }
}

// ===== /api/translate POST - 按需翻译 =====
async function handleTranslate(request, env, headers) {
  try {
    const body = await request.json();
    const text = (body.text || '').slice(0, 800);
    if (!text) {
      return new Response(JSON.stringify({ ok: false, error: 'missing text' }), { headers });
    }
    const translated = await translateWithAI(env, text);
    return new Response(JSON.stringify({ ok: true, translated: translated }), { headers });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), { headers });
  }
}

// ===== RSS 解析 =====
function parseRSS(xml) {
  const items = [];

  // RSS 2.0: <item>...</item>
  const itemRegex = /<item[\s\S]*?<\/item>/gi;
  const matches = xml.match(itemRegex) || [];

  for (const match of matches) {
    const title = extractTag(match, 'title');
    const link = extractTag(match, 'link');
    const desc = extractTag(match, 'description');
    const date = extractTag(match, 'pubDate') || extractTag(match, 'dc:date') || '';

    if (title) {
      items.push({ title, link, summary: desc, date: parseDate(date) });
    }
  }

  // Atom: <entry>...</entry>
  if (items.length === 0) {
    const entryRegex = /<entry[\s\S]*?<\/entry>/gi;
    const entries = xml.match(entryRegex) || [];
    for (const entry of entries) {
      const title = extractTag(entry, 'title');
      const link = extractAttr(entry, 'link', 'href');
      const desc = extractTag(entry, 'summary') || extractTag(entry, 'content');
      const date = extractTag(entry, 'published') || extractTag(entry, 'updated') || '';

      if (title) {
        items.push({ title, link, summary: desc, date: parseDate(date) });
      }
    }
  }

  return items;
}

function extractTag(xml, tag) {
  const regex = new RegExp('<' + tag + '[^>]*>([\\s\\S]*?)</' + tag + '>', 'i');
  const match = xml.match(regex);
  if (!match) return '';
  return stripHtml(match[1]);
}

function extractAttr(xml, tag, attr) {
  const regex = new RegExp('<' + tag + '[^>]*' + attr + '="([^"]*)"', 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : '';
}

function stripHtml(html) {
  return (html || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#8217;/g, '\u2019')
    .replace(/&#8212;/g, '\u2014')
    .replace(/&#8211;/g, '\u2013')
    .replace(/&#8230;/g, '\u2026')
    .replace(/&#\d+;/g, function(m) {
      var code = parseInt(m.match(/\d+/)[0]);
      return String.fromCharCode(code);
    })
    .trim();
}

async function translateWithAI(env, text) {
  if (!text || text.length === 0) return text;
  const truncated = text.slice(0, 400);
  try {
    const res = await env.AI.run('@cf/meta/m2m100-1.2b', {
      text: truncated,
      source_lang: 'english',
      target_lang: 'chinese',
    });
    if (res && res.translated_text) {
      return res.translated_text;
    }
    return text;
  } catch (e) {
    return text;
  }
}

function parseDate(dateStr) {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toISOString();
  } catch {
    return dateStr;
  }
}

function generateNewsSummary(items) {
  if (!items || items.length === 0) return '暂无最新AI资讯。';
  const sources = [...new Set(items.slice(0, 5).map((i) => i.source))];
  const titles = items.slice(0, 3).map((i) => i.titleZh || i.title);
  return '今日AI热点来自' + sources.join('、') + '等来源。关注：' + titles.join('；') + '。';
}
