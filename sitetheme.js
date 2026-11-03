// ─── 홈 테마 (관리자가 선택) ───
// 배경: navy / gold / white,  표지: a(기본) / b(수험서형)
// GET  /api/site-theme            → { theme, cover }
// POST /api/admin/site-theme      { theme?, cover? }  (관리자 전용)
// 홈(index.html) 응답 시 <body>에 클래스를 넣어 깜빡임 없이 적용
const fs = require('fs');
const path = require('path');

const OPTS = { theme: ['navy', 'gold', 'white'], cover: ['a', 'b'] };
const KEYS = { theme: 'home_theme', cover: 'home_cover' };

module.exports = function setupSiteTheme(app, { requireAuth, requireAdmin, rootDir }) {
  const root = rootDir || __dirname;
  const usePg = !!process.env.DATABASE_URL;
  let pool = null;
  if (usePg) {
    const { Pool } = require('pg');
    pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 2 });
  }
  const file = path.join(root, 'data', 'site-theme.json');
  const cur = { theme: 'navy', cover: 'a' };
  const ready = (async () => {
    try {
      if (pool) {
        await pool.query('CREATE TABLE IF NOT EXISTS site_settings (key TEXT PRIMARY KEY, value TEXT, updated_at TIMESTAMPTZ DEFAULT NOW())');
        const r = await pool.query('SELECT key, value FROM site_settings WHERE key = ANY($1)', [Object.values(KEYS)]);
        for (const row of r.rows) for (const k in KEYS) if (KEYS[k] === row.key && OPTS[k].includes(row.value)) cur[k] = row.value;
      } else if (fs.existsSync(file)) {
        const j = JSON.parse(fs.readFileSync(file, 'utf8'));
        for (const k in OPTS) if (OPTS[k].includes(j[k])) cur[k] = j[k];
      }
    } catch (e) { console.warn('[THEME] load', e.message); }
  })();

  let cache = null, cacheKey = '';
  function homeHtml() {
    const p = path.join(root, 'index.html');
    const key = cur.theme + cur.cover + ':' + fs.statSync(p).mtimeMs;
    if (cache && cacheKey === key) return cache;
    cache = fs.readFileSync(p, 'utf8').replace(/<body(\s[^>]*)?>/, `<body class="th-${cur.theme} cv-${cur.cover}">`);
    cacheKey = key;
    return cache;
  }
  app.get(['/', '/index.html'], async (req, res, next) => {
    try { await ready; res.set('Cache-Control', 'no-cache'); res.type('html').send(homeHtml()); }
    catch (e) { next(); }
  });
  app.get('/api/site-theme', async (req, res) => { await ready; res.json({ ...cur, options: OPTS }); });
  app.post('/api/admin/site-theme', requireAuth, requireAdmin, async (req, res) => {
    await ready;
    const b = req.body || {};
    const upd = {};
    for (const k in OPTS) if (b[k] != null) {
      if (!OPTS[k].includes(String(b[k]))) return res.status(400).json({ error: `unknown ${k}` });
      upd[k] = String(b[k]);
    }
    if (!Object.keys(upd).length) return res.status(400).json({ error: 'nothing to update' });
    try {
      if (pool) {
        for (const k in upd) await pool.query('INSERT INTO site_settings(key,value,updated_at) VALUES($1,$2,NOW()) ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=NOW()', [KEYS[k], upd[k]]);
      } else {
        try { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify({ ...cur, ...upd })); } catch (e) {}
      }
      Object.assign(cur, upd); cache = null;
      res.json({ ok: true, ...cur });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
};
