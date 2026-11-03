(()=>{const el0=document.getElementById('bk-data');if(!el0)return;const D=JSON.parse(el0.textContent);const B=D.books,n=B.length,NY=D.ny||12,DN=b=>b.d||b.s,TG=b=>b.tag!=null?b.tag:b.lv+'교시',QS=b=>b.q!=null?b.q:'&level='+encodeURIComponent(b.lv+'교시'),mob=innerWidth<=860;
const row=document.getElementById('row1'),cs=document.getElementById('case'),sp=document.getElementById('spread'),cf=document.getElementById('cf'),cb=document.getElementById('cb'),pR=document.getElementById('pR');
const lt=c=>{const h=c.replace('#','');const r=parseInt(h.substr(0,2),16),g=parseInt(h.substr(2,2),16),b=parseInt(h.substr(4,2),16);return (r*.299+g*.587+b*.114)>170};
const sc=n>6?1:1.15;const H=(mob?[92,86,96,88,84,94,90,92]:[128,118,134,122,114,130,120,126]),W=(mob?[24,23,25,24,23,25,24,24]:[42,40,44,41,40,43,41,42]).map(x=>Math.round(x*sc));
const FC=['#f4a259','#5b8e7d','#bc4b51','#8cb369','#f4e285','#6c8ead','#e9c46a','#2a9d8f','#e76f51','#a8dadc'];let fi=0;
const fill=k=>Array.from({length:k},()=>{const c=FC[fi++%FC.length];const h=(mob?70:100)+((fi*37)%(mob?20:30));const w=(mob?12:18)+((fi*13)%(mob?6:10));return `<i class="bk2 fl${lt(c)?' lt':''}" style="--c:${c};--h:${h}px;--w:${w}px"></i>`}).join('');
const bk=(b,i)=>`<button class="bk2${lt(b.c)?' lt':''}" style="--c:${b.c};--h:${H[i%8]}px;--w:${W[i%8]}px" data-i="${i}" aria-label="${DN(b)} 펼치기"><span>${b.sh}</span></button>`;
row.innerHTML=`<div class="deco plant"><i></i><i></i><i></i><b></b></div>`+fill(mob?(n>6?0:1):(n>6?2:3))+B.map((b,i)=>bk(b,i)).join('')+fill(mob?(n>6?0:1):(n>6?2:3))+`<div class="deco stack" style="width:90px"><i style="background:#9a7ad8;width:96%"></i><i style="background:#efc24e;width:100%"></i><i style="background:#4f9fd1;width:90%"></i></div>`;
const enc=encodeURIComponent,esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const cvBox=document.getElementById('covers'),stage=cs.closest('.stage');
if(cvBox){cvBox.style.setProperty('--cn',n<=5?n:4);cvBox.innerHTML=B.map((b,i)=>`<button class="cv" data-i="${i}" aria-label="${esc(DN(b))} 펼치기"><div class="cvf${lt(b.c)?' lt':''}" style="--c:${b.c}"><div class="top"><small>${TG(b)?TG(b)+' · ':''}${NY}개년 기출</small><h3${DN(b).length>7?' class="long"':''}>${esc(DN(b))}</h3></div><div class="stripe"></div><div class="bot"><b>${b.n}<small>문항</small></b><span>정답과 해설 포함</span><em>1위 ${esc((b.top[0]||{}).k||'')}</em></div></div><span class="lbl2">${esc(DN(b))}</span></button>`).join('');}
const cvs=cvBox?[...cvBox.querySelectorAll('.cv')]:[];
const mb=[...document.querySelectorAll('.modebar button')];
function setMode(m){stage.dataset.mode=m;mb.forEach(x=>{x.classList.toggle('on',x.dataset.m===m);x.setAttribute('aria-selected',x.dataset.m===m)});try{localStorage.setItem('wx_bookmode2',m)}catch(e){}}
let m0='cover';try{m0=localStorage.getItem('wx_bookmode2')||'cover'}catch(e){}setMode(m0==='shelf'?'shelf':'cover');
mb.forEach(x=>x.addEventListener('click',()=>setMode(x.dataset.m)));
cvs.forEach((c,i)=>c.addEventListener('click',()=>{openBook(i);clearInterval(T);document.getElementById('spread').scrollIntoView({behavior:'smooth',block:'center'});}));
const bks=[...cs.querySelectorAll('.bk2:not(.fl)')];let cur=-1,T=null,busy=false;
function fillBook(b){cf.className='cf'+(lt(b.c)?' lt':'');cf.style.setProperty('--c',b.c);
 cf.innerHTML=`<small>${TG(b)?TG(b)+' · ':''}${b.n}문항</small><h3>${esc(DN(b))}</h3><p>${NY}개년 기출 빈도 분석</p>`;
 const tot=b.fm.reduce((a,x)=>a+x[1],0)||1,mx=Math.max(...b.fm.map(x=>x[1]));
 const qs=QS(b);cb.innerHTML=`<div class="pg"><div class="ph${lt(b.c)?' lt':''}" style="--c:${b.c}">${TG(b)?TG(b)+' · ':''}${esc(DN(b))}</div><h4>${D.fmTitle||'출제 분류'}</h4><div class="sub">누르면 그 분야 문제를 풉니다</div><ul class="fm">${b.fm.map(f=>`<li><a href="exam.html?mode=form&subject=${enc(b.s)}&${f[2]||'form='+enc(f[0])}${qs}"><div class="t"><b>${esc(f[0])}</b><em>${f[1]}문항</em></div><i><u style="--p:${(f[1]/mx).toFixed(3)}"></u></i></a></li>`).join('')}</ul></div>`;
 pR.innerHTML=`<div class="pg"><div class="ph${lt(b.c)?' lt':''}" style="--c:${b.c}">${esc(DN(b))} · ${b.n}문항</div><h4>고빈도 키워드</h4><div class="sub">누르면 그 문제만 바로 풉니다</div><ul class="kw">${b.top.map((t,k)=>`<li style="transition-delay:${.5+k*.07}s"><a href="exam.html?mode=keyword&keyword=${enc(t.k)}${qs}"><b>${k+1}</b><span>${esc(t.k)}</span><em>${t.n}회</em></a></li>`).join('')}</ul><a class="go" href="exam.html?mode=subject&subject=${enc(b.s)}${qs}">이 과목 바로 풀기</a></div>`;}
function openBook(i){if(busy||i===cur)return;busy=true;const prev=cur;cur=i;
 const go=()=>{bks.forEach((s,j)=>s.classList.toggle('out',j===i));cvs.forEach((c,j)=>c.classList.toggle('sel',j===i));fillBook(B[i]);sp.classList.remove('open');sp.classList.add('show');
  setTimeout(()=>{sp.classList.add('open');busy=false;},750);};
 if(prev>=0){sp.classList.remove('open');setTimeout(()=>{sp.classList.remove('show');setTimeout(go,450);},900);}else go();}
function auto(){clearInterval(T);T=setInterval(()=>openBook((cur+1)%n),6500);}
bks.forEach((s,i)=>s.addEventListener('click',()=>{openBook(i);clearInterval(T);}));
sp.addEventListener('mouseenter',()=>clearInterval(T));
const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.intersectionRatio<.35)return;e.target.classList.add('in');if(!T&&cur<0){setTimeout(()=>openBook(n-1),500);auto();}}),{threshold:[.35]});
document.querySelectorAll('.bk-sec').forEach(s=>io.observe(s));
})();

(()=>{const c=document.getElementById('scue');if(!c)return;
const secs=()=>[...document.querySelectorAll('main > section')];
c.addEventListener('click',e=>{e.preventDefault();const y=scrollY+innerHeight*0.15;const nx=secs().find(s=>s.offsetTop>y+10);const tgt=nx?nx.offsetTop-60:document.body.scrollHeight;scrollTo({top:tgt,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});});
function f(){const end=scrollY+innerHeight>=document.documentElement.scrollHeight-40;c.classList.toggle('hide',end);}addEventListener('scroll',f,{passive:true});addEventListener('resize',f);f();})();
