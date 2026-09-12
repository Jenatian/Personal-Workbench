/**
 * 记账模块 - 增删改查 + 汇总渲染
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

  function render() {
    renderSummary();
    renderCategoryBar();
    renderEntryList();
  }

  function renderSummary() {
    const card = document.querySelector('#view-accounting .summary-card');
    if (!card) return;
    const now = new Date();
    const monthStr = Storage.formatMonth(now);
    const monthData = Storage.accounting.getSummary(monthStr);
    const todayData = Storage.accounting.getTodaySummary();

    // 本周
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

  function renderEntryList() {
    const card = document.querySelector('#view-accounting .entry-list');
    if (!card) return;
    const items = Storage.accounting.list().slice(0, 20);

    if (items.length === 0) {
      card.innerHTML = '<div class="card"><div class="card-title">最近记录</div>' +
        '<div class="empty-state"><div class="empty-icon">💸</div>' +
        '<div class="empty-text">还没有记账<br>点击右下角 + 记一笔</div></div></div>';
      return;
    }

    let html = '<div class="card"><div class="card-title">最近记录</div>';
    items.forEach((item) => {
      const cat = CATEGORIES.find((c) => c.name === item.category) || CATEGORIES[7];
      html += '<div class="entry-item">' +
        '<div class="entry-icon">' + cat.icon + '</div>' +
        '<div class="entry-info">' +
        '<div class="entry-cat">' + escapeHtml(item.category) + '</div>' +
        '<div class="entry-note">' + escapeHtml(item.note || formatDateShort(item.date)) + '</div>' +
        '</div>' +
        '<div class="entry-amount">¥' + formatMoney(item.amount) + '</div>' +
        '<button class="item-delete" data-id="' + item.id + '" style="color:var(--text-tertiary);font-size:18px;padding:4px 8px;">×</button>' +
        '</div>';
    });
    html += '</div>';
    card.innerHTML = html;

    card.querySelectorAll('.item-delete').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm('删除这条记录?')) {
          Storage.accounting.remove(btn.dataset.id);
          render();
        }
      });
    });
  }

  function showAddModal() {
    const modal = document.getElementById('modal-accounting');
    if (!modal) return;
    modal.querySelector('[name="amount"]').value = '';
    modal.querySelector('[name="note"]').value = '';
    modal.querySelector('[name="date"]').value = Storage.formatDate(new Date());
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
    hideModal();
    render();
  }

  function formatMoney(n) {
    return (n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function formatDateShort(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return (d.getMonth() + 1) + '/' + d.getDate();
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function init() {
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
