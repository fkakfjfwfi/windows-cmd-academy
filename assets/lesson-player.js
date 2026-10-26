/* 动画课堂播放器：像视频一样自动播放每阶段的教学动画
 * 用法：new LessonPlayer({ root: '#lesson1', title: '...', scenes: [{ d: 秒, cap: '字幕', a: function(theater){} }] })
 * 场景 act 采用"整状态声明"写法：seek 到任意场景都能正确复原画面（先 base 清场，再执行 act）。
 */
(function () {
  var STATE = ['on', 'dim', 'show', 'good', 'bad', 'warn', 'play', 'arrive', 'grow'];

  function fmt(s) {
    s = Math.max(0, Math.floor(s));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  function LessonPlayer(cfg) {
    var root = document.querySelector(cfg.root);
    var theater = root.querySelector('.theater');
    if (!theater) { console.error('LessonPlayer: 找不到 .theater'); return; }
    var scenes = cfg.scenes;
    var SPEEDS = [1, 1.25, 1.5, 2];
    var speedIdx = 0;
    var starts = [], total = 0;
    scenes.forEach(function (s) { starts.push(total); total += s.d; });

    /* ---- 拼装播放器外壳：字幕条 + 控制条 ---- */
    var cap = document.createElement('div');
    cap.className = 'lesson-cap';
    var chrome = document.createElement('div');
    chrome.className = 'lesson-chrome';
    chrome.innerHTML =
      '<button class="pbtn big" data-a="play" type="button" title="播放 / 暂停（空格）">▶</button>' +
      '<button class="pbtn" data-a="replay" type="button" title="从头重播">⟲</button>' +
      '<button class="pbtn" data-a="prev" type="button" title="上一场景">⏮</button>' +
      '<button class="pbtn" data-a="next" type="button" title="下一场景">⏭</button>' +
      '<button class="pbtn spd" data-a="speed" type="button" title="播放速度">1×</button>' +
      '<div class="tl" title="点击跳到任意位置"><div class="fill"></div><div class="dots"></div></div>' +
      '<span class="time">0:00 / ' + fmt(total) + '</span>' +
      '<span class="scene-lb"></span>';
    root.appendChild(cap);
    root.appendChild(chrome);

    var el = {
      fill: chrome.querySelector('.fill'),
      dots: chrome.querySelector('.dots'),
      time: chrome.querySelector('.time'),
      sceneLb: chrome.querySelector('.scene-lb'),
      play: chrome.querySelector('[data-a="play"]'),
      spd: chrome.querySelector('.spd'),
      tl: chrome.querySelector('.tl')
    };
    scenes.forEach(function (s, i) {
      var d = document.createElement('span');
      d.className = 'dot';
      d.style.left = (starts[i] / total * 100) + '%';
      el.dots.appendChild(d);
    });

    var cover = document.createElement('div');
    cover.className = 'lesson-cover';
    cover.innerHTML =
      '<div class="cover-play">▶</div>' +
      '<div class="cover-t">' + cfg.title + '</div>' +
      '<div class="cover-d">共 ' + scenes.length + ' 个场景 · 约 ' + Math.round(total / 60) + ' 分钟 · 点击播放（空格暂停）</div>';
    root.querySelector('.screen').appendChild(cover);

    /* ---- 状态机 ---- */
    var t = 0, cur = -1, playing = false, raf = 0, last = 0, ended = false;

    function base() {
      theater.querySelectorAll('*').forEach(function (e) {
        for (var i = 0; i < STATE.length; i++) e.classList.remove(STATE[i]);
      });
      theater.querySelectorAll('[data-dyn]').forEach(function (e) { e.textContent = ''; });
      theater.querySelectorAll('[data-fx]').forEach(function (e) { e.removeAttribute('style'); });
    }
    function idxAt(time) {
      var i = 0;
      while (i + 1 < scenes.length && starts[i + 1] <= time) i++;
      return i;
    }
    function apply(i) {
      cur = i;
      base();
      void theater.offsetWidth; /* 强制回流，保证 CSS 动画能重新触发 */
      /* 累积状态：0..i 的 set/cls 依次生效， seek 到任意场景都能完整复原"视频至今"的画面 */
      for (var j = 0; j <= i; j++) {
        var st = scenes[j].set, cl = scenes[j].cls;
        if (st) for (var id in st) {
          var e = theater.querySelector('#' + id);
          if (e) e.textContent = st[id];
        }
        if (cl) for (var id2 in cl) {
          var e2 = theater.querySelector('#' + id2);
          if (e2) {
            if (Array.isArray(cl[id2])) cl[id2].forEach(function (c) { e2.classList.add(c); });
            else e2.classList.add(cl[id2]);
          }
        }
      }
      if (scenes[i].a) scenes[i].a(theater);
      cap.textContent = scenes[i].cap;
      el.sceneLb.textContent = '场景 ' + (i + 1) + '/' + scenes.length;
      paint();
    }
    function paint() {
      el.fill.style.width = (t / total * 100) + '%';
      el.time.textContent = fmt(t) + ' / ' + fmt(total);
      el.dots.querySelectorAll('.dot').forEach(function (d, i) {
        d.classList.toggle('past', starts[i] <= t);
      });
    }
    function setPlaying(p) {
      playing = p;
      el.play.textContent = p ? '⏸' : '▶';
      if (p) {
        if (cur === -1) apply(0);
        cover.classList.add('hide');
        last = performance.now();
        raf = requestAnimationFrame(tick);
      } else {
        cancelAnimationFrame(raf);
      }
    }
    function tick(now) {
      if (!playing) return;
      t += (now - last) / 1000 * SPEEDS[speedIdx];
      last = now;
      if (t >= total) {
        t = total;
        paint();
        ended = true;
        setPlaying(false);
        cap.textContent = '本集完 ✅ —— 往下滚动，把刚才看到的亲手做一遍';
        cover.querySelector('.cover-play').textContent = '⟲';
        cover.querySelector('.cover-d').textContent = '重新播放本集';
        cover.classList.remove('hide');
        return;
      }
      var i = idxAt(t);
      if (i !== cur) apply(i);
      paint();
      raf = requestAnimationFrame(tick);
    }
    function play() {
      if (ended) {
        ended = false;
        t = 0;
        cover.querySelector('.cover-play').textContent = '▶';
        cover.querySelector('.cover-d').textContent = '共 ' + scenes.length + ' 个场景 · 约 ' + Math.round(total / 60) + ' 分钟 · 点击播放（空格暂停）';
      }
      setPlaying(true);
    }
    function seek(time) {
      t = Math.min(total - 0.001, Math.max(0, time));
      ended = false;
      if (playing) last = performance.now();
      apply(idxAt(t));
    }

    chrome.addEventListener('click', function (e) {
      var b = e.target.closest('[data-a]');
      if (!b) return;
      var a = b.dataset.a;
      if (a === 'play') { if (playing) setPlaying(false); else play(); }
      else if (a === 'replay') { ended = false; t = 0; apply(0); setPlaying(true); }
      else if (a === 'prev') seek(starts[Math.max(0, (cur === -1 ? 0 : cur) - 1)]);
      else if (a === 'next') seek(starts[Math.min(scenes.length - 1, (cur === -1 ? 0 : cur) + 1)]);
      else if (a === 'speed') { speedIdx = (speedIdx + 1) % SPEEDS.length; el.spd.textContent = SPEEDS[speedIdx] + '×'; }
    });
    cover.addEventListener('click', play);
    el.tl.addEventListener('click', function (e) {
      var r = this.getBoundingClientRect();
      seek((e.clientX - r.left) / r.width * total);
    });
    document.addEventListener('keydown', function (e) {
      if (e.code !== 'Space' || /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
      var inPlayer = e.target.closest && e.target.closest('.lesson');
      var r = root.getBoundingClientRect();
      if (inPlayer || (playing && r.top < innerHeight && r.bottom > 0)) {
        e.preventDefault();
        if (playing) setPlaying(false); else play();
      }
    });

    apply(0); /* 海报帧：先摆好第一场景画面 */
  }
  window.LessonPlayer = LessonPlayer;
})();
