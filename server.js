const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from the current directory
app.use(express.static(__dirname, {
  extensions: ['html'],
  index: 'index.html'
}));

// SPA fallback - serve index.html for unknown routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`공인노무사 기출문제 풀이 서버 실행 중: http://localhost:${PORT}`);
});
