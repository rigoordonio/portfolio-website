import {chromium} from 'playwright';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const ctx=await b.newContext({viewport:{width:1440,height:900},colorScheme:'light'});
const p=await ctx.newPage();
const url='file://'+process.cwd()+'/rigo-portfolio-merged.html';
await p.goto(url);await p.waitForTimeout(3000);
const cdp=await ctx.newCDPSession(p);await cdp.send('Animation.enable');
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m)};
ok(await p.evaluate(()=>document.documentElement.dataset.theme)==='light','starts light with light system');
for (const dir of ['night','day']){
  await cdp.send('Animation.setPlaybackRate',{playbackRate:.08});await p.click('.theme-btn');
  for(let i=0;i<6;i++){await p.waitForTimeout(i?1500:300);await p.screenshot({path:`merged/f-${dir}-${i}.png`})}
  await cdp.send('Animation.setPlaybackRate',{playbackRate:1});await p.waitForTimeout(1500);
}
await p.click('.theme-btn');await p.waitForTimeout(1200);
ok(await p.evaluate(()=>document.documentElement.dataset.theme)==='dark','toggle switches to dark');
ok(await p.getAttribute('.theme-btn','aria-label')==='Switch to day mode','label says next action');
/* no flash: theme attribute is set before first paint */
await p.reload({waitUntil:'commit'});
ok(await p.evaluate(()=>document.documentElement.dataset.theme)==='dark','persists after reload and is set before body loads');
const p2=await (await b.newContext({colorScheme:'dark'})).newPage();await p2.goto(url,{waitUntil:'commit'});
ok(await p2.evaluate(()=>document.documentElement.dataset.theme)==='dark','first visit follows system dark');
const p3=await (await b.newContext({reducedMotion:'reduce'})).newPage();await p3.goto(url);await p3.waitForTimeout(1500);
await p3.click('.theme-btn');ok(await p3.evaluate(()=>document.documentElement.dataset.theme)==='dark'&&!(await p3.$('.tx-fx')),'reduced motion: instant, no effects');
await b.close();
