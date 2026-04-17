const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();
const SECRET = process.env.JWT_SECRET || 'cpla-quiz-secret';

router.post('/register', (req, res) => {
  try {
    const db = req.app.locals.db;
    const { email, password, name } = req.body;
    if (!email || !password) return res.status(400).json({ error: '이메일과 비밀번호를 입력하세요.' });
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) return res.status(400).json({ error: '이미 등록된 이메일입니다.' });
    const hash = bcrypt.hashSync(password, 10);
    db.prepare('INSERT INTO users (email, password, name) VALUES (?, ?, ?)').run(email, hash, name || '');
    const user = db.prepare('SELECT id, email, name, role, expiry_date FROM users WHERE email = ?').get(email);
    const token = jwt.sign({ id: user.id, email: user.email, name: user.name, role: user.role }, SECRET, { expiresIn: '30d' });
    res.json({ token, user });
  } catch (err) { res.status(500).json({ error: '회원가입 실패: ' + err.message }); }
});

router.post('/login', (req, res) => {
  try {
    const db = req.app.locals.db;
    const { email, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) return res.status(401).json({ error: '이메일 또는 비밀번호가 잘못되었습니다.' });
    if (!user.is_active) return res.status(403).json({ error: '비활성화된 계정입니다.' });
    if (!bcrypt.compareSync(password, user.password)) return res.status(401).json({ error: '이메일 또는 비밀번호가 잘못되었습니다.' });
    const token = jwt.sign({ id: user.id, email: user.email, name: user.name, role: user.role }, SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role, expiry_date: user.expiry_date } });
  } catch (err) { res.status(500).json({ error: '로그인 실패' }); }
});

router.get('/me', authenticateToken, (req, res) => {
  if (!req.user) return res.status(401).json({ error: '인증 필요' });
  const db = req.app.locals.db;
  const user = db.prepare('SELECT id, email, name, role, expiry_date FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
  res.json({ user });
});

module.exports = router;
