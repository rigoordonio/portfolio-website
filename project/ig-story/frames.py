import sys
F=sys.argv[1]
base=f'''<style>
@font-face{{font-family:SG;src:url(file://{F}/schibsted-grotesk-latin.woff2);font-weight:400 900}}
@font-face{{font-family:GM;src:url(file://{F}/geist-mono-latin.woff2);font-weight:400 500}}
*{{box-sizing:border-box;margin:0}}
html,body{{width:1080px;height:1920px;overflow:hidden;background:#0a0c11;color:#eceae4;font-family:SG,sans-serif}}
.f{{position:relative;width:1080px;height:1920px;padding:120px 84px;background:radial-gradient(900px 700px at 85% 8%,rgba(52,211,153,.18),transparent 60%),radial-gradient(800px 600px at 0% 100%,rgba(52,211,153,.10),transparent 60%),#0a0c11;overflow:hidden}}
.grid{{position:absolute;inset:0;background-image:linear-gradient(rgba(236,234,228,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(236,234,228,.035) 1px,transparent 1px);background-size:60px 60px;mask-image:linear-gradient(#000,transparent 70%)}}
.top{{position:relative;display:flex;justify-content:space-between;align-items:center;font:500 30px GM,monospace;letter-spacing:.12em;text-transform:uppercase;color:#8f96a3}}
.dot{{display:inline-block;width:22px;height:22px;border-radius:50%;background:#34d399;box-shadow:0 0 0 10px rgba(52,211,153,.18),0 0 40px #34d399;margin-right:22px;vertical-align:-2px}}
h1{{position:relative;font-weight:800;letter-spacing:-.035em;line-height:.95;text-wrap:balance}}
.g{{color:#34d399}}
.pill{{display:inline-flex;align-items:center;gap:18px;padding:22px 34px;border-radius:999px;border:2px solid rgba(52,211,153,.5);background:rgba(52,211,153,.08);font:500 36px GM,monospace;color:#eceae4}}
.phone{{position:absolute;border-radius:78px;border:14px solid #1c2129;overflow:hidden;box-shadow:0 60px 120px -40px rgba(0,0,0,.8),0 0 0 2px #2a313b,0 0 120px rgba(52,211,153,.18)}}
.phone img{{display:block;width:100%}}
.sticker{{position:absolute;left:84px;right:84px;bottom:150px;height:200px;border:3px dashed rgba(236,234,228,.22);border-radius:40px;display:grid;place-items:center;font:500 28px GM,monospace;letter-spacing:.1em;text-transform:uppercase;color:rgba(236,234,228,.4)}}
.sub{{position:relative;font-size:40px;line-height:1.4;color:#b9bec7;max-width:880px}}
.row{{display:flex;justify-content:space-between;align-items:baseline;padding:34px 0;border-bottom:2px solid rgba(236,234,228,.1);font-size:56px;font-weight:700;letter-spacing:-.02em}}
.row span{{font:500 30px GM,monospace;color:#34d399;letter-spacing:.04em}}
.foot{{position:absolute;left:84px;right:84px;bottom:70px;display:flex;justify-content:space-between;font:500 26px GM,monospace;color:#5d6470;letter-spacing:.08em}}
</style>'''
f1=base+'''<div class="f"><div class="grid"></div>
<div class="top"><span><i class="dot"></i>Now live</span><span>2026</span></div>
<h1 style="font-size:132px;margin-top:70px">My new<br><span class="g">portfolio</span><br>is live.</h1>
<p class="sub" style="margin-top:40px">Data analytics, forecasting and AI, in one place.</p>
<div class="phone" style="left:220px;top:1180px;width:640px;height:1260px;transform:rotate(-5deg)"><img src="hero.png"></div>
<div style="position:relative;margin-top:44px" class="pill">rigoordonio.vercel.app</div>
<p style="position:relative;margin-top:64px;padding-left:36px;border-left:6px solid #34d399;font-size:50px;line-height:1.3;font-weight:600;letter-spacing:-.01em;max-width:860px">8+ years of turning data into forecasts. Come take a look.</p>
</div>'''
rows=[('Data Analytics',2),('Forecasting',4),('Machine Learning',2),('Data Engineering',4),('AI / LLM Solutions',7)]
f2=base+'''<div class="f"><div class="grid"></div>
<div class="top"><span><i class="dot"></i>What's inside</span><span>02 / 03</span></div>
<h1 style="font-size:116px;margin-top:70px">Data in,<br><span class="g">decisions</span> out.</h1>
<div style="position:relative;margin-top:60px">'''+''.join(f'<div class="row">{n}<span>{c} project{"s" if c>1 else ""}</span></div>' for n,c in rows)+'''</div>
<div class="phone" style="left:470px;top:1290px;width:520px;height:1000px;transform:rotate(5deg)"><img src="services.png"></div>
<p class="sub" style="position:absolute;left:84px;top:1360px;max-width:360px;font-size:36px">Open any service to see the projects behind it.</p>
<div class="foot"><span>rigoordonio.vercel.app</span></div>
</div>'''
f3=base+'''<div class="f"><div class="grid"></div>
<div class="top"><span><i class="dot"></i>Let's talk</span><span>03 / 03</span></div>
<h1 style="font-size:124px;margin-top:70px">Let's turn<br>your data into<br><span class="g">decisions.</span></h1>
<p class="sub" style="margin-top:40px">Open to Business Analyst, FP&amp;A, commercial analytics and AI data roles, and to project work.</p>
<img src="card.png" style="position:absolute;left:110px;top:1000px;width:860px;border-radius:44px;transform:rotate(-4deg);box-shadow:0 60px 120px -30px rgba(0,0,0,.85),0 0 120px rgba(52,211,153,.2)">
<div class="foot"><span>rigoordonio.vercel.app</span><span>in/rigo-karl-o-22a229134</span></div>
</div>'''
for i,h in enumerate([f1,f2,f3],1): open(f'frame{i}.html','w').write('<!doctype html><meta charset="utf-8">'+h)
