/* oxlint-disable typescript/no-require-imports -- Node-only tooling */
const {chromium}=require('C:/Users/aravi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs');
async function run(){
 fs.mkdirSync('outputs',{recursive:true});
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const response=await page.goto('http://localhost:3001/',{waitUntil:'domcontentloaded',timeout:60000});
 await page.getByRole('link',{name:'Sign in / Sign up',exact:true}).waitFor({timeout:30000});
 await page.screenshot({path:'outputs/studio-desktop.png',fullPage:true});
 console.log(JSON.stringify({status:response.status(),errors,title:await page.title(),body:(await page.locator('body').innerText()).slice(0,1200)}));
 await browser.close();
}
run().catch(e=>{console.error(e.message);process.exit(1);});
