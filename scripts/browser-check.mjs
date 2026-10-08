import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({headless:true,channel:'chrome',args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
const origin='http://127.0.0.1:4173';
const output=new URL('../test-results/',import.meta.url).pathname;
await mkdir(output,{recursive:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},permissions:['camera','microphone']});
const page=await context.newPage();
const errors=[],remote=[];
page.on('pageerror',error=>errors.push(error.message));
page.on('request',request=>{if(!request.url().startsWith(origin)&&!request.url().startsWith('blob:')&&!request.url().startsWith('data:'))remote.push(request.url());});
const check=async(name,fn)=>{await fn();console.log(`PASS ${name}`);};
try{
await check('Homepage, search synonyms, categories and empty state',async()=>{
 await page.goto(origin); assert.equal(await page.locator('h1').count(),1);
 await page.screenshot({path:output+'home-desktop.png',fullPage:true});
 assert.equal(await page.locator('.test-card:visible').count(),6);
 await page.locator('#test-search').fill('mic');assert.equal(await page.locator('.test-card:visible').count(),1);
 await page.locator('#test-search').fill('doesnotexist');assert.equal(await page.locator('#no-results').isVisible(),true);
 await page.locator('#clear-search').click();assert.equal(await page.locator('.test-card:visible').count(),6);
 await page.getByRole('button',{name:'Keyboard & screen'}).click();assert.equal(await page.locator('.test-card:visible').count(),3);
});
await check('All pages have content, canonical metadata, loaded tools and no overflow',async()=>{
 for(const route of ['/webcam-test/','/microphone-test/','/headphone-test/','/keyboard-test/','/mouse-test/','/screen-test/','/about/','/how-we-test/','/privacy/','/accessibility/']){
  const response=await page.goto(origin+route);assert.equal(response.status(),200);
  assert.equal(await page.locator('h1').count(),1);assert.ok(await page.locator('meta[name=description]').getAttribute('content'));
  assert.equal(await page.locator('link[rel=canonical]').getAttribute('href'),'https://test.institute'+route);
  if(await page.locator('#tool-root').count()){await page.locator('#tool-root .tool-stage').waitFor();assert.equal(await page.locator('#tool-root .tool-error').count(),0);assert.ok((await page.locator('.article-body').innerText()).length>1500);}
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),route+' desktop overflow');
 }
 assert.equal((await page.goto(origin+'/missing-route/')).status(),404);
});
await check('Keyboard focus, press/release, escape and reset',async()=>{
 await page.goto(origin+'/keyboard-test/');await page.locator('[data-action=activate]').click();
 await page.keyboard.down('a');assert.equal(await page.locator('[data-code=KeyA]').evaluate(el=>el.classList.contains('is-pressed')),true);
 await page.keyboard.up('a');assert.equal(await page.locator('[data-tested-count]').innerText(),'1');
 await page.keyboard.press('Escape');assert.equal(await page.locator('[data-key-state]').innerText(),'Ready');
 await page.keyboard.press('b');assert.equal(await page.locator('[data-tested-count]').innerText(),'1');
 await page.locator('[data-action=reset]').click();assert.equal(await page.locator('[data-tested-count]').innerText(),'0');
 await page.screenshot({path:output+'keyboard-desktop.png',fullPage:true});
});
await check('Mouse input and reset',async()=>{
 await page.goto(origin+'/mouse-test/');const pad=page.locator('[data-mouse-pad]');await pad.click();await pad.dblclick();
 assert.ok(Number(await page.locator('[data-buttons]').innerText())>=3);assert.equal(await page.locator('[data-doubles]').innerText(),'1');
 await pad.dispatchEvent('wheel',{deltaY:120,deltaX:0,deltaMode:0});assert.match(await page.locator('[data-scroll]').innerText(),/120/);
 await page.locator('[data-action=reset]').click();assert.equal(await page.locator('[data-buttons]').innerText(),'0');
});
await check('Screen patterns, observation and fullscreen',async()=>{
 await page.goto(origin+'/screen-test/');await page.locator('[data-action=dark]').click();assert.equal(await page.locator('[data-current-pattern]').innerText(),'Black');
 await page.locator('[data-action=next]').click();assert.equal(await page.locator('[data-current-pattern]').innerText(),'Red');
 await page.getByLabel('Looks even',{exact:true}).check();assert.equal(await page.locator('[data-observation]').innerText(),'Looks even');
 await page.locator('[data-action=fullscreen]').click();await page.waitForFunction(()=>Boolean(document.fullscreenElement));
 await page.screenshot({path:output+'screen-fullscreen.png'});
 await page.locator('[data-action=exit]').click();await page.waitForFunction(()=>!document.fullscreenElement);
});
await check('Webcam starts on request, returns real simulated stream settings and stops tracks',async()=>{
 await page.goto(origin+'/webcam-test/');await page.locator('[data-start]').waitFor();
 assert.equal(await page.locator('video').evaluate(el=>el.srcObject),null);
 await page.locator('[data-start]').click();await page.locator('[data-stop]').waitFor();
 assert.match(await page.locator('[data-size]').innerText(),/\d+ × \d+/);
 await page.evaluate(()=>{window.testStream=document.querySelector('video').srcObject;});
 await page.screenshot({path:output+'webcam-active.png',fullPage:true});
 await page.locator('[data-stop]').click();assert.equal(await page.evaluate(()=>window.testStream.getTracks().every(t=>t.readyState==='ended')),true);
 assert.equal(await page.locator('video').evaluate(el=>el.srcObject),null);
 await page.screenshot({path:output+'webcam-desktop.png',fullPage:true});
});
await check('Microphone level, local recording and cleanup',async()=>{
 await page.goto(origin+'/microphone-test/');await page.locator('[data-start]').click();await page.locator('[data-stop]').waitFor();
 assert.match(await page.locator('[data-reading]').innerText(),/dBFS/);
 await page.locator('[data-record]').click();await page.waitForTimeout(400);await page.locator('[data-record-stop]').click();
 await page.locator('[data-recording-result]').waitFor();assert.match(await page.locator('audio').getAttribute('src'),/^blob:/);
 await page.locator('[data-stop]').click();assert.equal(await page.locator('audio').getAttribute('src'),null);assert.equal(await page.locator('[data-recording-result]').isVisible(),false);
});
await check('Headphone output and user confirmations',async()=>{
 await page.goto(origin+'/headphone-test/');await page.locator('[data-channel=left]').click();await page.locator('[data-stop]').waitFor();
 await page.locator('[data-stop]').click();await page.locator('[data-confirm=left]').click();assert.match(await page.locator('[data-confirm-left]').innerText(),/You confirmed/);
 await page.screenshot({path:output+'headphone-desktop.png',fullPage:true});
});
await check('Permission denial and late permission cancellation',async()=>{
 const denied=await context.newPage();await denied.addInitScript(()=>{navigator.mediaDevices.getUserMedia=()=>Promise.reject(new DOMException('denied','NotAllowedError'));});
 await denied.goto(origin+'/webcam-test/');await denied.locator('[data-start]').click();await denied.waitForFunction(()=>document.querySelector('[data-status]').dataset.tone==='error');
 assert.match(await denied.locator('[data-status]').innerText(),/Permission/);await denied.close();
 const pending=await context.newPage();await pending.addInitScript(()=>{
  navigator.mediaDevices.getUserMedia=()=>new Promise(resolve=>window.resolveMedia=resolve);
  window.fakeTrack={stopped:false,stop(){this.stopped=true}};
 });
 await pending.goto(origin+'/webcam-test/');await pending.locator('[data-start]').click();await pending.locator('[data-cancel]').click();
 await pending.evaluate(()=>window.resolveMedia({getTracks:()=>[window.fakeTrack]}));
 assert.equal(await pending.evaluate(()=>window.fakeTrack.stopped),true);assert.equal(await pending.locator('[data-stop]').isVisible(),false);await pending.close();
});
await check('Mobile layout at 390px and 320px',async()=>{
 for(const width of [390,320]){
  await page.setViewportSize({width,height:844});
  for(const route of ['/','/webcam-test/','/microphone-test/','/headphone-test/','/keyboard-test/','/mouse-test/','/screen-test/']){
   await page.goto(origin+route);if(route!=='/')await page.locator('#tool-root .tool-stage').waitFor();
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),route+` mobile overflow at ${width}`);
   if(width===390)await page.screenshot({path:output+(route==='/'?'home':route.split('/')[1])+'-mobile.png',fullPage:true});
  }
 }
});
assert.deepEqual(errors,[],'browser errors');assert.deepEqual(remote,[],'unexpected remote requests');
console.log('PASS no browser errors or third-party requests. Screenshots in test-results/.');
} finally {await browser.close();}
