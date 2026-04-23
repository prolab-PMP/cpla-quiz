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
      // key -> ts(number) as 저장순 rank
      bookmarks:{},
      // { review: 'added'|'numAsc'|'recent', fav: ... }
      sortPref:{ review:'added', fav:'added' },
      // { title, ids:[key], answers:[1..5|null], mode, startedAt, timer, remaining, savedAt }
      resume: null,
    };
  }
  function saveState(s){
    localStorage.setItem(STORE_KEY, JSON.stringify(s));
  }

  // ---- 필터 ----
  function getProblems(){
    // window.PROBLEMS는 서버가 /api/problems로부터 받아 세팅한 것이 우선 (access-controlled)
    // 없으면 data/problems.js 에 정적으로 포함된 PROBLEMS 사용 (로컬/비로그인 fallback — 실제 서버는 빈 배열 반환)
    return window.__FILTERED_PROBLEMS__ || window.PROBLEMS || [];
  }

  // ---- 서버에서 사용자 맞춤 문제 불러오기 (로그인·접근권한 반영) ----
  window.__ACCESS__ = null;
  async function fetchAccessControlled(){
    try {
      const r = await fetch('/api/problems');
      const j = await r.json();
      window.__ACCESS__ = j;
      if (Array.isArray(j.problems)) window.__FILTERED_PROBLEMS__ = j.problems;
      return j;
    } catch(e){ console.warn('[ACCESS] /api/problems fetch 실패', e); return null; }
  }
  // 페이지 로드 시 자동으로 한 번 호출. 서버가 응답하면 페이지 내 getProblems()가
  // 필터된 목록을 반환하게 됨. 단, 이미 렌더된 UI는 갱신되지 않으므로 페이지별
  // 초기화 시점에 CPLA.refreshOrWait() 을 사용하면 좋음.
  if (typeof window !== 'undefined') {
    window.__ACCESS_READY__ = fetchAccessControlled();
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
    const bySubject = {}, byYear = {};
    for(const p of problems){
      const a = state.attempts[p.key];
      const sub = p.subject, yr = p.year;
      if (!bySubject[sub]) bySubject[sub] = { a:0, c:0, total:0 };
      if (!byYear[yr]) byYear[yr] = { a:0, c:0, total:0 };
      bySubject[sub].total++; byYear[yr].total++;
      if(a){
        solved++;
        bySubject[sub].a++; byYear[yr].a++;
        if(a.correct){ correct++; bySubject[sub].c++; byYear[yr].c++; }
        else wrong++;
      }
      if(state.bookmarks[p.key]) bookmark++;
    }
    return {
      total: problems.length, solved, correct, wrong, bookmark,
      accuracy: solved? Math.round(correct/solved*1000)/10 : 0,
      progress: problems.length? Math.round(solved/problems.length*1000)/10 : 0,
      bySubject, byYear,
    };
  }

  // ---- 진도율 커버리지 (ring + bars 용) ----
  function computeCoverage(problems){
    const state = loadState();
    const seenAll = Object.keys(state.attempts).length;
    const totalAll = problems.length;
    const coveragePct = totalAll ? (seenAll/totalAll*100) : 0;
    const subjects = [...new Set(problems.map(p=>p.subject))];
    const bars = subjects.map(sub => {
      const subProblems = problems.filter(p=>p.subject===sub);
      const seen = subProblems.filter(p=>state.attempts[p.key]).length;
      return { subject: sub, seen, total: subProblems.length,
        pct: subProblems.length ? (seen/subProblems.length*100) : 0 };
    });
    return { seenAll, totalAll, coveragePct, bars };
  }

  // ---- 추천 엔진: "오늘의 10문항" ----
  function pickRecommended(problems, n=10, seed=Date.now()){
    if(!problems.length) return [];
    const state = loadState();
    const stats = calcStats(problems);

    // 약점 과목
    let weakSubj = null;
    for (const [s, v] of Object.entries(stats.bySubject)){
      if (!v.a) continue;
      const acc = v.c/v.a;
      if (!weakSubj || acc < weakSubj.acc) weakSubj = { s, acc };
    }
    // 약점 연도: 전체 평균 미만
    const accEntries = Object.entries(stats.byYear)
      .map(([y,v]) => v.a ? { y, acc:v.c/v.a } : null).filter(Boolean);
    const avgAcc = accEntries.length
      ? accEntries.reduce((s,x)=>s+x.acc,0)/accEntries.length : 1;
    const weakYears = new Set(accEntries.filter(x=>x.acc<avgAcc).map(x=>x.y));
    const seen = new Set(Object.keys(state.attempts));
    const wrong = new Set(Object.keys(state.attempts).filter(k=>state.attempts[k].correct===false));

    // seeded RNG
    let rs = seed >>> 0;
    const rnd = () => (rs = (rs*1664525 + 1013904223) >>> 0) / 0xFFFFFFFF;

    const scored = problems.map(q => {
      let sc = 0;
      if (weakSubj && q.subject === weakSubj.s) sc += 3;
      if (weakYears.has(q.year)) sc += 2;
      if (!seen.has(q.key)) sc += 2;
      if (wrong.has(q.key)) sc += 4;
      sc += rnd();
      return { q, s: sc };
    });
    const wrongPool = scored.filter(x=>wrong.has(x.q.key)).sort((a,b)=>b.s-a.s);
    const nonWrong  = scored.filter(x=>!wrong.has(x.q.key)).sort((a,b)=>b.s-a.s);
    const picked = [], pickedKeys = new Set();
    const take = (list, max) => {
      for (const x of list) {
        if (picked.length >= n) break;
        if (pickedKeys.has(x.q.key)) continue;
        picked.push(x.q); pickedKeys.add(x.q.key);
        if (max && picked.length >= max) break;
      }
    };
    take(wrongPool, Math.min(2, n));
    take(nonWrong);
    take(wrongPool);
    // seeded shuffle
    for (let i = picked.length-1; i > 0; i--){
      const j = Math.floor(rnd()*(i+1));
      [picked[i], picked[j]] = [picked[j], picked[i]];
    }
    return { picks: picked.slice(0,n), weakSubj: weakSubj?weakSubj.s:null, weakSubjAcc: weakSubj?weakSubj.acc:null };
  }

  // ---- Resume 스냅샷 ----
  function saveResume(snap){ const s=loadState(); s.resume=snap; saveState(s); }
  function loadResume(){ return loadState().resume || null; }
  function clearResume(){ const s=loadState(); s.resume=null; saveState(s); }

  // ---- Sort pref ----
  function getSortPref(){ return loadState().sortPref || { review:'added', fav:'added' }; }
  function setSortPref(kind, mode){
    const s = loadState();
    s.sortPref = s.sortPref || { review:'added', fav:'added' };
    s.sortPref[kind] = mode;
    saveState(s);
  }
  // kind = 'review' | 'fav'; returns sorted problems
  function sortProblems(problems, mode){
    const state = loadState();
    const list = problems.slice();
    if (mode === 'numAsc') {
      list.sort((a,b)=>a.year.localeCompare(b.year) || a.subject.localeCompare(b.subject) || a.num-b.num);
    } else if (mode === 'recent') {
      list.sort((a,b)=>{
        const ta = state.attempts[a.key]?.ts || state.bookmarks[a.key] || 0;
        const tb = state.attempts[b.key]?.ts || state.bookmarks[b.key] || 0;
        return tb - ta;
      });
    } else { // 'added' — 저장 순서 (ts 오름차순)
      list.sort((a,b)=>{
        const ta = state.attempts[a.key]?.ts || state.bookmarks[a.key] || 0;
        const tb = state.attempts[b.key]?.ts || state.bookmarks[b.key] || 0;
        return ta - tb;
      });
    }
    return list;
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
            <a href="subjects.html" ${active==='subjects'?'class="active" aria-current="page"':''}>📚 과목·키워드</a>
            <a href="years.html" ${active==='years'?'class="active" aria-current="page"':''}>📅 연도별</a>
            <a href="dashboard.html" ${active==='dashboard'?'class="active" aria-current="page"':''}>📊 학습통계</a>
          </nav>
          <div class="header-actions">
            <div id="auth-slot" style="display:flex;gap:6px;align-items:center"></div>
            <button class="icon-btn" id="cpla-help-btn" title="키보드 단축키 (?)" aria-label="키보드 단축키 도움말 열기">⌨️</button>
            <button class="icon-btn" id="cpla-theme-btn" title="다크모드 토글 (Shift+D)" aria-label="다크모드 전환">${isDark?'☀️':'🌙'}</button>
          </div>
        </div>
      </header>`;
    document.body.insertAdjacentHTML("afterbegin", header);

    // 이벤트 바인딩
    document.getElementById('cpla-theme-btn').onclick = CPLA.toggleTheme;
    document.getElementById('cpla-help-btn').onclick = CPLA.openShortcutHelp;
    // Auth 슬롯 자동 렌더
    renderAuthSlot();

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
    let m = document.getElementById('cpla-shortcut-modal');
    if (!m) {
      m = document.createElement('div');
      m.id = 'cpla-shortcut-modal';
      m.className = 'modal-overlay';
      m.setAttribute('role','dialog');
      m.setAttribute('aria-modal','true');
      m.setAttribute('aria-labelledby','cpla-shortcut-title');
      m.innerHTML = `
        <div class="modal" onclick="event.stopPropagation()">
          <button class="close" aria-label="닫기" id="cpla-shortcut-close">×</button>
          <h3 id="cpla-shortcut-title">⌨️ 키보드 단축키</h3>
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
    const m = document.getElementById('cpla-shortcut-modal');
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

  // ---- Auth 슬롯 렌더 ----
  async function renderAuthSlot(){
    const slot = document.getElementById('auth-slot');
    if (!slot) return;
    try {
      const r = await fetch('/api/me');
      const j = await r.json();
      const u = j.user;
      if (!u) {
        slot.innerHTML = `
          <a class="btn sm" href="login.html">로그인</a>
          <a class="btn sm primary" href="signup.html">가입</a>`;
      } else {
        const badge = u.is_admin ? '<span class="chip purple">관리자</span>'
          : (u.isPremiumActive ? '<span class="chip green">Premium</span>' : '<span class="chip">무료</span>');
        slot.innerHTML = `
          <span class="desc" style="font-size:12px;margin-right:4px">${u.email}</span>
          ${badge}
          ${u.is_admin ? '<a class="btn sm" href="admin.html">관리자</a>' : ''}
          <button class="btn sm" id="btn-logout">로그아웃</button>`;
        document.getElementById('btn-logout').onclick = async () => {
          await fetch('/api/logout', { method:'POST' });
          location.reload();
        };
      }
    } catch(e){ /* 네트워크 실패 시 아무것도 안 함 */ }
  }

  // ---- 내보내기 ----
  window.CPLA = {
    loadState, saveState, getProblems, filterByMode, calcStats,
    computeCoverage, pickRecommended,
    saveResume, loadResume, clearResume,
    getSortPref, setSortPref, sortProblems,
    fetchAccessControlled, renderAuthSlot,
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
