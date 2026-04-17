/* ========== 공인노무사 Quiz SPA (v2) ========== */
const API = '/api';
let currentUser = null;
let token = localStorage.getItem('cpla_token');
let currentQuiz = null;
let quizTimer = null;
let guestStats = JSON.parse(sessionStorage.getItem('guest_stats') || '{"correct":0,"wrong":0,"wrongList":[],"total":0}');

const SUBJECTS = {
  '노동법1':   { color: '#dc2626', icon: 'fas fa-gavel',       short: '노1' },
  '노동법2':   { color: '#ea580c', icon: 'fas fa-handshake',   short: '노2' },
  '민법':      { color: '#2563eb', icon: 'fas fa-book',        short: '민' },
  '사회보험법':{ color: '#7c3aed', icon: 'fas fa-shield-alt',  short: '사' },
  '경제학':    { color: '#059669', icon: 'fas fa-chart-line',  short: '경제' },
  '경영학':    { color: '#0891b2', icon: 'fas fa-briefcase',   short: '경영' }
};

/* ===== Theme ===== */
function applyTheme(t) {
  if (t === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
  else document.documentElement.removeAttribute('data-theme');
  localStorage.setItem('cpla_theme', t);
  const btn = document.getElementById('themeToggle');
  if (btn) btn.innerHTML = t === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
}
function toggleTheme() {
  const cur = localStorage.getItem('cpla_theme') || 'light';
  applyTheme(cur === 'dark' ? 'light' : 'dark');
}
applyTheme(localStorage.getItem('cpla_theme') || 'light');

/* ===== Security soft-guards ===== */
document.addEventListener('contextmenu', e => { if (e.target.closest('.secure-text')) e.preventDefault(); });
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) e.preventDefault();
  if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) e.preventDefault();
});

/* ===== API helper ===== */
async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(API + path, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'API Error');
  return data;
}

/* ===== Toast ===== */
function showToast(msg, type = 'info') {
  const el = document.createElement('div');
  const icon = type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle';
  el.className = `toast ${type}`;
  el.innerHTML = `<i class="fas ${icon}"></i><span>${msg}</span>`;
  document.getElementById('toastContainer').appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 2600);
}

function toggleMobileMenu() { document.getElementById('headerNav').classList.toggle('show'); }

/* ===== Router ===== */
const app = {
  navigate(page, data) {
    document.getElementById('headerNav').classList.remove('show');
    document.querySelectorAll('[data-page]').forEach(b => {
      b.classList.toggle('active', b.dataset.page === page);
    });
    const container = document.getElementById('app');
    container.innerHTML = '<div class="loading"><div class="spinner"></div>로딩 중...</div>';
    window.scrollTo({ top: 0, behavior: 'instant' });
    switch (page) {
      case 'home': renderHome(container); break;
      case 'login': renderAuth(container); break;
      case 'quiz-setup': renderQuizSetup(container); break;
      case 'quiz': renderQuiz(container, data); break;
      case 'ox-quiz': renderOXQuiz(container, data); break;
      case 'results': renderResults(container, data); break;
      case 'keywords': renderKeywords(container); break;
      case 'wrong-answers': renderWrongAnswers(container); break;
      case 'bookmarks': renderBookmarks(container); break;
      case 'dashboard': renderDashboard(container); break;
      case 'admin': renderAdmin(container); break;
      default: renderHome(container);
    }
  }
};

