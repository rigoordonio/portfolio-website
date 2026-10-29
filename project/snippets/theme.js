<script>
/* day / night switch: circular reveal from the toggle, glowing scan ring, holographic grid, then glows settle */
(()=>{const root=document.documentElement,btn=document.querySelector('.theme-btn');if(!btn)return;
const RM=matchMedia('(prefers-reduced-motion: reduce)');let busy=false;
const sync=()=>{const d=root.dataset.theme==='dark';btn.setAttribute('aria-pressed',d);btn.setAttribute('aria-label',d?'Switch to day mode':'Switch to night mode');
  document.querySelectorAll('meta[name=theme-color]').forEach(m=>m.content=d?'#0a0c11':'#f7f7f5');dispatchEvent(new Event('themechange'))};
const set=t=>{root.dataset.theme=t;try{localStorage.setItem('theme',t)}catch(e){}sync()};
sync();
const fx=(x,y,R,night)=>{const w=document.createElement('div');w.className='tx-fx';
  w.style.cssText=night?'--r1:#34d399;--r2:#a3e635;--r3:#6ee7b7':'--r1:#ff5a1f;--r2:#ffb627;--r3:#ffd9b0';
  const g=document.createElement('div');g.className='tx-grid '+(night?'night':'day');g.style.setProperty('--x',x+'px');g.style.setProperty('--y',y+'px');
  const ring=document.createElement('div');ring.className='tx-ring';Object.assign(ring.style,{left:x-R+'px',top:y-R+'px',width:2*R+'px',height:2*R+'px'});
  const sc=document.createElement('div');sc.className='tx-scan';w.append(g,ring,sc);document.body.append(w);
  const ease="cubic-bezier(.65,0,.35,1)";
  ring.animate([{transform:'scale(0)',opacity:1},{transform:'scale(.8)',opacity:1,offset:.8},{transform:'scale(1)',opacity:0}],{duration:1100,easing:ease,fill:'forwards'});
  g.animate([{opacity:0,clipPath:`circle(0px at ${x}px ${y}px)`},{opacity:1,offset:.35},{opacity:0,clipPath:`circle(${R}px at ${x}px ${y}px)`}],{duration:1100,easing:ease,fill:'forwards'});
  sc.animate([{transform:`translateY(${y}px)`,opacity:0},{opacity:.9,offset:.2},{transform:`translateY(${night?innerHeight:-10}px)`,opacity:0}],{duration:900,delay:160,easing:'cubic-bezier(.4,0,.2,1)',fill:'forwards'});
  setTimeout(()=>w.remove(),1300)};
const settle=()=>{const els=[...document.querySelectorAll('.ava-logo,.step,.svc,.role,.card,h1,h2')].filter(e=>{const r=e.getBoundingClientRect();return r.bottom>0&&r.top<innerHeight}).slice(0,14);
  els.forEach((e,i)=>{e.style.setProperty('--sd',i*30+'ms');e.classList.remove('tx-settle');void e.offsetWidth;e.classList.add('tx-settle');setTimeout(()=>e.classList.remove('tx-settle'),600+i*30)})};
btn.addEventListener('click',()=>{if(busy)return;const next=root.dataset.theme==='dark'?'light':'dark';
  if(RM.matches){set(next);return}
  if(!document.startViewTransition){root.classList.add('no-vt');set(next);setTimeout(()=>root.classList.remove('no-vt'),320);return}
  busy=true;const b=btn.getBoundingClientRect(),x=b.left+b.width/2,y=b.top+b.height/2,R=Math.hypot(Math.max(x,innerWidth-x),Math.max(y,innerHeight-y));
  const vt=document.startViewTransition(()=>set(next));
  vt.ready.then(()=>{root.animate({clipPath:[`circle(0px at ${x}px ${y}px)`,`circle(${R}px at ${x}px ${y}px)`]},{duration:1100,easing:"cubic-bezier(.65,0,.35,1)",pseudoElement:'::view-transition-new(root)'});fx(x,y,R,next==='dark')});
  vt.finished.then(settle).finally(()=>{busy=false})});
})();
</script>
