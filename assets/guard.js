/* 命令行学院 · 内容防护层（客户端手段 = 提高扒站门槛；真正的防线在后端 server.py 的接口层） */
(function () {
  'use strict';
  var GUARD = {
    antiFrame: true,       /* 反 iframe 嵌套：防止整站被挂进别的网站冒充 */
    consoleBanner: true,   /* 控制台版权横幅 */
    copyAttribution: true, /* 复制内容自动附加来源信息 */
    devtoolsWatch: true    /* DevTools 打开检测（仅警示，不影响正常学习） */
  };

  /* 1) 反 iframe：被嵌套时强制跳到顶层 */
  if (GUARD.antiFrame) {
    try {
      if (window.top !== window.self) {
        window.top.location = window.self.location;
      }
    } catch (e) { /* 跨域取值失败说明被嵌套，同样跳转 */ }
  }

  /* 2) 控制台横幅：警告 + 版权声明 */
  if (GUARD.consoleBanner) {
    try {
      console.log('%c命令行学院 %c本站内容受保护：教学数据经加密接口下发，直接扒取 HTML 拿不到内容。\n转载请保留出处：https://fkakfjfwfi.github.io/windows-cmd-academy/',
        'background:#0f766e;color:#fff;padding:2px 8px;border-radius:4px;font-weight:bold',
        'color:#0f766e');
    } catch (e) {}
  }

  /* 3) 复制附加来源：允许学习复制，但带走的是带签名的 */
  if (GUARD.copyAttribution) {
    document.addEventListener('copy', function (e) {
      try {
        var sel = String(window.getSelection ? window.getSelection() : '');
        if (!sel || sel.length < 30) return; /* 短复制（一条命令）不打扰 */
        var src = (location.host || '本地文件') + location.pathname;
        var tag = '\n\n—— 来自「命令行学院」 ' + src;
        e.clipboardData.setData('text/plain', sel + tag);
        e.preventDefault();
      } catch (err) {}
    });
  }

  /* 4) DevTools 检测（窗口宽度启发式）：只提示一次，不做破坏 */
  if (GUARD.devtoolsWatch) {
    var warned = false;
    setInterval(function () {
      if (warned) return;
      var docked = window.outerWidth - window.innerWidth > 180 || window.outerHeight - window.innerHeight > 180;
      if (docked && document.hasFocus && document.hasFocus()) {
        warned = true;
        try { console.log('%c👋 检测到开发者工具。本站是开源学习站：想看懂实现欢迎读源码（github.com/fkakfjfwfi/windows-cmd-academy），但请勿原样扒取整站内容。', 'color:#b45309'); } catch (e) {}
      }
    }, 2000);
  }
})();
