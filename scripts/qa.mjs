import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {ROOMS,BONUS,CIPHERS} from '../content.js';
await mkdir('test-results',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:4173');
 await page.screenshot({path:'test-results/desktop-home.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:'test-results/mobile-home.png',fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Home must not overflow');
 await page.locator('#team-name').fill('Paradox Patrol');
 await page.locator('[data-emoji="🦖"]').click();
 await page.locator('#join-form button[type=submit]').click();
 await page.locator('#begin').click();
 await page.locator('#puzzle-panel').waitFor();
 await page.locator('.object-bar [data-object="0"]').click();
 await page.clock.install();
 await page.screenshot({path:'test-results/mobile-room.png',fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Room must not overflow');
 // Six failures: explanation after three, automatic hint after six.
 for(let i=0;i<6;i++){
   await page.locator('[data-answer="1"]').click();await page.locator('#check-answer').click();
   assert.equal(await page.locator('#check-answer').isDisabled(),true);
   await page.clock.fastForward((15+i*3)*1000);
   if(i===2)assert.match(await page.locator('#puzzle-panel').innerText(),/Grammar note/);
 }
 assert.match(await page.locator('#puzzle-panel').innerText(),/PIP’s hint/);
 for(let r=0;r<ROOMS.length;r++){
   const room=ROOMS[r];
   for(let i=0;i<room.puzzles.length;i++){
     await page.locator(`.object-bar [data-object="${i}"]`).click();
     await page.locator(`[data-answer="${room.puzzles[i].answer}"]`).click();
     await page.locator('#check-answer').click();
     assert.match(await page.locator('#puzzle-panel').innerText(),/Signal restored/);
   }
   await page.locator('.object-bar [data-object="map"]').click();
   await page.locator(`[data-cipher="${CIPHERS[r].answer}"]`).click();
   await page.locator('.object-bar [data-object="lock"]').click();
   if(r===5)await page.locator('[data-ending="dino"]').click();
   await page.locator('#lock-code').fill(room.code);
   await page.locator('#lock-form button').click();
   await page.locator('.portal-journey .btn').first().click();
   if(r===0){await page.reload();await page.locator('.room-heading h1').waitFor();assert.equal(await page.locator('.room-heading h1').innerText(),ROOMS[1].name);}
 }
 await page.locator('.result').waitFor();assert.match(await page.locator('h1').innerText(),/historical exception/);
 await page.screenshot({path:'test-results/mobile-result.png',fullPage:true});
 await page.goto('http://localhost:4173/#bonus?id=b0');
 await page.locator('[data-answer="1"]').click();await page.locator('#check-answer').click();
 assert.match(await page.locator('.feedback').innerText(),/Research complete/);
 await page.goto('http://localhost:4173/#board?code=PERSONAL');
 await page.locator('.team-card').waitFor();assert.match(await page.locator('.team-card').innerText(),/Paradox Patrol/);
 await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'test-results/desktop-board.png',fullPage:true});
 // New team and real deadline expiry.
 await page.goto('http://localhost:4173/#home');await page.locator('#team-name').fill('Late Chickens');await page.locator('#join-form button[type=submit]').click();await page.locator('#begin').click();
 await page.locator('#puzzle-panel').waitFor();
 await page.evaluate(()=>{const id=sessionStorage.getItem('iflab-active');const k='iflab-team-'+id;const g=JSON.parse(localStorage.getItem(k));g.deadline=Date.now()-100;localStorage.setItem(k,JSON.stringify(g));});
 await page.reload();await page.locator('.result').waitFor();assert.match(await page.locator('h1').innerText(),/chickens/);
 await page.goto('http://localhost:4173/#teacher');assert.match(await page.locator('main').innerText(),/Connect Supabase/);
 // Layout at narrow width and enlarged text.
 await page.setViewportSize({width:320,height:700});await page.goto('http://localhost:4173/#home');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'320px home overflow');
 await page.addStyleTag({content:':root{font-size:24px}'});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Enlarged text overflow');
 assert.deepEqual(errors,[]);
 console.log('Browser QA passed: full route, hints, refresh, bonus, board, timeout, mobile layout.');
}finally{await browser.close();}
