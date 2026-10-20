/**
 * 검색 유입용 공개 기출문제·해설 페이지 (서버 렌더링, 로그인 불필요)
 *   /q                         전체 연도·과목 목록
 *   /q/:year                   해당 연도 문항 목록
 *   /q/:year/:subject/:num     문항별 문제·정답·해설
 *   /q/kw/:keyword             키워드별 기출 모음
 *   /sitemap.xml               위 페이지 전체 포함
 */
module.exports = function mountSeo(app, PROBLEMS, opt) {
  const BASE = 'https://' + opt.host;
  const EXAM = opt.exam;                 // 예: '산업안전지도사'
  const LEVEL = opt.level || '1차';
  const roundOf = opt.roundOf || (y => '');
  const C = ['①', '②', '③', '④', '⑤'];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const enc = encodeURIComponent;
  const strip = s => String(s || '').replace(/^\s*\d+\.\s*/, '').replace(/\$([^$]*)\$/g, '$1');
  const short = (s, n) => { s = strip(s).replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
  const ansList = a => a === 12345 ? [1, 2, 3, 4, 5] : (Array.isArray(a) ? a : [a]);
  const ansText = a => { const L = ansList(a); return L.length === 5 ? '전항정답' : L.map(x => C[x - 1] || x).join(', '); };

  // ── 색인 ──
  const subjects = [];
  const byYear = {}, byKey = {}, byKw = {};
  for (const p of PROBLEMS) {
    if (!subjects.includes(p.subject)) subjects.push(p.subject);
    (byYear[p.year] = byYear[p.year] || []).push(p);
    byKey[p.year + '|' + p.subject + '|' + p.num] = p;
    for (const k of (p.keywords || [])) (byKw[k] = byKw[k] || []).push(p);
  }
  const years = Object.keys(byYear).sort((a, b) => b.localeCompare(a));
  const order = (a, b) => a.year !== b.year ? b.year.localeCompare(a.year) : (subjects.indexOf(a.subject) - subjects.indexOf(b.subject)) || (a.num - b.num);
  const urlOf = p => `/q/${p.year}/${enc(p.subject)}/${p.num}`;
  const kwUrl = k => `/q/kw/${enc(k)}`;
  const KW_MIN = 2;
  const kwList = Object.keys(byKw).filter(k => byKw[k].length >= KW_MIN).sort((a, b) => byKw[b].length - byKw[a].length || a.localeCompare(b));
  const topKw = (subj, n) => {
    const c = {};
    for (const p of PROBLEMS) if (!subj || p.subject === subj) for (const k of (p.keywords || [])) c[k] = (c[k] || 0) + 1;
    return Object.entries(c).filter(e => e[1] >= KW_MIN).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n);
  };

  const CSS = `
  body{margin:0;background:#f1f5f9;color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR',sans-serif;line-height:1.65}
  a{color:#2563eb;text-decoration:none}a:hover{text-decoration:underline}
  .top{background:#0f172a;color:#fff;padding:12px 16px}.top a{color:#fff;font-weight:700}
  .wrap{max-width:860px;margin:0 auto;padding:16px}
  .crumb{font-size:13px;color:#64748b;margin:4px 0 10px}
  h1{font-size:22px;line-height:1.4;margin:6px 0 14px}h2{font-size:18px;margin:26px 0 10px}
  .card{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:18px;margin:12px 0;box-shadow:0 1px 3px rgba(15,23,42,.06)}
  .q{font-size:17px;font-weight:600}.pass{background:#fafafa;border-left:3px solid #cbd5e1;padding:8px 12px;margin:10px 0;white-space:pre-wrap;font-size:15px}
  ol.ch{list-style:none;padding:0;margin:12px 0}ol.ch li{padding:8px 12px;border:1px solid #e2e8f0;border-radius:8px;margin:6px 0}
  ol.ch li.ok{border-color:#16a34a;background:#dcfce7;font-weight:600}
  .ans{font-size:16px;font-weight:700;color:#16a34a}.exp{white-space:pre-wrap}
  .tags a{display:inline-block;background:#dbeafe;color:#1d4ed8;border-radius:999px;padding:3px 10px;margin:3px 4px 3px 0;font-size:13px}
  .nav{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;margin:16px 0}
  .btn{display:inline-block;background:#2563eb;color:#fff!important;padding:10px 16px;border-radius:10px;font-weight:700}
  .btn.sub{background:#fff;color:#2563eb!important;border:1px solid #2563eb}
  .cta{background:#0f172a;color:#e2e8f0;border-radius:14px;padding:18px;margin:22px 0}.cta b{color:#fff}
  ul.list{padding-left:18px}ul.list li{margin:4px 0}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
  .grid a{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:10px;text-align:center}
  img.qi{max-width:100%;height:auto;border:1px solid #e2e8f0;border-radius:8px;margin:8px 0}
  details summary{cursor:pointer;font-weight:700;color:#2563eb}
  footer{color:#64748b;font-size:13px;text-align:center;padding:24px 16px}`;

  function page({ title, desc, path, body, ld, crumbs }) {
    const canon = BASE + path;
    const crumbLd = crumbs ? { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c[0], item: BASE + c[1] })) } : null;
    const lds = [crumbLd, ld].filter(Boolean).map(x => `<script type="application/ld+json">${JSON.stringify(x).replace(/</g, '\\u003c')}</script>`).join('\n');
    const crumbHtml = crumbs ? `<div class="crumb">${crumbs.map((c, i) => i === crumbs.length - 1 ? esc(c[0]) : `<a href="${c[1]}">${esc(c[0])}</a>`).join(' › ')}</div>` : '';
    return `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${canon}"><meta name="robots" content="index,follow">
<meta property="og:type" content="article"><meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${canon}">
<meta property="og:image" content="${BASE}/images/icon-512.png"><meta property="og:locale" content="ko_KR">
<style>${CSS}</style>${lds}</head><body>
<div class="top"><a href="/">${esc(EXAM)} ${esc(LEVEL)} 기출문제 풀이</a> · <a href="/q">연도별 기출·해설</a></div>
<div class="wrap">${crumbHtml}${body}</div>
<footer>${esc(EXAM)} ${esc(LEVEL)} 기출문제·해설 · 공식 정답은 한국산업인력공단 발표를 따릅니다.<br>사업자명: 더송도 | 사업자등록번호: 877-04-02518</footer>
</body></html>`;
  }

  const cta = (p) => `<div class="cta"><b>회원가입하면 이 문제를 직접 풀고 채점까지</b><br>
연도별 실전 모의고사 · 고빈도 키워드 집중 풀이 · 오답노트 · 성적 분석을 PC·모바일에서 이용할 수 있습니다.<br><br>
<a class="btn" href="/exam.html?mode=year&year=${p ? p.year : years[0]}">이 회차 직접 풀어보기</a>
<a class="btn sub" href="/signup.html">무료 회원가입</a></div>`;

  function send(res, html) {
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(html);
  }

  // ── /q 허브 ──
  app.get(['/q', '/q/'], (req, res) => {
    const yearsHtml = years.map(y => `<a href="/q/${y}">${y}년 ${esc(roundOf(y))}<br><small>${byYear[y].length}문항</small></a>`).join('');
    const subjHtml = subjects.map(s => {
      const t = topKw(s, 12);
      return `<h2>${esc(s)} 고빈도 키워드</h2><div class="tags">${t.map(([k, n]) => `<a href="${kwUrl(k)}">${esc(k)} (${n})</a>`).join('')}</div>`;
    }).join('');
    send(res, page({
      title: `${EXAM} ${LEVEL} 기출문제 해설 전체 (${years[years.length - 1]}~${years[0]}) | 연도별·키워드별`,
      desc: `${EXAM} ${LEVEL} ${years[years.length - 1]}~${years[0]}년 기출문제 ${PROBLEMS.length}문항 전체 정답과 해설. 연도별, 과목별, 고빈도 키워드별로 확인하세요.`,
      path: '/q', crumbs: [['홈', '/'], ['기출문제 해설', '/q']],
      body: `<h1>${esc(EXAM)} ${esc(LEVEL)} 기출문제·해설 (${years[years.length - 1]}~${years[0]}년, ${PROBLEMS.length}문항)</h1>
<p>모든 문항의 정답과 해설을 공개합니다. 연도를 고르거나 자주 출제되는 키워드로 모아 보세요.</p>
<h2>연도별 기출문제</h2><div class="grid">${yearsHtml}</div>${subjHtml}${cta(null)}`
    }));
  });

  // ── /q/kw/:keyword ──
  app.get('/q/kw/:kw', (req, res, next) => {
    const k = req.params.kw;
    const list = (byKw[k] || []).slice().sort(order);
    if (list.length < 1) return next();
    const groups = {};
    for (const p of list) (groups[p.subject] = groups[p.subject] || []).push(p);
    const body = Object.keys(groups).map(s => `<h2>${esc(s)} (${groups[s].length})</h2><ul class="list">${groups[s].map(p => `<li><a href="${urlOf(p)}">${p.year}년 ${p.num}번</a> — ${esc(short(p.question, 70))}</li>`).join('')}</ul>`).join('');
    const yrs = [...new Set(list.map(p => p.year))];
    send(res, page({
      title: `${k} 기출문제 모음 ${list.length}문항 | ${EXAM} ${LEVEL}`,
      desc: `${EXAM} ${LEVEL} '${k}' 관련 기출 ${list.length}문항(${yrs[yrs.length - 1]}~${yrs[0]}년)의 정답과 해설. 출제 빈도와 연도별 출제 흐름을 한 번에 확인하세요.`,
      path: kwUrl(k), crumbs: [['홈', '/'], ['기출문제 해설', '/q'], [k, kwUrl(k)]],
      body: `<h1>'${esc(k)}' 기출문제 모음 (${list.length}문항)</h1>
<p>${esc(EXAM)} ${esc(LEVEL)}에서 '${esc(k)}' 키워드로 출제된 문항입니다. 출제 연도: ${yrs.join(', ')}</p>${body}
<p><a class="btn" href="/exam.html?mode=keyword&keyword=${enc(k)}">'${esc(k)}' 문제만 모아서 풀기</a></p>${cta(null)}`
    }));
  });

  // ── /q/:year ──
  app.get('/q/:year(\\d{4})', (req, res, next) => {
    const y = req.params.year; const list = byYear[y];
    if (!list) return next();
    const groups = {};
    for (const p of list.slice().sort(order)) (groups[p.subject] = groups[p.subject] || []).push(p);
    const body = Object.keys(groups).map(s => `<h2>${esc(s)} (${groups[s].length}문항)</h2><ul class="list">${groups[s].map(p => `<li><a href="${urlOf(p)}">${p.num}번</a> — ${esc(short(p.question, 70))}</li>`).join('')}</ul>`).join('');
    send(res, page({
      title: `${y}년 ${roundOf(y)} ${EXAM} ${LEVEL} 기출문제 정답·해설 전체`,
      desc: `${y}년 ${roundOf(y)} ${EXAM} ${LEVEL} 기출문제 ${list.length}문항의 정답과 해설. 과목별(${Object.keys(groups).join('·')}) 문항별로 확인하세요.`,
      path: '/q/' + y, crumbs: [['홈', '/'], ['기출문제 해설', '/q'], [`${y}년`, '/q/' + y]],
      body: `<h1>${y}년 ${esc(roundOf(y))} ${esc(EXAM)} ${esc(LEVEL)} 기출문제 해설 (${list.length}문항)</h1>${body}${cta(list[0])}`
    }));
  });

  // ── /q/:year/:subject/:num ──
  app.get('/q/:year(\\d{4})/:subject/:num(\\d+)', (req, res, next) => {
    const p = byKey[req.params.year + '|' + req.params.subject + '|' + Number(req.params.num)];
    if (!p) return next();
    const sameSubj = PROBLEMS.filter(x => x.year === p.year && x.subject === p.subject).sort((a, b) => a.num - b.num);
    const i = sameSubj.indexOf(p); const prev = sameSubj[i - 1], nextP = sameSubj[i + 1];
    const okL = ansList(p.answer);
    const imgs = (p.images || []).map(s => `<img class="qi" src="/images/${esc(s)}" alt="${esc(p.year + '년 ' + p.subject + ' ' + p.num + '번 그림')}" loading="lazy">`).join('');
    const chImg = p.choice_images || {};
    const choices = (p.choices || []).map((c, j) => `<li${okL.includes(j + 1) ? ' class="ok"' : ''}>${esc(strip(c))}${chImg[String(j + 1)] ? `<br><img class="qi" src="/images/${esc(chImg[String(j + 1)])}" alt="보기 ${j + 1}" loading="lazy">` : ''}</li>`).join('');
    const related = [];
    for (const k of (p.keywords || [])) for (const r of (byKw[k] || [])) if (r !== p && !related.includes(r)) related.push(r);
    const rel = related.sort(order).slice(0, 6);
    const qText = strip(p.question);
    const title = `${p.year}년 ${EXAM} ${LEVEL} ${p.subject} ${p.num}번 기출문제 해설 — ${short(p.question, 34)}`;
    const desc = `${p.year}년 ${roundOf(p.year)} ${EXAM} ${LEVEL} ${p.subject} ${p.num}번. 정답 ${ansText(p.answer)}. ${short(p.explanation || qText, 110)}`;
    const ld = {
      '@context': 'https://schema.org', '@type': 'Quiz', name: `${p.year}년 ${EXAM} ${LEVEL} ${p.subject} ${p.num}번`,
      about: { '@type': 'Thing', name: p.subject }, educationalLevel: `${EXAM} ${LEVEL}`, inLanguage: 'ko',
      hasPart: [{
        '@type': 'Question', eduQuestionType: 'Multiple choice', text: qText,
        acceptedAnswer: okL.map(n => ({ '@type': 'Answer', position: n - 1, text: strip((p.choices || [])[n - 1] || ''), answerExplanation: { '@type': 'Comment', text: p.explanation || '' } })),
        suggestedAnswer: (p.choices || []).map((c, j) => ({ '@type': 'Answer', position: j, text: strip(c) })).filter(a => !okL.includes(a.position + 1))
      }]
    };
    send(res, page({
      title, desc, path: urlOf(p), ld,
      crumbs: [['홈', '/'], ['기출문제 해설', '/q'], [`${p.year}년`, '/q/' + p.year], [`${p.subject} ${p.num}번`, urlOf(p)]],
      body: `<h1>${p.year}년 ${esc(roundOf(p.year))} ${esc(EXAM)} ${esc(LEVEL)} ${esc(p.subject)} ${p.num}번</h1>
<div class="card"><div class="q">${esc(p.question)}</div>
${(p.passages || []).filter(Boolean).map(t => `<div class="pass">${esc(t)}</div>`).join('')}${imgs}
<ol class="ch">${choices}</ol>
<div class="ans">정답: ${ansText(p.answer)}</div></div>
<div class="card"><h2 style="margin-top:0">해설</h2><div class="exp">${esc(p.explanation || '해설 준비 중입니다.')}</div>
${(p.keywords || []).length ? `<div class="tags" style="margin-top:12px">키워드: ${p.keywords.map(k => `<a href="${kwUrl(k)}">${esc(k)}</a>`).join('')}</div>` : ''}</div>
<div class="nav">${prev ? `<a class="btn sub" href="${urlOf(prev)}">← ${prev.num}번</a>` : '<span></span>'}<a class="btn sub" href="/q/${p.year}">${p.year}년 전체</a>${nextP ? `<a class="btn sub" href="${urlOf(nextP)}">${nextP.num}번 →</a>` : '<span></span>'}</div>
${rel.length ? `<h2>같은 키워드 기출</h2><ul class="list">${rel.map(r => `<li><a href="${urlOf(r)}">${r.year}년 ${esc(r.subject)} ${r.num}번</a> — ${esc(short(r.question, 60))}</li>`).join('')}</ul>` : ''}
${cta(p)}`
    }));
  });

  // ── sitemap ──
  app.get('/sitemap.xml', (req, res) => {
    const today = new Date().toISOString().slice(0, 10);
    const urls = [['/', '1.0'], ['/q', '0.9'], ['/years.html', '0.6'], ['/subjects.html', '0.6']]
      .concat(years.map(y => ['/q/' + y, '0.8']))
      .concat(kwList.map(k => [kwUrl(k), '0.6']))
      .concat(PROBLEMS.slice().sort(order).map(p => [urlOf(p), '0.5']));
    res.set('Content-Type', 'application/xml; charset=utf-8');
    res.send('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
      urls.map(([u, pr]) => `<url><loc>${esc(BASE + u)}</loc><lastmod>${today}</lastmod><priority>${pr}</priority></url>`).join('\n') + '\n</urlset>');
  });

  return { pages: PROBLEMS.length + years.length + kwList.length + 1 };
};
