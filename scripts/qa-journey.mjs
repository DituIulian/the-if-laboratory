import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {ROOMS,CIPHERS} from '../content.js';
import {SCENES} from '../scenes.js';
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:4173');await page.clock.install();
 await page.locator('#team-name').fill('Future Rescue');await page.locator('#join-form button[type=submit]').click();await page.locator('#begin').click();
 await page.locator('.object-bar [data-object="0"]').click();
 await page.locator('[data-answer="1"]').click();await page.locator('#check-answer').click();
 assert.equal(await page.locator('.future-visitor').count(),0);
 await page.clock.fastForward(15000);await page.reload();await page.locator('.object-bar [data-object="0"]').click();
 await page.locator('[data-answer="1"]').click();await page.locator('#check-answer').click();
 assert.equal(await page.locator('.future-visitor').count(),1);
 await page.locator('.future-visitor img').evaluate(img=>img.decode());
 assert.equal(await page.locator('.future-visitor').isVisible(),true);await page.clock.fastForward(700);await page.screenshot({path:'test-results/felix-mobile.png',fullPage:false,animations:'disabled'});
 assert.match(await page.locator('.visitor-bubble').innerText(),/stuck in the future/);
 await page.clock.fastForward(10000);await page.clock.fastForward(500);assert.equal(await page.locator('.future-visitor').count(),0);
 await page.clock.fastForward(8000);
 for(const seconds of [21,24]){
  await page.locator('[data-answer="1"]').click();await page.locator('#check-answer').click();
  assert.equal(await page.locator('#retry-seconds').innerText(),String(seconds));
  if(seconds===24){assert.equal(await page.locator('.future-visitor').isVisible(),true);assert.match(await page.locator('.visitor-bubble').innerText(),/brought a book/);}
  await page.clock.fastForward(seconds*1000);
 }

 for(let r=0;r<ROOMS.length;r++){
  assert.equal(await page.locator('.room-scene img').getAttribute('src'),SCENES[r].image);
  if(r===0||r===3||r===5){await page.locator('.room-scene').scrollIntoViewIfNeeded();await page.screenshot({path:`test-results/portal-stage-${r+1}.png`,fullPage:false,animations:'disabled'});}
  for(let i=0;i<ROOMS[r].puzzles.length;i++){
   await page.locator(`.object-bar [data-object="${i}"]`).click();await page.locator(`[data-answer="${ROOMS[r].puzzles[i].answer}"]`).click();await page.locator('#check-answer').click();
  }
  await page.locator('.object-bar [data-object="map"]').click();await page.locator(`[data-cipher="${CIPHERS[r].answer}"]`).click();
  await page.locator('.object-bar [data-object="lock"]').click();if(r===5)await page.locator('[data-ending="tea"]').click();
  await page.locator('#lock-code').fill(ROOMS[r].code);await page.locator('#lock-form button').click();
  assert.equal(await page.locator('.portal-journey').isVisible(),true);
  if(r===0){await page.screenshot({path:'test-results/portal-journey.png',fullPage:false,animations:'disabled'});await page.clock.fastForward(4200);assert.equal(await page.locator('.portal-journey').count(),0);await page.reload();}
  else await page.locator('.portal-journey .btn').first().click();
 }
 await page.locator('.result').waitFor();assert.match(await page.locator('h1').innerText(),/tea/);
 assert.deepEqual(errors,[]);
 console.log('Journey QA passed: visitor after two errors across refresh, timed exit, six persistent camera stages, automatic/skip transitions and final escape.');
}finally{await browser.close();}


