const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1080,height:1920}});
for(const i of [1,2,3]){await p.goto('file://'+process.argv[2]+'/frame'+i+'.html');await p.waitForTimeout(600);await p.screenshot({path:'/mnt/project-files/website/ig-story/story-'+i+'.png'})}
await b.close()})();
