import {ROOMS} from './content.js';
export const QUESTIONS=ROOMS.flatMap((r,room)=>r.puzzles.map(p=>({...p,room,topic:r.topic})));
const median=values=>{const a=[...values].sort((x,y)=>x-y);return a.length?(a[Math.floor((a.length-1)/2)]+a[Math.ceil((a.length-1)/2)])/2:null;};
export function analyseTeams(teams){
 const rows=QUESTIONS.map(q=>({...q,wrong:0,responses:0,seenTeams:0,correctTeams:0,firstTry:0,timings:[],wrongChoices:{}}));
 const byId=new Map(rows.map(r=>[r.id,r])),fastest=[];
 for(const team of teams){
  const s=team.state||team;const events=s.answerEvents||[],seenEvents=new Set();
  for(const q of rows){const attempts=s.attempts?.[q.id]||0;if(attempts){q.seenTeams++;q.responses+=attempts;q.wrong+=Math.max(0,attempts-(s.solved?.includes(q.id)?1:0));}if(s.solved?.includes(q.id)){q.correctTeams++;if(attempts===1)q.firstTry++;}}
  for(const e of events){if(seenEvents.has(e.id))continue;seenEvents.add(e.id);const q=byId.get(e.question);if(!q)continue;
   if(!e.correct)q.wrongChoices[e.selected]=(q.wrongChoices[e.selected]||0)+1;
   if(e.correct&&Number.isFinite(e.elapsedMs)&&e.elapsedMs>=0){q.timings.push(e.elapsedMs);fastest.push({teamKey:team.id||team.teamId||team.name||s.name,team:team.name||s.name,emoji:team.emoji||s.emoji,question:q.id,title:q.title,ms:e.elapsedMs,at:e.at,attempt:e.attempt});}
  }
 }
 for(const q of rows){q.medianMs=median(q.timings);q.firstTryRate=q.seenTeams?q.firstTry/q.seenTeams:null;q.topWrong=Object.entries(q.wrongChoices).sort((a,b)=>b[1]-a[1])[0];}
 const eligible=rows.filter(q=>q.timings.length>=2).sort((a,b)=>a.medianMs-b.medianMs);
 const teamBest=new Map();for(const f of fastest.sort((a,b)=>a.ms-b.ms)){if(!teamBest.has(f.teamKey))teamBest.set(f.teamKey,f);}
 return {rows,fastest:[...teamBest.values()],quickest:eligible[0]||null,teamCount:teams.length};
}