/* ===== Auth UI ===== */
function updateAuthArea() {
  const area = document.getElementById('authArea');
  if (currentUser) {
    const isMaster = currentUser.role === 'master';
    area.innerHTML = `
      ${isMaster ? '<button onclick="app.navigate(\'admin\')" data-page="admin" title="관리"><i class="fas fa-cog"></i></button>' : ''}
      <button class="theme-toggle" id="themeToggle" onclick="toggleTheme()" title="테마 전환"></button>
      <span class="user-badge"><i class="fas fa-user"></i> ${currentUser.name || currentUser.email.split('@')[0]}</span>
      <button class="btn-ghost btn-sm" onclick="logout()" title="로그아웃"><i class="fas fa-sign-out-alt"></i></button>
    `;
  } else {
    area.innerHTML = `
      <button class="theme-toggle" id="themeToggle" onclick="toggleTheme()" title="테마 전환"></button>
      <span class="guest-badge"><i class="fas fa-user-secret"></i> 무료체험</span>
      <button class="btn btn-primary btn-sm" onclick="app.navigate('login')"><i class="fas fa-sign-in-alt"></i> 로그인</button>
    `;
  }
  applyTheme(localStorage.getItem('cpla_theme') || 'light');
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

/* ===== Home ===== */
async function renderHome(el) {
  let summary = { totalQuestions: 2130, totalYears: 13, totalSubjects: 6, totalKeywords: 600 };
  try { summary = await api('/stats/summary'); } catch {}

  let streakHtml = '';
  let todayHtml = '';
  if (currentUser) {
    try {
      const d = await api('/stats/dashboard');
      if (d.streak > 0) {
        streakHtml = `<div class="streak-badge"><i class="fas fa-fire"></i> ${d.streak}일 연속 학습 중!</div>`;
      }
      if (d.todayCount >= 0) {
        todayHtml = `<div class="streak-badge" style="background:var(--gradient-brand);"><i class="fas fa-bolt"></i> 오늘 ${d.todayCount}문제 풀이</div>`;
      }
    } catch {}
  }

  el.innerHTML = `
    <div class="fade-in">
      <section class="hero">
        <h1 class="hero-title">공인노무사 1차 <span class="badge">${summary.totalYears}년치 기출</span></h1>
        <p class="hero-sub">2013~2025년 모든 기출문제를 키워드로 분류하고, 실제 시험 환경에서 연습하세요. 오답노트·북마크·취약영역 분석까지 한 번에.</p>
        <div class="hero-stats">
          <div class="hero-stat"><div class="num">${summary.totalQuestions.toLocaleString()}</div><div class="lbl">기출문제</div></div>
          <div class="hero-stat"><div class="num">${summary.totalYears}</div><div class="lbl">년치</div></div>
          <div class="hero-stat"><div class="num">${summary.totalSubjects}</div><div class="lbl">과목</div></div>
          <div class="hero-stat"><div class="num">${summary.totalKeywords}+</div><div class="lbl">키워드</div></div>
        </div>
        <div style="display:flex;gap:10px;margin-top:22px;flex-wrap:wrap;">
          <button class="btn btn-xl" style="background:white;color:var(--brand-700);" onclick="app.navigate('quiz-setup')">
            <i class="fas fa-play"></i> 바로 시작하기
          </button>
          ${!currentUser ? `<button class="btn btn-xl" style="background:rgba(255,255,255,.15);color:white;border-color:rgba(255,255,255,.3);" onclick="app.navigate('login')">
            <i class="fas fa-user-plus"></i> 무료 회원가입
          </button>` : ''}
        </div>
      </section>

      ${streakHtml || todayHtml ? `
        <div style="display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap;">${streakHtml}${todayHtml}</div>
      ` : ''}

      <div class="mode-cards">
        <div class="mode-card" onclick="app.navigate('quiz-setup')">
          <div class="mode-card-icon"><i class="fas fa-book-open"></i></div>
          <h3>맞춤 문제풀이</h3>
          <p>과목·년도·키워드로 필터링. 원하는 수만큼 랜덤 출제로 취약 영역을 집중 학습.</p>
        </div>
        <div class="mode-card" onclick="startExamMode()">
          <div class="mode-card-icon warn"><i class="fas fa-stopwatch"></i></div>
          <h3>실전 모의고사</h3>
          <p>200문제 · 200분. 실제 시험과 동일한 환경에서 시간 관리까지 연습.</p>
        </div>
        <div class="mode-card" onclick="startOXFromHome()">
          <div class="mode-card-icon success"><i class="fas fa-random"></i></div>
          <h3>O/X 퀵 퀴즈</h3>
          <p>지문 하나하나를 O/X로 판단. 5지선다를 세분화해서 개념 정확도를 검증.</p>
        </div>
        <div class="mode-card" onclick="app.navigate('keywords')">
          <div class="mode-card-icon"><i class="fas fa-fire"></i></div>
          <h3>고빈도 키워드</h3>
          <p>과목별 출제빈도 1위 키워드부터 30위까지. 클릭 한 번으로 해당 키워드 집중풀이.</p>
        </div>
        <div class="mode-card" onclick="app.navigate('wrong-answers')">
          <div class="mode-card-icon danger"><i class="fas fa-redo"></i></div>
          <h3>오답 복습</h3>
          <p>틀린 문제만 다시. 맞추면 자동 삭제되는 스마트 오답노트.</p>
        </div>
        <div class="mode-card" onclick="app.navigate('dashboard')">
          <div class="mode-card-icon"><i class="fas fa-chart-bar"></i></div>
          <h3>나의 학습 현황</h3>
          <p>과목별·키워드별·년도별 정답률, 185일 학습 히트맵, 시간대 분석까지.</p>
        </div>
      </div>

      <div class="card">
        <div class="card-title"><span><i class="fas fa-th-large title-icon"></i> 과목별 바로가기</span><span class="subtitle">각 355문제 · 클릭 즉시 랜덤 20문제</span></div>
        <div class="subject-grid">
          ${Object.entries(SUBJECTS).map(([name, info]) => `
            <div class="subject-card" onclick="startSubjectQuiz('${name}')">
              <span class="sbj-bar" style="background:${info.color}"></span>
              <i class="${info.icon} sbj-icon" style="color:${info.color}"></i>
              <div class="sbj-name">${name}</div>
              <div class="sbj-count">355문제</div>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="card">
        <div class="card-title"><span><i class="fas fa-calendar-alt title-icon"></i> 회차별 바로풀기</span><span class="subtitle">각 회차 모의시험 환경</span></div>
        <div class="filter-chips">
          ${(function(){
            const years = [];
            for (let y = 2025; y >= 2013; y--) years.push(y);
            return years.map(y => {
              const round = y - 1991; // 2014→23, 2025→34 approx
              return `<div class="chip" onclick="startYearQuiz('${y}년')">${y}년 (제${round}회)</div>`;
            }).join('');
          })()}
        </div>
      </div>

      ${!currentUser ? `
        <div class="card" style="text-align:center; background: var(--gradient-brand); color: white; border:none;">
          <h3 style="color:white; margin-bottom:8px;">회원가입하면 더 많은 기능!</h3>
          <p style="opacity:.9; margin-bottom:16px;">북마크 · 오답노트 · 학습 통계 · 전체 ${summary.totalQuestions}문제 이용</p>
          <button class="btn btn-xl" style="background:white;color:var(--brand-700);" onclick="app.navigate('login')">
            <i class="fas fa-user-plus"></i> 무료 가입하기
          </button>
        </div>
      ` : ''}
    </div>
  `;
  applyTheme(localStorage.getItem('cpla_theme') || 'light');
}

/* ===== Auth Page ===== */
function renderAuth(el) {
  let isLogin = true;
  function render() {
    el.innerHTML = `
      <div class="auth-container fade-in">
        <div class="auth-card">
          <div class="logo-mark" style="width:56px; height:56px; margin:0 auto 14px; border-radius:16px;"><i class="fas fa-balance-scale" style="font-size:1.5rem;"></i></div>
          <h2>노무사 Quiz</h2>
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
              <input class="form-input" type="password" name="password" required minlength="4" placeholder="비밀번호 입력 (4자 이상)">
            </div>
            <button type="submit" class="btn btn-gradient btn-lg" style="width:100%;">
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

/* ===== Quiz Setup ===== */
async function renderQuizSetup(el) {
  try {
    const filters = await api('/quiz/filters');
    let selected = { subjects: [], years: [], keywords: [] };
    let count = 20;
    let mode = 'practice'; // practice / ox

    function render() {
      const isGuest = !currentUser;
      const maxCount = isGuest ? 30 : 200;
      if (count > maxCount) count = maxCount;
      el.innerHTML = `
        <div class="quiz-setup fade-in">
          <h2 style="margin-bottom:16px; display:flex; align-items:center; gap:8px;"><i class="fas fa-sliders-h" style="color:var(--brand-600)"></i> 문제 설정</h2>
          ${isGuest ? `<div class="card" style="background:var(--warning-soft); border:1px solid var(--warning);">
            <p style="font-size:.9rem;"><i class="fas fa-info-circle" style="color:var(--accent-600)"></i> 무료 체험: 최대 30문제. 전체 ${filters.totalQuestions}문제와 오답노트를 이용하려면 <a href="javascript:void(0)" onclick="app.navigate('login')" style="font-weight:700;">로그인</a>하세요.</p>
          </div>` : ''}

          <div class="card">
            <div class="card-title"><span><i class="fas fa-bolt title-icon"></i> 모드</span></div>
            <div class="filter-chips">
              <div class="chip ${mode==='practice'?'selected':''}" onclick="setMode('practice')"><i class="fas fa-pen"></i> 5지선다</div>
              <div class="chip ${mode==='ox'?'selected':''}" onclick="setMode('ox')"><i class="fas fa-check"></i> O/X 퀵퀴즈</div>
            </div>
            ${mode === 'ox' ? '<p style="font-size:.8rem;color:var(--text-muted);margin-top:10px;">5지선다 각 보기를 O/X 문제로 변환해 출제합니다. 개념의 정확성을 빠르게 점검!</p>' : ''}
          </div>

          <div class="card">
            <div class="card-title"><span><i class="fas fa-list-ol title-icon"></i> 출제 문제 수</span><span class="subtitle">${mode==='ox'?'문제 수':'문제 수'}</span></div>
            <div class="range-row">
              <input type="range" min="5" max="${maxCount}" step="5" value="${count}" oninput="updateCount(this.value)">
              <span class="range-value" id="countDisplay">${count}문제</span>
            </div>
          </div>

          <div class="card">
            <div class="card-title"><span><i class="fas fa-th title-icon"></i> 과목 선택</span><span class="subtitle">미선택 시 전체</span></div>
            <div class="filter-chips">
              ${filters.subjects.map(s => {
                const info = SUBJECTS[s] || { color: '#6b7280' };
                const sel = selected.subjects.includes(s);
                return `<div class="chip ${sel?'selected':''}" onclick="toggleFilter('subjects','${s}')" style="${sel ? 'background:'+info.color+';border-color:'+info.color : ''}"><i class="${info.icon}"></i> ${s}</div>`;
              }).join('')}
            </div>
          </div>

          <div class="card">
            <div class="card-title"><span><i class="fas fa-calendar title-icon"></i> 출제년도</span><span class="subtitle">${filters.years.length}개년</span></div>
            <div class="filter-chips">
              ${filters.years.map(y => `<div class="chip ${selected.years.includes(y)?'selected':''}" onclick="toggleFilter('years','${y}')">${y}</div>`).join('')}
            </div>
          </div>

          <div class="card">
            <div class="card-title"><span><i class="fas fa-tags title-icon"></i> 키워드</span><span class="subtitle">${selected.subjects.length?'선택 과목':'전체 과목'} 고빈도 30개</span></div>
            <div class="filter-chips" id="keywordChips">
              ${renderKeywordChips(filters, selected)}
            </div>
          </div>

          <div style="text-align:center; margin-top:24px; display:flex; justify-content:center; gap:10px; flex-wrap:wrap;">
            <button class="btn btn-outline btn-lg" onclick="resetFilters()"><i class="fas fa-undo"></i> 초기화</button>
            <button class="btn btn-gradient btn-xl" onclick="startQuiz()"><i class="fas fa-play"></i> 문제 풀기 시작</button>
          </div>
        </div>
      `;
    }

    function renderKeywordChips(filters, selected) {
      const activeSubjects = selected.subjects.length > 0 ? selected.subjects : Object.keys(filters.topKeywords);
      const seen = new Set();
      const list = [];
      for (const subj of activeSubjects) {
        const kws = filters.topKeywords[subj] || [];
        for (const kw of kws.slice(0, 12)) {
          if (!seen.has(kw.keyword)) { seen.add(kw.keyword); list.push(kw); }
        }
      }
      list.sort((a, b) => b.frequency - a.frequency);
      return list.slice(0, 30).map(kw =>
        `<div class="chip ${selected.keywords.includes(kw.keyword)?'selected':''}" onclick="toggleFilter('keywords','${kw.keyword.replace(/'/g, "\\'")}')">${kw.keyword} <span class="chip-count">${kw.frequency}</span></div>`
      ).join('');
    }

    window.setMode = (m) => { mode = m; render(); };
    window.updateCount = (v) => { count = parseInt(v); document.getElementById('countDisplay').textContent = v + '문제'; };
    window.toggleFilter = (key, val) => {
      const idx = selected[key].indexOf(val);
      if (idx >= 0) selected[key].splice(idx, 1); else selected[key].push(val);
      render();
    };
    window.resetFilters = () => { selected = { subjects: [], years: [], keywords: [] }; count = 20; render(); };
    window.startQuiz = async () => {
      try {
        const activeFilters = {};
        Object.entries(selected).forEach(([k, v]) => { if (v.length) activeFilters[k] = v; });
        const data = await api('/quiz/generate', {
          method: 'POST',
          body: JSON.stringify({ count, filters: activeFilters, quizType: 'practice' })
        });
        if (!data.questions.length) { showToast('조건에 맞는 문제가 없습니다.', 'error'); return; }
        if (mode === 'ox') app.navigate('ox-quiz', data);
        else app.navigate('quiz', data);
      } catch (err) { showToast(err.message, 'error'); }
    };
    render();
  } catch (err) { el.innerHTML = `<div class="card"><p style="color:var(--danger)">필터 로드 실패: ${err.message}</p></div>`; }
}

async function startExamMode() {
  try {
    if (!confirm('실전 모의고사를 시작합니다.\n\n• 200문제\n• 200분 제한\n• 중단 시 세션 종료\n\n계속하시겠습니까?')) return;
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

async function startYearQuiz(year) {
  try {
    const data = await api('/quiz/generate', {
      method: 'POST',
      body: JSON.stringify({ count: 40, filters: { years: [year] }, quizType: 'practice' })
    });
    if (!data.questions?.length) { showToast(`${year} 문제가 없습니다.`, 'error'); return; }
    app.navigate('quiz', data);
  } catch (err) { showToast(err.message, 'error'); }
}

async function startOXFromHome() {
  try {
    const count = currentUser ? 30 : 15;
    const data = await api('/quiz/generate', {
      method: 'POST',
      body: JSON.stringify({ count, filters: {}, quizType: 'practice' })
    });
    if (!data.questions?.length) { showToast('문제가 없습니다.', 'error'); return; }
    app.navigate('ox-quiz', data);
  } catch (err) { showToast(err.message, 'error'); }
}

/* ===== Keywords Page ===== */
async function renderKeywords(el) {
  try {
    const filters = await api('/quiz/filters');
    let activeSubject = Object.keys(filters.topKeywords)[0] || '노동법1';

    function render() {
      const kws = filters.topKeywords[activeSubject] || [];
      const maxFreq = kws[0]?.frequency || 1;

      el.innerHTML = `
        <div class="keywords-container fade-in">
          <h2 style="margin-bottom:16px; display:flex; align-items:center; gap:8px;"><i class="fas fa-fire" style="color:var(--accent-500)"></i> 고빈도 키워드 분석</h2>

          <div class="card">
            <div class="filter-chips">
              ${Object.keys(filters.topKeywords).map(s => {
                const info = SUBJECTS[s] || {};
                const sel = activeSubject === s;
                return `<div class="chip ${sel?'selected':''}" onclick="setKwSubject('${s}')" style="${sel ? 'background:'+(info.color||'var(--brand-600)')+';border-color:'+(info.color||'var(--brand-600)') : ''}"><i class="${info.icon}"></i> ${s}</div>`;
              }).join('')}
            </div>
          </div>

          <div class="card">
            <div class="card-title"><span><i class="fas fa-chart-bar title-icon"></i> ${activeSubject} TOP 30</span><span class="subtitle">클릭 시 해당 키워드 문제풀이</span></div>
            <div class="chart-container">
              ${kws.slice(0, 30).map(kw => {
                const pct = Math.round(kw.frequency / maxFreq * 100);
                const color = pct > 66 ? 'var(--danger)' : pct > 33 ? 'var(--accent-500)' : 'var(--success)';
                return `
                  <div class="chart-bar" style="cursor:pointer;" onclick="startKeywordQuiz('${kw.keyword.replace(/'/g,"\\'")}')">
                    <div class="chart-label">${kw.keyword}</div>
                    <div class="chart-track">
                      <div class="chart-fill" style="width:${Math.max(pct, 8)}%; background:${color}">
                        <span>${kw.frequency}회</span>
                      </div>
                    </div>
                    <div class="chart-percent"><i class="fas fa-play-circle" style="color:var(--brand-500);font-size:1rem;"></i></div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <div class="card">
            <div class="card-title"><span><i class="fas fa-clone title-icon"></i> 키워드 버블 맵</span><span class="subtitle">빨강=매우중요, 주황=중요, 초록=참고</span></div>
            <div class="keyword-grid">
              ${kws.map(kw => {
                const level = kw.frequency > maxFreq * 0.6 ? 'high' : kw.frequency > maxFreq * 0.3 ? 'mid' : 'low';
                return `<div class="keyword-bubble ${level}" onclick="startKeywordQuiz('${kw.keyword.replace(/'/g,"\\'")}')" title="${kw.frequency}회 출제">${kw.keyword}<div style="font-size:.7rem;opacity:.75;margin-top:2px;">${kw.frequency}회</div></div>`;
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
  } catch (err) { el.innerHTML = `<div class="card"><p style="color:var(--danger)">${err.message}</p></div>`; }
}

/* ===== Quiz Interface ===== */
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
      if (timerEl) {
        timerEl.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2, '0')}`;
        timerEl.classList.remove('warn', 'danger');
        if (remaining <= 300) timerEl.classList.add('danger');
        else if (remaining <= 1800) timerEl.classList.add('warn');
      }
      if (remaining <= 0) { clearInterval(quizTimer); showToast('시험 시간이 종료되었습니다.', 'error'); finishQuiz(); }
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

  const timerHtml = currentQuiz.isExam ? `<span class="quiz-timer" id="quizTimer">--:--</span>` : '';

  el.innerHTML = `
    <div class="quiz-container fade-in">
      <div class="quiz-progress">
        <span class="count">${idx + 1} / ${total}</span>
        <div class="progress-bar"><div class="progress-fill" style="width:${progress}%"></div></div>
        <span style="font-size:.8rem; color:var(--text-muted);">${answeredCount}완료</span>
        ${timerHtml}
      </div>

      <div class="question-card secure-text">
        <div class="question-number">
          <span><i class="${subjectInfo.icon}" style="color:${subjectInfo.color}"></i> ${q.year} ${q.subject} Q${q.question_number}</span>
          ${currentUser ? `<button class="btn-bookmark" id="bookmarkBtn_${q.id}" onclick="toggleBookmark(${q.id})" title="북마크"><i class="far fa-bookmark"></i></button>` : ''}
        </div>
        <div class="question-meta">
          <span class="question-tag subject" style="background:${subjectInfo.color}20;color:${subjectInfo.color};border:1px solid ${subjectInfo.color}40;"><i class="${subjectInfo.icon}"></i> ${q.subject}</span>
          ${q.keyword ? q.keyword.split(',').slice(0, 3).map(k => `<span class="question-tag keyword">#${k.trim()}</span>`).join('') : ''}
          <span class="question-tag">${q.year}</span>
        </div>
        <div class="question-text">${q.question_text}</div>

        ${q.image_path ? `<div class="question-image-wrap"><img src="${q.image_path}" alt="문제 이미지" class="question-image" /></div>` : ''}

        ${statements.length > 0 ? `
          <div class="statements-box">
            ${statements.map(s => `<p>${s}</p>`).join('')}
          </div>
        ` : ''}

        <div class="options-list" id="optionsList">
          ${renderOptions(q, answered, result)}
        </div>

        ${result ? renderExplanationBox(q, result, answered) : ''}
      </div>

      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
        <button class="btn btn-outline" onclick="prevQuestion()" ${idx === 0 ? 'disabled' : ''}>
          <i class="fas fa-chevron-left"></i> 이전
        </button>
        <div class="btn-group">
          ${!answered ? `<button class="btn btn-gradient" id="submitBtn" onclick="submitAnswer()"><i class="fas fa-check"></i> 제출</button>` : ''}
          ${idx < total - 1 ? `<button class="btn ${answered ? 'btn-primary' : 'btn-outline'}" onclick="nextQuestion()">다음 <i class="fas fa-chevron-right"></i></button>` : ''}
          ${idx === total - 1 ? `<button class="btn btn-success" onclick="confirmFinish()"><i class="fas fa-flag-checkered"></i> 완료</button>` : ''}
        </div>
        <button class="btn btn-ghost btn-sm" onclick="showQuestionNav()"><i class="fas fa-th"></i> 전체보기 (${answeredCount}/${total})</button>
      </div>
    </div>
  `;
  if (currentUser && q.id) checkBookmarkStatus(q.id);
}

function renderOptions(q, answered, result) {
  const opts = [q.option_1, q.option_2, q.option_3, q.option_4, q.option_5].filter(o => o && String(o).trim());
  let html = '';
  for (let i = 0; i < opts.length; i++) {
    const num = i + 1;
    let classes = 'option-item';
    let icon = '';

    if (result) {
      classes += ' disabled';
      if (num === result.correctAnswer) { classes += ' correct'; icon = '<i class="fas fa-check-circle option-check"></i>'; }
      if (num === parseInt(answered) && num !== result.correctAnswer) { classes += ' wrong'; icon = '<i class="fas fa-times-circle option-check"></i>'; }
    } else {
      if (currentQuiz._tempSelected === num) classes += ' selected';
    }

    html += `
      <div class="${classes}" onclick="selectOption(${num})">
        <span class="option-label">${num}</span>
        <span class="option-text">${String(opts[i]).replace(/^[①-⑤]\s*|^\d+\.\s*/,'')}</span>
        ${icon}
      </div>
    `;
  }
  return html;
}

function renderExplanationBox(q, result, answered) {
  const correct = result.correct;
  const aiExp = result.aiExplanation || '';
  const aiHtml = aiExp ? formatAIExplanation(aiExp) : '';
  return `
    <div class="explanation-box">
      <div class="explanation-header ${correct ? 'correct' : 'wrong'}">
        <i class="fas ${correct ? 'fa-check-circle' : 'fa-times-circle'}"></i>
        <span>${correct ? '정답입니다!' : `오답입니다. 정답: ${result.correctAnswer}번`}</span>
      </div>
      <div class="explanation-body">
        <h5>해설</h5>
        <p>${result.explanation || '해설이 준비 중입니다.'}</p>
        ${result.keyword ? `<h5>관련 키워드</h5><div class="kw-row">${result.keyword.split(',').map(k => `<span class="question-tag keyword">#${k.trim()}</span>`).join('')}</div>` : ''}
        ${aiExp ? `
          <div class="ai-exp-section">
            <button class="ai-exp-toggle" onclick="toggleAIExp(this)">
              <span class="ai-exp-label"><i class="fas fa-robot"></i> AI 상세해설</span>
              <i class="fas fa-chevron-down ai-exp-chevron"></i>
            </button>
            <div class="ai-exp-body" style="display:none;">
              ${aiHtml}
              <div class="ai-exp-note"><i class="fas fa-info-circle"></i> 이 해설은 문제·키워드·기존해설을 기반으로 구조화하여 생성되었습니다.</div>
            </div>
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

/* AI 해설 텍스트 → HTML 변환 (섹션 헤더 강조) */
function formatAIExplanation(text) {
  if (!text) return '';
  // Escape HTML
  let t = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // Highlight section headers 【...】
  t = t.replace(/【([^】]+)】/g, '<h6 class="ai-section-title">$1</h6>');
  // Bullets (lines starting with •)
  t = t.replace(/^• (.+)$/gm, '<li>$1</li>');
  t = t.replace(/(<li>[\s\S]*?<\/li>(?:\n<li>[\s\S]*?<\/li>)*)/g, '<ul class="ai-bullets">$1</ul>');
  // Paragraph breaks
  t = t.split(/\n\n+/).map(para => {
    if (/^<(h6|ul)/.test(para.trim())) return para;
    return '<p>' + para.replace(/\n/g, '<br>') + '</p>';
  }).join('');
  return t;
}

window.toggleAIExp = function(btn) {
  const body = btn.nextElementSibling;
  const chevron = btn.querySelector('.ai-exp-chevron');
  if (body.style.display === 'none') {
    body.style.display = 'block';
    chevron.style.transform = 'rotate(180deg)';
    btn.classList.add('open');
  } else {
    body.style.display = 'none';
    chevron.style.transform = 'rotate(0deg)';
    btn.classList.remove('open');
  }
};

function selectOption(num) {
  const q = currentQuiz.questions[currentQuiz.currentIndex];
  if (currentQuiz.results[q.id]) return;
  currentQuiz._tempSelected = num;
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
      guestStats.total = (guestStats.total || 0) + 1;
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
  let cells = '';
  for (let i = 0; i < total; i++) {
    const q = currentQuiz.questions[i];
    const answered = currentQuiz.answers[q.id];
    const result = currentQuiz.results[q.id];
    let cls = 'qg-cell';
    if (result?.correct) cls += ' correct';
    else if (result && !result.correct) cls += ' wrong';
    else if (answered) cls += ' answered';
    if (i === currentQuiz.currentIndex) cls += ' current';
    cells += `<div class="${cls}" onclick="goToQuestion(${i})">${i + 1}</div>`;
  }
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  overlay.innerHTML = `
    <div class="modal">
      <h3><i class="fas fa-th" style="color:var(--brand-600)"></i> 문제 목록 (${total}문제)</h3>
      <div class="qg-legend">
        <span><span class="sw" style="background:var(--gray-200)"></span>미풀이</span>
        <span><span class="sw" style="background:var(--brand-500)"></span>제출됨</span>
        <span><span class="sw" style="background:var(--success)"></span>정답</span>
        <span><span class="sw" style="background:var(--danger)"></span>오답</span>
      </div>
      <div class="question-grid">${cells}</div>
      <div class="modal-actions">
        <button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">닫기</button>
      </div>
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

function confirmFinish() {
  const total = currentQuiz.questions.length;
  const answered = Object.keys(currentQuiz.answers).length;
  const unanswered = total - answered;
  if (unanswered > 0) {
    if (!confirm(`아직 ${unanswered}문제가 남았습니다. 정말 제출하시겠습니까?`)) return;
  }
  finishQuiz();
}

async function finishQuiz() {
  if (quizTimer) { clearInterval(quizTimer); quizTimer = null; }
  try {
    const timeSpent = Math.floor((Date.now() - currentQuiz.startTime) / 1000);
    if (currentQuiz.sessionId) {
      const result = await api('/quiz/complete', {
        method: 'POST',
        body: JSON.stringify({ sessionId: currentQuiz.sessionId, timeSpent })
      });
      app.navigate('results', { ...result, timeSpent, isExam: currentQuiz.isExam });
    } else {
      const total = currentQuiz.questions.length;
      const correct = Object.values(currentQuiz.results).filter(r => r.correct).length;
      const wrong = Object.values(currentQuiz.results).filter(r => !r.correct).length;
      const score = total > 0 ? (correct / total * 100) : 0;
      app.navigate('results', { total, correct, wrong, score: Math.round(score * 10) / 10, passed: score >= 60, timeSpent, isExam: currentQuiz.isExam });
    }
  } catch (err) { showToast(err.message, 'error'); }
}

/* ===== O/X Quiz ===== */
function renderOXQuiz(el, data) {
  if (!data || !data.questions?.length) { app.navigate('home'); return; }

  // Expand each 5-choice question into 5 O/X items
  const oxItems = [];
  for (const q of data.questions) {
    const opts = [q.option_1, q.option_2, q.option_3, q.option_4, q.option_5].filter(o => o && String(o).trim());
    for (let i = 0; i < opts.length; i++) {
      oxItems.push({
        _source: q,
        optionIndex: i + 1,
        optionText: String(opts[i]).replace(/^[①-⑤]\s*|^\d+\.\s*/, ''),
        expectedAnswer: (i + 1) === q.correct_answer ? 'O' : 'X'
      });
    }
  }
  // Shuffle
  for (let i = oxItems.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [oxItems[i], oxItems[j]] = [oxItems[j], oxItems[i]];
  }

  const quiz = { items: oxItems.slice(0, Math.min(oxItems.length, data.questions.length * 5)), index: 0, answers: [], startTime: Date.now() };

  function renderOX() {
    const it = quiz.items[quiz.index];
    if (!it) return;
    const total = quiz.items.length;
    const idx = quiz.index;
    const q = it._source;
    const subjectInfo = SUBJECTS[q.subject] || {};
    const prev = quiz.answers[idx];
    const progress = ((idx + 1) / total * 100).toFixed(1);

    el.innerHTML = `
      <div class="quiz-container fade-in">
        <div class="quiz-progress">
          <span class="count">${idx + 1} / ${total}</span>
          <div class="progress-bar"><div class="progress-fill" style="width:${progress}%"></div></div>
          <span style="font-size:.8rem; color:var(--text-muted);">O/X 모드</span>
        </div>
        <div class="question-card secure-text">
          <div class="question-number">
            <span><i class="${subjectInfo.icon}" style="color:${subjectInfo.color}"></i> ${q.year} ${q.subject} Q${q.question_number} · 보기 ${it.optionIndex}</span>
          </div>
          <div class="question-meta">
            <span class="question-tag subject" style="background:${subjectInfo.color}20;color:${subjectInfo.color};"><i class="${subjectInfo.icon}"></i> ${q.subject}</span>
            ${q.keyword ? q.keyword.split(',').slice(0, 2).map(k => `<span class="question-tag keyword">#${k.trim()}</span>`).join('') : ''}
          </div>
          <div class="question-text" style="font-size:.95rem; color:var(--text-muted); margin-bottom:12px;">${q.question_text}</div>
          <div class="statements-box" style="border-left-color:var(--accent-500); background:var(--warning-soft); font-size:1rem;">
            <p><strong>이 보기는 정답/옳은 설명인가요?</strong></p>
            <p style="margin-top:8px;">${it.optionText}</p>
          </div>
          <div class="ox-buttons" id="oxBtns">
            ${prev ? renderOXButtonsDone(it, prev) : `
              <button class="ox-btn o" onclick="answerOX('O')"><i class="fas fa-circle"></i> O (맞다)</button>
              <button class="ox-btn x" onclick="answerOX('X')"><i class="fas fa-times"></i> X (아니다)</button>
            `}
          </div>
          ${prev ? renderOXExplanation(it, prev) : ''}
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
          <button class="btn btn-outline" onclick="prevOX()" ${idx === 0 ? 'disabled' : ''}><i class="fas fa-chevron-left"></i> 이전</button>
          <div class="btn-group">
            ${idx < total - 1 ? `<button class="btn btn-primary" onclick="nextOX()">다음 <i class="fas fa-chevron-right"></i></button>` : `<button class="btn btn-success" onclick="finishOX()"><i class="fas fa-flag-checkered"></i> 완료</button>`}
          </div>
        </div>
      </div>
    `;
  }

  function renderOXButtonsDone(it, prev) {
    return `
      <button class="ox-btn o ${prev.chosen==='O' ? (prev.correct?'correct':'wrong'):''}" disabled><i class="fas fa-circle"></i> O</button>
      <button class="ox-btn x ${prev.chosen==='X' ? (prev.correct?'correct':'wrong'):''}" disabled><i class="fas fa-times"></i> X</button>
    `;
  }
  function renderOXExplanation(it, prev) {
    return `
      <div class="explanation-box" style="margin-top:16px;">
        <div class="explanation-header ${prev.correct ? 'correct':'wrong'}">
          <i class="fas ${prev.correct ? 'fa-check-circle':'fa-times-circle'}"></i>
          <span>${prev.correct ? '정답!' : '오답'}  · 정답: ${it.expectedAnswer}</span>
        </div>
        <div class="explanation-body">
          <h5>원문제 정답</h5>
          <p><strong>${it._source.correct_answer}번</strong> · ${it.expectedAnswer === 'O' ? '이 보기가 정답입니다.' : '이 보기는 정답이 아닙니다.'}</p>
          ${it._source.explanation ? `<h5>해설</h5><p>${it._source.explanation}</p>` : ''}
        </div>
      </div>
    `;
  }

  window.answerOX = (chosen) => {
    const it = quiz.items[quiz.index];
    const correct = chosen === it.expectedAnswer;
    quiz.answers[quiz.index] = { chosen, correct };
    renderOX();
  };
  window.nextOX = () => { quiz.index++; renderOX(); };
  window.prevOX = () => { if (quiz.index > 0) { quiz.index--; renderOX(); } };
  window.finishOX = () => {
    const total = quiz.items.length;
    const answered = quiz.answers.filter(Boolean).length;
    const correct = quiz.answers.filter(a => a?.correct).length;
    const wrong = answered - correct;
    const score = answered > 0 ? (correct / answered * 100) : 0;
    const timeSpent = Math.floor((Date.now() - quiz.startTime) / 1000);
    app.navigate('results', {
      total: answered, correct, wrong, score: Math.round(score * 10) / 10,
      passed: score >= 60, timeSpent, isExam: false, mode: 'OX'
    });
  };
  renderOX();
}

/* ===== Results ===== */
function renderResults(el, data) {
  if (!data) { app.navigate('home'); return; }
  const scoreClass = data.score >= 60 ? 'pass' : 'fail';
  const minutes = Math.floor((data.timeSpent || 0) / 60);
  const seconds = (data.timeSpent || 0) % 60;
  const label = data.passed ? (data.isExam ? '합격 수준입니다!' : '훌륭합니다!') : '조금 더 공부해요!';

  el.innerHTML = `
    <div class="results-container fade-in">
      <div class="results-hero ${scoreClass}">
        <div style="font-size:.85rem; opacity:.9;"><i class="fas fa-${data.isExam?'stopwatch':'star'}"></i> ${data.mode === 'OX' ? 'O/X 퀵퀴즈 결과' : (data.isExam ? '실전 모의고사 결과' : '문제풀이 결과')}</div>
        <div class="results-score">${data.score}<span style="font-size:.3em;">%</span></div>
        <div class="results-msg">${label}</div>
        <div class="results-note">소요시간: ${minutes}분 ${seconds}초 · ${data.total}문제 중 ${data.correct}정답</div>
      </div>

      <div class="results-details">
        <div class="result-item"><div class="value" style="color:var(--text-strong)">${data.total}</div><div class="label">전체 문제</div></div>
        <div class="result-item"><div class="value" style="color:var(--success)">${data.correct}</div><div class="label">정답</div></div>
        <div class="result-item"><div class="value" style="color:var(--danger)">${data.wrong}</div><div class="label">오답</div></div>
        <div class="result-item"><div class="value" style="color:var(--brand-600)">${((data.correct/(data.total||1))*100).toFixed(0)}%</div><div class="label">정답률</div></div>
      </div>

      <div class="btn-group" style="justify-content:center; margin-top:24px;">
        <button class="btn btn-gradient btn-lg" onclick="app.navigate('quiz-setup')"><i class="fas fa-redo"></i> 다시 풀기</button>
        ${currentUser ? `<button class="btn btn-outline btn-lg" onclick="app.navigate('wrong-answers')"><i class="fas fa-list"></i> 오답 확인</button>
        <button class="btn btn-outline btn-lg" onclick="app.navigate('dashboard')"><i class="fas fa-chart-bar"></i> 성적 보기</button>` : ''}
      </div>
    </div>
  `;
  currentQuiz = null;
}

/* ===== Wrong Answers ===== */
async function renderWrongAnswers(el) {
  if (!currentUser) {
    const wl = guestStats.wrongList || [];
    el.innerHTML = `
      <div class="wrong-list fade-in">
        <h2 style="margin-bottom:16px;"><i class="fas fa-times-circle" style="color:var(--danger)"></i> 오답노트</h2>
        ${wl.length === 0
          ? '<div class="card" style="text-align:center;"><p>오답 문제가 없습니다. 문제를 풀어보세요!</p></div>'
          : `<div class="card"><p>무료 체험 모드에서 ${wl.length}개의 오답을 기록했습니다.</p>
             <p style="color:var(--text-muted); font-size:.85rem; margin-top:8px;">로그인하면 오답 문제를 다시 풀고 자동 관리할 수 있습니다.</p>
             <button class="btn btn-primary" onclick="app.navigate('login')" style="margin-top:12px;">로그인하기</button></div>`}
      </div>
    `;
    return;
  }

  try {
    const data = await api('/quiz/wrong-answers');
    el.innerHTML = `
      <div class="wrong-list fade-in">
        <h2 style="margin-bottom:16px; display:flex;align-items:center;gap:8px;"><i class="fas fa-times-circle" style="color:var(--danger)"></i> 오답노트 <span style="font-size:.9rem;color:var(--text-muted);font-weight:500;">(${data.total}문제)</span></h2>
        ${data.total > 0 ? `<button class="btn btn-gradient btn-lg" onclick="startWrongQuiz()" style="margin-bottom:16px;"><i class="fas fa-redo"></i> 오답 문제 풀기</button>` : ''}
        ${data.wrongAnswers.length === 0
          ? '<div class="card" style="text-align:center; padding:40px;"><i class="fas fa-trophy" style="font-size:3rem;color:var(--accent-500);margin-bottom:12px;"></i><p style="font-size:1.05rem;font-weight:600;">오답 문제가 없습니다!</p><p style="color:var(--text-muted);margin-top:6px;">모든 문제를 맞추셨네요.</p></div>'
          : data.wrongAnswers.map(w => {
              const sub = SUBJECTS[w.subject] || {};
              return `<div class="wrong-item">
              <div class="wrong-item-header">
                <span style="font-weight:700;"><i class="${sub.icon}" style="color:${sub.color}"></i> ${w.year} ${w.subject} Q${w.question_id}</span>
                <div style="display:flex;gap:6px;align-items:center;">
                  <span class="wrong-count-badge">오답 ${w.wrong_count}회</span>
                  ${w.keyword ? `<span class="question-tag keyword">#${w.keyword.split(',')[0]}</span>` : ''}
                </div>
              </div>
              <p style="font-size:.85rem; color:var(--text-muted); overflow:hidden; text-overflow:ellipsis; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;" class="secure-text">
                ${(w.question_text || '').substring(0, 180)}...
              </p>
            </div>`;
          }).join('')}
      </div>
    `;
  } catch (err) { el.innerHTML = `<p style="color:var(--danger)">${err.message}</p>`; }
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

/* ===== Bookmarks ===== */
async function renderBookmarks(el) {
  if (!currentUser) {
    el.innerHTML = `
      <div class="fade-in">
        <h2 style="margin-bottom:16px;"><i class="fas fa-bookmark" style="color:var(--accent-500)"></i> 북마크</h2>
        <div class="card" style="text-align:center;"><p>북마크 기능은 로그인 후 이용할 수 있습니다.</p>
          <button class="btn btn-primary" onclick="app.navigate('login')" style="margin-top:12px;">로그인하기</button>
        </div>
      </div>`;
    return;
  }
  try {
    const data = await api('/quiz/bookmarks');
    el.innerHTML = `
      <div class="fade-in">
        <h2 style="margin-bottom:16px;"><i class="fas fa-bookmark" style="color:var(--accent-500)"></i> 북마크 <span style="font-size:.9rem;color:var(--text-muted);font-weight:500;">(${data.total}문제)</span></h2>
        ${data.total > 0 ? `<button class="btn btn-gradient btn-lg" onclick="startBookmarkQuiz()" style="margin-bottom:16px;"><i class="fas fa-play"></i> 북마크 문제 풀기</button>` : ''}
        ${data.bookmarks.length === 0
          ? '<div class="card" style="text-align:center;padding:40px;"><i class="far fa-bookmark" style="font-size:3rem;color:var(--brand-400);margin-bottom:12px;"></i><p>아직 북마크한 문제가 없습니다.</p><p style="color:var(--text-muted);font-size:.85rem;margin-top:6px;">문제 풀이 중 북마크 버튼을 눌러 저장해보세요.</p></div>'
          : data.bookmarks.map(b => {
              const sub = SUBJECTS[b.subject] || {};
              return `<div class="wrong-item" style="border-left-color:var(--accent-500);">
              <div class="wrong-item-header">
                <span style="font-weight:700;"><i class="${sub.icon}" style="color:${sub.color}"></i> ${b.year} ${b.subject} Q${b.question_id}</span>
                <div style="display:flex;gap:6px;align-items:center;">
                  ${b.keyword ? `<span class="question-tag keyword">#${b.keyword.split(',')[0]}</span>` : ''}
                  <button class="btn btn-outline btn-sm" onclick="removeBookmark(${b.question_id})" title="북마크 삭제"><i class="fas fa-trash"></i></button>
                </div>
              </div>
              <p style="font-size:.85rem; color:var(--text-muted); overflow:hidden; text-overflow:ellipsis; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical;" class="secure-text">
                ${(b.question_text || '').substring(0, 220)}
              </p>
            </div>`;
          }).join('')}
      </div>`;
  } catch (err) { el.innerHTML = `<p style="color:var(--danger)">${err.message}</p>`; }
}

async function startBookmarkQuiz() {
  try {
    const data = await api('/quiz/bookmarks');
    if (!data.bookmarks?.length) { showToast('북마크한 문제가 없습니다.', 'info'); return; }
    const questions = data.bookmarks.map(b => ({
      id: b.question_id, year: b.year, subject: b.subject, question_number: b.question_id,
      question_text: b.question_text, option_1: b.option_1, option_2: b.option_2, option_3: b.option_3,
      option_4: b.option_4, option_5: b.option_5, keyword: b.keyword, statements: b.statements,
      image_path: b.image_path, correct_answer: b.correct_answer
    }));
    app.navigate('quiz', { questions, sessionId: null, total: questions.length });
  } catch (err) { showToast(err.message, 'error'); }
}

async function toggleBookmark(questionId) {
  if (!currentUser) { showToast('북마크는 로그인 후 이용할 수 있습니다.', 'info'); return; }
  const btn = document.getElementById(`bookmarkBtn_${questionId}`);
  if (!btn) return;
  const icon = btn.querySelector('i');
  const isBookmarked = icon.classList.contains('fas');
  try {
    if (isBookmarked) {
      await api(`/quiz/bookmark/${questionId}`, { method: 'DELETE' });
      icon.classList.remove('fas'); icon.classList.add('far');
      btn.classList.remove('active');
      showToast('북마크 해제', 'info');
    } else {
      await api('/quiz/bookmark', { method: 'POST', body: JSON.stringify({ questionId }) });
      icon.classList.remove('far'); icon.classList.add('fas');
      btn.classList.add('active');
      showToast('북마크 추가!', 'success');
    }
  } catch (err) { showToast(err.message, 'error'); }
}

async function removeBookmark(questionId) {
  if (!confirm('북마크를 삭제하시겠습니까?')) return;
  try {
    await api(`/quiz/bookmark/${questionId}`, { method: 'DELETE' });
    showToast('삭제되었습니다.', 'info');
    renderBookmarks(document.getElementById('app'));
  } catch (err) { showToast(err.message, 'error'); }
}

async function checkBookmarkStatus(questionId) {
  if (!currentUser) return;
  try {
    const data = await api(`/quiz/bookmark-status/${questionId}`);
    const btn = document.getElementById(`bookmarkBtn_${questionId}`);
    if (btn && data.bookmarked) {
      const icon = btn.querySelector('i');
      icon.classList.remove('far'); icon.classList.add('fas');
      btn.classList.add('active');
    }
  } catch (err) {}
}

/* ===== Dashboard ===== */
function renderRingChart(pct, size = 120, label = '', sub = '', color = 'var(--brand-600)') {
  const r = 44, c = 2 * Math.PI * r;
  const off = c - (pct / 100) * c;
  return `
    <svg class="ring-svg" viewBox="0 0 100 100" width="${size}" height="${size}">
      <circle class="ring-track" cx="50" cy="50" r="${r}"></circle>
      <circle class="ring-fill" cx="50" cy="50" r="${r}"
        stroke="${color}" stroke-dasharray="${c}" stroke-dashoffset="${off}"></circle>
      <text class="ring-label" x="50" y="52" dy=".35em">${label}</text>
      ${sub ? `<text class="ring-sub" x="50" y="70">${sub}</text>` : ''}
    </svg>
  `;
}

function renderHeatmap(calendar) {
  const days = 182;
  const map = {};
  (calendar || []).forEach(r => { map[r.day] = r.cnt; });
  const cells = [];
  const today = new Date();
  let maxCnt = 1;
  Object.values(map).forEach(v => { if (v > maxCnt) maxCnt = v; });
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today); d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const cnt = map[key] || 0;
    let level = 0;
    if (cnt > 0) {
      const pct = cnt / maxCnt;
      if (pct > 0.66) level = 4;
      else if (pct > 0.33) level = 3;
      else if (pct > 0.1) level = 2;
      else level = 1;
    }
    cells.push(`<div class="heatmap-cell ${level>0?'l'+level:''}" title="${key}: ${cnt}문제"></div>`);
  }
  return `
    <div class="heatmap">${cells.join('')}</div>
    <div class="heatmap-legend">
      적음
      <span class="sw" style="background:var(--gray-200)"></span>
      <span class="sw heatmap-cell l1"></span>
      <span class="sw heatmap-cell l2"></span>
      <span class="sw heatmap-cell l3"></span>
      <span class="sw heatmap-cell l4"></span>
      많음
    </div>
  `;
}

function renderHourChart(byHour) {
  const data = new Array(24).fill(0);
  (byHour || []).forEach(r => { data[r.hour] = r.cnt; });
  const max = Math.max(1, ...data);
  const bars = data.map((v, h) => {
    const pct = Math.round(v / max * 100);
    return `<div style="display:flex;flex-direction:column;align-items:center;gap:4px;flex:1;min-width:20px;">
      <div style="height:60px;width:70%;background:var(--gray-100);border-radius:4px;display:flex;align-items:flex-end;overflow:hidden;">
        <div style="width:100%;height:${pct}%;background:var(--gradient-brand);border-radius:4px 4px 0 0;transition:height .5s;"></div>
      </div>
      <div style="font-size:.65rem;color:var(--text-muted);">${h}</div>
    </div>`;
  }).join('');
  return `<div style="display:flex;gap:2px;align-items:flex-end;">${bars}</div>`;
}

async function renderDashboard(el) {
  if (!currentUser) {
    const total = guestStats.correct + guestStats.wrong;
    const rate = total > 0 ? (guestStats.correct / total * 100).toFixed(1) : 0;
    el.innerHTML = `
      <div class="fade-in">
        <h2 style="margin-bottom:16px;"><i class="fas fa-chart-bar" style="color:var(--brand-600)"></i> 학습 현황 <span style="font-size:.8rem;color:var(--text-muted);">(무료 체험)</span></h2>
        <div class="stats-grid">
          <div class="stat-card"><div class="stat-value">${total}</div><div class="stat-label">풀이 수</div></div>
          <div class="stat-card success"><div class="stat-value">${guestStats.correct}</div><div class="stat-label">정답</div></div>
          <div class="stat-card danger"><div class="stat-value">${guestStats.wrong}</div><div class="stat-label">오답</div></div>
          <div class="stat-card warning"><div class="stat-value">${rate}%</div><div class="stat-label">정답률</div></div>
        </div>
        <div class="card" style="text-align:center;padding:40px;">
          <i class="fas fa-lock" style="font-size:2rem;color:var(--brand-400);margin-bottom:10px;"></i>
          <p>로그인하면 <strong>185일 학습 히트맵, 과목별 정답률, 취약 키워드, 시간대 분석</strong>을 볼 수 있습니다.</p>
          <button class="btn btn-gradient" onclick="app.navigate('login')" style="margin-top:16px;">로그인하기</button>
        </div>
      </div>
    `;
    return;
  }

  try {
    const data = await api('/stats/dashboard');
    const accuracyColor = data.accuracy >= 60 ? 'var(--success)' : data.accuracy >= 40 ? 'var(--accent-500)' : 'var(--danger)';

    el.innerHTML = `
      <div class="fade-in">
        <h2 style="margin-bottom:16px; display:flex; align-items:center; gap:8px;"><i class="fas fa-chart-bar" style="color:var(--brand-600)"></i> 학습 현황</h2>

        <div class="stats-grid">
          <div class="stat-card"><div class="stat-value">${data.totalAnswered.toLocaleString()}</div><div class="stat-label">푼 문제 수</div></div>
          <div class="stat-card success"><div class="stat-value">${data.correctTotal.toLocaleString()}</div><div class="stat-label">정답</div></div>
          <div class="stat-card danger"><div class="stat-value">${data.wrongCount}</div><div class="stat-label">현재 오답</div></div>
          <div class="stat-card warning"><div class="stat-value">${data.bookmarkCount || 0}</div><div class="stat-label">북마크</div></div>
        </div>

        <div class="card">
          <div class="card-title"><span><i class="fas fa-bullseye title-icon"></i> 전체 정답률 · 학습 진척도</span></div>
          <div class="ring-wrap">
            ${renderRingChart(data.accuracy, 140, data.accuracy + '%', '정답률', accuracyColor)}
            ${renderRingChart(Math.min(100, Math.round(data.totalAnswered / data.totalQuestions * 100)), 140, Math.round(data.totalAnswered / data.totalQuestions * 100) + '%', '진척도', 'var(--brand-600)')}
            <div style="flex:1; min-width:200px;">
              <p style="font-size:.85rem;color:var(--text-muted);margin-bottom:10px;">누적 학습 현황</p>
              <div style="display:flex;flex-direction:column;gap:6px;font-size:.9rem;">
                <div style="display:flex;justify-content:space-between;"><span>전체 문제</span><strong>${data.totalQuestions.toLocaleString()}</strong></div>
                <div style="display:flex;justify-content:space-between;"><span>시도한 문제</span><strong>${data.totalAnswered.toLocaleString()}</strong></div>
                <div style="display:flex;justify-content:space-between;"><span>미시도 문제</span><strong>${(data.totalQuestions - data.totalAnswered).toLocaleString()}</strong></div>
                <div style="display:flex;justify-content:space-between;"><span>연속 학습</span><strong style="color:var(--accent-500);">${data.streak || 0}일 🔥</strong></div>
              </div>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-title"><span><i class="fas fa-calendar-alt title-icon"></i> 학습 캘린더</span><span class="subtitle">최근 182일</span></div>
          ${renderHeatmap(data.calendar)}
        </div>

        <div class="card">
          <div class="card-title"><span><i class="fas fa-clock title-icon"></i> 시간대별 학습 패턴</span><span class="subtitle">24시간</span></div>
          ${renderHourChart(data.byHour)}
        </div>

        <div class="card">
          <div class="card-title"><span><i class="fas fa-layer-group title-icon"></i> 과목별 정답률</span></div>
          <div class="chart-container">
            ${(data.bySubject || []).map(d => {
              const info = SUBJECTS[d.subject] || {};
              const color = d.accuracy >= 60 ? 'var(--success)' : d.accuracy >= 40 ? 'var(--accent-500)' : 'var(--danger)';
              return `
              <div class="chart-bar">
                <div class="chart-label">${d.subject}</div>
                <div class="chart-track">
                  <div class="chart-fill" style="width:${Math.max(d.accuracy, 8)}%; background:${color}">
                    <span>${d.accuracy}%</span>
                  </div>
                </div>
                <div class="chart-percent">${d.total}문</div>
              </div>
            `}).join('') || '<p style="color:var(--text-muted);">아직 풀이한 문제가 없습니다.</p>'}
          </div>
        </div>

        <div class="card">
          <div class="card-title"><span><i class="fas fa-calendar title-icon"></i> 년도별 정답률</span></div>
          <div class="chart-container">
            ${(data.byYear || []).map(d => {
              const color = d.accuracy >= 60 ? 'var(--success)' : d.accuracy >= 40 ? 'var(--accent-500)' : 'var(--danger)';
              return `
                <div class="chart-bar">
                  <div class="chart-label">${d.year}</div>
                  <div class="chart-track">
                    <div class="chart-fill" style="width:${Math.max(d.accuracy, 8)}%; background:${color}">
                      <span>${d.accuracy}%</span>
                    </div>
                  </div>
                  <div class="chart-percent">${d.total}문</div>
                </div>
              `;
            }).join('') || '<p style="color:var(--text-muted);">아직 풀이한 문제가 없습니다.</p>'}
          </div>
        </div>

        ${(data.byKeyword || []).length > 0 ? `
        <div class="card">
          <div class="card-title"><span><i class="fas fa-exclamation-triangle title-icon" style="color:var(--danger)"></i> 취약 키워드 TOP 20</span><span class="subtitle">클릭 시 집중 풀이</span></div>
          <div class="chart-container">
            ${data.byKeyword.map(d => {
              const color = d.accuracy >= 50 ? 'var(--accent-500)' : 'var(--danger)';
              return `
                <div class="chart-bar" style="cursor:pointer;" onclick="startKeywordQuiz('${d.keyword.replace(/'/g,"\\'")}')">
                  <div class="chart-label">${d.keyword}</div>
                  <div class="chart-track">
                    <div class="chart-fill" style="width:${Math.max(d.accuracy, 8)}%; background:${color}">
                      <span>${d.accuracy}%</span>
                    </div>
                  </div>
                  <div class="chart-percent">${d.total}문</div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
        ` : ''}

        ${data.recentSessions?.length ? `
          <div class="card">
            <div class="card-title"><span><i class="fas fa-history title-icon"></i> 최근 시험 기록</span></div>
            <div style="overflow-x:auto;">
              <table class="admin-table">
                <thead><tr><th>일시</th><th>유형</th><th>과목</th><th>문제</th><th>정답</th><th>오답</th><th>점수</th></tr></thead>
                <tbody>
                  ${data.recentSessions.map(s => `
                    <tr>
                      <td>${(s.completed_at || s.created_at || '').replace('T', ' ').substring(0, 16)}</td>
                      <td>${s.session_type === 'exam' ? '<span style="color:var(--danger);font-weight:700;">모의고사</span>' : '연습'}</td>
                      <td>${s.subject || '전체'}</td>
                      <td>${s.total_questions}</td>
                      <td style="color:var(--success);font-weight:600;">${s.correct_count}</td>
                      <td style="color:var(--danger);font-weight:600;">${s.wrong_count}</td>
                      <td style="font-weight:700; color:${s.score >= 60 ? 'var(--success)' : 'var(--danger)'}">${(s.score||0).toFixed(1)}%</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  } catch (err) { el.innerHTML = `<p style="color:var(--danger)">${err.message}</p>`; }
}

/* ===== Admin ===== */
async function renderAdmin(el) {
  if (!currentUser || currentUser.role !== 'master') { app.navigate('home'); return; }
  let activeTab = 'users';

  async function render() {
    el.innerHTML = `
      <div class="admin-container fade-in">
        <h2 style="margin-bottom:16px;"><i class="fas fa-cog"></i> 관리자 페이지</h2>
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
              <thead><tr><th>이메일</th><th>이름</th><th>역할</th><th>상태</th><th>유효기간</th><th>풀이</th><th>정답률</th><th>관리</th></tr></thead>
              <tbody>
                ${data.users.map(u => {
                  const rate = u.total_answers > 0 ? (u.correct_answers / u.total_answers * 100).toFixed(1) : '-';
                  return `<tr>
                    <td>${u.email}</td>
                    <td>${u.name}</td>
                    <td>${u.role === 'master' ? '<b>마스터</b>' : '일반'}</td>
                    <td><span class="${u.is_active ? 'status-active' : 'status-inactive'}">${u.is_active ? '활성' : '비활성'}</span></td>
                    <td><input type="date" value="${u.expiry_date || ''}" onchange="updateExpiry(${u.id}, this.value)" style="border:1px solid var(--border);border-radius:6px;padding:4px;font-size:.8rem;background:var(--surface);color:var(--text);"></td>
                    <td>${u.total_answers}</td>
                    <td>${rate}${rate!=='-'?'%':''}</td>
                    <td>${u.role !== 'master' ? `<button class="btn btn-sm ${u.is_active ? 'btn-danger' : 'btn-success'}" onclick="toggleUser(${u.id})">${u.is_active ? '비활성' : '활성'}</button>` : ''}</td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    } catch (err) { document.getElementById('adminContent').innerHTML = `<p style="color:var(--danger)">${err.message}</p>`; }
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
              <thead><tr><th>ID</th><th>과목</th><th>키워드</th><th>시도</th><th>정답률</th></tr></thead>
              <tbody>
                ${(qStats.stats || []).map(s => `
                  <tr>
                    <td>Q${s.question_id}</td>
                    <td>${s.subject || '-'}</td>
                    <td>${s.keyword || '-'}</td>
                    <td>${s.total_attempts}</td>
                    <td style="color:${(s.accuracy_rate * 100) < 50 ? 'var(--danger)' : 'var(--success)'};font-weight:700;">${(s.accuracy_rate * 100).toFixed(1)}%</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    } catch (err) { document.getElementById('adminContent').innerHTML = `<p style="color:var(--danger)">${err.message}</p>`; }
  }

  render();
}

/* ===== Init ===== */
async function init() {
  await checkAuth();
  app.navigate('home');
}

init();
