// 反馈接收服务：网站"提交反馈"表单 POST /api/feedback → 追加到 feedback.jsonl，并用 QQ 邮箱发一封通知。
// 只用 Node 自带模块（无 npm 依赖）。由 nginx 反向代理（deploy/nginx-igcm.conf），只监听 127.0.0.1。
// 环境变量（systemd 的 EnvironmentFile=/etc/igcm-feedback.env，权限 600，见 deploy/README.md）：
//   PORT=3201  DATA_DIR=/srv/igcm-feedback
//   SMTP_USER=xxx@qq.com  SMTP_PASS=<QQ 邮箱授权码>  NOTIFY_TO=xxx@qq.com   （不填 SMTP_PASS 则只存不发）
import http from 'node:http';
import tls from 'node:tls';
import fs from 'node:fs';
import path from 'node:path';

const PORT = +(process.env.PORT || 3201);
const DATA_DIR = process.env.DATA_DIR || '/srv/igcm-feedback';
const { SMTP_USER, SMTP_PASS, NOTIFY_TO } = process.env;
const FILE = path.join(DATA_DIR, 'feedback.jsonl');
const LIMITS = { name: 40, email: 120, text: 2000, body: 8192 };
fs.mkdirSync(DATA_DIR, { recursive: true });

// 每个 IP 每 10 分钟最多 5 条，每天全站最多 500 条：防刷
const hits = new Map();
let day = '', dayCount = 0;
function allowed(ip) {
  const now = Date.now(), d = new Date().toISOString().slice(0, 10);
  if (d !== day) { day = d; dayCount = 0; hits.clear(); }
  const list = (hits.get(ip) || []).filter((t) => now - t < 10 * 60e3);
  if (list.length >= 5 || dayCount >= 500) return false;
  list.push(now); hits.set(ip, list); dayCount++;
  return true;
}

const clean = (s, n) => String(s ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, n);
const EMAIL = /^[^\s@<>"']{1,64}@[^\s@<>"']{1,255}\.[a-z]{2,}$/i;

// 最小 SMTP 客户端：smtp.qq.com:465（SSL），AUTH LOGIN，发一封纯文本 UTF-8 邮件
function sendMail(subject, text) {
  return new Promise((resolve, reject) => {
    const sock = tls.connect(465, 'smtp.qq.com', { servername: 'smtp.qq.com' });
    const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');
    const enc = (s) => `=?UTF-8?B?${b64(s)}?=`;
    const body = b64(text).replace(/.{76}/g, '$&\r\n');
    const msg = [`From: ${enc('社团地图反馈')} <${SMTP_USER}>`, `To: <${NOTIFY_TO}>`, `Subject: ${enc(subject)}`,
      `Date: ${new Date().toUTCString()}`, 'MIME-Version: 1.0', 'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: base64', '', body, '.'].join('\r\n');
    const steps = [null, `EHLO igcm`, 'AUTH LOGIN', b64(SMTP_USER), b64(SMTP_PASS), `MAIL FROM:<${SMTP_USER}>`, `RCPT TO:<${NOTIFY_TO}>`, 'DATA', msg, 'QUIT'];
    const want = [220, 250, 334, 334, 235, 250, 250, 354, 250, 221];
    let i = 0, buf = '';
    const timer = setTimeout(() => { sock.destroy(); reject(new Error('smtp timeout')); }, 20000);
    sock.on('data', (d) => {
      buf += d.toString('utf8');
      // a reply is complete when its last line has a space after the code
      const lines = buf.split('\r\n').filter(Boolean);
      const last = lines[lines.length - 1];
      if (!last || !/^\d{3} /.test(last) || !buf.endsWith('\r\n')) return;
      const code = +last.slice(0, 3); buf = '';
      if (code !== want[i]) { clearTimeout(timer); sock.destroy(); return reject(new Error(`smtp ${code} at step ${i}: ${last.slice(0, 120)}`)); }
      i++;
      if (i >= steps.length) { clearTimeout(timer); sock.end(); return resolve(); }
      sock.write(steps[i] + '\r\n');
    });
    sock.on('error', (e) => { clearTimeout(timer); reject(e); });
  });
}

const reply = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(obj)); };

http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/api/feedback/health') return reply(res, 200, { ok: true, mail: !!SMTP_PASS });
  if (req.method !== 'POST' || req.url !== '/api/feedback') return reply(res, 404, { ok: false });
  const ip = String(req.headers['x-real-ip'] || req.socket.remoteAddress || '');
  let raw = '', over = false;
  req.on('data', (d) => { raw += d; if (raw.length > LIMITS.body) { over = true; req.destroy(); } });
  req.on('end', async () => {
    if (over) return;
    let b;
    try { b = JSON.parse(raw); } catch { return reply(res, 400, { ok: false, error: '格式不对' }); }
    if (b.website) return reply(res, 200, { ok: true });   // 隐藏字段被填了：机器人，假装成功
    const name = clean(b.name, LIMITS.name), email = clean(b.email, LIMITS.email), text = clean(b.text, LIMITS.text);
    if (!name) return reply(res, 400, { ok: false, error: '请填写称呼' });
    if (!EMAIL.test(email)) return reply(res, 400, { ok: false, error: '邮箱地址格式不对' });
    if (text.length < 2) return reply(res, 400, { ok: false, error: '请填写反馈内容' });
    if (!allowed(ip)) return reply(res, 429, { ok: false, error: '提交太频繁了，请稍后再试' });
    const rec = { at: new Date().toISOString(), name, email, text, page: clean(b.page, 300), ua: clean(req.headers['user-agent'], 200), ip };
    fs.appendFileSync(FILE, JSON.stringify(rec) + '\n');
    reply(res, 200, { ok: true });
    if (SMTP_USER && SMTP_PASS && NOTIFY_TO) {
      sendMail(`社团地图反馈：${name}`, `称呼：${name}\n邮箱：${email}\n时间：${new Date(rec.at).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}\n页面：${rec.page}\n\n${text}\n`)
        .catch((e) => console.error('[mail]', e.message));
    }
  });
}).listen(PORT, '127.0.0.1', () => console.log(`feedback on 127.0.0.1:${PORT}, mail ${SMTP_PASS ? 'on' : 'off'}`));
