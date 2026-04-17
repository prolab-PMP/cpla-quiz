const express = require('express');
const crypto = require('crypto');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

router.use(authenticateToken);

router.get('/filters', (req, res) => {
  const db = req.app.locals.db;
  const subjects = db.prepare("SELECT DISTINCT subject FROM questions ORDER BY subject").all().map(r => r.subject);
  const years = db.prepare("SELECT DISTINCT year FROM questions ORDER BY year").all().map(r => r.year);
  const keywords = db.prepare("SELECT DISTINCT keyword FROM questions WHERE keyword != '' ORDER BY keyword").all().map(r => r.keyword);
  const totalQuestions = db.prepare('SELECT COUNT(*) as cnt FROM questions').get().cnt;

  // Top keywords per subject
  const topKeywords = {};
  for (const subj of subjects) {
    const kws = db.prepare("SELECT keyword, frequency FROM keywords WHERE subject = ? ORDER BY frequency DESC LIMIT 30").all(subj);
    topKeywords[subj] = kws;
  }

  res.json({ subjects, years, keywords, totalQuestions, topKeywords });
});

router.get('/keyword-stats', (req, res) => {
  const db = req.app.locals.db;
  const { subject } = req.query;
  let sql = "SELECT subject, keyword, frequency FROM keywords";
  let params = [];
  if (subject) { sql += " WHERE subject = ?"; params.push(subject); }
  sql += " ORDER BY frequency DESC";
  const data = db.prepare(sql).all(...params);
  res.json({ keywords: data });
});

router.post('/generate', (req, res) => {
  try {
    const db = req.app.locals.db;
    const { count, filters, quizType } = req.body;
    const isGuest = !req.user;
    let where = ['1=1'];
    let params = [];

    if (filters) {
      if (filters.subjects?.length) {
        where.push(`subject IN (${filters.subjects.map(() => '?').join(',')})`);
        params.push(...filters.subjects);
      }
      if (filters.years?.length) {
        where.push(`year IN (${filters.years.map(() => '?').join(',')})`);
        params.push(...filters.years);
      }
      if (filters.keywords?.length) {
        const kwConds = filters.keywords.map(() => "keyword LIKE ?");
        where.push(`(${kwConds.join(' OR ')})`);
        params.push(...filters.keywords.map(k => `%${k}%`));
      }
    }

    if (quizType === 'wrong_only' && req.user) {
      const wrongIds = db.prepare('SELECT question_id FROM wrong_answers WHERE user_id = ? AND is_resolved = 0').all(req.user.id).map(r => r.question_id);
      if (wrongIds.length === 0) return res.json({ questions: [], sessionId: null, message: '오답 문제가 없습니다.' });
      where.push(`id IN (${wrongIds.map(() => '?').join(',')})`);
      params.push(...wrongIds);
    }

    let limit = parseInt(count) || 20;
    if (quizType === 'exam') limit = 200;
    if (isGuest) { limit = Math.min(limit, 30); }

    const sql = `SELECT id, year, subject, question_number, question_text,
      option_1, option_2, option_3, option_4, option_5,
      keyword, statements, image_path
      FROM questions WHERE ${where.join(' AND ')} ORDER BY RANDOM() LIMIT ?`;
    params.push(limit);
    const questions = db.prepare(sql).all(...params);

    const sessionId = crypto.randomUUID();
    const subjectStr = filters?.subjects?.join(',') || 'all';
    db.prepare(`INSERT INTO quiz_sessions (id, user_id, session_type, subject, total_questions, filters, status, time_limit) VALUES (?,?,?,?,?,?,?,?)`)
      .run(sessionId, req.user?.id || null, quizType || 'practice', subjectStr, questions.length, JSON.stringify(filters || {}), 'in_progress', quizType === 'exam' ? 200 : 0);

    res.json({ questions, sessionId, total: questions.length });
  } catch (err) { res.status(500).json({ error: '문제 생성 실패: ' + err.message }); }
});

router.post('/answer', (req, res) => {
  try {
    const db = req.app.locals.db;
    const { sessionId, questionId, selectedAnswer, timeSpent } = req.body;
    const question = db.prepare('SELECT correct_answer, explanation, ai_explanation, keyword FROM questions WHERE id = ?').get(questionId);
    if (!question) return res.status(404).json({ error: '문제를 찾을 수 없습니다.' });

    const isCorrect = parseInt(selectedAnswer) === question.correct_answer;
    const userId = req.user?.id || null;

    db.prepare('INSERT INTO user_answers (user_id, session_id, question_id, selected_answer, is_correct, time_spent) VALUES (?,?,?,?,?,?)')
      .run(userId, sessionId, questionId, selectedAnswer, isCorrect ? 1 : 0, timeSpent || 0);

    if (isCorrect) db.prepare('UPDATE quiz_sessions SET correct_count = correct_count + 1 WHERE id = ?').run(sessionId);
    else db.prepare('UPDATE quiz_sessions SET wrong_count = wrong_count + 1 WHERE id = ?').run(sessionId);

    // Update global stats
    const stat = db.prepare('SELECT * FROM question_stats WHERE question_id = ?').get(questionId);
    if (stat) {
      const newTotal = stat.total_attempts + 1;
      const newCorrect = stat.correct_count + (isCorrect ? 1 : 0);
      db.prepare('UPDATE question_stats SET total_attempts = ?, correct_count = ?, wrong_count = ?, accuracy_rate = ? WHERE question_id = ?')
        .run(newTotal, newCorrect, stat.wrong_count + (isCorrect ? 0 : 1), newCorrect / newTotal, questionId);
    }

    // Wrong answer tracking
    if (userId) {
      if (!isCorrect) {
        const existing = db.prepare('SELECT id FROM wrong_answers WHERE user_id = ? AND question_id = ?').get(userId, questionId);
        if (existing) {
          db.prepare("UPDATE wrong_answers SET wrong_count = wrong_count + 1, last_wrong_date = datetime('now'), is_resolved = 0 WHERE user_id = ? AND question_id = ?").run(userId, questionId);
        } else {
          db.prepare("INSERT INTO wrong_answers (user_id, session_id, question_id, wrong_count, last_wrong_date) VALUES (?,?,?,1,datetime('now'))").run(userId, sessionId, questionId);
        }
      } else {
        db.prepare('UPDATE wrong_answers SET is_resolved = 1 WHERE user_id = ? AND question_id = ?').run(userId, questionId);
      }
    }

    res.json({
      correct: isCorrect,
      correctAnswer: question.correct_answer,
      explanation: question.explanation,
      aiExplanation: question.ai_explanation || '',
      keyword: question.keyword
    });
  } catch (err) { res.status(500).json({ error: '답안 제출 실패: ' + err.message }); }
});

