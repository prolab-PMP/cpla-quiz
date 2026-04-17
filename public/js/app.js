/* ===== 공인노무사 Quiz SPA ===== */
const API = '/api';
let currentUser = null;
let token = localStorage.getItem('cpla_token');
let currentQuiz = null;
let quizTimer = null;
let guestStats = JSON.parse(sessionStorage.getItem('guest_stats') || '{"correct":0,"wrong":0,"wrongList":[]}');

const SUBJECTS = {
  '노동법1': { color: '#dc2626', icon: 'fas fa-gavel' },
  '노동법2': { color: '#ea580c', icon: 'fas fa-handshake' },
  '민법': { color: '#2563eb', icon: 'fas fa-book' },
  '사회보험법': { color: '#7c3aed', icon: 'fas fa-shield-alt' },
  '경제학': { color: '#059669', icon: 'fas fa-chart-line' },
  '경영학': { color: '#0891b2', icon: 'fas fa-briefcase' }
};

// Security
document.addEventListener('contextmenu', e => { if(e.target.closest('.secure-text')) e.preventDefault(); });
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) e.preventDefault();
  if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) e.preventDefault();
});

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(API + path, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'API Error');
  return data;
}

function showToast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  document.getElementById('toastContainer').appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

function toggleMobileMenu() {
  document.getElementById('headerNav').classList.toggle('show');
}

// ===== Router =====
const app = {
  navigate(page, data) {
    document.getElementById('headerNav').classList.remove('show');
    document.querySelectorAll('.header-nav button[data-page]').forEach(b => {
      b.classList.toggle('active', b.dataset.page === page);
    });
    const container = document.getElementById('app');
    container.innerHTML = '<div class="loading"><div class="spinner"></div>로딩 중...</div>';
    switch(page) {
      case 'home': renderHome(container); break;
      case 'login': renderAuth(container); break;
      case 'quiz-setup': renderQuizSetup(container); break;
      case 'quiz': renderQuiz(container, data); break;
      case 'results': renderResults(container, data); break;
      case 'keywords': renderKeywords(container); break;
      case 'wrong-answers': renderWrongAnswers(container); break;
      case 'dashboard': renderDashboard(container); break;
      case 'admin': renderAdmin(container); break;
      default: renderHome(container);
    }
  }
};

// ===== Auth =====
function updateAuthArea() {
  const area = document.getElementById('authArea');
  if (currentUser) {
    const isMaster = currentUser.role === 'master';
    area.innerHTML = `
      ${isMaster ? '<button onclick="app.navigate(\'admin\')" data-page="admin"><i class="fas fa-cog"></i> 관리</button>' : ''}
      <span class="user-badge"><i class="fas fa-user"></i> ${currentUser.name || currentUser.email}</span>
      <button onclick="logout()" style="color:var(--danger)"><i class="fas fa-sign-out-alt"></i> 로그아웃</button>
    `;
  } else {
    area.innerHTML = `
      <span class="guest-badge"><i class="fas fa-user-secret"></i> 무료체험</span>
      <button onclick="app.navigate('login')" class="btn btn-primary btn-sm"><i class="fas fa-sign-in-alt"></i> 로그인</button>
    `;
  }
}

async function checkAuth() {
  if (!token) { currentUser = null; updateAuthArea(); return; }
  try {
    const data = await api('/auth/me');
    currentUser = data.user;
  } catch { currentUser = null; token = null; localStorage.removeItem('cpla_token'); }
  updateAuthArea();
}

function logout() {
  token = null; currentUser = null;
  localStorage.removeItem('cpla_token');
  updateAuthArea();
  app.navigate('home');
  showToast('로그아웃되었습니다.', 'info');
}

