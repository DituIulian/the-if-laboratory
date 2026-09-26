import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const context=await browser.newContext({viewport:{width:390,height:844}}),teacher=await context.newPage(),errors=[];
 context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
 await teacher.goto('http://localhost:4173/#teacher');
 await teacher.locator('#class-title').fill('Year 9A');await teacher.locator('#create-session button').click();
 const code=(await teacher.locator('.session-code').innerText()).trim();
 const pupil=await context.newPage();await pupil.goto('http://localhost:4173/#home?code='+code);
 await pupil.locator('#team-name').fill('Local Owls');await pupil.locator('#join-form button[type=submit]').click();await pupil.locator('#begin').click();
 await pupil.locator('.object-bar [data-object="0"]').click();await pupil.locator('[data-answer="0"]').click();await pupil.locator('#check-answer').click();
 await teacher.reload();await teacher.locator('[data-report]').click();await teacher.locator('.learning-report').waitFor();
 assert.match(await teacher.locator('.learning-report').innerText(),/Local Owls/);
 assert.equal(await teacher.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Report mobile overflow');
 await teacher.locator('[data-reset]').click();await teacher.locator('dialog input[name=title]').fill('Year 9B');await teacher.locator('dialog button[type=submit]').click();
 await teacher.waitForFunction(()=>document.querySelector('#sessions')?.textContent.includes('Year 9B'));
 assert.notEqual((await teacher.locator('.session-code').innerText()).trim(),code);
 await pupil.waitForFunction(()=>document.querySelector('h1')?.textContent.includes('archives'));
 await teacher.locator('[data-view=history]').click();await teacher.locator('[data-report]').click();
 await teacher.locator('.learning-report').waitFor();assert.match(await teacher.locator('.learning-report').innerText(),/Local Owls/);
 await teacher.screenshot({path:'test-results/history-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('Local class QA passed: join, timing report, mobile layout, reset, frozen old team and preserved history.');
}finally{await browser.close();}
