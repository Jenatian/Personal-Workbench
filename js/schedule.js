/**
 * 日程模块 - 日/周/月看板 + 增删改查 + 云同步
 */
const ScheduleModule = (function () {
  let selectedDate = Storage.formatDate(new Date());
  let weekBase = new Date();
  let monthBase = new Date();
  let currentView = localStorage.getItem('schedule_view') || 'day';

  function render() {
    const tabs = document.querySelectorAll('.schedule-tab');
    tabs.forEach((t) => {
      t.classList.toggle('active', t.dataset.view === currentView);
    });

    const container = document.querySelector('.schedule-content');
    if (!container) return;

    if (currentView === 'day') renderDayView(container);
    else if (currentView === 'week') renderWeekView(container);
    else renderMonthView(container);

    updateDateBadge();
  }

  function updateDateBadge() {
    const badge = document.querySelector('#view-schedule .date-badge');
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

  // ===== 日视图 =====
  function renderDayView(container) {
    const weekDates = Storage.getWeekDates(weekBase);
    const todayStr = Storage.formatDate(new Date());

    let html = '<div class="week-strip">';
    html += '<button class="week-nav" id="week-prev">\u2039</button>';
    html += '<div class="week-days-row">';
    weekDates.forEach((d, i) => {
      const dateStr = Storage.formatDate(d);
      const isToday = dateStr === todayStr;
      const isSelected = dateStr === selectedDate;
      const hasItems = Storage.schedule.getByDate(dateStr).length > 0;
      let cls = 'week-day';
      if (isToday) cls += ' today';
      if (isSelected) cls += ' selected';
      html += '<div class="' + cls + '" data-date="' + dateStr + '">' +
        '<span class="week-label">' + Storage.WEEK_LABELS[i] + '</span>' +
        '<span class="week-num">' + d.getDate() + '</span>' +
        (hasItems ? '<span class="week-dot"></span>' : '') +
        '</div>';
    });
    html += '</div>';
    html += '<button class="week-nav" id="week-next">\u203a</button>';
    html += '</div>';

    const items = Storage.schedule.getByDate(selectedDate);
    html += '<div class="schedule-list">';
    if (items.length === 0) {
      html += '<div class="card"><div class="card-title">' + formatDateLabel(selectedDate) + '</div>' +
        '<div class="empty-state"><div class="empty-icon">\uD83D\uDCCB</div>' +
        '<div class="empty-text">\u8FD9\u4E00\u5929\u8FD8\u6CA1\u6709\u5B89\u6392<br>\u70B9\u51FB\u53F3\u4E0B\u89D2 + \u6DFB\u52A0</div></div></div>';
    } else {
      html += '<div class="card"><div class="card-title">' + formatDateLabel(selectedDate) + '</div>';
      items.forEach((item) => {
        html += '<div class="schedule-item" data-id="' + item.id + '">' +
          '<div class="schedule-time">' + escapeHtml(item.time || '') + '</div>' +
          '<div class="schedule-dot"></div>' +
          '<div class="schedule-content-cell">' +
          '<div class="item-title">' + escapeHtml(item.title) + '</div>' +
          '<div class="item-desc">' + escapeHtml(item.desc || '') + '</div>' +
          '</div>' +
          '<button class="item-delete" data-id="' + item.id + '">\u00d7</button>' +
          '</div>';
      });
      html += '</div>';
    }
    html += '</div>';

    container.innerHTML = html;

    bindWeekNav(container);
    bindDayClick(container);
    bindDelete(container);
  }

  // ===== 周视图 =====
  function renderWeekView(container) {
    const weekDates = Storage.getWeekDates(weekBase);
    const todayStr = Storage.formatDate(new Date());

    let html = '<div class="week-nav-bar">';
    html += '<button class="week-nav" id="week-prev">\u2039</button>';
    html += '<span class="week-range-label">' + (weekDates[0].getMonth() + 1) + '/' + weekDates[0].getDate() + ' - ' + (weekDates[6].getMonth() + 1) + '/' + weekDates[6].getDate() + '</span>';
    html += '<button class="week-nav" id="week-next">\u203a</button>';
    html += '</div>';

    let totalItems = 0;
    weekDates.forEach((d) => {
      const dateStr = Storage.formatDate(d);
      const items = Storage.schedule.getByDate(dateStr);
      totalItems += items.length;
      const isToday = dateStr === todayStr;
      let cls = 'week-day-row';
      if (isToday) cls += ' today';

      html += '<div class="' + cls + '" data-date="' + dateStr + '">';
      html += '<div class="wdr-left">';
      html += '<span class="wdr-weekday">' + Storage.WEEK_LABELS[(d.getDay() || 7) - 1] + '</span>';
      html += '<span class="wdr-date">' + (d.getMonth() + 1) + '/' + d.getDate() + '</span>';
      if (isToday) html += '<span class="wdr-today-tag">\u4ECA\u5929</span>';
      html += '</div>';
      html += '<div class="wdr-right">';
      if (items.length === 0) {
        html += '<span class="wdr-empty">\u65E0\u5B89\u6392</span>';
      } else {
        items.slice(0, 3).forEach((item) => {
          html += '<div class="wdr-item">' +
            (item.time ? '<span class="wdr-time">' + escapeHtml(item.time) + '</span>' : '') +
            '<span class="wdr-title">' + escapeHtml(item.title) + '</span>' +
            '</div>';
        });
        if (items.length > 3) {
          html += '<div class="wdr-more">\u8FD8\u6709 ' + (items.length - 3) + ' \u6761</div>';
        }
      }
      html += '</div>';
      html += '</div>';
    });

    if (totalItems === 0) {
      html += '<div class="empty-state"><div class="empty-icon">\uD83D\uDCCB</div>' +
        '<div class="empty-text">\u8FD9\u4E00\u5468\u8FD8\u6CA1\u6709\u5B89\u6392</div></div>';
    }

    container.innerHTML = html;

    const prev = container.querySelector('#week-prev');
    const next = container.querySelector('#week-next');
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
    html += '<button class="week-nav" id="month-prev">\u2039</button>';
    html += '<span class="month-range-label">' + year + '\u5E74' + (month + 1) + '\u6708</span>';
    html += '<button class="week-nav" id="month-next">\u203a</button>';
    html += '</div>';

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
      const items = Storage.schedule.getByDate(dateStr);
      const isToday = dateStr === todayStr;
      const isSelected = dateStr === selectedDate;
      let cls = 'cal-cell';
      if (isToday) cls += ' today';
      if (isSelected) cls += ' selected';
      html += '<div class="' + cls + '" data-date="' + dateStr + '">';
      html += '<span class="cal-day-num">' + day + '</span>';
      if (items.length > 0) {
        html += '<span class="cal-dot"></span>';
        html += '<span class="cal-count">' + items.length + '</span>';
      }
      html += '</div>';
    }
    html += '</div>';
    html += '</div>';

    const selectedItems = Storage.schedule.getByDate(selectedDate);
    html += '<div class="schedule-list">';
    if (selectedItems.length > 0) {
      html += '<div class="card"><div class="card-title">' + formatDateLabel(selectedDate) + '</div>';
      selectedItems.forEach((item) => {
        html += '<div class="schedule-item" data-id="' + item.id + '">' +
          '<div class="schedule-time">' + escapeHtml(item.time || '') + '</div>' +
          '<div class="schedule-dot"></div>' +
          '<div class="schedule-content-cell">' +
          '<div class="item-title">' + escapeHtml(item.title) + '</div>' +
          '<div class="item-desc">' + escapeHtml(item.desc || '') + '</div>' +
          '</div>' +
          '<button class="item-delete" data-id="' + item.id + '">\u00d7</button>' +
          '</div>';
      });
      html += '</div>';
    } else {
      html += '<div class="empty-state" style="padding:20px"><div class="empty-text">' + formatDateLabel(selectedDate) + '\u65E0\u5B89\u6392</div></div>';
    }
    html += '</div>';

    container.innerHTML = html;

    const prev = container.querySelector('#month-prev');
    const next = container.querySelector('#month-next');
    if (prev) prev.addEventListener('click', (e) => { e.stopPropagation(); monthBase.setMonth(monthBase.getMonth() - 1); render(); });
    if (next) next.addEventListener('click', (e) => { e.stopPropagation(); monthBase.setMonth(monthBase.getMonth() + 1); render(); });

    container.querySelectorAll('.cal-cell:not(.empty)').forEach((cell) => {
      cell.addEventListener('click', () => {
        selectedDate = cell.dataset.date;
        render();
      });
    });

    bindDelete(container);
  }

  function bindWeekNav(container) {
    const prev = container.querySelector('#week-prev');
    const next = container.querySelector('#week-next');
    if (prev) prev.addEventListener('click', (e) => { e.stopPropagation(); weekBase.setDate(weekBase.getDate() - 7); render(); });
    if (next) next.addEventListener('click', (e) => { e.stopPropagation(); weekBase.setDate(weekBase.getDate() + 7); render(); });
  }

  function bindDayClick(container) {
    container.querySelectorAll('.week-day').forEach((el) => {
      el.addEventListener('click', () => {
        selectedDate = el.dataset.date;
        render();
      });
    });
  }

  function bindDelete(container) {
    container.querySelectorAll('.item-delete').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        if (confirm('\u5220\u9664\u8FD9\u6761\u65E5\u7A0B?')) {
          Storage.schedule.remove(id);
          render();
          autoSync();
        }
      });
    });
  }

  function switchView(view) {
    currentView = view;
    localStorage.setItem('schedule_view', view);
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
    let label = (d.getMonth() + 1) + '\u6708' + d.getDate() + '\u65E5';
    if (isToday) label = '\u4ECA\u5929';
    else if (isTomorrow) label = '\u660E\u5929';
    else if (isYesterday) label = '\u6628\u5929';
    return label + '\u4E8B\u9879';
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function autoSync() {
    const apiBase = localStorage.getItem('apiBase') || '';
    if (apiBase.indexOf('workers.dev') !== -1) {
      localStorage.removeItem('apiBase');
    }
    Storage.sync().catch(() => {});
  }

  function showAddModal() {
    const modal = document.getElementById('modal-schedule');
    if (!modal) return;
    modal.querySelector('[name="date"]').value = selectedDate;
    modal.querySelector('[name="time"]').value = '';
    modal.querySelector('[name="title"]').value = '';
    modal.querySelector('[name="desc"]').value = '';
    modal.classList.add('show');
    setTimeout(() => modal.querySelector('[name="time"]').focus(), 100);
  }

  function hideModal() {
    document.getElementById('modal-schedule').classList.remove('show');
  }

  function handleSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const data = {
      date: form.date.value,
      time: form.time.value,
      title: form.title.value.trim(),
      desc: form.desc.value.trim(),
    };
    if (!data.title) return;
    Storage.schedule.add(data);
    selectedDate = data.date;
    const newDate = new Date(data.date);
    weekBase = new Date(newDate);
    monthBase = new Date(newDate);
    hideModal();
    render();
    autoSync();
  }

  function init() {
    const tabs = document.querySelectorAll('.schedule-tab');
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => switchView(tab.dataset.view));
    });

    render();

    const fab = document.querySelector('#view-schedule .fab');
    if (fab) fab.addEventListener('click', showAddModal);

    const modal = document.getElementById('modal-schedule');
    if (modal) {
      modal.querySelector('form').addEventListener('submit', handleSubmit);
      modal.addEventListener('click', (e) => { if (e.target === modal) hideModal(); });
      const cancelBtn = modal.querySelector('.btn-cancel');
      if (cancelBtn) cancelBtn.addEventListener('click', hideModal);
    }
  }

  return { init, render };
})();