// ===== Home =====
function renderHome(el) {
  el.innerHTML = `
    <div class="fade-in" style="text-align:center; padding: 40px 0;">
      <h1 style="font-size:2.5rem; margin-bottom:12px;">공인노무사 1차 기출문제 풀이</h1>
      <p style="color:var(--gray-500); font-size:1.1rem; margin-bottom:40px;">2013~2024년 | 총 1,890문제 | 6과목 | 키워드별 분류</p>

      <div class="mode-cards" style="max-width:1000px; margin:0 auto 40px;">
        <div class="mode-card" onclick="app.navigate('quiz-setup')">
          <i class="fas fa-book-open"></i>
          <h3>과목별 문제풀이</h3>
          <p>과목/년도/키워드 필터링<br>원하는 수만큼 랜덤 출제</p>
        </div>
        <div class="mode-card" onclick="app.navigate('keywords')">
          <i class="fas fa-fire"></i>
          <h3>고빈도 키워드</h3>
          <p>과목별 키워드 빈도 분석<br>키워드 클릭시 바로 문제풀이</p>
        </div>
        <div class="mode-card" onclick="startExamMode()">
          <i class="fas fa-clock"></i>
          <h3>실전 모의고사</h3>
          <p>200문제 / 200분 제한<br>실제 시험과 유사한 환경</p>
        </div>
        <div class="mode-card" onclick="app.navigate('wrong-answers')">
          <i class="fas fa-redo"></i>
          <h3>오답 복습</h3>
          <p>틀린 문제만 모아서 다시 풀기<br>맞추면 자동 삭제</p>
        </div>
      </div>

      <div class="stats-grid" style="max-width:800px; margin:0 auto 30px;">
        ${Object.entries(SUBJECTS).map(([name, info]) => `
          <div class="stat-card" style="border-top-color:${info.color}; cursor:pointer;" onclick="startSubjectQuiz('${name}')">
            <div class="stat-value" style="font-size:1.5rem;"><i class="${info.icon}" style="color:${info.color}"></i></div>
            <div class="stat-label">${name}</div>
          </div>
        `).join('')}
      </div>

      ${!currentUser ? `
        <div class="card" style="max-width:500px; margin:0 auto; text-align:center;">
          <p style="margin-bottom:12px;"><strong>무료 체험:</strong> 로그인 없이 30문제를 풀어볼 수 있습니다.</p>
          <p style="color:var(--gray-500); font-size:.85rem;">전체 1,890문제와 오답노트, 성적관리를 이용하려면 회원가입하세요.</p>
          <div style="margin-top:16px;">
            <button class="btn btn-primary" onclick="app.navigate('quiz-setup')"><i class="fas fa-play"></i> 무료 체험하기</button>
            <button class="btn btn-outline" onclick="app.navigate('login')" style="margin-left:8px;"><i class="fas fa-user-plus"></i> 회원가입</button>
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

// ===== Auth Page =====
function renderAuth(el) {
  let isLogin = true;
  function render() {
    el.innerHTML = `
      <div class="auth-container fade-in">
        <div class="auth-card">
          <h2><i class="fas fa-balance-scale" style="color:var(--primary)"></i> 노무사 Quiz</h2>
          <p class="subtitle">${isLogin ? '로그인하여 전체 기능을 이용하세요' : '새 계정을 만들어 시작하세요'}</p>
          <div class="auth-tabs">
            <button class="auth-tab ${isLogin ? 'active' : ''}" onclick="switchAuth(true)">로그인</button>
            <button class="auth-tab ${!isLogin ? 'active' : ''}" onclick="switchAuth(false)">회원가입</button>
          </div>
          <form onsubmit="handleAuth(event, ${isLogin})">
            ${!isLogin ? '<div class="form-group"><label class="form-label">이름</label><input class="form-input" name="name" placeholder="홍길동"></div>' : ''}
            <div class="form-group">
              <label class="form-label">이메일</label>
              <input class="form-input" type="email" name="email" required placeholder="example@email.com">
            </div>
            <div class="form-group">
              <label class="form-label">비밀번호</label>
              <input class="form-input" type="password" name="password" required minlength="4" placeholder="비밀번호 입력">
            </div>
            <button type="submit" class="btn btn-primary btn-lg" style="width:100%; justify-content:center;">
              ${isLogin ? '<i class="fas fa-sign-in-alt"></i> 로그인' : '<i class="fas fa-user-plus"></i> 회원가입'}
            </button>
          </form>
        </div>
      </div>
    `;
    window.switchAuth = (v) => { isLogin = v; render(); };
  }
  render();
}

async function handleAuth(e, isLogin) {
  e.preventDefault();
  const form = new FormData(e.target);
  const body = Object.fromEntries(form);
  try {
    const data = await api(isLogin ? '/auth/login' : '/auth/register', { method: 'POST', body: JSON.stringify(body) });
    token = data.token;
    localStorage.setItem('cpla_token', token);
    currentUser = data.user;
    updateAuthArea();
    showToast(isLogin ? '로그인 성공!' : '회원가입 성공!', 'success');
    app.navigate('home');
  } catch (err) { showToast(err.message, 'error'); }
}

// ===== Quiz Setup =====
async function renderQuizSetup(el) {
  try {
    const filters = await api('/quiz/filters');
    let selected = { subjects: [], years: [], keywords: [] };
    let count = 20;

    function render() {
      const isGuest = !currentUser;
      el.innerHTML = `
        <div class="quiz-setup fade-in">
          <h2 style="margin-bottom:20px;"><i class="fas fa-sliders-h"></i> 문제 설정</h2>
          ${isGuest ? '<div class="card" style="background:#fff7ed; border:1px solid #fed7aa;"><p><i class="fas fa-info-circle" style="color:var(--warning)"></i> 무료 체험 모드: 30문제까지 출제됩니다. 전체 ${filters.totalQuestions}문제를 이용하려면 <a href="javascript:void(0)" onclick="app.navigate(\'login\')">로그인</a>하세요.</p></div>' : ''}

          <div class="card">
            <div class="card-title">출제 문제 수</div>
            <div class="range-row">
              <input type="range" min="5" max="${isGuest ? 30 : 200}" value="${count}" oninput="updateCount(this.value)">
              <span class="range-value" id="countDisplay">${count}문제</span>
            </div>
          </div>

          <div class="card">
            <div class="card-title">과목 선택</div>
            <div class="filter-chips">
              ${filters.subjects.map(s => {
                const info = SUBJECTS[s] || { color: '#6b7280' };
                return `<div class="chip ${selected.subjects.includes(s)?'selected':''}" onclick="toggleFilter('subjects','${s}')" style="${selected.subjects.includes(s) ? 'background:'+info.color+';border-color:'+info.color : ''}">${s}</div>`;
              }).join('')}
            </div>
          </div>

          <div class="card">
            <div class="card-title">출제년도</div>
            <div class="filter-chips">
              ${filters.years.map(y => `<div class="chip ${selected.years.includes(y)?'selected':''}" onclick="toggleFilter('years','${y}')">${y}</div>`).join('')}
            </div>
          </div>

          <div class="card">
            <div class="card-title">키워드 (선택한 과목의 고빈도 키워드)</div>
            <div class="filter-chips" id="keywordChips">
              ${renderKeywordChips(filters, selected)}
            </div>
          </div>

          <div style="text-align:center; margin-top:24px;">
            <button class="btn btn-primary btn-lg" onclick="startQuiz()"><i class="fas fa-play"></i> 문제 풀기 시작</button>
          </div>
        </div>
      `;
    }

    function renderKeywordChips(filters, selected) {
      const activeSubjects = selected.subjects.length > 0 ? selected.subjects : Object.keys(filters.topKeywords);
      const keywordsToShow = [];
      for (const subj of activeSubjects) {
        const kws = filters.topKeywords[subj] || [];
        for (const kw of kws.slice(0, 10)) {
          if (!keywordsToShow.find(k => k.keyword === kw.keyword)) {
            keywordsToShow.push(kw);
          }
        }
      }
      keywordsToShow.sort((a, b) => b.frequency - a.frequency);
      return keywordsToShow.slice(0, 30).map(kw =>
        `<div class="chip ${selected.keywords.includes(kw.keyword)?'selected':''}" onclick="toggleFilter('keywords','${kw.keyword}')">${kw.keyword} <span class="chip-count">(${kw.frequency})</span></div>`
      ).join('');
    }

    window.updateCount = (v) => { count = parseInt(v); document.getElementById('countDisplay').textContent = v + '문제'; };
    window.toggleFilter = (key, val) => {
      const idx = selected[key].indexOf(val);
      if (idx >= 0) selected[key].splice(idx, 1); else selected[key].push(val);
      render();
    };
    window.startQuiz = async () => {
      try {
        const activeFilters = {};
        Object.entries(selected).forEach(([k, v]) => { if (v.length) activeFilters[k] = v; });
        const data = await api('/quiz/generate', {
          method: 'POST',
          body: JSON.stringify({ count, filters: activeFilters, quizType: 'practice' })
        });
        if (!data.questions.length) { showToast('조건에 맞는 문제가 없습니다.', 'error'); return; }
        app.navigate('quiz', data);
      } catch (err) { showToast(err.message, 'error'); }
    };
    render();
  } catch (err) { el.innerHTML = `<p style="color:red">필터 로드 실패: ${err.message}</p>`; }
}

async function startExamMode() {
  try {
    const data = await api('/quiz/generate', {
      method: 'POST',
      body: JSON.stringify({ count: 200, filters: {}, quizType: 'exam' })
    });
    if (!data.questions.length) { showToast('문제를 불러올 수 없습니다.', 'error'); return; }
    app.navigate('quiz', { ...data, isExam: true, timeLimit: 200 });
  } catch (err) { showToast(err.message, 'error'); }
}

async function startSubjectQuiz(subject) {
  try {
    const data = await api('/quiz/generate', {
      method: 'POST',
      body: JSON.stringify({ count: 20, filters: { subjects: [subject] }, quizType: 'practice' })
    });
    if (!data.questions.length) { showToast('문제를 불러올 수 없습니다.', 'error'); return; }
    app.navigate('quiz', data);
  } catch (err) { showToast(err.message, 'error'); }
}

// ===== Keywords Page =====
async function renderKeywords(el) {
  try {
    const filters = await api('/quiz/filters');
    let activeSubject = Object.keys(filters.topKeywords)[0] || '노동법1';

    function render() {
      const kws = filters.topKeywords[activeSubject] || [];
      const maxFreq = kws[0]?.frequency || 1;

      el.innerHTML = `
        <div class="keywords-container fade-in">
          <h2 style="margin-bottom:20px;"><i class="fas fa-fire" style="color:var(--warning)"></i> 고빈도 키워드 분석</h2>

          <div class="card">
            <div class="filter-chips" style="margin-bottom:0;">
              ${Object.keys(filters.topKeywords).map(s => {
                const info = SUBJECTS[s] || {};
                return `<div class="chip ${activeSubject === s ? 'selected' : ''}" onclick="setKwSubject('${s}')" style="${activeSubject === s ? 'background:'+(info.color||'var(--primary)')+';border-color:'+(info.color||'var(--primary)') : ''}">${s}</div>`;
              }).join('')}
            </div>
          </div>

          <div class="card">
            <div class="card-title">${activeSubject} - 키워드별 출제 빈도 (상위 30개)</div>
            <div class="chart-container">
              ${kws.slice(0, 30).map(kw => {
                const pct = Math.round(kw.frequency / maxFreq * 100);
                const color = pct > 60 ? 'var(--danger)' : pct > 30 ? 'var(--warning)' : 'var(--success)';
                return `
                  <div class="chart-bar" style="cursor:pointer;" onclick="startKeywordQuiz('${kw.keyword}')">
                    <div class="chart-label">${kw.keyword}</div>
                    <div class="chart-track">
                      <div class="chart-fill" style="width:${pct}%; background:${color}">
                        <span>${kw.frequency}회</span>
                      </div>
                    </div>
                    <div class="chart-percent"><i class="fas fa-play" style="font-size:.7rem;color:var(--primary)"></i></div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <div class="card">
            <div class="card-title">키워드 맵 (클릭하면 해당 키워드 문제풀이)</div>
            <div class="keyword-grid">
              ${kws.map(kw => {
                const level = kw.frequency > maxFreq * 0.6 ? 'high' : kw.frequency > maxFreq * 0.3 ? 'mid' : 'low';
                return `<div class="keyword-bubble ${level}" onclick="startKeywordQuiz('${kw.keyword}')" title="${kw.frequency}회 출제">${kw.keyword}</div>`;
              }).join('')}
            </div>
          </div>
        </div>
      `;
    }

    window.setKwSubject = (s) => { activeSubject = s; render(); };
    window.startKeywordQuiz = async (keyword) => {
      try {
        const data = await api('/quiz/generate', {
          method: 'POST',
          body: JSON.stringify({ count: 20, filters: { keywords: [keyword] }, quizType: 'practice' })
        });
        if (!data.questions?.length) { showToast(`"${keyword}" 관련 문제가 없습니다.`, 'error'); return; }
        app.navigate('quiz', data);
      } catch (err) { showToast(err.message, 'error'); }
    };
    render();
  } catch (err) { el.innerHTML = `<p style="color:red">${err.message}</p>`; }
}

// ===== Quiz Interface =====
function renderQuiz(el, data) {
  if (!data || !data.questions?.length) { app.navigate('home'); return; }

  currentQuiz = {
    questions: data.questions,
    sessionId: data.sessionId,
    currentIndex: 0,
    answers: {},
    results: {},
    isExam: data.isExam || false,
    timeLimit: data.timeLimit || 0,
    startTime: Date.now()
  };

  if (currentQuiz.isExam && currentQuiz.timeLimit > 0) {
    let remaining = currentQuiz.timeLimit * 60;
    quizTimer = setInterval(() => {
      remaining--;
      const m = Math.floor(remaining / 60);
      const s = remaining % 60;
      const timerEl = document.getElementById('quizTimer');
      if (timerEl) timerEl.textContent = `${m}:${s.toString().padStart(2, '0')}`;
      if (remaining <= 0) { clearInterval(quizTimer); finishQuiz(); }
      if (remaining <= 300 && timerEl) timerEl.style.color = 'var(--danger)';
    }, 1000);
  }

  renderQuestion(el);
}

function renderQuestion(el) {
  const q = currentQuiz.questions[currentQuiz.currentIndex];
  const total = currentQuiz.questions.length;
  const idx = currentQuiz.currentIndex;
  const answered = currentQuiz.answers[q.id];
  const result = currentQuiz.results[q.id];
  const progress = ((idx + 1) / total * 100).toFixed(1);
  const answeredCount = Object.keys(currentQuiz.answers).length;
  const subjectInfo = SUBJECTS[q.subject] || { color: '#6b7280' };

  let statements = [];
  try { statements = JSON.parse(q.statements || '[]'); } catch { statements = []; }

  let timerHtml = '';
  if (currentQuiz.isExam) {
    timerHtml = `<span class="quiz-timer" id="quizTimer">--:--</span>`;
  }

  el.innerHTML = `
    <div class="quiz-container fade-in">
      <div class="quiz-progress">
        <span style="font-weight:600; font-size:.9rem;">${idx + 1} / ${total}</span>
        <div class="progress-bar"><div class="progress-fill" style="width:${progress}%"></div></div>
        <span style="font-size:.85rem; color:var(--gray-500);">${answeredCount}문제 완료</span>
        ${timerHtml}
      </div>

      <div class="question-card secure-text">
        <div class="question-number">${q.year} ${q.subject} - Q${q.question_number}</div>
        <div class="question-meta">
          <span class="question-tag subject" style="background:${subjectInfo.color}20;color:${subjectInfo.color};border:1px solid ${subjectInfo.color}40;">${q.subject}</span>
          ${q.keyword ? `<span class="question-tag keyword">${q.keyword}</span>` : ''}
          <span class="question-tag">${q.year}</span>
        </div>
        <div class="question-text">${q.question_text}</div>

        ${statements.length > 0 ? `
          <div class="statements-box">
            ${statements.map(s => `<p>${s}</p>`).join('')}
          </div>
        ` : ''}

        <div class="options-list" id="optionsList">
          ${renderOptions(q, answered, result)}
        </div>

        ${result ? renderExplanationBox(q, result) : ''}
      </div>

      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
        <button class="btn btn-outline" onclick="prevQuestion()" ${idx === 0 ? 'disabled' : ''}>
          <i class="fas fa-chevron-left"></i> 이전
        </button>
        <div class="btn-group">
          ${!answered ? `<button class="btn btn-primary" id="submitBtn" onclick="submitAnswer()"><i class="fas fa-check"></i> 제출</button>` : ''}
          ${idx < total - 1 ? `<button class="btn ${answered ? 'btn-primary' : 'btn-outline'}" onclick="nextQuestion()">다음 <i class="fas fa-chevron-right"></i></button>` : ''}
          ${idx === total - 1 || answeredCount === total ? `<button class="btn btn-success" onclick="finishQuiz()"><i class="fas fa-flag-checkered"></i> 완료</button>` : ''}
        </div>
        <button class="btn btn-outline btn-sm" onclick="showQuestionNav()"><i class="fas fa-th"></i> 전체보기</button>
      </div>
    </div>
  `;
}

function renderOptions(q, answered, result) {
  const opts = [q.option_1, q.option_2, q.option_3, q.option_4, q.option_5].filter(o => o && o.trim());
  let html = '';
  for (let i = 0; i < opts.length; i++) {
    const num = i + 1;
    let classes = 'option-item';
    let icon = '';

    if (result) {
      classes += ' disabled';
      if (num === result.correctAnswer) { classes += ' correct'; icon = '<i class="fas fa-check-circle option-check" style="color:var(--success)"></i>'; }
      if (num === parseInt(answered) && num !== result.correctAnswer) { classes += ' wrong'; icon = '<i class="fas fa-times-circle option-check" style="color:var(--danger)"></i>'; }
    } else {
      if (currentQuiz._tempSelected === num) classes += ' selected';
    }

    html += `
      <div class="${classes}" onclick="selectOption(${num})">
        <span class="option-label">${num}.</span>
        <span class="option-text">${opts[i]}</span>
        ${icon}
      </div>
    `;
  }
  return html;
}

function renderExplanationBox(q, result) {
  return `
    <div class="explanation-box">
      <h4>${result.correct ? '&#10003; 정답입니다!' : '&#10007; 오답입니다.'} 정답: ${result.correctAnswer}번</h4>
      ${result.explanation ? `<p>${result.explanation}</p>` : '<p>해설이 준비 중입니다.</p>'}
      ${result.keyword ? `<p style="margin-top:8px; font-size:.85rem; color:var(--gray-500);">키워드: ${result.keyword}</p>` : ''}
    </div>
  `;
}

function selectOption(num) {
  currentQuiz._tempSelected = num;
  const q = currentQuiz.questions[currentQuiz.currentIndex];
  const answered = currentQuiz.answers[q.id];
  const result = currentQuiz.results[q.id];
  document.getElementById('optionsList').innerHTML = renderOptions(q, answered, result);
}

async function submitAnswer() {
  const q = currentQuiz.questions[currentQuiz.currentIndex];
  const sel = currentQuiz._tempSelected;
  if (!sel) { showToast('답을 선택하세요.', 'error'); return; }

  try {
    const result = await api('/quiz/answer', {
      method: 'POST',
      body: JSON.stringify({
        sessionId: currentQuiz.sessionId,
        questionId: q.id,
        selectedAnswer: sel,
        timeSpent: Math.floor((Date.now() - currentQuiz.startTime) / 1000)
      })
    });
    currentQuiz.answers[q.id] = sel;
    currentQuiz.results[q.id] = result;
    currentQuiz._tempSelected = null;

    if (!currentUser) {
      if (result.correct) guestStats.correct++;
      else { guestStats.wrong++; if (!guestStats.wrongList.includes(q.id)) guestStats.wrongList.push(q.id); }
      sessionStorage.setItem('guest_stats', JSON.stringify(guestStats));
    }

    renderQuestion(document.getElementById('app'));
  } catch (err) { showToast(err.message, 'error'); }
}

function nextQuestion() {
  if (currentQuiz.currentIndex < currentQuiz.questions.length - 1) {
    currentQuiz.currentIndex++;
    currentQuiz._tempSelected = null;
    renderQuestion(document.getElementById('app'));
  }
}

function prevQuestion() {
  if (currentQuiz.currentIndex > 0) {
    currentQuiz.currentIndex--;
    currentQuiz._tempSelected = null;
    renderQuestion(document.getElementById('app'));
  }
}

function showQuestionNav() {
  const total = currentQuiz.questions.length;
  let grid = '';
  for (let i = 0; i < total; i++) {
    const q = currentQuiz.questions[i];
    const answered = currentQuiz.answers[q.id];
    const result = currentQuiz.results[q.id];
    let bg = 'var(--gray-200)';
    if (result?.correct) bg = 'var(--success)';
    else if (result && !result.correct) bg = 'var(--danger)';
    else if (answered) bg = 'var(--primary)';
    const isCurrent = i === currentQuiz.currentIndex;
    grid += `<div onclick="goToQuestion(${i})" style="width:36px;height:36px;display:flex;align-items:center;justify-content:center;border-radius:8px;cursor:pointer;font-size:.75rem;font-weight:600;color:${bg === 'var(--gray-200)' ? 'var(--gray-600)' : 'white'};background:${bg};${isCurrent ? 'outline:3px solid var(--primary);outline-offset:2px;' : ''}">${i + 1}</div>`;
  }
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  overlay.innerHTML = `
    <div class="modal">
      <h3>문제 목록</h3>
      <div style="display:flex;gap:4px;margin-bottom:12px;">
        <span style="display:flex;align-items:center;gap:4px;font-size:.75rem;"><span style="width:12px;height:12px;border-radius:3px;background:var(--gray-200);display:inline-block;"></span>미풀이</span>
        <span style="display:flex;align-items:center;gap:4px;font-size:.75rem;"><span style="width:12px;height:12px;border-radius:3px;background:var(--success);display:inline-block;"></span>정답</span>
        <span style="display:flex;align-items:center;gap:4px;font-size:.75rem;"><span style="width:12px;height:12px;border-radius:3px;background:var(--danger);display:inline-block;"></span>오답</span>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;max-height:50vh;overflow-y:auto;">${grid}</div>
      <div class="modal-actions"><button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">닫기</button></div>
    </div>
  `;
  document.body.appendChild(overlay);
}

window.goToQuestion = (i) => {
  currentQuiz.currentIndex = i;
  currentQuiz._tempSelected = null;
  document.querySelector('.modal-overlay')?.remove();
  renderQuestion(document.getElementById('app'));
};

async function finishQuiz() {
  if (quizTimer) { clearInterval(quizTimer); quizTimer = null; }
  try {
    const timeSpent = Math.floor((Date.now() - currentQuiz.startTime) / 1000);
    const result = await api('/quiz/complete', {
      method: 'POST',
      body: JSON.stringify({ sessionId: currentQuiz.sessionId, timeSpent })
    });
    app.navigate('results', result);
  } catch (err) { showToast(err.message, 'error'); }
}

// ===== Results =====
function renderResults(el, data) {
  if (!data) { app.navigate('home'); return; }
  const scoreClass = data.score >= 40 ? 'pass' : 'fail';
  const minutes = currentQuiz ? Math.floor((Date.now() - currentQuiz.startTime) / 60000) : 0;

  el.innerHTML = `
    <div class="results-container fade-in">
      <h2 style="margin-bottom:8px;"><i class="fas fa-trophy" style="color:${data.passed ? 'gold' : 'var(--gray-400)'}"></i> 시험 결과</h2>
      <div class="results-score ${scoreClass}">${data.score}%</div>
      <p style="font-size:1.2rem; font-weight:600; color:${data.passed ? 'var(--success)' : 'var(--danger)'}">
        ${data.passed ? '합격 수준입니다!' : '더 공부가 필요합니다. 화이팅!'}
      </p>
      <p style="color:var(--gray-500); margin:4px 0;">합격 기준: 과목당 40% 이상, 전과목 평균 60% | 소요시간: ${minutes}분</p>

      <div class="results-details">
        <div class="result-item">
          <div class="value" style="color:var(--gray-800)">${data.total}</div>
          <div class="label">전체 문제</div>
        </div>
        <div class="result-item">
          <div class="value" style="color:var(--success)">${data.correct}</div>
          <div class="label">정답</div>
        </div>
        <div class="result-item">
          <div class="value" style="color:var(--danger)">${data.wrong}</div>
          <div class="label">오답</div>
        </div>
      </div>

      <div class="btn-group" style="justify-content:center; margin-top:24px;">
        <button class="btn btn-primary" onclick="app.navigate('quiz-setup')"><i class="fas fa-redo"></i> 다시 풀기</button>
        <button class="btn btn-outline" onclick="app.navigate('wrong-answers')"><i class="fas fa-list"></i> 오답 확인</button>
        <button class="btn btn-outline" onclick="app.navigate('dashboard')"><i class="fas fa-chart-bar"></i> 성적 보기</button>
      </div>
    </div>
  `;
  currentQuiz = null;
}

// ===== Wrong Answers =====
async function renderWrongAnswers(el) {
  if (!currentUser) {
    const wl = guestStats.wrongList || [];
    el.innerHTML = `
      <div class="wrong-list fade-in">
        <h2 style="margin-bottom:20px;"><i class="fas fa-times-circle" style="color:var(--danger)"></i> 오답노트</h2>
        ${wl.length === 0
          ? '<div class="card" style="text-align:center;"><p>오답 문제가 없습니다. 문제를 풀어보세요!</p></div>'
          : `<div class="card"><p>무료 체험 모드에서는 ${wl.length}개의 오답이 기록되었습니다.</p><p style="color:var(--gray-500); font-size:.85rem; margin-top:8px;">로그인하면 오답 문제를 다시 풀고 자동 관리할 수 있습니다.</p>
             <button class="btn btn-primary btn-sm" onclick="app.navigate('login')" style="margin-top:12px;">로그인하기</button></div>`}
      </div>
    `;
    return;
  }

  try {
    const data = await api('/quiz/wrong-answers');
    el.innerHTML = `
      <div class="wrong-list fade-in">
        <h2 style="margin-bottom:20px;"><i class="fas fa-times-circle" style="color:var(--danger)"></i> 오답노트 (${data.total}문제)</h2>
        ${data.total > 0 ? `<button class="btn btn-primary" onclick="startWrongQuiz()" style="margin-bottom:16px;"><i class="fas fa-redo"></i> 오답 문제 풀기</button>` : ''}
        ${data.wrongAnswers.length === 0
          ? '<div class="card" style="text-align:center;"><p>오답 문제가 없습니다! 모든 문제를 맞추셨네요!</p></div>'
          : data.wrongAnswers.map(w => `
            <div class="wrong-item">
              <div class="wrong-item-header">
                <span style="font-weight:600;">${w.year} ${w.subject} Q${w.question_id}</span>
                <div style="display:flex;gap:8px;align-items:center;">
                  <span class="wrong-count-badge">오답 ${w.wrong_count}회</span>
                  ${w.keyword ? `<span class="question-tag keyword">${w.keyword}</span>` : ''}
                </div>
              </div>
              <p style="font-size:.85rem; color:var(--gray-600); overflow:hidden; text-overflow:ellipsis; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;" class="secure-text">
                ${(w.question_text || '').substring(0, 150)}...
              </p>
            </div>
          `).join('')}
      </div>
    `;
  } catch (err) { el.innerHTML = `<p style="color:red">${err.message}</p>`; }
}

async function startWrongQuiz() {
  try {
    const data = await api('/quiz/generate', {
      method: 'POST',
      body: JSON.stringify({ count: 50, filters: {}, quizType: 'wrong_only' })
    });
    if (!data.questions?.length) { showToast('오답 문제가 없습니다.', 'info'); return; }
    app.navigate('quiz', data);
  } catch (err) { showToast(err.message, 'error'); }
}

// ===== Dashboard =====
async function renderDashboard(el) {
  if (!currentUser) {
    const total = guestStats.correct + guestStats.wrong;
    const rate = total > 0 ? (guestStats.correct / total * 100).toFixed(1) : 0;
    el.innerHTML = `
      <div class="fade-in">
        <h2 style="margin-bottom:20px;"><i class="fas fa-chart-bar"></i> 성적 (무료 체험)</h2>
        <div class="stats-grid">
          <div class="stat-card"><div class="stat-value">${total}</div><div class="stat-label">풀이 수</div></div>
          <div class="stat-card success"><div class="stat-value">${guestStats.correct}</div><div class="stat-label">정답</div></div>
          <div class="stat-card danger"><div class="stat-value">${guestStats.wrong}</div><div class="stat-label">오답</div></div>
          <div class="stat-card warning"><div class="stat-value">${rate}%</div><div class="stat-label">정답률</div></div>
        </div>
        <div class="card" style="text-align:center;">
          <p>로그인하면 상세한 성적 분석과 과목별 정답률을 확인할 수 있습니다.</p>
          <button class="btn btn-primary btn-sm" onclick="app.navigate('login')" style="margin-top:12px;">로그인하기</button>
        </div>
      </div>
    `;
    return;
  }

  try {
    const data = await api('/stats/dashboard');
    el.innerHTML = `
      <div class="fade-in">
        <h2 style="margin-bottom:20px;"><i class="fas fa-chart-bar"></i> 내 성적</h2>

        <div class="stats-grid">
          <div class="stat-card"><div class="stat-value">${data.totalQuestions}</div><div class="stat-label">전체 문제</div></div>
          <div class="stat-card"><div class="stat-value">${data.totalAnswered}</div><div class="stat-label">풀이한 문제</div></div>
          <div class="stat-card success"><div class="stat-value">${data.accuracy}%</div><div class="stat-label">정답률</div></div>
          <div class="stat-card danger"><div class="stat-value">${data.wrongCount}</div><div class="stat-label">현재 오답 수</div></div>
        </div>

        <div class="card">
          <div class="card-title">과목별 정답률</div>
          <div class="chart-container">
            ${(data.bySubject || []).map(d => {
              const info = SUBJECTS[d.subject] || {};
              return `
              <div class="chart-bar">
                <div class="chart-label">${d.subject}</div>
                <div class="chart-track">
                  <div class="chart-fill" style="width:${d.accuracy}%; background:${d.accuracy >= 40 ? (info.color || 'var(--success)') : 'var(--danger)'}">
                    <span>${d.accuracy}%</span>
                  </div>
                </div>
                <div class="chart-percent">${d.total}문제</div>
              </div>
            `}).join('')}
          </div>
        </div>

        <div class="card">
          <div class="card-title">년도별 정답률</div>
          <div class="chart-container">
            ${(data.byYear || []).map(d => `
              <div class="chart-bar">
                <div class="chart-label">${d.year}</div>
                <div class="chart-track">
                  <div class="chart-fill" style="width:${d.accuracy}%; background:${d.accuracy >= 60 ? 'var(--success)' : 'var(--danger)'}">
                    <span>${d.accuracy}%</span>
                  </div>
                </div>
                <div class="chart-percent">${d.total}문제</div>
              </div>
            `).join('')}
          </div>
        </div>

        ${(data.byKeyword || []).length > 0 ? `
        <div class="card">
          <div class="card-title">취약 키워드 (정답률 낮은 순)</div>
          <div class="chart-container">
            ${data.byKeyword.map(d => `
              <div class="chart-bar" style="cursor:pointer;" onclick="startKeywordQuiz('${d.keyword}')">
                <div class="chart-label">${d.keyword}</div>
                <div class="chart-track">
                  <div class="chart-fill" style="width:${d.accuracy}%; background:${d.accuracy >= 40 ? 'var(--warning)' : 'var(--danger)'}">
                    <span>${d.accuracy}%</span>
                  </div>
                </div>
                <div class="chart-percent">${d.total}문제</div>
              </div>
            `).join('')}
          </div>
        </div>
        ` : ''}

        ${data.recentSessions?.length ? `
          <div class="card">
            <div class="card-title">최근 시험 기록</div>
            <div style="overflow-x:auto;">
              <table class="admin-table">
                <thead><tr><th>일시</th><th>유형</th><th>과목</th><th>문제 수</th><th>정답</th><th>오답</th><th>점수</th></tr></thead>
                <tbody>
                  ${data.recentSessions.map(s => `
                    <tr>
                      <td>${(s.created_at || '').replace('T', ' ').substring(0, 16)}</td>
                      <td>${s.session_type === 'exam' ? '모의고사' : '연습'}</td>
                      <td>${s.subject || '-'}</td>
                      <td>${s.total_questions}</td>
                      <td style="color:var(--success)">${s.correct_count}</td>
                      <td style="color:var(--danger)">${s.wrong_count}</td>
                      <td style="font-weight:600; color:${s.score >= 60 ? 'var(--success)' : 'var(--danger)'}">${(s.score||0).toFixed(1)}%</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  } catch (err) { el.innerHTML = `<p style="color:red">${err.message}</p>`; }
}

// ===== Admin =====
async function renderAdmin(el) {
  if (!currentUser || currentUser.role !== 'master') { app.navigate('home'); return; }
  let activeTab = 'users';

  async function render() {
    el.innerHTML = `
      <div class="admin-container fade-in">
        <h2 style="margin-bottom:20px;"><i class="fas fa-cog"></i> 관리자 페이지</h2>
        <div class="admin-tabs">
          <button class="admin-tab ${activeTab==='users'?'active':''}" onclick="setAdminTab('users')">회원 관리</button>
          <button class="admin-tab ${activeTab==='stats'?'active':''}" onclick="setAdminTab('stats')">전체 통계</button>
        </div>
        <div id="adminContent"><div class="loading"><div class="spinner"></div>로딩 중...</div></div>
      </div>
    `;
    window.setAdminTab = (t) => { activeTab = t; render(); };
    if (activeTab === 'users') await renderAdminUsers();
    else if (activeTab === 'stats') await renderAdminStats();
  }

  async function renderAdminUsers() {
    try {
      const data = await api('/admin/users');
      const content = document.getElementById('adminContent');
      content.innerHTML = `
        <div class="card">
          <div class="card-title">회원 목록 (${data.users.length}명)</div>
          <div style="overflow-x:auto;">
            <table class="admin-table">
              <thead><tr><th>이메일</th><th>이름</th><th>역할</th><th>상태</th><th>유효기간</th><th>풀이수</th><th>정답률</th><th>관리</th></tr></thead>
              <tbody>
                ${data.users.map(u => {
                  const rate = u.total_answers > 0 ? (u.correct_answers / u.total_answers * 100).toFixed(1) : '-';
                  return `<tr>
                    <td>${u.email}</td>
                    <td>${u.name}</td>
                    <td>${u.role === 'master' ? '<b>마스터</b>' : '일반'}</td>
                    <td><span class="${u.is_active ? 'status-active' : 'status-inactive'}">${u.is_active ? '활성' : '비활성'}</span></td>
                    <td><input type="date" value="${u.expiry_date || ''}" onchange="updateExpiry(${u.id}, this.value)" style="border:1px solid var(--gray-300);border-radius:4px;padding:4px;font-size:.8rem;"></td>
                    <td>${u.total_answers}</td>
                    <td>${rate}%</td>
                    <td>${u.role !== 'master' ? `<button class="btn btn-sm ${u.is_active ? 'btn-danger' : 'btn-success'}" onclick="toggleUser(${u.id})">${u.is_active ? '비활성화' : '활성화'}</button>` : ''}</td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    } catch (err) { document.getElementById('adminContent').innerHTML = `<p style="color:red">${err.message}</p>`; }
  }

  window.updateExpiry = async (id, date) => {
    try {
      await api(`/admin/users/${id}/expiry`, { method: 'POST', body: JSON.stringify({ expiry_date: date }) });
      showToast('유효기간이 수정되었습니다.', 'success');
    } catch (err) { showToast(err.message, 'error'); }
  };

  window.toggleUser = async (id) => {
    try {
      const data = await api(`/admin/users/${id}/toggle`, { method: 'POST' });
      showToast(data.message, 'success');
      render();
    } catch (err) { showToast(err.message, 'error'); }
  };

  async function renderAdminStats() {
    try {
      const overall = await api('/admin/overall-stats');
      const qStats = await api('/admin/question-stats');
      document.getElementById('adminContent').innerHTML = `
        <div class="stats-grid">
          <div class="stat-card"><div class="stat-value">${overall.totalUsers}</div><div class="stat-label">전체 회원</div></div>
          <div class="stat-card success"><div class="stat-value">${overall.activeUsers}</div><div class="stat-label">활성 회원</div></div>
          <div class="stat-card"><div class="stat-value">${overall.totalSessions}</div><div class="stat-label">총 시험 횟수</div></div>
          <div class="stat-card warning"><div class="stat-value">${overall.avgScore}%</div><div class="stat-label">평균 점수</div></div>
        </div>
        <div class="card">
          <div class="card-title">문제별 정답률 (하위 100개)</div>
          <div style="overflow-x:auto;">
            <table class="admin-table">
              <thead><tr><th>ID</th><th>과목</th><th>키워드</th><th>시도 수</th><th>정답률</th></tr></thead>
              <tbody>
                ${(qStats.stats || []).map(s => `
                  <tr>
                    <td>Q${s.question_id}</td>
                    <td>${s.subject || '-'}</td>
                    <td>${s.keyword || '-'}</td>
                    <td>${s.total_attempts}</td>
                    <td style="color:${(s.accuracy_rate * 100) < 50 ? 'var(--danger)' : 'var(--success)'}">${(s.accuracy_rate * 100).toFixed(1)}%</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    } catch (err) { document.getElementById('adminContent').innerHTML = `<p style="color:red">${err.message}</p>`; }
  }

  render();
}

// ===== Init =====
async function init() {
  await checkAuth();
  app.navigate('home');
}

init();
