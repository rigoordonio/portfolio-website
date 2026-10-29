const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1080,height:1920}});
p.on('pageerror',e=>console.log('ERR',e.message));
await p.goto('file://'+process.argv[2]+'/video.html');await p.waitForTimeout(800);
const N=180;const t0=Date.now();
for(let i=0;i<N;i++){await p.evaluate(t=>render(t),i/30);await p.screenshot({path:process.argv[2]+'/vid/frames/'+String(i).padStart(4,'0')+'.png'});}
console.log('done',N,(Date.now()-t0)/1000+'s');await b.close()})();
