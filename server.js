/**
 * Sushi Koya — web server
 * Zero-dependency Node (>=18) server:
 *   - serves the static site from /public
 *   - GET  /api/site                 site content (menu, hours, etc.)
 *   - GET  /api/status               live "open now" status (New York time)
 *   - POST /api/inquiry              private dining / buyout / general inquiries
 *   - POST /api/newsletter           mailing list sign-up
 *   - GET  /api/admin/inquiries      (Bearer ADMIN_TOKEN) list inquiries
 *   - GET  /api/admin/subscribers    (Bearer ADMIN_TOKEN) list subscribers
 *   - GET  /reserve                  302 → Resy
 */
const http = require('http');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT) || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');
const SITE_FILE = path.join(PUBLIC_DIR, 'data', 'site.json');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'SAMEORIGIN',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

/* ---------- tiny JSON "database" ---------- */
async function readStore(name) {
  try {
    return JSON.parse(await fsp.readFile(path.join(DATA_DIR, name + '.json'), 'utf8'));
  } catch {
    return [];
  }
}
const writeLocks = {};
async function appendStore(name, record) {
  // serialize writes per store so concurrent requests don't clobber each other
  const prev = writeLocks[name] || Promise.resolve();
  const next = prev.then(async () => {
    await fsp.mkdir(DATA_DIR, { recursive: true });
    const rows = await readStore(name);
    rows.push(record);
    const file = path.join(DATA_DIR, name + '.json');
    await fsp.writeFile(file + '.tmp', JSON.stringify(rows, null, 2));
    await fsp.rename(file + '.tmp', file);
    return rows;
  });
  writeLocks[name] = next.catch(() => {});
  return next;
}

/* ---------- helpers ---------- */
function send(res, status, body, headers = {}) {
  const isObj = typeof body === 'object' && !Buffer.isBuffer(body);
  res.writeHead(status, {
    ...SECURITY_HEADERS,
    'Content-Type': isObj ? MIME['.json'] : 'text/plain; charset=utf-8',
    ...headers,
  });
  res.end(isObj ? JSON.stringify(body) : body);
}

function readBody(req, limit = 20_000) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(Object.assign(new Error('Payload too large'), { status: 413 }));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch {
        reject(Object.assign(new Error('Invalid JSON'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

const clean = (v, max = 500) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
const cleanMultiline = (v, max = 2000) => String(v ?? '').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ').trim().slice(0, max);
const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

/* simple in-memory rate limiter: N requests / window per IP per bucket */
const hits = new Map();
function rateLimited(ip, bucket, max = 5, windowMs = 10 * 60 * 1000) {
  const key = bucket + ':' + ip;
  const now = Date.now();
  const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
  arr.push(now);
  hits.set(key, arr);
  return arr.length > max;
}
setInterval(() => {
  const now = Date.now();
  for (const [k, arr] of hits) if (!arr.some((t) => now - t < 10 * 60 * 1000)) hits.delete(k);
}, 60_000).unref();

function clientIp(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
}

function isAdmin(req) {
  if (!ADMIN_TOKEN) return false;
  const h = req.headers.authorization || '';
  const given = Buffer.from(h.replace(/^Bearer\s+/i, ''));
  const want = Buffer.from(ADMIN_TOKEN);
  return given.length === want.length && crypto.timingSafeEqual(given, want);
}

/* open/closed status in New York time (hours: daily 17:00–22:00) */
function nyStatus(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York', hour: 'numeric', minute: 'numeric', hourCycle: 'h23', weekday: 'long',
    }).formatToParts(now).map((p) => [p.type, p.value])
  );
  const mins = Number(parts.hour) * 60 + Number(parts.minute);
  const OPEN = 17 * 60, CLOSE = 22 * 60;
  const open = mins >= OPEN && mins < CLOSE;
  let message;
  if (open) message = `Open now · until 10 pm`;
  else if (mins < OPEN) message = `Opens today at 5 pm`;
  else message = `Closed · opens tomorrow at 5 pm`;
  return { open, message, weekday: parts.weekday };
}

/* ---------- API ---------- */
async function handleApi(req, res, url) {
  const ip = clientIp(req);

  if (req.method === 'GET' && url.pathname === '/api/site') {
    const site = await fsp.readFile(SITE_FILE, 'utf8');
    return send(res, 200, site, { 'Content-Type': MIME['.json'], 'Cache-Control': 'public, max-age=300' });
  }

  if (req.method === 'GET' && url.pathname === '/api/status') {
    return send(res, 200, nyStatus(), { 'Cache-Control': 'no-store' });
  }

  if (req.method === 'POST' && url.pathname === '/api/inquiry') {
    if (rateLimited(ip, 'inquiry')) return send(res, 429, { ok: false, error: 'Too many requests. Please call us instead.' });
    const b = await readBody(req);
    if (b.company_website) return send(res, 200, { ok: true }); // honeypot
    const rec = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      type: clean(b.type, 40) || 'general',
      name: clean(b.name, 120),
      email: clean(b.email, 200).toLowerCase(),
      phone: clean(b.phone, 40),
      date: clean(b.date, 20),
      guests: Math.max(0, Math.min(200, parseInt(b.guests, 10) || 0)),
      message: cleanMultiline(b.message, 2000),
      ip,
    };
    const errors = {};
    if (rec.name.length < 2) errors.name = 'Please tell us your name.';
    if (!isEmail(rec.email)) errors.email = 'Please enter a valid email.';
    if (!['private-dining', 'buyout', 'gift', 'press', 'general'].includes(rec.type)) rec.type = 'general';
    if (rec.message.length < 5) errors.message = 'Please add a short message.';
    if (Object.keys(errors).length) return send(res, 422, { ok: false, errors });
    await appendStore('inquiries', rec);
    console.log(`[inquiry] ${rec.type} from ${rec.name} <${rec.email}>`);
    return send(res, 201, { ok: true, id: rec.id });
  }

  if (req.method === 'POST' && url.pathname === '/api/newsletter') {
    if (rateLimited(ip, 'newsletter', 8)) return send(res, 429, { ok: false, error: 'Too many requests.' });
    const b = await readBody(req, 2_000);
    if (b.company_website) return send(res, 200, { ok: true });
    const email = clean(b.email, 200).toLowerCase();
    if (!isEmail(email)) return send(res, 422, { ok: false, errors: { email: 'Please enter a valid email.' } });
    const rows = await readStore('subscribers');
    if (!rows.some((r) => r.email === email)) {
      await appendStore('subscribers', { email, createdAt: new Date().toISOString() });
    }
    return send(res, 201, { ok: true });
  }

  if (req.method === 'GET' && url.pathname.startsWith('/api/admin/')) {
    if (!isAdmin(req)) return send(res, 401, { ok: false, error: 'Unauthorized' });
    if (url.pathname === '/api/admin/inquiries') return send(res, 200, await readStore('inquiries'));
    if (url.pathname === '/api/admin/subscribers') return send(res, 200, await readStore('subscribers'));
  }

  return send(res, 404, { ok: false, error: 'Not found' });
}

