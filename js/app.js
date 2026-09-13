/* 个人工作台 - 核心逻辑 */

(function () {
  'use strict';

  // ===== 模块路由 =====
  const modules = ['schedule', 'accounting', 'ai-daily', 'language', 'settings'];

  function switchModule(name) {
    if (!modules.includes(name)) return;

    document.querySelectorAll('.nav-item').forEach((item) => {
      item.classList.toggle('active', item.dataset.module === name);
    });

    document.querySelectorAll('.view').forEach((view) => {
      view.classList.toggle('active', view.id === 'view-' + name);
    });

    const content = document.getElementById('content');
    content.scrollTop = 0;
    localStorage.setItem('activeModule', name);
  }

  // ===== 主题管理 =====
  const skinColors = {
    default: { bg: '#E1306C', ring: 'linear-gradient(135deg, #E1306C, #F77737)' },
    mint: { bg: '#00C9A7', ring: 'linear-gradient(135deg, #00C9A7, #00B8D9)' },
    sky: { bg: '#5B7CFA', ring: 'linear-gradient(135deg, #5B7CFA, #00B8D9)' },
    orange: { bg: '#FF8C42', ring: 'linear-gradient(135deg, #FF8C42, #FFB627)' },
    dark: { bg: '#BB86FC', ring: 'linear-gradient(135deg, #BB86FC, #03DAC6)' },
  };

  function applyTheme(theme, skin) {
    const html = document.documentElement;
    html.setAttribute('data-theme', theme);
    html.setAttribute('data-skin', skin);

    if (skin === 'dark') {
      html.setAttribute('data-theme', 'dark');
    }

    localStorage.setItem('theme', theme);
    localStorage.setItem('skin', skin);

    document.querySelectorAll('.skin-option').forEach((opt) => {
      opt.classList.toggle('active', opt.dataset.skin === skin);
    });

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      const colors = { light: '#FAFAFA', dark: '#000000' };
      meta.setAttribute('content', colors[skin === 'dark' ? 'dark' : theme] || '#FAFAFA');
    }
  }

  // ===== 初始化 =====
  function init() {
    // 恢复主题
    const savedTheme = localStorage.getItem('theme') || 'light';
    const savedSkin = localStorage.getItem('skin') || 'default';
    applyTheme(savedTheme, savedSkin);

    // 恢复模块
    const savedModule = localStorage.getItem('activeModule') || 'schedule';
    switchModule(savedModule);

    // 导航点击
    document.querySelectorAll('.nav-item').forEach((item) => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        switchModule(item.dataset.module);
      });
    });

    // 皮肤选择
    document.querySelectorAll('.skin-option').forEach((opt) => {
      opt.addEventListener('click', () => {
        const skin = opt.dataset.skin;
        const isDark = skin === 'dark';
        applyTheme(isDark ? 'dark' : 'light', skin);
      });
    });

    // 外语 Tab 切换
    document.querySelectorAll('.lang-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.lang-tab').forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
      });
    });

    // 自动从云端拉取数据(静默,失败不影响使用)
    if (typeof Storage !== 'undefined' && localStorage.getItem('apiBase') !== null) {
      Storage.pull().then(() => {
        if (typeof ScheduleModule !== 'undefined') ScheduleModule.render();
        if (typeof AccountingModule !== 'undefined') AccountingModule.render();
      }).catch(() => {});
    }

    // 初始化各功能模块
    if (typeof ScheduleModule !== 'undefined') ScheduleModule.init();
    if (typeof AccountingModule !== 'undefined') AccountingModule.init();
    if (typeof AIDailyModule !== 'undefined') AIDailyModule.init();
    if (typeof LanguageModule !== 'undefined') LanguageModule.init();
    if (typeof WeatherModule !== 'undefined') WeatherModule.init();

    // 云同步设置
    initSyncSettings();
  }

  function initSyncSettings() {
    const apiBaseInput = document.getElementById('api-base-input');
    const saveBtn = document.getElementById('api-base-save');
    const pushBtn = document.getElementById('sync-push');
    const pullBtn = document.getElementById('sync-pull');
    const statusEl = document.getElementById('sync-status');

    if (apiBaseInput) {
      apiBaseInput.value = localStorage.getItem('apiBase') || '';
    }

    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        const val = apiBaseInput.value.trim().replace(/\/$/, '');
        localStorage.setItem('apiBase', val);
        if (statusEl) {
          statusEl.textContent = '已保存。刷新页面后生效。';
          statusEl.style.color = 'var(--accent)';
        }
      });
    }

    if (pushBtn) {
      pushBtn.addEventListener('click', async () => {
        if (statusEl) { statusEl.textContent = '正在上传...'; statusEl.style.color = 'var(--text-secondary)'; }
        const result = await Storage.sync();
        if (statusEl) {
          if (result.ok) {
            statusEl.textContent = '上传成功 ' + new Date().toLocaleTimeString();
            statusEl.style.color = 'var(--accent)';
          } else {
            statusEl.textContent = '上传失败: ' + (result.message || '未知错误');
            statusEl.style.color = '#E74C3C';
          }
        }
      });
    }

    if (pullBtn) {
      pullBtn.addEventListener('click', async () => {
        if (statusEl) { statusEl.textContent = '正在拉取...'; statusEl.style.color = 'var(--text-secondary)'; }
        const result = await Storage.pull();
        if (statusEl) {
          if (result.ok) {
            statusEl.textContent = '拉取成功,正在刷新...';
            statusEl.style.color = 'var(--accent)';
            setTimeout(() => { window.location.reload(); }, 800);
          } else {
            statusEl.textContent = '拉取失败: ' + (result.message || '未知错误');
            statusEl.style.color = '#E74C3C';
          }
        }
      });
    }
  }

  // ===== Service Worker 注册 =====
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
  }

  // 启动
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
