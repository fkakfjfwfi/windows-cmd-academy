/* 命令行学院 · SecureAPI 客户端（由 tools/build-api.js 生成，勿手改）
 * 加载链：探测后端 /api/ping → 有真后端走 /api（token + 限速 + Referer 校验）
 *         否则走静态加密文件 api/v1/*.bin（AES-256-GCM，WebCrypto 解密）
 *         fetch 失败（file:// 离线）→ 内嵌 XOR 混淆兜底
 * 诚实声明：密钥必须随页面下发，客户端加密防的是"一键扒站"，防不了逆向高手。 */
(function () {
  'use strict';
  var MANIFEST = {"stage5-procs":"bd62ee189e","stage8-dangers":"33801c0c51","stage9-gems":"35dd62a0aa"};
  var FALLBACK = {"stage5-procs":"s6ympw3DhkAju1DaYdKWrAe/15qnDA3UZ41qCz3pzurcjYylQN3LQHf6H4533JbFduqEzLUJToxllTpAvnhPLVM+SQGoXgbab/YdnSeJ2OkxtIbU4lMPhWuiEEJ5sNTohsDB4g+ChkAook3TLJrT/Hqj3IvgTQ/aN8Z+QGPrxfjYlYCnD9XDD2/gHZ172pq3YPKEpeBND9owx3sWe/HU6A4AIG6wGkPwwT6GBKZiF2j0SYbC4kNLmSnIfxB78dT7yNyAiieYhhlt+FPeLo2UtHTkx4awDkKdacpiB3vn1OiYyMilF5iVU3/qEZ9hhdPjdvyEzPdQHdR3nypCEunY6srWxOZZmpxCbzyIMKtPPmvNbobC4kNLmSnIfxB78dT6yNyAiieYhhlt+FPeLo2UtHTk0IuxFQKLIt1sByvlkbKNg4CnD8jPBm/gHYt22oaidOTJi69DFdhlni9UdfnA8sjqjqsNmtEKLK4fhWPKUjP0IT5qJNSkEOg6/P7ULn5ryo2MpUnZyAUoqB+FY9iW83jLrs7iGg/aKc53B3vx1Oi/xO/vTMyIBzW/H5NjysbnMOSezvdQH8BrjzgPPKbW8MiDn78dlJ9Qdfp2nW/IlPk8p9DM+EENHfkB/t346djqysXN6Urd1EB3+g2fPsS7hHTm387gD06VIo0gQnulm76N0c3jA93eB2/2HZ0zgdKsbuaS2PZVA9hlwn8Pe/HU6NmTgLUVgIYpb/YdnTSA1/p2/ITMKs+fHP0k/P716djqysXN6Urd1EB3+g2fPuW801nM","stage8-dangers":"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","stage9-gems":"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"};
  var KEYBIN = (function () {
    var parts = ["i2PWrpUHOAY=","jyR6QpgKaCIOreM0","JG1gS+F0aq6BFvFz"].reverse().join('');
    var raw = atob(parts), out = '';
    for (var i = 0; i < raw.length; i++) out += String.fromCharCode(raw.charCodeAt(i) ^ 204);
    return out; /* 32 字节二进制串 */
  })();
  function keyBytes() {
    var arr = new Uint8Array(32);
    for (var i = 0; i < 32; i++) arr[i] = KEYBIN.charCodeAt(i);
    return arr;
  }
  function b64ToBuf(s) {
    var raw = atob(s), arr = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
    return arr;
  }
  function xorDecode(name) {
    if (!FALLBACK[name]) return null;
    var data = b64ToBuf(FALLBACK[name]), kb = keyBytes(), out = new Uint8Array(data.length);
    for (var i = 0; i < data.length; i++) out[i] = data[i] ^ kb[i % kb.length];
    return new TextDecoder().decode(out);
  }
  function aesDecode(buf) {
    if (!(window.crypto && window.crypto.subtle)) return Promise.reject(new Error('需要 https 或 localhost 环境（WebCrypto 不可用）'));
    var bytes = new Uint8Array(buf);
    var iv = bytes.slice(0, 12), body = bytes.slice(12); /* body = 密文 + GCM 标签 */
    return crypto.subtle.importKey('raw', keyBytes(), 'AES-GCM', false, ['decrypt']).then(function (k) {
      return crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, k, body);
    }).then(function (pt) { return new TextDecoder().decode(pt); });
  }

  var baseP = null; /* '/api'（真后端）或 'api/v1'（静态加密文件） */
  function detectBase() {
    if (baseP) return baseP;
    baseP = fetch('/api/ping', { cache: 'no-store' }).then(function (r) {
      return r.ok ? r.json() : null;
    }).then(function (j) {
      return (j && j.ok && j.mode === 'backend') ? '/api' : 'api/v1';
    }).catch(function () { return 'api/v1'; });
    return baseP;
  }

  var cache = {};
  function load(name) {
    if (!cache[name]) {
      cache[name] = detectBase().then(function (base) {
        var bust = MANIFEST[name] ? ('?v=' + MANIFEST[name]) : '';
        var url = base === '/api'
          ? '/api/v1/' + name
          : base + '/' + name + '.bin' + bust;
        var pre = base === '/api' ? fetch('/api/token', { cache: 'no-store' }).catch(function () { return null; }) : Promise.resolve(null);
        return pre.then(function () {
          return fetch(url, { cache: 'no-store' });
        }).then(function (r) {
          if (!r.ok) throw new Error('接口 ' + r.status + (r.status === 429 ? '（请求太快被限速）' : ''));
          return r.arrayBuffer();
        }).then(aesDecode).catch(function (e) {
          var t = xorDecode(name); /* 静态/离线兜底 */
          if (!t) throw e;
          return t;
        }).then(function (text) { return JSON.parse(text); });
      });
    }
    return cache[name];
  }

  window.SecureAPI = { load: load };
})();