/* ---------- static ---------- */
async function serveStatic(req, res, url) {
  let pathname = decodeURIComponent(url.pathname);
  if (pathname.endsWith('/')) pathname += 'index.html';
  const file = path.normalize(path.join(PUBLIC_DIR, pathname));
  if (!file.startsWith(PUBLIC_DIR + path.sep)) return send(res, 403, 'Forbidden');

  let stat;
  try {
    stat = await fsp.stat(file);
    if (stat.isDirectory()) return serveStatic(req, res, new URL(url.pathname.replace(/\/?$/, '/'), url));
  } catch {
    // clean URLs: /privacy → privacy.html; unknown → 404 page
    if (!path.extname(file)) {
      try { await fsp.access(file + '.html'); return streamFile(req, res, file + '.html'); } catch {}
    }
    const notFound = path.join(PUBLIC_DIR, '404.html');
    res.writeHead(404, { ...SECURITY_HEADERS, 'Content-Type': MIME['.html'] });
    return fs.createReadStream(notFound).on('error', () => res.end('Not found')).pipe(res);
  }
  return streamFile(req, res, file, stat);
}

async function streamFile(req, res, file, stat) {
  stat = stat || (await fsp.stat(file));
  const ext = path.extname(file).toLowerCase();
  const etag = `W/"${stat.size.toString(16)}-${stat.mtimeMs.toString(16)}"`;
  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304, SECURITY_HEADERS);
    return res.end();
  }
  const longCache = /\.(jpg|jpeg|png|webp|avif|svg|woff2|mp4|webm)$/.test(ext);
  res.writeHead(200, {
    ...SECURITY_HEADERS,
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Content-Length': stat.size,
    'Cache-Control': longCache ? 'public, max-age=604800' : 'no-cache',
    ETag: etag,
  });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(file).pipe(res);
}

/* ---------- server ---------- */
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (url.pathname === '/reserve' || url.pathname === '/resy') {
      const site = JSON.parse(await fsp.readFile(SITE_FILE, 'utf8'));
      res.writeHead(302, { Location: site.resy });
      return res.end();
    }
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');
    return await serveStatic(req, res, url);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) send(res, err.status || 500, { ok: false, error: err.status ? err.message : 'Server error' });
  }
});

if (require.main === module) {
  server.listen(PORT, () => console.log(`Sushi Koya running → http://localhost:${PORT}`));
}
module.exports = { server, nyStatus };
