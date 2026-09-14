/**
 * AI要点模块 - 接入 Worker /api/news + /api/knowledge
 * Worker 未部署时使用内置示例数据兜底
 */
const AIDailyModule = (function () {
  function getApiBase() {
    return localStorage.getItem('apiBase') || '';
  }
  const FALLBACK_NEWS = {
    summary: '以下为示例数据。部署后将自动汇总多个来源近两天的 AI 资讯，按热度排序并用 AI 生成摘要。',
    items: [
      {
        source: '机器之心',
        title: '大模型行业再迎变革：多模态能力成为标配',
        summary: '随着GPT-4o、Gemini等模型陆续支持图片、音频、视频理解，多模态能力正从差异化竞争转为行业标配。',
        link: 'https://www.jiqizhixin.com/articles/2024-12-01',
        date: '',
      },
      {
        source: '36氪AI',
        title: 'AI Agent赛道爆发，国内创业公司密集融资',
        summary: '2024年下半年，AI Agent方向融资事件超30起，覆盖客服、数据分析、代码生成等场景。',
        link: 'https://36kr.com/p/ai-agent-funding',
        date: '',
      },
      {
        source: '量子位',
        title: '国产大模型最新进展：性能追平国际一线',
        summary: '多家国内大模型公司发布新版本，在多项基准测试中表现接近或达到国际一线水平。',
        link: 'https://www.qbitai.com/2024/12/01',
        date: '',
      },
    ],
  };

  const FALLBACK_KNOWLEDGE = {
    items: [
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
    ],
  };

  function init() {
    renderDate();
    fetchNews();
    fetchKnowledge();
  }

  function renderDate() {
    const badge = document.querySelector('#view-ai-daily .date-badge');
    if (!badge) return;
    const d = new Date();
    badge.textContent = (d.getMonth() + 1) + '月' + d.getDate() + '日';
  }

  async function fetchNews() {
    const summaryEl = document.querySelector('#view-ai-daily .speed-summary .speed-text');
    const newsContainer = document.querySelector('#view-ai-daily .news-container');
    if (!summaryEl || !newsContainer) return;

    // 显示加载中
    summaryEl.textContent = '正在获取今日 AI 资讯...';
    newsContainer.innerHTML = '';

    try {
      const res = await fetch(getApiBase() + '/api/news', { headers: { 'X-User-Id': getUserId() } });
      if (res.ok) {
        const data = await res.json();
        if (data.ok !== false && data.items && data.items.length > 0) {
          summaryEl.textContent = data.summary || '今日 AI 资讯';
          renderNewsItems(data.items, newsContainer);
          return;
        }
      }
    } catch (e) {
      // Worker 未部署,使用兜底数据
    }

    summaryEl.textContent = FALLBACK_NEWS.summary;
    renderNewsItems(FALLBACK_NEWS.items, newsContainer);
  }

  function renderNewsItems(items, container) {
    if (!container) return;
    container.innerHTML = items.map(function (item) {
      var displayTitle = item.title;
      var displaySummary = item.summary || '';

      var heatBadge = '';
      if (item.heatLevel === 'high') {
        heatBadge = '<span class="heat-badge heat-high">🔥 多源报道</span>';
      } else if (item.heatLevel === 'medium') {
        heatBadge = '<span class="heat-badge heat-medium">· 热门</span>';
      }

      return '<div class="news-item' + (item.heatLevel === 'high' ? ' hot' : '') + '">' +
        '<span class="news-source-tag">' + escapeHtml(item.source) + '</span>' +
        '<div class="news-content">' +
        '<div class="news-title">' + escapeHtml(displayTitle) + '</div>' +
        (displaySummary ? '<div class="news-summary">' + escapeHtml(displaySummary) + '</div>' : '') +
        '<div class="news-meta">' +
        heatBadge +
        (item.link ? '<a class="news-link" href="' + escapeHtml(item.link) + '" target="_blank">查看原文 →</a>' : '') +
        '</div>' +
        '</div></div>';
    }).join('');
  }

  async function fetchKnowledge() {
    const container = document.querySelector('#view-ai-daily .knowledge-container');
    if (!container) return;

    container.innerHTML = '<div class="empty-state"><div class="empty-text">加载中...</div></div>';

    try {
      const res = await fetch(getApiBase() + '/api/knowledge', { headers: { 'X-User-Id': getUserId() } });
      if (res.ok) {
        const data = await res.json();
        if (data.ok !== false && data.items && data.items.length > 0) {
          renderKnowledge(data.items, container);
          return;
        }
      }
    } catch (e) {
      // 使用兜底数据
    }

    renderKnowledge(FALLBACK_KNOWLEDGE.items, container);
  }

  function renderKnowledge(items, container) {
    if (!container) return;
    container.innerHTML = items.map(function (item) {
      var tagsHtml = (item.tags || []).map(function (t) {
        return '<span class="knowledge-tag">' + escapeHtml(t) + '</span>';
      }).join('');
      return '<div class="knowledge-card">' +
        '<span class="knowledge-badge">' + escapeHtml(item.type) + '</span>' +
        '<div class="knowledge-title">' + escapeHtml(item.title) + '</div>' +
        '<div class="knowledge-desc">' + escapeHtml(item.desc) + '</div>' +
        (tagsHtml ? '<div class="knowledge-tags">' + tagsHtml + '</div>' : '') +
        '</div>';
    }).join('');
  }

  function getUserId() {
    return localStorage.getItem('userId') || 'default';
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  return { init, fetchNews, fetchKnowledge };
})();
