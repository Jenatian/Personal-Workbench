/**
 * 记账模块 - 日/周/月看板 + 增删改查 + 汇总 + 云同步
 */
const AccountingModule = (function () {
  const CATEGORIES = [
    { name: '餐饮', icon: '🍔', color: '#E1306C' },
    { name: '交通', icon: '🚕', color: '#F77737' },
    { name: '购物', icon: '🛒', color: '#5B7CFA' },
    { name: '娱乐', icon: '🎮', color: '#00C9A7' },
    { name: '住房', icon: '🏠', color: '#9B59B6' },
    { name: '医疗', icon: '💊', color: '#E74C3C' },
    { name: '教育', icon: '📚', color: '#3498DB' },
    { name: '其他', icon: '📝', color: '#95A5A6' },
  ];

  let selectedDate = Storage.formatDate(new Date());
  let weekBase = new Date();
  let monthBase = new Date();
  let currentView = localStorage.getItem('acc_view') || 'day';

  function render() {
    document.querySelectorAll('.acc-tab').forEach((t) => {
      t.classList.toggle('active', t.dataset.view === currentView);
    });

    renderSummary();
    renderCategoryBar();

    const container = document.querySelector('.acc-content');
    if (!container) return;

    if (currentView === 'day') renderDayView(container);
    else if (currentView === 'week') renderWeekView(container);
    else renderMonthView(container);

    updateDateBadge();
  }

  function updateDateBadge() {
    const badge = document.querySelector('#view-accounting .date-badge');
    if (!badge) return;
    const d = new Date(selectedDate);
    if (currentView === 'day') {
      badge.textContent = (d.getMonth() + 1) + '月' + d.getDate() + '日';
    } else if (currentView === 'week') {
      const weekDates = Storage.getWeekDates(weekBase);
      const s = weekDates[0], e = weekDates[6];
      badge.textContent = (s.getMonth() + 1) + '/' + s.getDate() + ' - ' + (e.getMonth() + 1) + '/' + e.getDate();
    } else {
      badge.textContent = (monthBase.getFullYear()) + '年' + (monthBase.getMonth() + 1) + '月';
    }
  }

  function renderSummary() {
    const card = document.querySelector('#view-accounting .summary-card');
    if (!card) return;
    const now = new Date();
    const monthStr = Storage.formatMonth(now);
    const monthData = Storage.accounting.getSummary(monthStr);
    const todayData = Storage.accounting.getTodaySummary();

    const weekStart = new Date(now);
    const dayOfWeek = now.getDay() || 7;
    weekStart.setDate(now.getDate() - dayOfWeek + 1);
    const weekStr = Storage.formatDate(weekStart);
    const weekItems = Storage.accounting.list().filter((i) => i.date >= weekStr);
    const weekTotal = weekItems.reduce((s, i) => s + (i.amount || 0), 0);

    card.innerHTML =
      '<div class="summary-label">' + (now.getMonth() + 1) + '月支出</div>' +
      '<div class="summary-amount">¥' + formatMoney(monthData.total) + '</div>' +
      '<div class="summary-row">' +
      '<div class="summary-item"><div class="label">今日</div><div class="amount">¥' + formatMoney(todayData.total) + '</div></div>' +
      '<div class="summary-item"><div class="label">本周</div><div class="amount">¥' + formatMoney(weekTotal) + '</div></div>' +
      '</div>';
  }

  function renderCategoryBar() {
    const card = document.querySelector('#view-accounting .category-card');
    if (!card) return;
    const monthStr = Storage.formatMonth(new Date());
    const data = Storage.accounting.getSummary(monthStr);

    if (data.total === 0) {
      card.innerHTML = '<div class="card-title">分类占比</div>' +
        '<div class="empty-state"><div class="empty-text">暂无数据</div></div>';
      return;
    }

    let barHtml = '<div class="category-bar">';
    let legendHtml = '<div class="category-legend">';
    CATEGORIES.forEach((cat) => {
      const amount = data.byCategory[cat.name] || 0;
      if (amount > 0) {
        const pct = ((amount / data.total) * 100).toFixed(1);
        barHtml += '<span style="width:' + pct + '%;background:' + cat.color + '"></span>';
        legendHtml += '<span><span class="dot" style="background:' + cat.color + '"></span>' +
          cat.name + ' ¥' + formatMoney(amount) + '</span>';
      }
    });
    barHtml += '</div>';
    legendHtml += '</div>';

    card.innerHTML = '<div class="card-title">分类占比</div>' + barHtml + legendHtml;
  }

  // ===== 日视图 =====
  function renderDayView(container) {
    const weekDates = Storage.getWeekDates(weekBase);
    const todayStr = Storage.formatDate(new Date());

    let html = '<div class="week-strip">';
    html += '<button class="week-nav" id="acc-week-prev">‹</button>';
    html += '<div class="week-days-row">';
    weekDates.forEach((d, i) => {
      const dateStr = Storage.formatDate(d);
      const isToday = dateStr === todayStr;
      const isSelected = dateStr === selectedDate;
      const dayItems = Storage.accounting.list().filter((it) => it.date === dateStr);
      const dayTotal = dayItems.reduce((s, it) => s + (it.amount || 0), 0);
      let cls = 'week-day';
      if (isToday) cls += ' today';
      if (isSelected) cls += ' selected';
      html += '<div class="' + cls + '" data-date="' + dateStr + '">' +
        '<span class="week-label">' + Storage.WEEK_LABELS[i] + '</span>' +
        '<span class="week-num">' + d.getDate() + '</span>' +
        (dayTotal > 0 ? '<span class="week-amount">¥' + formatMoney(dayTotal) + '</span>' : '') +
        '</div>';
    });
    html += '</div>';
    html += '<button class="week-nav" id="acc-week-next">›</button>';
    html += '</div>';

    const items = Storage.accounting.list().filter((it) => it.date === selectedDate);
    const dayTotal = items.reduce((s, it) => s + (it.amount || 0), 0);

    html += '<div class="acc-day-list">';
    if (items.length === 0) {
      html += '<div class="card"><div class="card-title">' + formatDateLabel(selectedDate) + '</div>' +
        '<div class="empty-state"><div class="empty-icon">💸</div>' +
        '<div class="empty-text">这天没有记账<br>点击右下角 + 记一笔</div></div></div>';
    } else {
      html += '<div class="card"><div class="card-title">' + formatDateLabel(selectedDate) +
        ' · 共 ¥' + formatMoney(dayTotal) + '</div>';
      items.forEach((item) => {
        const cat = CATEGORIES.find((c) => c.name === item.category) || CATEGORIES[7];
        html += '<div class="entry-item">' +
          '<div class="entry-icon">' + cat.icon + '</div>' +
          '<div class="entry-info">' +
          '<div class="entry-cat">' + escapeHtml(item.category) + '</div>' +
          '<div class="entry-note">' + escapeHtml(item.note || '') + '</div>' +
          '</div>' +
          '<div class="entry-amount">¥' + formatMoney(item.amount) + '</div>' +
          '<button class="item-delete" data-id="' + item.id + '" style="color:var(--text-tertiary);font-size:18px;padding:4px 8px;">×</button>' +
          '</div>';
      });
      html += '</div>';
    }
    html += '</div>';

    container.innerHTML = html;

    const prev = container.querySelector('#acc-week-prev');
    const next = container.querySelector('#acc-week-next');
    if (prev) prev.addEventListener('click', (e) => { e.stopPropagation(); weekBase.setDate(weekBase.getDate() - 7); render(); });
    if (next) next.addEventListener('click', (e) => { e.stopPropagation(); weekBase.setDate(weekBase.getDate() + 7); render(); });

    container.querySelectorAll('.week-day').forEach((el) => {
      el.addEventListener('click', () => { selectedDate = el.dataset.date; render(); });
    });

    bindDelete(container);
  }

  // ===== 周视图 =====
  function renderWeekView(container) {
    const weekDates = Storage.getWeekDates(weekBase);
    const todayStr = Storage.formatDate(new Date());
    let weekTotal = 0;

    let html = '<div class="week-nav-bar">';
    html += '<button class="week-nav" id="acc-week-prev">‹</button>';
    html += '<span class="week-range-label">' + (weekDates[0].getMonth() + 1) + '/' + weekDates[0].getDate() + ' - ' + (weekDates[6].getMonth() + 1) + '/' + weekDates[6].getDate() + '</span>';
    html += '<button class="week-nav" id="acc-week-next">›</button>';
    html += '</div>';

    weekDates.forEach((d) => {
      const dateStr = Storage.formatDate(d);
      const items = Storage.accounting.list().filter((it) => it.date === dateStr);
      const dayTotal = items.reduce((s, it) => s + (it.amount || 0), 0);
      weekTotal += dayTotal;
      const isToday = dateStr === todayStr;
      let cls = 'week-day-row';
      if (isToday) cls += ' today';

      html += '<div class="' + cls + '" data-date="' + dateStr + '">';
      html += '<div class="wdr-left">';
      html += '<span class="wdr-weekday">' + Storage.WEEK_LABELS[(d.getDay() || 7) - 1] + '</span>';
      html += '<span class="wdr-date">' + (d.getMonth() + 1) + '/' + d.getDate() + '</span>';
      if (isToday) html += '<span class="wdr-today-tag">今天</span>';
      html += '</div>';
      html += '<div class="wdr-right">';
      if (items.length === 0) {
        html += '<span class="wdr-empty">无记录</span>';
      } else {
        html += '<span class="wdr-day-total">¥' + formatMoney(dayTotal) + '</span>';
        html += '<div class="wdr-cats">';
        items.slice(0, 3).forEach((item) => {
          const cat = CATEGORIES.find((c) => c.name === item.category) || CATEGORIES[7];
          html += '<span class="wdr-cat-item">' + cat.icon + ' ' + escapeHtml(item.category) + ' ¥' + formatMoney(item.amount) + '</span>';
        });
        if (items.length > 3) {
          html += '<span class="wdr-more">还有 ' + (items.length - 3) + ' 笔</span>';
        }
        html += '</div>';
      }
      html += '</div>';
      html += '</div>';
    });

    html += '<div class="card" style="text-align:center;padding:16px"><div class="summary-label">本周总支出</div><div class="summary-amount">¥' + formatMoney(weekTotal) + '</div></div>';

    container.innerHTML = html;

    const prev = container.querySelector('#acc-week-prev');
    const next = container.querySelector('#acc-week-next');
    if (prev) prev.addEventListener('click', (e) => { e.stopPropagation(); weekBase.setDate(weekBase.getDate() - 7); render(); });
    if (next) next.addEventListener('click', (e) => { e.stopPropagation(); weekBase.setDate(weekBase.getDate() + 7); render(); });

    container.querySelectorAll('.week-day-row').forEach((row) => {
      row.addEventListener('click', () => {
        selectedDate = row.dataset.date;
        weekBase = new Date(selectedDate);
        switchView('day');
      });
    });
  }

  // ===== 月视图 =====
  function renderMonthView(container) {
    const year = monthBase.getFullYear();
    const month = monthBase.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startWeekday = (firstDay.getDay() || 7) - 1;
    const daysInMonth = lastDay.getDate();
    const todayStr = Storage.formatDate(new Date());

    let html = '<div class="month-nav-bar">';
    html += '<button class="week-nav" id="acc-month-prev">‹</button>';
    html += '<span class="month-range-label">' + year + '年' + (month + 1) + '月</span>';
    html += '<button class="week-nav" id="acc-month-next">›</button>';
    html += '</div>';

    let monthTotal = 0;

    html += '<div class="calendar-grid">';
    html += '<div class="cal-header-row">';
    ['一', '二', '三', '四', '五', '六', '日'].forEach((w) => {
      html += '<div class="cal-header">' + w + '</div>';
    });
    html += '</div>';

    html += '<div class="cal-body">';
    for (let i = 0; i < startWeekday; i++) {
      html += '<div class="cal-cell empty"></div>';
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
      const dayItems = Storage.accounting.list().filter((it) => it.date === dateStr);
      const dayTotal = dayItems.reduce((s, it) => s + (it.amount || 0), 0);
      monthTotal += dayTotal;
      const isToday = dateStr === todayStr;
      const isSelected = dateStr === selectedDate;
      let cls = 'cal-cell acc-cell';
      if (isToday) cls += ' today';
      if (isSelected) cls += ' selected';
      html += '<div class="' + cls + '" data-date="' + dateStr + '">';
      html += '<span class="cal-day-num">' + day + '</span>';
      if (dayTotal > 0) {
        html += '<span class="cal-amount">¥' + formatMoney(dayTotal) + '</span>';
      }
      html += '</div>';
    }
    html += '</div>';
    html += '</div>';

    html += '<div class="card" style="text-align:center;padding:12px;margin-bottom:12px"><span class="summary-label">本月总支出</span> <span style="font-size:20px;font-weight:700;color:var(--accent-color)">¥' + formatMoney(monthTotal) + '</span></div>';

    const selectedItems = Storage.accounting.list().filter((it) => it.date === selectedDate);
    const selTotal = selectedItems.reduce((s, it) => s + (it.amount || 0), 0);
    html += '<div class="acc-day-list">';
    if (selectedItems.length > 0) {
      html += '<div class="card"><div class="card-title">' + formatDateLabel(selectedDate) + ' · ¥' + formatMoney(selTotal) + '</div>';
      selectedItems.forEach((item) => {
        const cat = CATEGORIES.find((c) => c.name === item.category) || CATEGORIES[7];
        html += '<div class="entry-item">' +
          '<div class="entry-icon">' + cat.icon + '</div>' +
          '<div class="entry-info">' +
          '<div class="entry-cat">' + escapeHtml(item.category) + '</div>' +
          '<div class="entry-note">' + escapeHtml(item.note || '') + '</div>' +
          '</div>' +
          '<div class="entry-amount">¥' + formatMoney(item.amount) + '</div>' +
          '<button class="item-delete" data-id="' + item.id + '" style="color:var(--text-tertiary);font-size:18px;padding:4px 8px;">×</button>' +
          '</div>';
      });
      html += '</div>';
    } else {
      html += '<div class="empty-state" style="padding:20px"><div class="empty-text">' + formatDateLabel(selectedDate) + '无记录</div></div>';
    }
    html += '</div>';

    container.innerHTML = html;

    const prev = container.querySelector('#acc-month-prev');
    const next = container.querySelector('#acc-month-next');
    if (prev) prev.addEventListener('click', (e) => { e.stopPropagation(); monthBase.setMonth(monthBase.getMonth() - 1); render(); });
    if (next) next.addEventListener('click', (e) => { e.stopPropagation(); monthBase.setMonth(monthBase.getMonth() + 1); render(); });

    container.querySelectorAll('.cal-cell:not(.empty)').forEach((cell) => {
      cell.addEventListener('click', () => { selectedDate = cell.dataset.date; render(); });
    });

    bindDelete(container);
  }

  function bindDelete(container) {
    container.querySelectorAll('.item-delete').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm('删除这条记录?')) {
          Storage.accounting.remove(btn.dataset.id);
          render();
          autoSync();
        }
      });
    });
  }

  function switchView(view) {
    currentView = view;
    localStorage.setItem('acc_view', view);
    render();
  }

  function formatDateLabel(dateStr) {
    const d = new Date(dateStr);
    const today = new Date();
    const isToday = Storage.formatDate(d) === Storage.formatDate(today);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow = dateStr === Storage.formatDate(tomorrow);
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = dateStr === Storage.formatDate(yesterday);
    let label = (d.getMonth() + 1) + '月' + d.getDate() + '日';
    if (isToday) label = '今天';
    else if (isTomorrow) label = '明天';
    else if (isYesterday) label = '昨天';
    return label;
  }

  function autoSync() {
    const apiBase = localStorage.getItem('apiBase') || '';
    if (apiBase.indexOf('workers.dev') !== -1) {
      localStorage.removeItem('apiBase');
    }
    Storage.sync().catch(() => {});
  }

  function showAddModal() {
    const modal = document.getElementById('modal-accounting');
    if (!modal) return;
    modal.querySelector('[name="amount"]').value = '';
    modal.querySelector('[name="note"]').value = '';
    modal.querySelector('[name="date"]').value = selectedDate;
    renderCategoryPicker(modal);
    modal.classList.add('show');
    setTimeout(() => modal.querySelector('[name="amount"]').focus(), 100);
  }

  function renderCategoryPicker(modal) {
    const picker = modal.querySelector('.category-picker');
    if (!picker) return;
    picker.innerHTML = CATEGORIES.map((c, i) =>
      '<button type="button" class="cat-pill' + (i === 0 ? ' active' : '') + '" data-cat="' + c.name + '">' +
      c.icon + ' ' + c.name + '</button>'
    ).join('');
    picker.querySelectorAll('.cat-pill').forEach((pill) => {
      pill.addEventListener('click', () => {
        picker.querySelectorAll('.cat-pill').forEach((p) => p.classList.remove('active'));
        pill.classList.add('active');
        modal.dataset.selectedCat = pill.dataset.cat;
      });
    });
    modal.dataset.selectedCat = CATEGORIES[0].name;
  }

  function hideModal() {
    document.getElementById('modal-accounting').classList.remove('show');
  }

  function handleSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const modal = document.getElementById('modal-accounting');
    const amount = parseFloat(form.amount.value);
    if (!amount || amount <= 0) return;
    const data = {
      amount: amount,
      category: modal.dataset.selectedCat || '其他',
      note: form.note.value.trim(),
      date: form.date.value,
    };
    Storage.accounting.add(data);
    selectedDate = data.date;
    weekBase = new Date(data.date);
    monthBase = new Date(data.date);
    hideModal();
    render();
    autoSync();
  }

  function formatMoney(n) {
    return (n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function init() {
    document.querySelectorAll('.acc-tab').forEach((tab) => {
      tab.addEventListener('click', () => switchView(tab.dataset.view));
    });

    render();

    const fab = document.querySelector('#view-accounting .fab');
    if (fab) fab.addEventListener('click', showAddModal);

    const modal = document.getElementById('modal-accounting');
    if (modal) {
      modal.querySelector('form').addEventListener('submit', handleSubmit);
      modal.addEventListener('click', (e) => {
        if (e.target === modal) hideModal();
      });
      const cancelBtn = modal.querySelector('.btn-cancel');
      if (cancelBtn) cancelBtn.addEventListener('click', hideModal);
    }
  }

  return { init, render };
})();
