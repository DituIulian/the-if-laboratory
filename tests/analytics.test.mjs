import test from 'node:test';
import assert from 'node:assert/strict';
import {analyseTeams} from '../analytics.js';
test('report counts errors, deduplicates events and compares medians across teams',()=>{
 const a={name:'Owls',state:{attempts:{r0a:2,r0b:1},solved:['r0a','r0b'],answerEvents:[
  {id:'r0a-1',question:'r0a',selected:1,correct:false},
  {id:'r0a-2',question:'r0a',correct:true,elapsedMs:20000,attempt:2},
  {id:'r0a-2',question:'r0a',correct:true,elapsedMs:20000,attempt:2},
  {id:'r0b-1',question:'r0b',correct:true,elapsedMs:5000,attempt:1}]}},
 b={name:'Foxes',state:{attempts:{r0a:1,r0b:1},solved:['r0a','r0b'],answerEvents:[
  {id:'r0a-1',question:'r0a',correct:true,elapsedMs:10000,attempt:1},
  {id:'r0b-1',question:'r0b',correct:true,elapsedMs:7000,attempt:1}]}};
 const report=analyseTeams([a,b]);assert.equal(report.rows[0].wrong,1);assert.equal(report.rows[0].medianMs,15000);
 assert.equal(report.rows[0].firstTryRate,.5);assert.deepEqual(report.rows[0].topWrong,['1',1]);
 assert.equal(report.quickest.id,'r0b');assert.equal(report.quickest.medianMs,6000);assert.equal(report.fastest[0].team,'Owls');
 assert.equal(analyseTeams([a]).quickest,null);
});
test('old sessions retain error counts without fabricated timing',()=>{
 const report=analyseTeams([{name:'Old',state:{attempts:{r0a:4},solved:['r0a']}}]);
 assert.equal(report.rows[0].wrong,3);assert.equal(report.rows[0].medianMs,null);assert.equal(report.fastest.length,0);
});
