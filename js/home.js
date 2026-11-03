(()=>{if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;document.documentElement.classList.add('js');
const ch=document.getElementById('chapter');if(!ch)return;const rows=[...document.querySelectorAll('#rows .row')],steps=[...document.querySelectorAll('.steps li')];
const cl=(x,a,b)=>Math.min(1,Math.max(0,(x-a)/(b-a)));
function f(){const r=ch.getBoundingClientRect(),p=cl(-r.top,0,r.height-innerHeight),h=rows[0].offsetHeight;
 const sort=cl(p,.08,.38),fill=cl(p,.38,.62),weak=cl(p,.7,.9);
 rows.forEach((e,i)=>{const from=+e.style.getPropertyValue('--from');e.style.transform=`translateY(${from*h*(1-sort)}px)`;
  const w=+e.style.getPropertyValue('--w');e.querySelector('.bar b').style.transform=`scaleX(${w*fill})`;
  const wk=e.classList.contains('weak');e.querySelector('.tag').style.opacity=wk?weak:0;const dip=1-Math.sin(Math.PI*sort)*.6;e.style.opacity=(wk?1:1-weak*.55)*dip;
  e.querySelector('.k').style.color=wk&&weak>.5?'':'var(--color-ink)';});
 const si=p<.38?0:p<.66?1:2;steps.forEach((s,i)=>s.style.opacity=i===si?1:.35);}
addEventListener('scroll',f,{passive:true});addEventListener('resize',f);f();})();

(async()=>{try{const r=await fetch('/api/me',{credentials:'same-origin'});const j=await r.json();if(j&&j.user){if(j.user.is_admin)thSwitch();const a=document.getElementById('nav-login');a.textContent='내 학습';a.href='dashboard.html';const c=document.getElementById('cta-sub');if(c){c.textContent='내 학습통계';c.href='dashboard.html';}}}catch(e){}})();
(()=>{if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;const sec=document.querySelector('.freq');if(!sec)return;
const lanes=[...sec.querySelectorAll('.lane')];
function g(){const r=sec.getBoundingClientRect(),h=innerHeight;const p=Math.min(1,Math.max(0,(h*0.9-r.top)/(r.height*0.9)));
 lanes.forEach((l,li)=>{const cs=l.querySelectorAll('.cells i');cs.forEach((c,i)=>{const t=(i+li*1.2)/(cs.length+lanes.length*1.2);c.style.opacity=p>t?1:.12;c.style.transform=p>t?'none':'scaleY(.4)';});
  const n=l.querySelector('.n');n.style.opacity=p>(cs.length+li*1.2)/(cs.length+lanes.length*1.2)*0.9?1:.2;});}
addEventListener('scroll',g,{passive:true});g();})();
(()=>{const el=document.getElementById('st-data');if(!el)return;const S=JSON.parse(el.textContent);const red=matchMedia('(prefers-reduced-motion: reduce)').matches;
const $=id=>document.getElementById(id),ring=$('st-ring'),btns=[...document.querySelectorAll('.sl button')],cols=[...document.querySelectorAll('#st-cols .c')],rows=[...document.querySelectorAll('#st-sb li')];
const fmt=n=>Math.round(n).toLocaleString();let cur={pct:0,solved:0,acc:0,wrong:0,streak:0};let idx=0,timer=null,chipT=null;
function tween(to){const from={...cur},t0=performance.now(),D=red?0:600;function f(t){const k=D?Math.min(1,(t-t0)/D):1,e=1-Math.pow(1-k,3);const v={};for(const key in to)v[key]=from[key]+(to[key]-from[key])*e;
 $('st-pct').textContent=Math.round(v.pct);$('st-solved').textContent=fmt(v.solved);$('st-acc').textContent=Math.round(v.acc)+'%';$('st-wrong').textContent=fmt(v.wrong);$('st-streak').textContent=Math.round(v.streak)+'일';
 if(k<1)requestAnimationFrame(f);else cur={...to};}requestAnimationFrame(f);}
function show(i){idx=i;const s=S[i];btns.forEach((b,j)=>{b.classList.toggle('on',j===i);b.setAttribute('aria-selected',j===i)});
 ring.style.setProperty('--r',s.pct/100);tween({pct:s.pct,solved:s.solved,acc:s.acc,wrong:s.wrong,streak:s.streak});
 const mx=Math.max(...s.week);cols.forEach((c,j)=>{c.querySelector('b').style.transform=`scaleY(${s.week[j]/mx})`;c.querySelector('u').textContent=s.week[j];c.classList.toggle('hi',s.week[j]===mx)});
 rows.forEach((r,j)=>{const [n,v]=s.rows[j]||['',0];r.style.visibility=n?'visible':'hidden';r.querySelector('span').textContent=n;r.querySelector('em').textContent=v?v+'%':'';const b=r.querySelector('b');b.style.transform=`scaleX(${v/100})`;b.classList.toggle('low',v&&v<60)});
 const wk=$('st-wk');wk.innerHTML=s.weak.slice(0,3).map((k,j)=>`<span style="animation-delay:${j*30}ms">${k.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}</span>`).join('');
 const chips=[...wk.children];let ci=0;clearInterval(chipT);if(!red)chipT=setInterval(()=>{chips.forEach((c,j)=>c.classList.toggle('on',j===ci%chips.length));ci++;},300);}
function auto(){clearInterval(timer);if(!red)timer=setInterval(()=>show((idx+1)%S.length),1000);}
btns.forEach((b,i)=>b.addEventListener('click',()=>{show(i);auto();}));
show(0);auto();})();

function thSwitch(){if(document.querySelector('.thsw'))return;const cl=document.body.classList;
const cur=k=>([...cl].find(c=>c.startsWith(k+'-'))||'').slice(k.length+1);
const w=document.createElement('div');w.className='thsw';
w.innerHTML='<span>배경</span><div class="g" data-k="th"><button data-v="navy">네이비</button><button data-v="gold">골드</button><button data-v="white">화이트</button></div><i class="sep"></i><span>표지</span><div class="g" data-k="cv"><button data-v="a">기본</button><button data-v="b">수험서</button></div>';
document.body.appendChild(w);
const mark=()=>w.querySelectorAll('.g').forEach(g=>{const v=cur(g.dataset.k)||(g.dataset.k==='th'?'navy':'a');g.querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.v===v))});mark();
w.querySelectorAll('.g button').forEach(b=>b.onclick=async()=>{const k=b.parentNode.dataset.k,v=b.dataset.v;
 const body=k==='th'?{theme:v}:{cover:v};
 try{const r=await fetch('/api/admin/site-theme',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});if(!r.ok)throw 0;
 [...cl].filter(c=>c.startsWith(k+'-')).forEach(c=>cl.remove(c));cl.add(k+'-'+v);mark();}catch(e){alert('저장 실패');}});}
