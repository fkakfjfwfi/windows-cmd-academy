/* 命令行学院 · 加密内容管线
 *
 * 输入：tools/content/*.json（明文内容源）
 * 输出：
 *   api/v1/<name>.bin       —— AES-256-GCM 加密载荷（IV 12B + 密文 + GCM 标签 16B）
 *   assets/secure.js        —— 自包含客户端：混淆密钥 + SecureAPI 加载器 + manifest（缓存戳）
 *   assets/fallback-data.js —— file:// 离线兜底（XOR 混淆，非明文）
 *
 * 用法：node tools/build-api.js    （每次运行生成新密钥，需全量重建）
 * 后端模式：server.py 读取同一批 api/v1/*.bin 下发，接口层叠加 token/限速/Referer 防护
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const CONTENT_DIR = path.join(ROOT, 'tools', 'content');
const OUT_DIR = path.join(ROOT, 'api', 'v1');
const ASSETS = path.join(ROOT, 'assets');

fs.mkdirSync(OUT_DIR, { recursive: true });

const key = crypto.randomBytes(32);          /* AES-256 会话密钥（每次构建随机） */
const mask = crypto.randomBytes(1)[0];       /* 密钥混淆用异或掩码 */
const names = fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5));

const manifest = {};
const fallback = {};

for (const name of names) {
  const plain = fs.readFileSync(path.join(CONTENT_DIR, name + '.json'));

  /* --- AES-256-GCM 加密 --- */
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  const bin = Buffer.concat([iv, ct, tag]);
  fs.writeFileSync(path.join(OUT_DIR, name + '.bin'), bin);
  manifest[name] = crypto.createHash('sha256').update(bin).digest('hex').slice(0, 10); /* 缓存戳 */

  /* --- XOR 混淆兜底（file:// 场景；非明文，防一键扒站） --- */
  const xored = Buffer.alloc(plain.length);
  for (let i = 0; i < plain.length; i++) xored[i] = plain[i] ^ key[i % key.length];
  fallback[name] = xored.toString('base64');
}

/* --- 密钥混淆：XOR 掩码 → base64 → 切 4 段倒序存放 --- */
const kx = Buffer.from(key);
for (let i = 0; i < kx.length; i++) kx[i] ^= mask;
const b64 = kx.toString('base64');
const parts = b64.match(/.{1,16}/g) || [];
const keyParts = JSON.stringify(parts.reverse());

const CLIENT = `/* 命令行学院 · SecureAPI 客户端（由 tools/build-api.js 生成，勿手改）
 * 加载链：探测后端 /api/ping → 有真后端走 /api（token + 限速 + Referer 校验）
 *         否则走静态加密文件 api/v1/*.bin（AES-256-GCM，WebCrypto 解密）
 *         fetch 失败（file:// 离线）→ 内嵌 XOR 混淆兜底
 * 诚实声明：密钥必须随页面下发，客户端加密防的是"一键扒站"，防不了逆向高手。 */
(function () {
  'use strict';
  var MANIFEST = ${JSON.stringify(manifest)};
  var FALLBACK = ${JSON.stringify(fallback)};
  var KEYBIN = (function () {
    var parts = ${keyParts}.reverse().join('');
    var raw = atob(parts), out = '';
    for (var i = 0; i < raw.length; i++) out += String.fromCharCode(raw.charCodeAt(i) ^ ${mask});
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
`;

fs.writeFileSync(path.join(ASSETS, 'secure.js'), CLIENT);
fs.writeFileSync(path.join(ASSETS, 'fallback-data.js'),
  '/* 由 tools/build-api.js 生成：离线兜底数据（XOR 混淆），secure.js 已内嵌同款，此文件仅为占位说明 */\n');

console.log('构建完成 ✅');
console.log('  密钥：每次构建随机生成（' + key.length + ' 字节，已混淆内嵌）');
names.forEach(n => console.log('  api/v1/' + n + '.bin  ' + fs.statSync(path.join(OUT_DIR, n + '.bin')).size + ' B  (v=' + manifest[n] + ')'));
