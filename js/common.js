/* ==== 공인노무사 문제풀이 공통 스크립트 ==== */
(function(){
  // ---- 테마 (다크모드) — body 그리기 전에 적용 ----
  const THEME_KEY = "cpla_theme";
  try {
    const t = localStorage.getItem(THEME_KEY);
    if (t === 'dark') document.documentElement.setAttribute('data-theme','dark');
  } catch(e){}

  // ---- 서비스 워커 등록 (PWA 오프라인 지원) ----
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('service-worker.js').catch(err => {
        // 조용히 실패 — file:// 등 지원 안 되는 환경에서도 UX 영향 없음
        console.debug('[CPLA] SW register skipped:', err && err.message);
      });
    });
  }

  // ---- 데이터 유틸 ----
  const STORE_KEY = "cpla_study_state_v1";

  function loadState(){
    try{
      const raw = localStorage.getItem(STORE_KEY);
      if(!raw) return defaultState();
      const s = JSON.parse(raw);
      return Object.assign(defaultState(), s);
    }catch(e){ return defaultState(); }
  }
  function defaultState(){
    return {
      // key -> { answer:number, correct:bool, ts:number }
      attempts:{},
      // key set
      bookmarks:{},
    };
  }
  function saveState(s){
    localStorage.setItem(STORE_KEY, JSON.stringify(s));
  }

  // ---- 필터 ----
  function getProblems(){
    return window.PROBLEMS || [];
  }
  function filterByMode(){
    const params = new URLSearchParams(location.search);
    const mode = params.get("mode") || "all";
    const year = params.get("year");
    const subject = params.get("subject");
    const keyword = params.get("keyword");
    const onlyWrong = params.get("wrong") === "1";
    const onlyBookmark = params.get("bookmark") === "1";
    const state = loadState();

    let list = getProblems().slice();
    if(mode === "year" && year) list = list.filter(p => p.year === year);
    if(mode === "subject" && subject) list = list.filter(p => p.subject === subject);
    if(mode === "keyword" && keyword) list = list.filter(p => (p.keywords||[]).includes(keyword));
    if(onlyWrong){
      list = list.filter(p => { const a = state.attempts[p.key]; return a && a.correct === false; });
    }
    if(onlyBookmark){
      list = list.filter(p => state.bookmarks[p.key]);
    }
    // 정렬: 연도(오름차순) → 과목 → 번호
    list.sort((a,b)=> a.year.localeCompare(b.year) || a.subject.localeCompare(b.subject) || a.num - b.num);
    return {list, mode, year, subject, keyword, onlyWrong, onlyBookmark};
  }

  // ---- 계산 ----
  function calcStats(problems){
    const state = loadState();
    let solved=0, correct=0, wrong=0, bookmark=0;
    for(const p of problems){
      const a = state.attempts[p.key];
      if(a){ solved++; if(a.correct) correct++; else wrong++; }
      if(state.bookmarks[p.key]) bookmark++;
    }
    return {
      total: problems.length, solved, correct, wrong, bookmark,
      accuracy: solved? Math.round(correct/solved*1000)/10 : 0,
      progress: problems.length? Math.round(solved/problems.length*1000)/10 : 0
    };
  }

  // ---- 네비 렌더 ----
  function renderHeader(active){
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const header = `
      <header class="site-header">
        <div class="inner">
          <a href="index.html" class="brand" aria-label="홈으로 가기 - 공인노무사 기출문제 풀이">
            <span class="dot" aria-hidden="true">산</span>
            <span>공인노무사</span><small>1차 기출문제 풀이</small>
          </a>
          <nav class="nav" aria-label="주 메뉴">
            <a href="index.html" ${active==='home'?'class="active" aria-current="page"':''}>🏠 홈</a>
            <a href="years.html" ${active==='years'?'class="active" aria-current="page"':''}>📅 연도별</a>
            <a href="subjects.html" ${active==='subjects'?'class="active" aria-current="page"':''}>📚 과목·키워드</a>
            <a href="dashboard.html" ${active==='dashboard'?'class="active" aria-current="page"':''}>📊 학습통계</a>
          </nav>
          <div class="header-actions">
            <button class="icon-btn" id="cpla-help-btn" title="키보드 단축키 (?)" aria-label="키보드 단축키 도움말 열기">⌨️</button>
            <button class="icon-btn" id="cpla-theme-btn" title="다크모드 토글 (Shift+D)" aria-label="다크모드 전환">${isDark?'☀️':'🌙'}</button>
          </div>
        </div>
      </header>`;
    document.body.insertAdjacentHTML("afterbegin", header);

    // 이벤트 바인딩
    document.getElementById('cpla-theme-btn').onclick = CPLA.toggleTheme;
    document.getElementById('cpla-help-btn').onclick = CPLA.openShortcutHelp;

    // 전역 단축키
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === '?' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); CPLA.openShortcutHelp(); }
      else if ((e.key === 'D' || e.key === 'd') && e.shiftKey) { e.preventDefault(); CPLA.toggleTheme(); }
      else if (e.key === 'Escape') CPLA.closeShortcutHelp();
    });
  }

  // ---- 다크모드 토글 ----
  function toggleTheme(){
    const cur = document.documentElement.getAttribute('data-theme');
    const next = cur === 'dark' ? 'light' : 'dark';
    if (next === 'dark') document.documentElement.setAttribute('data-theme','dark');
    else document.documentElement.removeAttribute('data-theme');
    try { localStorage.setItem(THEME_KEY, next); } catch(e){}
    const btn = document.getElementById('cpla-theme-btn');
    if (btn) btn.textContent = next === 'dark' ? '☀️' : '🌙';
  }

  // ---- 키보드 단축키 도움말 ----
  function openShortcutHelp(){
    let m = document.getElementById('sas-shortcut-modal');
    if (!m) {
      m = document.createElement('div');
      m.id = 'sas-shortcut-modal';
      m.className = 'modal-overlay';
      m.setAttribute('role','dialog');
      m.setAttribute('aria-modal','true');
      m.setAttribute('aria-labelledby','sas-shortcut-title');
      m.innerHTML = `
        <div class="modal" onclick="event.stopPropagation()">
          <button class="close" aria-label="닫기" id="cpla-shortcut-close">×</button>
          <h3 id="sas-shortcut-title">⌨️ 키보드 단축키</h3>
          <div class="shortcut-list">
            <span class="keys"><kbd>←</kbd> <kbd>→</kbd></span><span>이전 / 다음 문제</span>
            <span class="keys"><kbd>1</kbd>~<kbd>5</kbd></span><span>선택지 ①~⑤ 고르기 (시험 모드에선 자동 저장)</span>
            <span class="keys"><kbd>Enter</kbd></span><span>채점하기</span>
            <span class="keys"><kbd>B</kbd></span><span>북마크 토글 (문제풀이 화면)</span>
            <span class="keys"><kbd>N</kbd></span><span>안 푼 문제로 점프 (문제풀이 화면)</span>
            <span class="keys"><kbd>Shift</kbd>+<kbd>D</kbd></span><span>다크모드 전환</span>
            <span class="keys"><kbd>?</kbd></span><span>이 도움말 창 열기</span>
            <span class="keys"><kbd>Esc</kbd></span><span>모달 닫기</span>
          </div>
          <p class="desc" style="margin-top:14px;font-size:12px">입력창·텍스트 영역에 포커스 되어 있을 때는 단축키가 동작하지 않습니다.</p>
          <p class="desc" style="margin-top:6px;font-size:12px">⏱️ <strong>시험 모드</strong>는 URL 끝에 <code>&exam=1</code> 을 붙이면 진입합니다. 150분 타이머가 시작되고 정답·해설은 최종 제출 후에 공개됩니다.</p>
        </div>`;
      document.body.appendChild(m);
      m.onclick = () => CPLA.closeShortcutHelp();
      m.querySelector('#cpla-shortcut-close').onclick = () => CPLA.closeShortcutHelp();
    }
    m.classList.add('open');
  }
  function closeShortcutHelp(){
    const m = document.getElementById('sas-shortcut-modal');
    if (m) m.classList.remove('open');
  }

  // ---- 토스트 ----
  function toast(msg, ms){
    let t = document.getElementById('sas-toast');
    if (!t){
      t = document.createElement('div');
      t.id = 'sas-toast';
      t.className = 'toast';
      t.setAttribute('role','status');
      t.setAttribute('aria-live','polite');
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t.__hideTimer);
    t.__hideTimer = setTimeout(() => t.classList.remove('show'), ms || 2200);
  }

  // ---- 풀이 기록 Export / Import ----
  function exportState(){
    const s = loadState();
    const payload = {
      type: 'sas-study-state',
      version: 1,
      exportedAt: new Date().toISOString(),
      data: s
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const ts = new Date().toISOString().slice(0,10);
    a.href = url; a.download = `sas-study-${ts}.json`;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 100);
    toast('풀이 기록을 파일로 저장했어요');
  }
  function importState(file, cb){
    const fr = new FileReader();
    fr.onload = () => {
      try {
        const p = JSON.parse(fr.result);
        if (!p || p.type !== 'sas-study-state' || !p.data) throw new Error('bad format');
        const merged = Object.assign(defaultState(), loadState());
        merged.attempts = Object.assign({}, merged.attempts, p.data.attempts || {});
        merged.bookmarks = Object.assign({}, merged.bookmarks, p.data.bookmarks || {});
        saveState(merged);
        toast(`가져오기 완료: 시도 ${Object.keys(p.data.attempts||{}).length}건, 북마크 ${Object.keys(p.data.bookmarks||{}).length}건`);
        if (typeof cb === 'function') cb(true);
      } catch(e){
        toast('잘못된 파일 형식입니다');
        if (typeof cb === 'function') cb(false);
      }
    };
    fr.readAsText(file);
  }
  function renderFooter(){
    const f = `<footer class="footer">
      공인노무사 1차 기출문제 풀이 사이트 · 데이터 기준 2013~2025년 · 총 ${getProblems().length}문제<br>
      <small>본 자료는 학습 목적으로 제공되며, 공식 정답은 한국산업인력공단 발표를 따릅니다.</small>
    </footer>`;
    document.body.insertAdjacentHTML("beforeend", f);
  }

  // ---- 내보내기 ----
  window.CPLA = {
    loadState, saveState, getProblems, filterByMode, calcStats,
    renderHeader, renderFooter,
    toggleTheme, openShortcutHelp, closeShortcutHelp, toast,
    exportState, importState,
    toggleBookmark(key){
      const s = loadState();
      if(s.bookmarks[key]) delete s.bookmarks[key]; else s.bookmarks[key] = Date.now();
      saveState(s); return !!s.bookmarks[key];
    },
    recordAttempt(key, answer, correct){
      const s = loadState();
      s.attempts[key] = {answer, correct, ts: Date.now()};
      saveState(s);
    },
    resetAll(){ localStorage.removeItem(STORE_KEY); },
    hasImage(p){ return !!((p.images && p.images.length) || (p.choice_images && Object.keys(p.choice_images).length)); },
    circleNum(i){ return ["①","②","③","④","⑤"][i] || String(i+1); }
  };
})();
