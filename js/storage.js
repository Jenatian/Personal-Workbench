/**
 * 数据层 - localStorage 存储 + 云同步接口预留
 * 后续接入 Cloudflare Worker 时只需替换 sync 方法
 */
const Storage = (function () {
  const PREFIX = 'workbench_';
  const SYNC_URL = '/api/sync';

  function key(k) { return PREFIX + k; }

  function get(k, fallback) {
    try {
      const raw = localStorage.getItem(key(k));
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function set(k, val) {
    try {
      localStorage.setItem(key(k), JSON.stringify(val));
    } catch (e) {
      console.error('Storage write failed:', e);
    }
  }

  function remove(k) {
    localStorage.removeItem(key(k));
  }

  // ===== 日程数据 =====
  const schedule = {
    list() {
      return get('schedule', []);
    },
    save(items) {
      set('schedule', items);
    },
    add(item) {
      const items = this.list();
      item.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      item.createdAt = new Date().toISOString();
      items.push(item);
      items.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
      this.save(items);
      return item;
    },
    update(id, patch) {
      const items = this.list();
      const idx = items.findIndex((i) => i.id === id);
      if (idx === -1) return null;
      items[idx] = Object.assign(items[idx], patch);
      items.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
      this.save(items);
      return items[idx];
    },
    remove(id) {
      const items = this.list().filter((i) => i.id !== id);
      this.save(items);
    },
    getByDate(dateStr) {
      return this.list().filter((i) => i.date === dateStr);
    },
  };

  // ===== 记账数据 =====
  const accounting = {
    list() {
      return get('accounting', []);
    },
    save(items) {
      set('accounting', items);
    },
    add(entry) {
      const items = this.list();
      entry.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      entry.createdAt = new Date().toISOString();
      items.unshift(entry);
      this.save(items);
      return entry;
    },
    update(id, patch) {
      const items = this.list();
      const idx = items.findIndex((i) => i.id === id);
      if (idx === -1) return null;
      items[idx] = Object.assign(items[idx], patch);
      this.save(items);
      return items[idx];
    },
    remove(id) {
      const items = this.list().filter((i) => i.id !== id);
      this.save(items);
    },
    getSummary(yearMonth) {
      const items = this.list().filter((i) => i.date.startsWith(yearMonth));
      const total = items.reduce((s, i) => s + (i.amount || 0), 0);
      const byCategory = {};
      items.forEach((i) => {
        byCategory[i.category] = (byCategory[i.category] || 0) + (i.amount || 0);
      });
      return { total, byCategory, count: items.length, items };
    },
    getTodaySummary() {
      const today = formatDate(new Date());
      const items = this.list().filter((i) => i.date === today);
      return {
        total: items.reduce((s, i) => s + (i.amount || 0), 0),
        count: items.length,
        items,
      };
    },
  };

  // ===== 带超时的 fetch =====
  function fetchWithTimeout(url, options, timeout = 10000) {
    return Promise.race([
      fetch(url, options),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('请求超时')), timeout)
      ),
    ]);
  }

  // ===== 云同步 =====
  async function sync() {
    const apiBase = localStorage.getItem('apiBase') || '';
    const userId = localStorage.getItem('userId') || 'default';
    const data = { schedule: schedule.list(), accounting: accounting.list() };
    try {
      const res = await fetchWithTimeout(apiBase + SYNC_URL + '?uid=' + userId, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
        body: JSON.stringify(data),
      }, 10000);
      return await res.json();
    } catch (e) {
      return { ok: false, message: '上传失败: ' + e.message };
    }
  }

  async function pull() {
    const apiBase = localStorage.getItem('apiBase') || '';
    const userId = localStorage.getItem('userId') || 'default';
    try {
      const res = await fetchWithTimeout(apiBase + SYNC_URL + '?uid=' + userId, {
        headers: { 'X-User-Id': userId },
      }, 10000);
      const result = await res.json();
      if (result.ok && result.data) {
        if (result.data.schedule) schedule.save(result.data.schedule);
        if (result.data.accounting) accounting.save(result.data.accounting);
      }
      return result;
    } catch (e) {
      return { ok: false, message: '拉取失败: ' + e.message };
    }
  }

  // ===== 日期工具 =====
  function formatDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  function formatMonth(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return y + '-' + m;
  }

  function getWeekDates(base) {
    const d = base ? new Date(base) : new Date();
    const day = d.getDay() || 7; // 周一=1
    const monday = new Date(d);
    monday.setDate(d.getDate() - day + 1);
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const wd = new Date(monday);
      wd.setDate(monday.getDate() + i);
      dates.push(wd);
    }
    return dates;
  }

  const WEEK_LABELS = ['一', '二', '三', '四', '五', '六', '日'];

  return {
    schedule,
    accounting,
    sync,
    pull,
    formatDate,
    formatMonth,
    getWeekDates,
    WEEK_LABELS,
  };
})();
