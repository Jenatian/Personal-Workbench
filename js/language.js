/**
 * 外语学习模块 - 接入 Worker /api/articles
 * Worker 未部署时使用内置示例数据兜底
 * 点击文章弹出简要内容弹窗，弹窗内附完整原文链接
 */
const LanguageModule = (function () {
  const API_BASE = localStorage.getItem('apiBase') || '';
  let currentTab = 'speaking';
  let currentArticles = [];

  const FALLBACK = {
    speaking: [
      { source: 'VOA Everyday', title: 'Learning English Podcast', excerpt: 'Learning English uses a limited vocabulary and is read at a slower pace than VOA\'s other English broadcasts. Great for practicing everyday listening comprehension.', link: 'https://learningenglish.voanews.com/a/8191731.html', date: '', readTime: 3 },
      { source: 'CommonSense ESL', title: 'How to Start and End Conversations Naturally', excerpt: 'A practical strategy for starting and ending conversations with confidence. Includes useful phrases and real-world examples you can use immediately in social situations.', link: 'https://commonsense-esl.com/2026/08/01/it-worked-david-a-practical-strategy-for-starting-and-ending-conversations-updated-for-2026/', date: '', readTime: 2 },
      { source: 'CommonSense ESL', title: 'Friends Matter More Than a Famous College', excerpt: 'Research shows that the type of friends you have may matter more for your future than attending a famous college. An interesting read about social influence and personal growth.', link: 'https://commonsense-esl.com/2026/08/16/short-human-interest-articles-for-extensive-reading-20-your-type-of-friends-are-more-important-for-your-future-than-a-famous-college/', date: '', readTime: 4 },
      { source: 'VOA Everyday', title: 'Everyday English in Real Life', excerpt: 'Practice with real dialogues covering daily situations — ordering food, asking directions, making small talk. Each episode comes with transcripts and vocabulary lists.', link: 'https://learningenglish.voanews.com/a/8191341.html', date: '', readTime: 3 },
    ],
    reading: [
      { source: 'CommonSense ESL', title: 'Effective and Ineffective Praise for Motivation', excerpt: 'Understanding how to give effective praise in the classroom. Originally published in Modern English Teaching, this article explores what works and what doesn\'t when motivating students.', link: 'https://commonsense-esl.com/2026/09/01/effective-and-ineffective-praise-of-students-for-motivation/', date: '', readTime: 5 },
      { source: 'CommonSense ESL', title: 'Kindness Makes People Look More Beautiful', excerpt: 'A fascinating study on how kindness affects perception of beauty. Watch passengers on a bus and discover why character matters more than appearance.', link: 'https://commonsense-esl.com/2026/07/13/short-human-interest-articles-for-extensive-reading-19-kindness-makes-people-look-more-beautiful/', date: '', readTime: 4 },
      { source: 'VOA Learning', title: 'Learning English Through News Stories', excerpt: 'Real news stories simplified for English learners. Each article covers current events with vocabulary explanations and comprehension exercises to build reading skills.', link: 'https://learningenglish.voanews.com/a/8190894.html', date: '', readTime: 6 },
    ],
  };

  const ICONS = ['💬', '☕', '📞', '✈️', '📖', '🌐', '🎯', '✨'];

  function init() {
    const tabs = document.querySelectorAll('#view-language .lang-tab');
    tabs.forEach(function (tab, i) {
      tab.addEventListener('click', function () {
        tabs.forEach(function (t) { t.classList.remove('active'); });
        tab.classList.add('active');
        currentTab = i === 0 ? 'speaking' : 'reading';
        fetchArticles();
      });
    });
    fetchArticles();
  }

  async function fetchArticles() {
    const container = document.querySelector('#view-language .article-list');
    if (!container) return;

    container.innerHTML = '<div class="empty-state"><div class="empty-text">加载中...</div></div>';

    try {
      var res = await fetch(API_BASE + '/api/articles?cat=' + currentTab, { headers: { 'X-User-Id': getUserId() } });
      if (res.ok) {
        var data = await res.json();
        if (data.ok !== false && data.items && data.items.length > 0) {
          currentArticles = data.items;
          renderArticles(data.items, container);
          return;
        }
      }
    } catch (e) {
      // Worker 未部署
    }

    currentArticles = FALLBACK[currentTab] || FALLBACK.speaking;
    renderArticles(currentArticles, container);
  }

  function renderArticles(items, container) {
    if (!container) return;
    if (!items || items.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-icon">📄</div><div class="empty-text">暂无文章</div></div>';
      return;
    }

    container.innerHTML = items.map(function (item, i) {
      var icon = ICONS[i % ICONS.length];
      return '<div class="article-card" data-idx="' + i + '" style="cursor:pointer;">' +
        '<div class="article-thumb">' + icon + '</div>' +
        '<div class="article-info">' +
        '<div class="article-title">' + escapeHtml(item.title) + '</div>' +
        '<div class="article-meta">' +
        '<span>' + escapeHtml(item.source) + '</span>' +
        (item.readTime ? '<span>·</span><span>' + item.readTime + ' min</span>' : '') +
        '</div>' +
        (item.excerpt ? '<div style="font-size:13px;color:var(--text-secondary);margin-top:4px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">' + escapeHtml(item.excerpt) + '</div>' : '') +
        '<div style="font-size:13px;color:var(--accent-color);margin-top:6px;">点击查看摘要 →</div>' +
        '</div></div>';
    }).join('');

    container.querySelectorAll('.article-card').forEach(function (card) {
      card.addEventListener('click', function () {
        var idx = parseInt(this.dataset.idx);
        showArticleModal(items[idx]);
      });
    });
  }

  function showArticleModal(item) {
    var existing = document.getElementById('article-modal');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.id = 'article-modal';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:1000;display:flex;align-items:flex-end;justify-content:center;animation:overlayIn 0.2s ease;';

    var sheet = document.createElement('div');
    sheet.style.cssText = 'background:var(--bg-primary);border-radius:20px 20px 0 0;width:100%;max-width:480px;max-height:78vh;padding:24px 20px 32px;box-shadow:0 -4px 24px rgba(0,0,0,0.15);overflow-y:auto;animation:sheetIn 0.25s cubic-bezier(0.32,0.72,0,1);';

    var handle = '<div style="width:40px;height:4px;background:var(--border-color);border-radius:2px;margin:0 auto 16px;"></div>';
    var sourceTag = '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">' +
      '<span style="font-size:12px;padding:2px 8px;border-radius:6px;background:var(--accent-light);color:var(--accent-color);font-weight:600;">' + escapeHtml(item.source) + '</span>' +
      (item.readTime ? '<span style="font-size:12px;color:var(--text-tertiary);">' + item.readTime + ' min read</span>' : '') +
    '</div>';

    var toggleBar = '<div id="lang-toggle" style="display:flex;gap:0;margin-bottom:16px;border-radius:10px;overflow:hidden;border:1px solid var(--border-color);">' +
      '<button id="btn-original" style="flex:1;padding:8px 16px;border:none;background:var(--accent-color);color:var(--bg-primary);font-size:13px;font-weight:600;cursor:pointer;transition:all 0.2s;">原文</button>' +
      '<button id="btn-translation" style="flex:1;padding:8px 16px;border:none;background:transparent;color:var(--text-primary);font-size:13px;font-weight:500;cursor:pointer;transition:all 0.2s;">译文</button>' +
    '</div>';

    var titleEn = '<h3 id="modal-title-en" style="font-size:18px;font-weight:700;color:var(--text-primary);line-height:1.4;margin-bottom:12px;">' + escapeHtml(item.title) + '</h3>';
    var titleZh = '<h3 id="modal-title-zh" style="font-size:18px;font-weight:700;color:var(--text-primary);line-height:1.4;margin-bottom:12px;display:none;">翻译中...</h3>';
    var excerptEn = '<div id="modal-excerpt-en" style="font-size:14px;color:var(--text-secondary);line-height:1.7;margin-bottom:20px;">' + escapeHtml(item.excerpt || '暂无摘要内容。') + '</div>';
    var excerptZh = '<div id="modal-excerpt-zh" style="font-size:14px;color:var(--text-secondary);line-height:1.7;margin-bottom:20px;display:none;">翻译中...</div>';

    var linkBtn = item.link
      ? '<a href="' + escapeHtml(item.link) + '" target="_blank" style="display:block;text-align:center;padding:12px;border-radius:12px;background:var(--accent-light);color:var(--text-primary);font-size:14px;font-weight:600;text-decoration:none;border:1px solid var(--border-color);">阅读完整原文 →</a>'
      : '';
    var closeBtn = '<button id="article-modal-close" style="margin-top:12px;width:100%;padding:10px;border:none;border-radius:12px;background:var(--bg-secondary);color:var(--text-secondary);font-size:14px;cursor:pointer;">关闭</button>';

    sheet.innerHTML = handle + sourceTag + toggleBar + titleEn + titleZh + excerptEn + excerptZh + linkBtn + closeBtn;
    overlay.appendChild(sheet);
    document.body.appendChild(overlay);

    var translated = { title: null, excerpt: null };
    var translating = false;

    function switchTo(mode) {
      var btnOrig = document.getElementById('btn-original');
      var btnTrans = document.getElementById('btn-translation');
      var titleEn = document.getElementById('modal-title-en');
      var titleZh = document.getElementById('modal-title-zh');
      var excerptEn = document.getElementById('modal-excerpt-en');
      var excerptZh = document.getElementById('modal-excerpt-zh');

      if (mode === 'original') {
        btnOrig.style.background = 'var(--accent-color)';
        btnOrig.style.color = 'var(--bg-primary)';
        btnTrans.style.background = 'transparent';
        btnTrans.style.color = 'var(--text-primary)';
        titleEn.style.display = 'block';
        titleZh.style.display = 'none';
        excerptEn.style.display = 'block';
        excerptZh.style.display = 'none';
      } else {
        btnTrans.style.background = 'var(--accent-color)';
        btnTrans.style.color = 'var(--bg-primary)';
        btnOrig.style.background = 'transparent';
        btnOrig.style.color = 'var(--text-primary)';
        titleEn.style.display = 'none';
        titleZh.style.display = 'block';
        excerptEn.style.display = 'none';
        excerptZh.style.display = 'block';

        if (!translated.title && !translating) {
          translating = true;
          fetchTranslation(item).then(function (result) {
            translated.title = result.title;
            translated.excerpt = result.excerpt;
            titleZh.textContent = result.title;
            excerptZh.textContent = result.excerpt;
            translating = false;
          }).catch(function () {
            titleZh.textContent = '翻译失败,请稍后重试';
            excerptZh.textContent = '';
            translating = false;
          });
        }
      }
    }

    document.getElementById('btn-original').addEventListener('click', function () { switchTo('original'); });
    document.getElementById('btn-translation').addEventListener('click', function () { switchTo('translation'); });

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay || e.target.id === 'article-modal-close') {
        overlay.remove();
      }
    });
  }

  async function fetchTranslation(item) {
    var apiBase = localStorage.getItem('apiBase') || '';
    var titleRes = await fetch(apiBase + '/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: item.title }),
    });
    var excerptRes = await fetch(apiBase + '/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: item.excerpt || '' }),
    });
    var titleData = await titleRes.json();
    var excerptData = await excerptRes.json();
    return {
      title: titleData.ok ? titleData.translated : item.title,
      excerpt: excerptData.ok ? excerptData.translated : (item.excerpt || ''),
    };
  }

  function getUserId() {
    return localStorage.getItem('userId') || 'default';
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  return { init, fetchArticles };
})();
