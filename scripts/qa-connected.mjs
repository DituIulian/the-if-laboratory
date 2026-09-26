// Browser integration against the real SQL functions in an in-memory PostgreSQL.
// Supabase's HTTP/auth boundary is simulated; no remote account is created.
import {chromium} from 'playwright';
import {PGlite} from '@electric-sql/pglite';
import {readFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const db=new PGlite();
const browser=await chromium.launch({channel:'chrome',headless:true});
let sequence=1,queue=Promise.resolve();
const uuid=n=>'00000000-0000-0000-0000-'+String(n).padStart(12,'0');
try {
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;`);
 await db.exec(await readFile('supabase/schema.sql','utf8'));
 await db.query('insert into auth.users values ($1)',[uuid(1)]);
 await db.query('insert into public.lab_teachers values ($1)',[uuid(1)]);
 const errors=[];
 async function context(){
  const ctx=await browser.newContext({viewport:{width:1280,height:900}});
  await ctx.route('**/config.js',r=>r.fulfill({contentType:'text/javascript',body:`window.LAB_CONFIG={supabaseUrl:'https://lab.test',supabaseKey:'test-public-key'};`}));
  await ctx.route('https://lab.test/**',async route=>{
   const request=route.request(),path=new URL(request.url()).pathname;
   const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'};
   if(request.method()==='OPTIONS'){await route.fulfill({status:204,headers});return;}
   const task=queue.then(async()=>{
    let data;
    try {
     const body=request.postDataJSON();
     if(path==='/auth/v1/signup'||path==='/auth/v1/token'){
      const id=path.endsWith('signup')?uuid(++sequence):uuid(1);
      if(path.endsWith('signup'))await db.query('insert into auth.users values ($1)',[id]);
      data={access_token:id,refresh_token:id,expires_in:3600,user:{id,email:id===uuid(1)?'teacher@example.test':undefined,is_anonymous:id!==uuid(1)}};
     }else if(path==='/auth/v1/logout'){data={};}
     else{
      const id=request.headers().authorization?.replace('Bearer ','')||'';
      await db.query(`select set_config('test.uid',$1,false)`,[id]);
      const name=path.split('/').at(-1);
      assert.ok(['teacher_sessions','create_lab','set_lab_open','join_lab','save_lab_progress','lab_board','teacher_report','reset_lab','archive_lab','delete_lab'].includes(name));
      const values=Object.values(body).map(v=>typeof v==='object'?JSON.stringify(v):v);
      const args=Object.keys(body).map((k,i)=>`${k} => $${i+1}`).join(',');
      data=(await db.query(`select public.${name}(${args}) as result`,values)).rows[0].result;
     }
     await route.fulfill({status:200,headers,contentType:'application/json',body:JSON.stringify(data)});
    }catch(e){await route.fulfill({status:400,headers,contentType:'application/json',body:JSON.stringify({message:e.message})});}
   });queue=task.catch(()=>{});await task;
  });
  const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));return {ctx,page};
 }
 const teacher=await context();await teacher.page.goto('http://localhost:4173/#teacher');
 await teacher.page.locator('#email').fill('teacher@example.test');await teacher.page.locator('#password').fill('test-password');await teacher.page.locator('#login-form button').click();
 await teacher.page.locator('#class-title').fill('Year 9 · The time experiment');await teacher.page.locator('#create-session button').click();
 await teacher.page.locator('.session-code').waitFor();const code=(await teacher.page.locator('.session-code').innerText()).trim();
 assert.equal(await teacher.page.locator('.qr svg').count(),1,'QR must be rendered');
 await mkdir('test-results',{recursive:true});await teacher.page.screenshot({path:'test-results/teacher-connected.png',fullPage:true});
 const student=await context();await student.page.goto('http://localhost:4173/#home?code='+code);
 await student.page.locator('#team-name').fill('Quantum Owls');await student.page.locator('#join-form button[type=submit]').click();await student.page.locator('#begin').click();
 await student.page.locator('#puzzle-panel').waitFor();await student.page.locator('.object-bar [data-object="0"]').click();await student.page.locator('[data-answer="1"]').click();await student.page.locator('#check-answer').click();await student.page.waitForTimeout(15100);await student.page.locator('[data-answer="0"]').click();await student.page.locator('#check-answer').click();
 await teacher.page.goto('http://localhost:4173/#board?code='+code);await teacher.page.locator('.team-card').waitFor();
 await teacher.page.waitForFunction(()=>document.querySelector('.team-card')?.textContent.includes('1/13 signals'));
 const second=await context();await second.page.goto('http://localhost:4173/#home?code='+code);await second.page.locator('#team-name').fill('Cosmic Foxes');await second.page.locator('#join-form button[type=submit]').click();await second.page.locator('#begin').click();await second.page.locator('#puzzle-panel').waitFor();
 await second.page.locator('.object-bar [data-object="0"]').click();await second.page.locator('[data-answer="0"]').click();await second.page.locator('#check-answer').click();
 await teacher.page.waitForFunction(()=>document.querySelectorAll('.team-card').length===2);
 await teacher.page.screenshot({path:'test-results/live-board.png',fullPage:true});
 await student.page.reload();await student.page.locator('#puzzle-panel').waitFor();await student.page.locator('.object-bar [data-object="0"]').click();assert.match(await student.page.locator('#puzzle-panel').innerText(),/Signal restored/);
 await teacher.page.goto('http://localhost:4173/#teacher');await teacher.page.locator('[data-close]').click();await teacher.page.waitForFunction(()=>document.querySelector('#sessions')?.textContent.includes('Entry closed'));
 const download=teacher.page.waitForEvent('download');await teacher.page.locator('[data-export]').click();assert.match((await download).suggestedFilename(),/if-lab-/);
 await teacher.page.locator('[data-report]').click();await teacher.page.locator('.learning-report').waitFor();
 assert.match(await teacher.page.locator('.learning-report').innerText(),/Quantum Owls/);assert.equal(await teacher.page.locator('.chart-row b').first().innerText(),'1');
 await teacher.page.locator('[data-reset]').click();await teacher.page.locator('dialog input[name=title]').fill('Year 9B · Next class');await teacher.page.locator('dialog button[type=submit]').click();
 await teacher.page.waitForFunction(()=>document.querySelector('#sessions')?.textContent.includes('Year 9B'));
 const nextCode=(await teacher.page.locator('.session-code').innerText()).trim();assert.notEqual(nextCode,code);
 await teacher.page.locator('[data-view=history]').click();await teacher.page.locator('[data-report]').click();await teacher.page.locator('.learning-report').waitFor();
 assert.match(await teacher.page.locator('#sessions').innerText(),/Archived/);assert.match(await teacher.page.locator('.learning-report').innerText(),/Quantum Owls/);
 await teacher.page.screenshot({path:'test-results/history-connected.png',fullPage:true});
 await student.page.waitForFunction(()=>document.querySelector('h1')?.textContent.includes('archives'),{},{timeout:20000});

 await teacher.page.locator('[data-delete]').click();await teacher.page.locator('#cancel-delete').click();assert.equal(await teacher.page.locator('.session-code').count(),1);
 await teacher.page.locator('[data-delete]').click();await teacher.page.locator('dialog button[type=submit]').click();
 await teacher.page.locator('#sessions .empty-state').waitFor();await teacher.page.reload();await teacher.page.locator('[data-view=history]').click();await teacher.page.locator('#sessions .empty-state').waitFor();
 await teacher.page.locator('[data-view=active]').click();assert.equal((await teacher.page.locator('.session-code').innerText()).trim(),nextCode);
 assert.deepEqual(errors,[]);

 console.log('Connected UI QA passed: teacher sign-in, session, QR, two isolated teams, shared board, refresh, close entry, CSV export. HTTP/auth was simulated; PostgreSQL functions were real.');
} finally {await browser.close();await db.close();}
