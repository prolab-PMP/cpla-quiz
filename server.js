/**
 * 산업안전지도사 1차 기출문제 사이트 서버 (v2: 회원/관리자/접근제어)
 *
 * 환경변수:
 *   PORT                 (기본 3000)
 *   DATABASE_URL         Postgres (Railway 자동 주입). 없으면 로컬 SQLite 사용
 *   SESSION_SECRET       express-session 비밀 (없으면 기본값 경고)
 *   ADMIN_EMAIL          관리자로 지정할 이메일 (회원가입 시 자동 관리자)
 *   SITE_NAME            이메일 본문에 쓰는 사이트 이름 (기본: 공인노무사 문제풀이)
 *   SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS  메일 발송용 (없으면 로그만)
 *   NOTIFY_EMAIL         신규가입 알림 수신 이메일 (기본 songdoinfo@naver.com)
 */
const express = require('express');
const session = require('express-session');
const path = require('path');
const bcrypt = require('bcryptjs');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const SITE_NAME = process.env.SITE_NAME || '공인노무사 문제풀이';
const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL || 'songdoinfo@naver.com';
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'songdoinfo@naver.com').toLowerCase();

// ─── DB 어댑터 (SQLite 로컬 / Postgres Railway) ────────────────
const usePg = !!process.env.DATABASE_URL;
let db;
if (usePg) {
  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  db = {
    async init() {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          is_admin BOOLEAN DEFAULT FALSE,
          is_premium BOOLEAN DEFAULT FALSE,
          premium_until TIMESTAMP NULL,
          created_at TIMESTAMP DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS sessions (
          sid TEXT PRIMARY KEY,
          sess JSONB NOT NULL,
          expire TIMESTAMP NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_sessions_expire ON sessions (expire);
        CREATE TABLE IF NOT EXISTS attempts (
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          problem_key TEXT NOT NULL,
          answer SMALLINT,
          correct BOOLEAN,
          ts BIGINT,
          PRIMARY KEY (user_id, problem_key)
        );
        CREATE INDEX IF NOT EXISTS idx_attempts_user ON attempts (user_id);
        CREATE TABLE IF NOT EXISTS bookmarks (
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          problem_key TEXT NOT NULL,
          ts BIGINT,
          PRIMARY KEY (user_id, problem_key)
        );
        CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON bookmarks (user_id);
        CREATE TABLE IF NOT EXISTS resumes (
          user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          snapshot JSONB,
          saved_at BIGINT
        );
      `);
    },
    async getUserByEmail(email) {
      const r = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
      return r.rows[0] || null;
    },
    async getUserById(id) {
      const r = await pool.query('SELECT * FROM users WHERE id=$1', [id]);
      return r.rows[0] || null;
    },
    async createUser({ email, password_hash, is_admin }) {
      const r = await pool.query(
        'INSERT INTO users (email, password_hash, is_admin) VALUES ($1,$2,$3) RETURNING *',
        [email, password_hash, !!is_admin]
      );
      return r.rows[0];
    },
    async listUsers() {
      const r = await pool.query('SELECT id, email, is_admin, is_premium, premium_until, created_at FROM users ORDER BY created_at DESC');
      return r.rows;
    },
    async updateUserAccess(id, { is_premium, premium_until }) {
      await pool.query(
        'UPDATE users SET is_premium=$1, premium_until=$2 WHERE id=$3',
        [!!is_premium, premium_until, id]
      );
    },
    async updateUserAdmin(id, is_admin) {
      await pool.query('UPDATE users SET is_admin=$1 WHERE id=$2', [!!is_admin, id]);
    },
    async deleteUser(id) {
      await pool.query('DELETE FROM users WHERE id=$1', [id]);
    },
    // ---- 학습 기록 (attempts/bookmarks/resume) ----
    async getUserState(userId) {
      const [att, bks, res] = await Promise.all([
        pool.query('SELECT problem_key, answer, correct, ts FROM attempts WHERE user_id=$1', [userId]),
        pool.query('SELECT problem_key, ts FROM bookmarks WHERE user_id=$1', [userId]),
        pool.query('SELECT snapshot FROM resumes WHERE user_id=$1', [userId]),
      ]);
      const attempts = {};
      att.rows.forEach(r => attempts[r.problem_key] = { answer: r.answer, correct: r.correct, ts: Number(r.ts) });
      const bookmarks = {};
      bks.rows.forEach(r => bookmarks[r.problem_key] = Number(r.ts));
      return { attempts, bookmarks, resume: res.rows[0]?.snapshot || null };
    },
    async saveAttempt(userId, { key, answer, correct, ts }) {
      await pool.query(
        `INSERT INTO attempts (user_id, problem_key, answer, correct, ts)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (user_id, problem_key) DO UPDATE SET
           answer=EXCLUDED.answer, correct=EXCLUDED.correct, ts=EXCLUDED.ts`,
        [userId, key, answer, correct, ts]
      );
    },
    async deleteAttempt(userId, key) {
      await pool.query('DELETE FROM attempts WHERE user_id=$1 AND problem_key=$2', [userId, key]);
    },
    async setBookmark(userId, key, on) {
      if (on) {
        await pool.query(
          `INSERT INTO bookmarks (user_id, problem_key, ts) VALUES ($1,$2,$3)
           ON CONFLICT (user_id, problem_key) DO UPDATE SET ts=EXCLUDED.ts`,
          [userId, key, Date.now()]
        );
      } else {
        await pool.query('DELETE FROM bookmarks WHERE user_id=$1 AND problem_key=$2', [userId, key]);
      }
    },
    async saveResume(userId, snapshot) {
      await pool.query(
        `INSERT INTO resumes (user_id, snapshot, saved_at) VALUES ($1,$2,$3)
         ON CONFLICT (user_id) DO UPDATE SET snapshot=EXCLUDED.snapshot, saved_at=EXCLUDED.saved_at`,
        [userId, snapshot, Date.now()]
      );
    },
    async clearResume(userId) {
      await pool.query('DELETE FROM resumes WHERE user_id=$1', [userId]);
    },
    async resetUserState(userId) {
      await pool.query('DELETE FROM attempts WHERE user_id=$1', [userId]);
      await pool.query('DELETE FROM bookmarks WHERE user_id=$1', [userId]);
      await pool.query('DELETE FROM resumes WHERE user_id=$1', [userId]);
    },
  };
} else {
  // 로컬 개발용 JSON 파일 스토어 (데이터 영속성 낮음 — Railway 배포 시 DATABASE_URL 필수)
  const jsonPath = path.join(__dirname, 'data', 'users.json');
  let store = { users: [], nextId: 1 };
  try {
    if (fs.existsSync(jsonPath)) store = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  } catch (e) { console.warn('[DB] users.json 읽기 실패', e.message); }
  const save = () => {
    try { fs.mkdirSync(path.dirname(jsonPath), { recursive: true }); fs.writeFileSync(jsonPath, JSON.stringify(store, null, 2)); }
    catch (e) { console.warn('[DB] users.json 저장 실패', e.message); }
  };
  store.state = store.state || {}; // { userId: { attempts, bookmarks, resume } }
  const getState = (userId) => {
    if (!store.state[userId]) store.state[userId] = { attempts:{}, bookmarks:{}, resume:null };
    return store.state[userId];
  };
  db = {
    async init() { /* JSON: 이미 로드됨 */ },
    async getUserByEmail(email) { return store.users.find(u => u.email === email) || null; },
    async getUserById(id) { return store.users.find(u => u.id === id) || null; },
    async createUser({ email, password_hash, is_admin }) {
      const u = {
        id: store.nextId++, email, password_hash,
        is_admin: !!is_admin, is_premium: false, premium_until: null,
        created_at: new Date().toISOString(),
      };
      store.users.push(u); save();
      return u;
    },
    async listUsers() { return store.users.slice().sort((a,b) => b.created_at.localeCompare(a.created_at)); },
    async updateUserAccess(id, { is_premium, premium_until }) {
      const u = store.users.find(u => u.id === id);
      if (u) { u.is_premium = !!is_premium; u.premium_until = premium_until; save(); }
    },
    async deleteUser(id) {
      store.users = store.users.filter(u => u.id !== id);
      delete store.state[id];
      save();
    },
    async getUserState(userId) {
      const s = getState(userId);
      return { attempts: { ...s.attempts }, bookmarks: { ...s.bookmarks }, resume: s.resume };
    },
    async saveAttempt(userId, { key, answer, correct, ts }) {
      const s = getState(userId);
      s.attempts[key] = { answer, correct, ts };
      save();
    },
    async deleteAttempt(userId, key) {
      const s = getState(userId);
      delete s.attempts[key];
      save();
    },
    async setBookmark(userId, key, on) {
      const s = getState(userId);
      if (on) s.bookmarks[key] = Date.now();
      else delete s.bookmarks[key];
      save();
    },
    async saveResume(userId, snapshot) {
      const s = getState(userId);
      s.resume = snapshot;
      save();
    },
    async clearResume(userId) {
      const s = getState(userId);
      s.resume = null;
      save();
    },
    async resetUserState(userId) {
      store.state[userId] = { attempts:{}, bookmarks:{}, resume:null };
      save();
    },
  };
}

// ─── 세션 ─────────────────────────────────────────────────────
const sessionOpts = {
  secret: process.env.SESSION_SECRET || 'change-this-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 30 * 24 * 60 * 60 * 1000, httpOnly: true, sameSite: 'lax' },
};
if (usePg) {
  try {
    const pgSession = require('connect-pg-simple')(session);
    const { Pool } = require('pg');
    sessionOpts.store = new pgSession({
      pool: new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
      }),
      tableName: 'sessions',
      createTableIfMissing: true,
    });
  } catch (e) { console.warn('[SESSION] pg store init failed, falling back to memory', e.message); }
}
app.use(session(sessionOpts));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── 이메일 (nodemailer) ───────────────────────────────────────
let mailer = null;
if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
  const nodemailer = require('nodemailer');
  mailer = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}
async function sendSignupNotification(email) {
  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  const body = `${SITE_NAME} 사이트 아이디 ${email} ${now.getMonth()+1}월${now.getDate()}일 가입`;
  if (!mailer) { console.log('[MAIL][stub]', NOTIFY_EMAIL, body); return; }
  try {
    await mailer.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: NOTIFY_EMAIL,
      subject: `[${SITE_NAME}] 신규 가입: ${email}`,
      text: body,
    });
  } catch (e) { console.warn('[MAIL] send failed:', e.message); }
}

// ─── 미들웨어: 인증 정보 ────────────────────────────────────────
app.use(async (req, res, next) => {
  req.user = null;
  if (req.session?.userId) {
    try {
      const u = await db.getUserById(req.session.userId);
      if (u) {
        // ADMIN_EMAIL 이면 자동 승격 (가입 시 누락된 경우 보완 — idempotent)
        if ((u.email||'').toLowerCase() === ADMIN_EMAIL && !u.is_admin) {
          try { await db.updateUserAdmin(u.id, true); u.is_admin = true; console.log('[AUTH] admin auto-promoted:', u.email); }
          catch (e) { console.warn('[AUTH] admin promote failed:', e.message); }
        }
        const now = new Date();
        const isPremiumActive = u.is_premium && (!u.premium_until || new Date(u.premium_until) > now);
        req.user = { ...u, isPremiumActive };
      }
    } catch (e) { console.warn('[AUTH]', e.message); }
  }
  next();
});

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: '로그인이 필요합니다.' });
  next();
}
function requireAdmin(req, res, next) {
  if (!req.user?.is_admin) return res.status(403).json({ error: '관리자만 접근할 수 있습니다.' });
  next();
}

// ─── 인증 API ──────────────────────────────────────────────────
app.post('/api/signup', async (req, res) => {
  try {
    const { email, password } = req.body;
    const em = String(email || '').trim().toLowerCase();
    if (!em.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) return res.status(400).json({ error: '이메일 형식이 올바르지 않습니다.' });
    if (String(password || '').length < 4) return res.status(400).json({ error: '비밀번호는 최소 4자 이상이어야 합니다.' });
    const exists = await db.getUserByEmail(em);
    if (exists) return res.status(400).json({ error: '이미 가입된 이메일입니다.' });
    const hash = bcrypt.hashSync(String(password), 10);
    const isAdmin = em === ADMIN_EMAIL;
    const u = await db.createUser({ email: em, password_hash: hash, is_admin: isAdmin });
    req.session.userId = u.id;
    sendSignupNotification(em).catch(()=>{});
    res.json({ ok: true, user: { email: u.email, is_admin: !!u.is_admin, isPremiumActive: false } });
  } catch (e) { console.error(e); res.status(500).json({ error: '가입 중 오류가 발생했습니다.' }); }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const em = String(email || '').trim().toLowerCase();
    const u = await db.getUserByEmail(em);
    if (!u || !bcrypt.compareSync(String(password || ''), u.password_hash)) {
      return res.status(401).json({ error: '이메일 또는 비밀번호가 일치하지 않습니다.' });
    }
    req.session.userId = u.id;
    const now = new Date();
    const isPremiumActive = u.is_premium && (!u.premium_until || new Date(u.premium_until) > now);
    res.json({ ok: true, user: { email: u.email, is_admin: !!u.is_admin, isPremiumActive } });
  } catch (e) { console.error(e); res.status(500).json({ error: '로그인 중 오류가 발생했습니다.' }); }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/me', (req, res) => {
  if (!req.user) return res.json({ user: null });
  res.json({ user: { email: req.user.email, is_admin: !!req.user.is_admin, isPremiumActive: req.user.isPremiumActive, premium_until: req.user.premium_until } });
});

// 진단 엔드포인트: DB 연결 상태 확인 (계정 영속성 진단용)
app.get('/api/health', async (req, res) => {
  try {
    const userCount = usePg
      ? parseInt((await require('pg').Pool ? null : null) || '0', 10) // placeholder
      : null;
    // 단순 유저 수 조회로 DB 접근 테스트
    const users = await db.listUsers();
    res.json({
      status: 'ok',
      db: usePg ? 'postgres' : 'json-file (data/users.json — 배포 시 초기화됨!)',
      userCount: users.length,
      deployedAt: process.env.RAILWAY_DEPLOYMENT_ID || 'local',
      sessionStore: usePg ? 'postgres (persistent)' : 'memory (재시작시 초기화)',
      warning: usePg ? null : '⚠ Postgres 미사용 — DATABASE_URL 환경변수 확인 필요',
    });
  } catch (e) { res.status(500).json({ status: 'error', error: e.message, db: usePg ? 'postgres' : 'json' }); }
});

// ─── 학습 기록 동기화 API (로그인 사용자) ─────────────────────
app.get('/api/state', requireAuth, async (req, res) => {
  try {
    const state = await db.getUserState(req.user.id);
    res.json(state);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/state/attempt', requireAuth, async (req, res) => {
  try {
    const { key, answer, correct, ts } = req.body;
    if (!key) return res.status(400).json({ error: 'key required' });
    await db.saveAttempt(req.user.id, { key, answer: answer || 0, correct: !!correct, ts: ts || Date.now() });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/state/attempt/:key', requireAuth, async (req, res) => {
  try {
    await db.deleteAttempt(req.user.id, req.params.key);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/state/bookmark', requireAuth, async (req, res) => {
  try {
    const { key, on } = req.body;
    if (!key) return res.status(400).json({ error: 'key required' });
    await db.setBookmark(req.user.id, key, !!on);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/state/resume', requireAuth, async (req, res) => {
  try {
    await db.saveResume(req.user.id, req.body.snapshot);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/state/resume', requireAuth, async (req, res) => {
  try {
    await db.clearResume(req.user.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/state/reset', requireAuth, async (req, res) => {
  try {
    await db.resetUserState(req.user.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── 관리자 API ────────────────────────────────────────────────
app.get('/api/admin/users', requireAuth, requireAdmin, async (req, res) => {
  const users = await db.listUsers();
  res.json({ users });
});
app.post('/api/admin/users/:id/access', requireAuth, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { is_premium, premium_until } = req.body;
  await db.updateUserAccess(id, { is_premium: !!is_premium, premium_until: premium_until || null });
  res.json({ ok: true });
});
app.delete('/api/admin/users/:id', requireAuth, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (id === req.user.id) return res.status(400).json({ error: '자기 계정은 삭제할 수 없습니다.' });
  await db.deleteUser(id);
  res.json({ ok: true });
});

// ─── 문제 접근 제어 API (무료: 최근 50문항 per subject + 키워드 3-5위) ────
// 프론트엔드는 /api/problems 를 fetch 하여 권한에 따른 필터된 리스트를 받는다.
function loadAllProblems() {
  const filePath = path.join(__dirname, 'data', 'problems.js');
  const src = fs.readFileSync(filePath, 'utf8');
  const m = src.match(/window\.PROBLEMS\s*=\s*(\[[\s\S]*?\]);?\s*$/m);
  if (!m) return [];
  try { return JSON.parse(m[1]); } catch (e) { return []; }
}
const ALL_PROBLEMS = loadAllProblems();

function computeFullSubjectKeywords(problems) {
  // 전체 데이터 기반 과목별 키워드 빈도. 무료/유료 동일하게 보임.
  const bySubKw = {};
  for (const p of problems) {
    const s = p.subject;
    if (!bySubKw[s]) bySubKw[s] = {};
    for (const k of (p.keywords || [])) {
      bySubKw[s][k] = (bySubKw[s][k] || 0) + 1;
    }
  }
  const result = {};
  for (const s of Object.keys(bySubKw)) {
    result[s] = Object.entries(bySubKw[s]).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }
  return result;
}

function filterForFree(problems) {
  // 무료: 과목별 최근 50문제 (연도 내림차순 → 번호 내림차순)
  const bySubject = {};
  for (const p of problems) {
    (bySubject[p.subject] = bySubject[p.subject] || []).push(p);
  }
  const filtered = [];
  for (const s of Object.keys(bySubject)) {
    const sorted = bySubject[s].slice().sort((a,b) => {
      if (a.year !== b.year) return b.year.localeCompare(a.year);
      return b.num - a.num;
    });
    filtered.push(...sorted.slice(0, 50));
  }
  return filtered;
}

function getAllowedKeywordsForFree(problems) {
  // 키워드 빈도를 계산하고 정렬(과목별 3~5위)
  const bySubjectKw = {};
  for (const p of problems) {
    const s = p.subject;
    if (!bySubjectKw[s]) bySubjectKw[s] = {};
    for (const k of (p.keywords || [])) bySubjectKw[s][k] = (bySubjectKw[s][k]||0) + 1;
  }
  const allowed = new Set();
  for (const s of Object.keys(bySubjectKw)) {
    const sorted = Object.entries(bySubjectKw[s]).sort((a,b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    // rank 3~5 (0-indexed: 2,3,4)
    const mid = sorted.slice(2, 5).map(x => x[0]);
    mid.forEach(k => allowed.add(k));
  }
  return allowed;
}

app.get('/api/problems', (req, res) => {
  const totalCount = ALL_PROBLEMS.length;
  const fullSubjectKeywords = computeFullSubjectKeywords(ALL_PROBLEMS);
  if (!req.user) return res.json({ problems: [], allowedKeywords: null, user: null, locked: 'login', totalCount, fullSubjectKeywords });
  if (req.user.isPremiumActive || req.user.is_admin) {
    return res.json({ problems: ALL_PROBLEMS, allowedKeywords: null, user: { email: req.user.email, is_admin: !!req.user.is_admin, isPremiumActive: true }, totalCount , fullSubjectKeywords });
  }
  // 무료 사용자
  const filtered = filterForFree(ALL_PROBLEMS);
  const allowedKeywords = Array.from(getAllowedKeywordsForFree(ALL_PROBLEMS));
  res.json({ problems: filtered, allowedKeywords, user: { email: req.user.email, is_admin: false, isPremiumActive: false }, totalCount , fullSubjectKeywords });
});

// ─── /data/problems.js 동적 라우트 (정적 미들웨어보다 위에 위치) ───
// 무료/비로그인이 정적 파일로 전체 ALL_PROBLEMS을 받는 우회 차단
app.get('/data/problems.js', (req, res) => {
  let problems = [];
  if (req.user) {
    if (req.user.isPremiumActive || req.user.is_admin) {
      problems = ALL_PROBLEMS;
    } else {
      problems = filterForFree(ALL_PROBLEMS);
    }
  }
  res.set('Content-Type', 'application/javascript; charset=utf-8');
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.send('window.PROBLEMS = ' + JSON.stringify(problems) + ';');
});

// ─── Static (기존) ───────────────────────────────────────────
app.use(express.static(__dirname, {
  extensions: ['html'],
  index: 'index.html'
}));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ─── Start ──────────────────────────────────────────────────
(async () => {
  try { await db.init(); } catch (e) { console.error('[DB INIT]', e.message); }
  // ADMIN_EMAIL 사용자 자동 admin 보장 (재배포 시마다 멱등 실행)
  try {
    const adminUser = await db.getUserByEmail(ADMIN_EMAIL);
    if (adminUser && !adminUser.is_admin) {
      await db.updateUserAdmin(adminUser.id, true);
      console.log('[INIT] ADMIN_EMAIL 자동 승격 완료:', adminUser.email);
    } else if (adminUser) {
      console.log('[INIT] ADMIN_EMAIL 이미 admin:', adminUser.email);
    } else {
      console.log('[INIT] ADMIN_EMAIL 미가입 (가입 시 자동 admin 됨):', ADMIN_EMAIL);
    }
  } catch (e) { console.warn('[INIT] admin 보장 실패:', e.message); }
  app.listen(PORT, () => {
    console.log(`[${SITE_NAME}] 서버 실행 중: http://localhost:${PORT}`);
    if (usePg) console.log('[DB] Postgres (DATABASE_URL)'); else console.log('[DB] JSON file (data/users.json) — 로컬 전용');
    if (!mailer) console.log('[MAIL] SMTP 미설정 — 신규가입 알림은 콘솔 로그로만 출력됩니다.');
  });
})();
