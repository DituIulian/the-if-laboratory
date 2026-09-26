import test from 'node:test';
import assert from 'node:assert/strict';
import {ROOMS,BONUS} from '../content.js';
import {newState,answer,roomReady,unlock,expired,remaining,score,TOTAL,cooldown,startQuestion} from '../engine.js';
test('complete route and valid lock codes',()=>{
 const s=newState('Test','fox');
 for(let i=0;i<ROOMS.length;i++){
  const r=ROOMS[i];assert.equal(s.room,i);assert.equal(unlock(s,r.code),false);
  for(const p of r.puzzles){assert.equal(answer(s,p,p.answer),true);assert.equal(answer(s,p,p.answer),null);}
  assert.equal(roomReady(s),false);s.fragments.push(i);assert.equal(roomReady(s),true);
  assert.equal(r.code,r.puzzles.map(p=>p.digit).join('')+r.fragment);assert.equal(unlock(s,r.code),true);
 }
 assert.equal(s.status,'escaped');assert.equal(s.solved.length,TOTAL);assert.equal(score(s).accuracy,100);
});
test('six failures escalate cooldown and add one hint',()=>{
 let now=Date.now();const s=newState('Team','fox'),p=ROOMS[0].puzzles[0];
 for(let i=0;i<6;i++){assert.equal(answer(s,p,1,now),false);assert.equal(cooldown(s,now),15+i*3);now+=s.retrySeconds*1000;}
 assert.deepEqual(s.hints,[p.id]);answer(s,p,1,now);now+=s.retrySeconds*1000;assert.equal(s.hints.length,1);
 answer(s,p,0,now);assert.equal(score(s).attempts,8);assert.equal(score(s).accuracy,13);
});
test('deadline survives reload and expires at boundary',()=>{
 const s=JSON.parse(JSON.stringify(newState('Team','fox',30,1000)));
 assert.equal(remaining(s,1000),1800);assert.equal(expired(s,1800999),false);assert.equal(expired(s,1801000),true);
});
test('finished mission rejects answers',()=>{const s=newState('Team','fox');s.status='timeout';assert.equal(answer(s,ROOMS[0].puzzles[0],0),null);assert.equal(unlock(s,'274'),false);});
test('content IDs and answers are valid',()=>{const ps=[...ROOMS.flatMap(r=>r.puzzles),...BONUS];assert.equal(new Set(ps.map(p=>p.id)).size,ps.length);for(const p of ps){assert.ok(p.options[p.answer]);assert.ok(p.explanation.length>20);}});
test('15-second cooldown blocks other puzzles and survives serialization',()=>{
 const now=Date.now(),s=newState('Team','fox'),p=ROOMS[0].puzzles[0];
 assert.equal(answer(s,p,1,now),false);assert.equal(cooldown(s,now),15);
 assert.equal(answer(s,p,0,now+14999),null);assert.equal(answer(s,ROOMS[0].puzzles[1],1,now+5000),null);assert.equal(score(s).attempts,1);
 const restored=JSON.parse(JSON.stringify(s));assert.equal(cooldown(restored,now+7000),8);assert.equal(answer(restored,p,0,now+15000),true);
});
test('Felix appears on every second total mistake across success and refresh',()=>{
 let now=Date.now();const s=newState('Team','fox'),p=ROOMS[0].puzzles[0],p2=ROOMS[0].puzzles[1];
 answer(s,p,1,now);assert.equal(s.futureVisits,undefined);now+=15000;
 answer(s,p,0,now);assert.equal(s.wrongStreak,0);
 const restored=JSON.parse(JSON.stringify(s));answer(restored,p2,(p2.answer+1)%3,now);
 assert.equal(restored.pendingVisitor,1);assert.equal(restored.retrySeconds,18);now+=18000;
 answer(restored,p2,(p2.answer+1)%3,now);now+=21000;
 answer(restored,p2,(p2.answer+1)%3,now);assert.equal(restored.pendingVisitor,2);assert.equal(restored.retrySeconds,24);
});
test('timing uses first opening, includes retry wait, and does not invent old times',()=>{
 const now=Date.now(),s=newState('Team','fox'),p=ROOMS[0].puzzles[0];
 startQuestion(s,p.id,now);startQuestion(s,p.id,now+1000);
 answer(s,p,1,now+2000);answer(s,p,0,now+17000);
 assert.equal(s.answerEvents[1].elapsedMs,17000);assert.equal(s.answerEvents[1].attempt,2);
 const old=newState('Old','fox');answer(old,p,0);assert.equal(old.answerEvents[0].elapsedMs,null);
});
