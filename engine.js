import { ROOMS } from './content.js';
export const TOTAL=ROOMS.reduce((n,r)=>n+r.puzzles.length,0);
export function newState(name,emoji,minutes=30,now=Date.now()) {return {name,emoji,room:0,solved:[],attempts:{},hints:[],fragments:[],opened:[],startedAt:now,deadline:now+minutes*60000,status:'playing',choice:null,finishedAt:null,bonusSolved:[]};}
export function roomReady(s){return ROOMS[s.room]?.puzzles.every(p=>s.solved.includes(p.id)) && s.fragments.includes(s.room);}
export function cooldown(s,now=Date.now()){return Math.max(0,Math.ceil(((s?.retryAt||0)-now)/1000));}
export function penalize(s,now=Date.now()){
 const previous=Number.isFinite(s.mistakeCount)?s.mistakeCount:Math.max(0,score(s).attempts-s.solved.length);
 s.mistakeCount=previous+1;s.retrySeconds=15+(s.mistakeCount-1)*3;s.retryAt=now+s.retrySeconds*1000;
 s.wrongStreak=(s.wrongStreak||0)+1;
 if(s.mistakeCount%2===0){s.futureVisits=(s.futureVisits||0)+1;s.pendingVisitor=s.futureVisits;}
}
export function startQuestion(s,id,now=Date.now()){s.questionStarted||={};if(!Number.isFinite(s.questionStarted[id]))s.questionStarted[id]=now;}
export function answer(s,p,index,now=Date.now()){
 if(s.status!=='playing'||s.solved.includes(p.id)||cooldown(s,now)||expired(s,now)||!Number.isInteger(index)||!p.options[index])return null;
 s.mistakeCount??=Math.max(0,score(s).attempts-s.solved.length);s.attempts[p.id]=(s.attempts[p.id]||0)+1;
 const correct=index===p.answer,first=s.questionStarted?.[p.id];
 s.answerEvents||=[];s.answerEvents.push({id:`${p.id}-${s.attempts[p.id]}`,question:p.id,selected:index,correct,at:now,elapsedMs:Number.isFinite(first)?Math.max(0,now-first):null,attempt:s.attempts[p.id]});
 if(correct){s.solved.push(p.id);s.wrongStreak=0;}else penalize(s,now);
 if(!correct&&s.attempts[p.id]>=6&&!s.hints.includes(p.id))s.hints.push(p.id);return correct;
}
export function expired(s,now=Date.now()){return s.status==='playing' && now>=s.deadline;}
export function remaining(s,now=Date.now()){return Math.max(0,Math.ceil((s.deadline-now)/1000));}
export function score(s){const count=Object.values(s.attempts).reduce((a,b)=>a+b,0);return {accuracy:count?Math.round(s.solved.length/count*100):0,firstTry:s.solved.filter(id=>s.attempts[id]===1).length,attempts:count,hints:s.hints.length,solved:s.solved.length};}
export function unlock(s,code){if(!roomReady(s)||s.status!=='playing'||cooldown(s)||expired(s)||code!==ROOMS[s.room].code)return false;s.wrongStreak=0;s.opened.push(s.room);if(s.room<ROOMS.length-1)s.room++;else {s.status='escaped';s.finishedAt=Date.now();}return true;}

