const express = require('express');
const { authenticateToken, requireMaster } = require('../middleware/auth');
const router = express.Router();

router.use(authenticateToken);
router.use(requireMaster);

router.get('/users', (req, res) => {
  try {
    const db = req.app.locals.db;
    const users = db.prepare(`
      SELECT u.id, u.email, u.name, u.role, u.is_active, u.expiry_date, u.created_at,
        COALESCE((SELECT COUNT(*) FROM user_answers WHERE user_id = u.id), 0) as total_answers,
        COALESCE((SELECT SUM(is_correct) FROM user_answers WHERE user_id = u.id), 0) as correct_answers
      FROM users u ORDER BY u.created_at DESC
    `).all();
    res.json({ users });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/users/:id/expiry', (req, res) => {
  try {
    const db = req.app.locals.db;
    db.prepare('UPDATE users SET expiry_date = ? WHERE id = ?').run(req.body.expiry_date, req.params.id);
    res.json({ message: '유효기간이 수정되었습니다.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/users/:id/toggle', (req, res) => {
  try {
    const db = req.app.locals.db;
    const user = db.prepare('SELECT is_active FROM users WHERE id = ?').get(req.params.id);
    if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    const newStatus = user.is_active ? 0 : 1;
    db.prepare('UPDATE users SET is_active = ? WHERE id = ?').run(newStatus, req.params.id);
    res.json({ message: newStatus ? '활성화되었습니다.' : '비활성화되었습니다.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/overall-stats', (req, res) => {
  try {
    const db = req.app.locals.db;
    const totalUsers = db.prepare('SELECT COUNT(*) as cnt FROM users').get().cnt;
    const activeUsers = db.prepare('SELECT COUNT(*) as cnt FROM users WHERE is_active = 1').get().cnt;
    const totalSessions = db.prepare("SELECT COUNT(*) as cnt FROM quiz_sessions WHERE status = 'completed'").get().cnt;
    const avgScore = db.prepare("SELECT ROUND(AVG(score), 1) as avg FROM quiz_sessions WHERE status = 'completed'").get().avg || 0;
    res.json({ totalUsers, activeUsers, totalSessions, avgScore });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/question-stats', (req, res) => {
  try {
    const db = req.app.locals.db;
    const stats = db.prepare(`
      SELECT qs.question_id, q.question_text, q.subject, q.keyword,
        qs.total_attempts, qs.accuracy_rate
      FROM question_stats qs JOIN questions q ON qs.question_id = q.id
      WHERE qs.total_attempts > 0
      ORDER BY qs.accuracy_rate ASC LIMIT 100
    `).all();
    res.json({ stats });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
