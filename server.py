#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""命令行学院 · 后端模式（零依赖，Python 3.7+ 标准库）

用法：
    python server.py            # 默认 8765 端口
    python server.py 9000       # 自定义端口

访问：http://127.0.0.1:8765/   （请用 127.0.0.1，浏览器才允许 WebCrypto 解密）

与 GitHub Pages 的关系：
    前端 SecureAPI 会先探测 /api/ping —— 探测到本后端就走「token + 限速 + Referer」的接口模式；
    探测不到（GitHub Pages）自动回退静态加密文件。同一套前端，两种运行形态。

接口防护（这是静态托管给不了的）：
    1. HMAC-SHA256 签名短时 token（HttpOnly Cookie，10 分钟过期）
    2. 每 IP 每分钟 60 次限速（token 与数据接口分开计数）
    3. Referer 同源校验（跨站热链直接 403）
"""
import base64
import hashlib
import hmac
import json
import os
import secrets
import sys
import time
from collections import defaultdict, deque
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

ROOT = os.path.dirname(os.path.abspath(__file__))
API_DIR = os.path.join(ROOT, 'api', 'v1')
SECRET_FILE = os.path.join(ROOT, '.secret')
TOKEN_TTL = 600          # token 有效期（秒）
RATE_LIMIT = int(os.environ.get('KA_RATE', '60'))  # 每 IP 每分钟请求上限（KA_RATE 环境变量可覆盖，便于测试）
WINDOW = 60.0


def load_secret() -> bytes:
    """首次运行生成 64 位十六进制密钥并落盘（.secret 已加入 .gitignore，切勿提交/外传）"""
    if os.path.exists(SECRET_FILE):
        with open(SECRET_FILE, 'r', encoding='utf-8') as f:
            return f.read().strip().encode()
    s = secrets.token_hex(32)
    with open(SECRET_FILE, 'w', encoding='utf-8') as f:
        f.write(s)
    return s.encode()


SECRET = load_secret()
_rate: dict = defaultdict(deque)


def sign(payload: bytes) -> str:
    mac = hmac.new(SECRET, payload, hashlib.sha256).hexdigest()
    return base64.urlsafe_b64encode(payload).decode().rstrip('=') + '.' + mac


def verify(token: str) -> bool:
    try:
        b64, mac = token.rsplit('.', 1)
        payload = base64.urlsafe_b64decode(b64 + '=' * (-len(b64) % 4))
        good = hmac.compare_digest(hmac.new(SECRET, payload, hashlib.sha256).hexdigest(), mac)
        if not good:
            return False
        data = json.loads(payload)
        return data.get('exp', 0) > time.time()
    except Exception:
        return False


def rate_ok(ip: str, bucket: str) -> bool:
    """滑动窗口限速：返回 True=放行。bucket 区分不同接口独立计数。"""
    now = time.time()
    q = _rate[bucket + '|' + ip]
    while q and now - q[0] > WINDOW:
        q.popleft()
    if len(q) >= RATE_LIMIT:
        return False
    q.append(now)
    return True


class Handler(SimpleHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'

    def _json(self, obj, code=200, headers=None):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        for k, v in (headers or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)

    def _client_ip(self) -> str:
        return self.client_address[0] or 'unknown'

    def do_GET(self):
        path = self.path.split('?', 1)[0]

        # ---- 探测：前端据此决定走后端还是静态加密文件 ----
        if path == '/api/ping':
            return self._json({'ok': True, 'mode': 'backend', 'time': int(time.time())})

        # ---- token 签发：HttpOnly Cookie，前端拿不到内容也改不了 ----
        if path == '/api/token':
            if not rate_ok(self._client_ip(), 'token'):
                return self._json({'ok': False, 'error': 'rate_limited'}, 429)
            payload = json.dumps({'iat': int(time.time()), 'exp': int(time.time()) + TOKEN_TTL,
                                  'nonce': secrets.token_hex(8)}).encode()
            cookie = sign(payload)
            exp = int(time.time()) + TOKEN_TTL
            return self._json({'ok': True, 'exp': exp},
                              headers={'Set-Cookie': f'ka_t={cookie}; HttpOnly; Path=/api; Max-Age={TOKEN_TTL}; SameSite=Strict'})

        # ---- 数据接口：token + 限速 + Referer 三重校验 ----
        if path.startswith('/api/v1/'):
            ip = self._client_ip()
            if not rate_ok(ip, 'data'):
                return self._json({'ok': False, 'error': 'rate_limited'}, 429)
            referer = self.headers.get('Referer', '')
            if referer:
                host = self.headers.get('Host', '')
                if host and host not in referer:
                    return self._json({'ok': False, 'error': 'hotlink_denied'}, 403)
            cookies = self.headers.get('Cookie', '')
            token = ''
            for part in cookies.split(';'):
                k, _, v = part.strip().partition('=')
                if k == 'ka_t':
                    token = v
            if not token or not verify(token):
                return self._json({'ok': False, 'error': 'need_token'}, 401)
            name = path[len('/api/v1/'):].strip('/')
            if '/' in name or '..' in name:
                return self._json({'ok': False, 'error': 'bad_name'}, 400)
            fp = os.path.join(API_DIR, name + '.bin')
            if not os.path.isfile(fp):
                return self._json({'ok': False, 'error': 'not_found'}, 404)
            with open(fp, 'rb') as f:
                body = f.read()
            self.send_response(200)
            self.send_header('Content-Type', 'application/octet-stream')
            self.send_header('Content-Length', str(len(body)))
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            self.wfile.write(body)
            return

        # ---- 其余路径：静态托管本站 ----
        super().do_GET()

    def log_message(self, fmt, *args):
        sys.stderr.write('[%s] %s\n' % (self.log_date_time_string(), fmt % args))


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    handler = partial(Handler, directory=ROOT)
    httpd = ThreadingHTTPServer(('0.0.0.0', port), handler)  # 多线程：并发请求/慢客户端不互相阻塞
    print(f'命令行学院 · 后端模式已启动')
    print(f'  本站：http://127.0.0.1:{port}/')
    print(f'  探口：/api/ping   token：/api/token   数据：/api/v1/<名称>')
    print(f'  防护：HMAC token（{TOKEN_TTL}s）+ {RATE_LIMIT} 次/分钟/IP + Referer 同源校验')
    print(f'  密钥：{SECRET_FILE}（已 gitignore，勿外传）')
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print('\n已停止')


if __name__ == '__main__':
    main()