router.post('/complete', (req, res) => {
  try {
    const db = req.app.locals.db;
    const { sessionId, timeSpent } = req.body;
    const session = db.prepare('SELECT * FROM quiz_sessions WHERE id = ?').get(sessionId);
    if (!session) return res.status(404).json({ error: '세션을 찾을 수 없습니다.' });
    const total = session.correct_count + session.wrong_count;
    const score = total > 0 ? (session.correct_count / total * 100) : 0;
    db.prepare("UPDATE quiz_sessions SET status = 'completed', score = ?, time_spent = ?, completed_at = datetime('now') WHERE id = ?").run(score, timeSpent || 0, sessionId);
    const { save } = require('../database');
    save();
    res.json({ total, correct: session.correct_count, wrong: session.wrong_count, score: Math.round(score * 10) / 10, passed: score >= 40 });
  } catch (err) { res.status(500).json({ error: '세션 완료 실패' }); }
});

router.get('/wrong-answers', (req, res) => {
  if (!req.user) return res.json({ wrongAnswers: [], isGuest: true });
  const db = req.app.locals.db;
  const wrongAnswers = db.prepare(`
    SELECT w.question_id, w.wrong_count, w.last_wrong_date,
      q.question_text, q.year, q.subject, q.keyword, q.correct_answer
    FROM wrong_answers w JOIN questions q ON w.question_id = q.id
    WHERE w.user_id = ? AND w.is_resolved = 0 ORDER BY w.last_wrong_date DESC
  `).all(req.user.id);
  res.json({ wrongAnswers, total: wrongAnswers.length });
});

// Bookmark routes
router.get('/bookmarks', (req, res) => {
  if (!req.user) return res.json({ bookmarks: [], isGuest: true });
  const db = req.app.locals.db;
  const bookmarks = db.prepare(`
    SELECT b.question_id, b.note, b.created_at,
      q.question_text, q.year, q.subject, q.keyword, q.correct_answer,
      q.option_1, q.option_2, q.option_3, q.option_4, q.option_5,
      q.explanation, q.ai_explanation, q.statements, q.image_path
    FROM bookmarks b JOIN questions q ON b.question_id = q.id
    WHERE b.user_id = ? ORDER BY b.created_at DESC
  `).all(req.user.id);
  res.json({ bookmarks, total: bookmarks.length });
});

router.post('/bookmark', (req, res) => {
  if (!req.user) return res.status(401).json({ error: '로그인이 필요합니다.' });
  try {
    const db = req.app.locals.db;
    const { questionId, note } = req.body;
    const existing = db.prepare('SELECT id FROM bookmarks WHERE user_id = ? AND question_id = ?').get(req.user.id, questionId);
    if (existing) {
      return res.json({ bookmarked: true, alreadyExists: true });
    }
    db.prepare('INSERT INTO bookmarks (user_id, question_id, note) VALUES (?,?,?)').run(req.user.id, questionId, note || '');
    const { save } = require('../database');
    save();
    res.json({ bookmarked: true });
  } catch (err) {
    res.status(500).json({ error: '북마크 저장 실패: ' + err.message });
  }
});

router.delete('/bookmark/:questionId', (req, res) => {
  if (!req.user) return res.status(401).json({ error: '로그인이 필요합니다.' });
  try {
    const db = req.app.locals.db;
    db.prepare('DELETE FROM bookmarks WHERE user_id = ? AND question_id = ?').run(req.user.id, parseInt(req.params.questionId));
    const { save } = require('../database');
    save();
    res.json({ bookmarked: false });
  } catch (err) {
    res.status(500).json({ error: '북마크 삭제 실패: ' + err.message });
  }
});

router.get('/bookmark-status/:questionId', (req, res) => {
  if (!req.user) return res.json({ bookmarked: false });
  const db = req.app.locals.db;
  const row = db.prepare('SELECT id FROM bookmarks WHERE user_id = ? AND question_id = ?').get(req.user.id, parseInt(req.params.questionId));
  res.json({ bookmarked: !!row });
});

module.exports = router;
