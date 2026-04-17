require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { getWrapper, save } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      scriptSrcAttr: ["'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
    }
  }
}));
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 500 });
app.use('/api/', limiter);

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

async function start() {
  const db = await getWrapper();
  app.locals.db = db;

  const { initDatabase } = require('./scripts/init-db');
  await initDatabase(db);

  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/quiz', require('./routes/quiz'));
  app.use('/api/admin', require('./routes/admin'));
  app.use('/api/stats', require('./routes/stats'));

  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  process.on('SIGINT', () => { save(); process.exit(); });
  process.on('SIGTERM', () => { save(); process.exit(); });

  app.listen(PORT, () => {
    console.log(`CPLA Quiz Server running on http://localhost:${PORT}`);
  });
}

start().catch(err => { console.error('Failed to start:', err); process.exit(1); });
