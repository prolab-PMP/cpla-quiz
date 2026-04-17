const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'cpla-quiz-secret';

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) { req.user = null; return next(); }
  try {
    const decoded = jwt.verify(token, SECRET);
    req.user = decoded;
  } catch { req.user = null; }
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: '로그인이 필요합니다.' });
  next();
}

function requireMaster(req, res, next) {
  if (!req.user || req.user.role !== 'master') return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
  next();
}

module.exports = { authenticateToken, requireAuth, requireMaster };
