/* 命令行学院 · 共享脚本：导航高亮 + 打卡进度持久化（localStorage） */
(function () {
  var KEY = 'cmdAcademyProgress';

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
  }
  function save(o) {
    try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {}
  }
  var state = load();
  var TOTALS = { 1: 5, 2: 6, 3: 6, 4: 6, 5: 6, 6: 6 }; // 每阶段打卡项数量，合计 35

  // 恢复勾选状态
  var boxes = document.querySelectorAll('input[type="checkbox"][data-persist]');
  boxes.forEach(function (cb) {
    if (!cb.id) return;
    if (state[cb.id]) cb.checked = true;
    cb.addEventListener('change', function () {
      state[cb.id] = cb.checked;
      save(state);
      paint();
    });
  });

  function counts() {
    var done = {}, total = {}, d = 0, t = 0, k;
    for (k in TOTALS) { total[k] = TOTALS[k]; done[k] = 0; }
    for (var key in state) {
      var m = /^s(\d)-/.exec(key);
      if (m && state[key] && total[m[1]] !== undefined) done[m[1]]++;
    }
    for (k in TOTALS) { d += done[k]; t += TOTALS[k]; }
    return { done: done, total: total, allDone: d, allTotal: t };
  }

  function paint() {
    var c = counts();
    document.querySelectorAll('[data-progress-bar]').forEach(function (el) {
      var which = el.getAttribute('data-progress-bar');
      var d, t;
      if (which === 'all' || which === '') { d = c.allDone; t = c.allTotal; }
      else { d = c.done[which] || 0; t = c.total[which] || 0; }
      el.style.width = (t ? (d / t * 100) : 0) + '%';
    });
    document.querySelectorAll('[data-progress-label]').forEach(function (el) {
      var which = el.getAttribute('data-progress-label');
      if (which === 'all' || which === '') el.textContent = c.allDone + ' / ' + c.allTotal + ' 项已打卡';
      else el.textContent = (c.done[which] || 0) + ' / ' + (c.total[which] || 0) + ' · 阶段 ' + which;
    });
    document.querySelectorAll('[data-stage-progress]').forEach(function (el) {
      var which = el.getAttribute('data-stage-progress');
      el.textContent = (c.done[which] || 0) + '/' + (c.total[which] || 0);
    });
  }

  // 导航高亮
  var page = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav a').forEach(function (a) {
    var href = a.getAttribute('href');
    if (href === page || (page === '' && href === 'index.html')) a.classList.add('active');
  });

  paint();
})();
