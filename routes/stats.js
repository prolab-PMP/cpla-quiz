const express = require('express');
const { authenticateToken, requireAuth } = require('../middleware/auth');
const router = express.Router();

router.use(authenticateToken);

router.get('/dashboard', requireAuth, (req, res) => {
  try {
    const db = req.app.locals.db;
    const userId = req.user.id;

    const totalQuestions = db.prepare('SELECT COUNT(*) as cnt FROM questions').get().cnt;
    const totalAnswered = db.prepare('SELECT COUNT(DISTINCT question_id) as cnt FROM user_answers WHERE user_id = ?').get(userId).cnt;
    const correctTotal = db.prepare('SELECT COUNT(*) as cnt FROM user_answers WHERE user_id = ? AND is_correct = 1').get(userId).cnt;
    const wrongTotal = db.prepare('SELECT COUNT(*) as cnt FROM user_answers WHERE user_id = ? AND is_correct = 0').get(userId).cnt;
    const allTotal = correctTotal + wrongTotal;
    const accuracy = allTotal > 0 ? Math.round(correctTotal / allTotal * 1000) / 10 : 0;
    const wrongCount = db.prepare('SELECT COUNT(*) as cnt FROM wrong_answers WHERE user_id = ? AND is_resolved = 0').get(userId).cnt;
    const bookmarkCount = db.prepare('SELECT COUNT(*) as cnt FROM bookmarks WHERE user_id = ?').get(userId).cnt;

    // By subject
    const bySubject = db.prepare(`
      SELECT q.subject,
        COUNT(*) as total,
        SUM(CASE WHEN ua.is_correct = 1 THEN 1 ELSE 0 END) as correct,
        ROUND(CAST(SUM(CASE WHEN ua.is_correct = 1 THEN 1 ELSE 0 END) AS REAL) / COUNT(*) * 100, 1) as accuracy
      FROM user_answers ua JOIN questions q ON ua.question_id = q.id
      WHERE ua.user_id = ?
      GROUP BY q.subject ORDER BY q.subject
    `).all(userId);

    // By year
    const byYear = db.prepare(`
      SELECT q.year,
        COUNT(*) as total,
        SUM(CASE WHEN ua.is_correct = 1 THEN 1 ELSE 0 END) as correct,
        ROUND(CAST(SUM(CASE WHEN ua.is_correct = 1 THEN 1 ELSE 0 END) AS REAL) / COUNT(*) * 100, 1) as accuracy
      FROM user_answers ua JOIN questions q ON ua.question_id = q.id
      WHERE ua.user_id = ?
      GROUP BY q.year ORDER BY q.year
    `).all(userId);

    // By keyword (top 20 worst)
    const byKeyword = db.prepare(`
      SELECT q.keyword,
        COUNT(*) as total,
        SUM(CASE WHEN ua.is_correct = 1 THEN 1 ELSE 0 END) as correct,
        ROUND(CAST(SUM(CASE WHEN ua.is_correct = 1 THEN 1 ELSE 0 END) AS REAL) / COUNT(*) * 100, 1) as accuracy
      FROM user_answers ua JOIN questions q ON ua.question_id = q.id
      WHERE ua.user_id = ? AND q.keyword != ''
      GROUP BY q.keyword HAVING COUNT(*) >= 3
      ORDER BY accuracy ASC LIMIT 20
    `).all(userId);

    // Recent sessions
    const recentSessions = db.prepare(`
      SELECT * FROM quiz_sessions WHERE user_id = ? AND status = 'completed'
      ORDER BY completed_at DESC LIMIT 10
    `).all(userId);

    // 185-day calendar heatmap (daily answer counts)
    const calendarRows = db.prepare(`
      SELECT DATE(created_at) as day, COUNT(*) as cnt,
        SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) as correct
      FROM user_answers
      WHERE user_id = ? AND created_at >= DATE('now', '-184 days')
      GROUP BY day ORDER BY day
    `).all(userId);

    // Study streak (consecutive days with activity ending today or yesterday)
    const dayMap = {};
    calendarRows.forEach(r => { dayMap[r.day] = r.cnt; });
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(today); d.setDate(today.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      if (dayMap[key]) streak++;
      else if (i === 0) continue; // allow today to not count
      else break;
    }
    const todayKey = new Date().toISOString().slice(0, 10);
    const todayCount = dayMap[todayKey] || 0;

    const user = db.prepare('SELECT expiry_date FROM users WHERE id = ?').get(userId);

    // Hour distribution (study time pattern)
    const byHour = db.prepare(`
      SELECT CAST(strftime('%H', created_at, 'localtime') AS INTEGER) as hour, COUNT(*) as cnt
      FROM user_answers
      WHERE user_id = ?
      GROUP BY hour ORDER BY hour
    `).all(userId);

    res.json({
      totalQuestions, totalAnswered, accuracy, wrongCount, bookmarkCount,
      correctTotal, wrongTotal,
      bySubject, byYear, byKeyword, recentSessions, user,
      calendar: calendarRows, streak, todayCount,
      byHour
    });
  } catch (err) { res.status(500).json({ error: '통계 로드 실패: ' + err.message }); }
});

router.get('/summary', (req, res) => {
  try {
    const db = req.app.locals.db;
    const totalQuestions = db.prepare('SELECT COUNT(*) as cnt FROM questions').get().cnt;
    const totalYears = db.prepare('SELECT COUNT(DISTINCT year) as cnt FROM questions').get().cnt;
    const totalSubjects = db.prepare('SELECT COUNT(DISTINCT subject) as cnt FROM questions').get().cnt;
    const totalKeywords = db.prepare('SELECT COUNT(*) as cnt FROM keywords').get().cnt;
    res.json({ totalQuestions, totalYears, totalSubjects, totalKeywords });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
