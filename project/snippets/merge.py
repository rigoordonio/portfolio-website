import sys
f=sys.argv[1];s=open(f).read()
def rep(a,b):
  global s
  assert a in s,a[:60]; s=s.replace(a,b,1)
rep('<title>Rigo Ordonio Studio</title>','<title>Rigo Ordonio</title>')
rep('  color-scheme:light;\n}','''  --glow:transparent;  /* night: light the elements emit */
  --veil:#ffffff;      /* loupe fill */
  --band:rgba(255,90,31,.12);
  color-scheme:light;
}
/* night mode: the same design after dark; surfaces emit light instead of casting shadows */
[data-theme="dark"]{
  --paper:#0a0c11;
  --card:#11141b;
  --ink:#eceae4;
  --ink-2:#a3a9b4;
  --rule:#232835;
  --ember:#34d399;
  --gold:#a3e635;
  --ember-ink:#86efac;
  --glow:rgba(52,211,153,.14);
  --veil:#11141b;
  --band:rgba(52,211,153,.14);
  color-scheme:dark;
}
''')
rep('<meta name="claude:viewport-fit-sides" content="cover">','''<meta name="claude:viewport-fit-sides" content="cover">
<script>/* theme before first paint: saved choice, else night */
(()=>{let t;try{t=localStorage.getItem('theme')}catch(e){}if(t!=='dark'&&t!=='light')t='dark';document.documentElement.dataset.theme=t})();
</script>''')
rep('<button class="menu-btn"','''<button class="theme-btn" type="button" aria-pressed="false" aria-label="Switch to night mode"><svg viewBox="0 0 24 24" aria-hidden="true"><mask id="moon-cut"><rect width="24" height="24" fill="#fff"/><circle class="tb-cut" cx="25" cy="3" r="6.5" fill="#000"/></mask><circle class="tb-core" cx="12" cy="12" r="5" mask="url(#moon-cut)"/><g class="tb-rays"><path d="M12 1.8v2.4M12 19.8v2.4M1.8 12h2.4M19.8 12h2.4M4.8 4.8l1.7 1.7M17.5 17.5l1.7 1.7M4.8 19.2l1.7-1.7M17.5 6.5l1.7-1.7"/></g><g class="tb-stars"><circle cx="19.5" cy="4.5" r=".9"/><circle cx="22" cy="9.5" r=".6"/><circle cx="16" cy="2" r=".5"/></g></svg></button>
    <button class="menu-btn"''')
for a,b in (("c.strokeStyle='#e4e3df';c.fillStyle='#5c5c58'","c.strokeStyle=tk('--rule');c.fillStyle=tk('--ink-2')"),
            ("c.strokeStyle='#121212';c.lineWidth=2","c.strokeStyle=tk('--ink');c.lineWidth=2"),
            ("c.strokeStyle='#ff5a1f';c.setLineDash","c.strokeStyle=tk('--ember');c.setLineDash"),
            ("c.fillStyle='#121212';c.beginPath()","c.fillStyle=tk('--ink');c.beginPath()"),
            ("c.fillStyle='rgba(255,90,31,.12)'","c.fillStyle=tk('--band')"),
            ("cx.fillStyle='#fff';","cx.fillStyle=tk('--veil');"),
            ("cx.strokeStyle='#121212';cx.lineWidth=1.5","cx.strokeStyle=tk('--ink');cx.lineWidth=1.5"),
            ("border-top:1px solid #2b2b29}","border-top:1px solid var(--reach-line,#2b2b29)}"),
            ("border-bottom:1px solid #2b2b29;","border-bottom:1px solid var(--reach-line,#2b2b29);")):
  rep(a,b)
rep("const drawChart=(c)=>{","const tk=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();\naddEventListener('themechange',()=>{try{render()}catch(e){}});\nconst drawChart=(c)=>{")
rep('</style>',open(sys.argv[2]).read()+'</style>')
i=s.rindex('</body>') if '</body>' in s else len(s)
s=s[:i]+open(sys.argv[3]).read()+s[i:]
open(f,'w').write(s)
