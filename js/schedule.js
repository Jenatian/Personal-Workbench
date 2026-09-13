/**
 * 日程模块 - 增删改查 + 周切换 + 云同步
 */
const ScheduleModule = (function () {
  let selectedDate = Storage.formatDate(new Date());
  let weekBase = new Date(); // 当前周的基准日

  function render() {
    renderWeekStrip();
    renderScheduleList();
  }

  function renderWeekStrip() {
    const container = document.querySelector('#view-schedule .week-strip');
    if (!container) return;
    const weekDates = Storage.getWeekDates(weekBase);
    const todayStr = Storage.formatDate(new Date());

    let html = '<button class="week-nav" id="week-prev">‹</button>';
    html += '<div class="week-days-row">';
    weekDates.forEach((d, i) => {
      const dateStr = Storage.formatDate(d);
      const num = d.getDate();
      const isToday = dateStr === todayStr;
      const isSelected = dateStr === selectedDate;
      const hasItems = Storage.schedule.getByDate(dateStr).length > 0;
      let cls = 'week-day';
      if (isToday) cls += ' today';
      if (isSelected) cls += ' selected';
      html += '<div class="' + cls + '" data-date="' + dateStr + '">' +
        '<span class="week-label">' + Storage.WEEK_LABELS[i] + '</span>' +
        '<span class="week-num">' + num + '</span>' +
        (hasItems ? '<span class="week-dot"></span>' : '') +
        '</div>';
    });
    html += '</div>';
    html += '<button class="week-nav" id="week-next">›</button>';

    container.innerHTML = html;

    // 绑定日期点击
    container.querySelectorAll('.week-day').forEach((el) => {
      el.addEventListener('click', () => {
        selectedDate = el.dataset.date;
        render();
      });
    });

    // 上一周
    const prevBtn = container.querySelector('#week-prev');
    if (prevBtn) prevBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      weekBase.setDate(weekBase.getDate() - 7);
      render();
    });

    // 下一周
    const nextBtn = container.querySelector('#week-next');
    if (nextBtn) nextBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      weekBase.setDate(weekBase.getDate() + 7);
      render();
    });
  }

  function renderScheduleList() {
    const card = document.querySelector('#view-schedule .schedule-list');
    if (!card) return;
    const items = Storage.schedule.getByDate(selectedDate);

    if (items.length === 0) {
      card.innerHTML = '<div class="card"><div class="card-title">' + formatDateLabel(selectedDate) + '</div>' +
        '<div class="empty-state"><div class="empty-icon">📋</div>' +
        '<div class="empty-text">这一天还没有安排<br>点击右下角 + 添加</div></div></div>';
      return;
    }

    let html = '<div class="card"><div class="card-title">' + formatDateLabel(selectedDate) + '</div>';
    items.forEach((item) => {
      html += '<div class="schedule-item" data-id="' + item.id + '">' +
        '<div class="schedule-time">' + escapeHtml(item.time || '') + '</div>' +
        '<div class="schedule-dot"></div>' +
        '<div class="schedule-content">' +
        '<div class="item-title">' + escapeHtml(item.title) + '</div>' +
        '<div class="item-desc">' + escapeHtml(item.desc || '') + '</div>' +
        '</div>' +
        '<button class="item-delete" data-id="' + item.id + '" style="color:var(--text-tertiary);font-size:18px;padding:4px 8px;">×</button>' +
        '</div>';
    });
    html += '</div>';
    card.innerHTML = html;

    card.querySelectorAll('.item-delete').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        if (confirm('删除这条日程?')) {
          Storage.schedule.remove(id);
          render();
          // 自动同步
          if (isSyncEnabled()) Storage.sync();
        }
      });
    });
  }

  function formatDateLabel(dateStr) {
    const d = new Date(dateStr);
    const today = new Date();
    const isToday = Storage.formatDate(d) === Storage.formatDate(today);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow = dateStr === Storage.formatDate(tomorrow);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = dateStr === Storage.formatDate(yesterday);
    let label = (d.getMonth() + 1) + '月' + d.getDate() + '日';
    if (isToday) label = '今天';
    else if (isTomorrow) label = '明天';
    else if (isYesterday) label = '昨天';
    return label + '事项';
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
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
    // 如果新选的日期不在当前周,跳到那一周
    const newDate = new Date(data.date);
    const weekDates = Storage.getWeekDates(weekBase);
    const weekStart = Storage.formatDate(weekDates[0]);
    const weekEnd = Storage.formatDate(weekDates[6]);
    if (data.date < weekStart || data.date > weekEnd) {
      weekBase = new Date(newDate);
    }
    hideModal();
    render();
    // 自动同步
    if (isSyncEnabled()) Storage.sync();
  }

  function isSyncEnabled() {
    const apiBase = localStorage.getItem('apiBase');
    // apiBase 为空说明用 Pages 同源 API,也是启用的
    return apiBase !== null && apiBase !== undefined;
  }

  function init() {
    render();

    const scheduleFab = document.querySelector('#view-schedule .fab');
    if (scheduleFab) {
      scheduleFab.addEventListener('click', showAddModal);
    }

    const modal = document.getElementById('modal-schedule');
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
