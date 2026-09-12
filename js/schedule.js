/**
 * 日程模块 - 增删改查 + 渲染
 */
const ScheduleModule = (function () {
  let selectedDate = Storage.formatDate(new Date());

  function render() {
    renderWeekStrip();
    renderScheduleList();
  }

  function renderWeekStrip() {
    const container = document.querySelector('#view-schedule .week-strip');
    if (!container) return;
    const weekDates = Storage.getWeekDates();
    const todayStr = Storage.formatDate(new Date());

    container.innerHTML = weekDates.map((d, i) => {
      const dateStr = Storage.formatDate(d);
      const num = d.getDate();
      const isToday = dateStr === todayStr;
      const isSelected = dateStr === selectedDate;
      const cls = isToday ? 'week-day today' : (isSelected ? 'week-day selected' : 'week-day');
      return '<div class="' + cls + '" data-date="' + dateStr + '">' +
        '<span class="week-label">' + Storage.WEEK_LABELS[i] + '</span>' +
        '<span class="week-num">' + num + '</span>' +
        '</div>';
    }).join('');

    container.querySelectorAll('.week-day').forEach((el) => {
      el.addEventListener('click', () => {
        selectedDate = el.dataset.date;
        render();
      });
    });
  }

  function renderScheduleList() {
    const card = document.querySelector('#view-schedule .schedule-list');
    if (!card) return;
    const items = Storage.schedule.getByDate(selectedDate);

    if (items.length === 0) {
      card.innerHTML = '<div class="card"><div class="card-title">今日事项</div>' +
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
    const label = isToday ? '今天' : (isTomorrow ? '明天' : (d.getMonth() + 1) + '月' + d.getDate() + '日');
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
    hideModal();
    render();
    updateDateBadge();
  }

  function updateDateBadge() {
    const badge = document.querySelector('#view-schedule .date-badge');
    if (!badge) return;
    const d = new Date(selectedDate);
    const weeks = ['日', '一', '二', '三', '四', '五', '六'];
    badge.textContent = (d.getMonth() + 1) + '月' + d.getDate() + '日 周' + weeks[d.getDay()];
  }

  function init() {
    render();
    updateDateBadge();

    const fab = document.querySelector('#view-accounting .fab');
    // schedule 的 FAB
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
