import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:390,height:844}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:4173');
 await page.locator('#team-name').fill('Mobile Explorers');
 await page.locator('#join-form button[type=submit]').click();await page.locator('#begin').click();
 await page.locator('.room-scene img').evaluate(img=>img.decode());
 await page.screenshot({path:'test-results/mobile-refined.png'});
 for(const width of [320,390,430]){
  await page.setViewportSize({width,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  const brand=await page.locator('.brand').boundingBox(),nav=await page.locator('.nav').boundingBox();
  assert.ok(brand.x+brand.width<=nav.x+1);
 }
 await page.setViewportSize({width:390,height:844});
 await page.locator('.hotspot[data-object="0"]').click();await page.waitForTimeout(700);
 assert.ok((await page.locator('#puzzle-panel').boundingBox()).y>=60);
 await page.screenshot({path:'test-results/mobile-refined-question.png'});
 await page.locator('#back-to-scene').click();await page.waitForTimeout(700);
 assert.ok((await page.locator('.room-scene').boundingBox()).y>=60);
 await page.setViewportSize({width:1440,height:1000});
 await page.screenshot({path:'test-results/desktop-refined.png',fullPage:true});
 assert.deepEqual(errors,[]);
 console.log('Mobile layout passed at 320/390/430px: compact header, no overflow, question navigation and return to scene. Desktop screenshot saved.');
}finally{await browser.close();}
