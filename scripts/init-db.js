const path = require('path');
const fs = require('fs');
const zlib = require('zlib');
const bcrypt = require('bcryptjs');

async function initDatabase(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT 'user',
      is_active INTEGER NOT NULL DEFAULT 1,
      expiry_date TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      year TEXT NOT NULL,
      subject TEXT NOT NULL,
      question_number INTEGER NOT NULL,
      question_text TEXT NOT NULL,
      option_1 TEXT, option_2 TEXT, option_3 TEXT, option_4 TEXT, option_5 TEXT,
      correct_answer INTEGER NOT NULL,
      keyword TEXT DEFAULT '',
      explanation TEXT DEFAULT '',
      statements TEXT DEFAULT '',
      image_path TEXT DEFAULT '',
      seq_id INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Add image_path column to existing DBs that don't have it
  try {
    db.exec("ALTER TABLE questions ADD COLUMN image_path TEXT DEFAULT ''");
  } catch (e) { /* column already exists */ }

  // Add ai_explanation column (v2) - structured detailed explanation
  try {
    db.exec("ALTER TABLE questions ADD COLUMN ai_explanation TEXT DEFAULT ''");
  } catch (e) { /* column already exists */ }

  // Bookmarks table
  db.exec(`
    CREATE TABLE IF NOT EXISTS bookmarks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      question_id INTEGER NOT NULL,
      note TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, question_id)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS keywords (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject TEXT NOT NULL,
      keyword TEXT NOT NULL,
      frequency INTEGER DEFAULT 0,
      UNIQUE(subject, keyword)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS user_answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER, session_id TEXT, question_id INTEGER NOT NULL,
      selected_answer INTEGER NOT NULL, is_correct INTEGER NOT NULL,
      time_spent INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS quiz_sessions (
      id TEXT PRIMARY KEY, user_id INTEGER,
      session_type TEXT NOT NULL DEFAULT 'practice',
      subject TEXT DEFAULT '',
      total_questions INTEGER DEFAULT 0, correct_count INTEGER DEFAULT 0,
      wrong_count INTEGER DEFAULT 0, score REAL DEFAULT 0,
      time_limit INTEGER DEFAULT 0, time_spent INTEGER DEFAULT 0,
      filters TEXT DEFAULT '{}', status TEXT DEFAULT 'in_progress',
      created_at TEXT DEFAULT (datetime('now')), completed_at TEXT
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS wrong_answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER, session_id TEXT, question_id INTEGER NOT NULL,
      wrong_count INTEGER DEFAULT 1, last_wrong_date TEXT DEFAULT (datetime('now')),
      is_resolved INTEGER DEFAULT 0,
      UNIQUE(user_id, question_id)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS question_stats (
      question_id INTEGER PRIMARY KEY,
      total_attempts INTEGER DEFAULT 0, correct_count INTEGER DEFAULT 0,
      wrong_count INTEGER DEFAULT 0, accuracy_rate REAL DEFAULT 0
    )
  `);

  // Indexes
  try {
    db.exec('CREATE INDEX IF NOT EXISTS idx_ua_user ON user_answers(user_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_ua_q ON user_answers(question_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_ua_s ON user_answers(session_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_wa_user ON wrong_answers(user_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_qs_user ON quiz_sessions(user_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_q_subject ON questions(subject)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_q_year ON questions(year)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_q_keyword ON questions(keyword)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_kw_subject ON keywords(subject)');
  } catch {}

  // Master admin
  const masterEmail = process.env.MASTER_EMAIL || 'rladhkdtlr@daum.net';
  const masterPass = process.env.MASTER_PASSWORD || 'admin1234';
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(masterEmail);
  if (!existing) {
    const hash = bcrypt.hashSync(masterPass, 10);
    db.prepare('INSERT INTO users (email, password, name, role, expiry_date) VALUES (?, ?, ?, ?, ?)').run(
      masterEmail, hash, 'Master', 'master', '2099-12-31'
    );
    console.log('Master admin created');
  }

  // Load questions
  const qCount = db.prepare('SELECT COUNT(*) as cnt FROM questions').get().cnt;
  if (qCount === 0) {
    let questions = [];

    // Try loading from single file first
    const questionsPath = path.join(__dirname, '..', 'data', 'questions_data.json');
    if (fs.existsSync(questionsPath)) {
      questions = JSON.parse(fs.readFileSync(questionsPath, 'utf-8'));
      console.log(`Loaded ${questions.length} questions from questions_data.json`);
    } else {
      // Load from gzipped subject files
      const subjectsDir = path.join(__dirname, '..', 'data', 'subjects');
      if (fs.existsSync(subjectsDir)) {
        const files = fs.readdirSync(subjectsDir).filter(f => f.endsWith('.json.gz')).sort();
        for (const file of files) {
          try {
            const gz = fs.readFileSync(path.join(subjectsDir, file));
            const json = zlib.gunzipSync(gz).toString('utf-8');
            const subjectQuestions = JSON.parse(json);
            questions = questions.concat(subjectQuestions);
            console.log(`Loaded ${subjectQuestions.length} questions from ${file}`);
          } catch (e) {
            console.error(`Error loading ${file}:`, e.message);
          }
        }
      }
    }

    if (questions.length > 0) {
      const insertQ = db.prepare(`INSERT OR REPLACE INTO questions (
        year, subject, question_number, question_text,
        option_1, option_2, option_3, option_4, option_5,
        correct_answer, keyword, explanation, statements, image_path, seq_id
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);

      const insertStat = db.prepare('INSERT OR IGNORE INTO question_stats (question_id) VALUES (?)');

      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const opts = q.options || [];
        insertQ.run(
          q.year, q.subject, q.question_number, q.question_text,
          opts[0]?.text || '', opts[1]?.text || '', opts[2]?.text || '',
          opts[3]?.text || '', opts[4]?.text || '',
          q.correct_answer, q.keyword || '', q.explanation || '',
          JSON.stringify(q.statements || []), q.image_path || '', q.seq_id || 0
        );
        insertStat.run(i + 1);
      }
      console.log(`Total questions loaded: ${questions.length}`);
    } else {
      console.log('No question data files found');
    }
  } else {
    console.log(`Questions already loaded: ${qCount}`);
  }

  // Idempotent keyword sync — 모든 JSON 갱신을 DB에 반영 (기존 2025-only 게이트 완화)
  const blank25 = db.prepare("SELECT COUNT(*) as cnt FROM questions WHERE year = '2025년' AND (keyword IS NULL OR keyword = '')").get().cnt;
  const questionsPathSync = path.join(__dirname, '..', 'data', 'questions_data.json');
  if (fs.existsSync(questionsPathSync)) {
    console.log(`Syncing keywords from questions_data.json (blank25=${blank25})`);
    const qData = JSON.parse(fs.readFileSync(questionsPathSync, 'utf-8'));
    const updateKw = db.prepare(
      'UPDATE questions SET keyword = ? WHERE year = ? AND subject = ? AND question_number = ?'
    );
    let synced = 0;
    for (const q of qData) {
      if (q.keyword && q.keyword.trim()) {
        const r = updateKw.run(q.keyword, q.year, q.subject, q.question_number);
        if (r.changes) synced++;
      }
    }
    console.log(`Keyword sync: updated ${synced} questions`);
  }

  // Load / rebuild keywords table
  const keywordsPath = path.join(__dirname, '..', 'data', 'keywords_data.json');
  if (fs.existsSync(keywordsPath)) {
    const kwCount = db.prepare('SELECT COUNT(*) as cnt FROM keywords').get().cnt;
    const keywordsData = JSON.parse(fs.readFileSync(keywordsPath, 'utf-8'));
    let expected = 0;
    for (const kws of Object.values(keywordsData)) expected += Object.keys(kws).length;
    // Rebuild if count differs — any change triggers full rebuild (idempotent, cheap)
    if (kwCount !== expected) {
      if (kwCount > 0) {
        db.prepare('DELETE FROM keywords').run();
        console.log(`Rebuilding keywords table (had ${kwCount}, expected ${expected})`);
      }
      const insertKw = db.prepare('INSERT OR IGNORE INTO keywords (subject, keyword, frequency) VALUES (?,?,?)');
      let total = 0;
      for (const [subject, keywords] of Object.entries(keywordsData)) {
        for (const [keyword, frequency] of Object.entries(keywords)) {
          insertKw.run(subject, keyword, frequency);
          total++;
        }
      }
      console.log(`Loaded ${total} keywords`);
    } else {
      console.log(`Keywords already loaded: ${kwCount}`);
    }
  }

  const { save } = require('../database');
  save();
}

module.exports = { initDatabase }