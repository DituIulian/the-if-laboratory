import * as api from './backend.js';
const read=(k,f)=>{try{return JSON.parse(localStorage.getItem(k))??f;}catch{return f;}};
const write=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
export const localTeams=()=>Object.keys(localStorage).filter(k=>k.startsWith('iflab-team-')).map(k=>({key:k,...read(k,{})})).filter(t=>t.mode==='demo');
export function localSessions(){
 const sessions=read('iflab-sessions',[]),teams=localTeams();
 for(const t of teams){const code=t.code||'DEMO';if(!sessions.some(s=>s.code===code))sessions.push({id:code,code,title:code==='DEMO'||code==='PERSONAL'?'Individual expeditions':code,minutes:30,created_at:new Date(t.startedAt).toISOString(),is_open:true,archived_at:null});}
 return sessions.map(s=>({...s,team_count:teams.filter(t=>(t.code||'DEMO')===s.code).length})).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
}
export const listSessions=()=>api.configured?api.rpc('teacher_sessions'):Promise.resolve(localSessions());
export async function createSession(title,minutes){
 if(api.configured)return api.rpc('create_lab',{p_title:title,p_minutes:minutes});
 const sessions=localSessions(),id=crypto.randomUUID?.()||Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join(''),s={id,code:id.replaceAll('-','').slice(0,8).toUpperCase(),title,minutes,is_open:true,created_at:new Date().toISOString(),archived_at:null};sessions.unshift(s);write('iflab-sessions',sessions);return s;
}
export async function setOpen(id,open){if(api.configured)return api.rpc('set_lab_open',{p_session:id,p_open:open});const sessions=localSessions();const s=sessions.find(s=>s.id===id);if(!s||s.archived_at)throw Error('Archived sessions cannot reopen. Start a new class.');s.is_open=open;write('iflab-sessions',sessions);}
export async function archiveSession(id){
 if(api.configured)return api.rpc('archive_lab',{p_session:id});
 const sessions=localSessions(),s=sessions.find(s=>s.id===id);if(!s)throw Error('Session not found.');
 s.archived_at||=new Date().toISOString();s.is_open=false;write('iflab-sessions',sessions);
 for(const team of localTeams().filter(t=>(t.code||'DEMO')===s.code)){if(team.status==='playing'){team.status=Date.now()>=team.deadline?'timeout':'closed';team.finishedAt=Math.min(Date.now(),team.deadline);const key=team.key;delete team.key;write(key,team);}}
}
export async function resetSession(id,title,minutes){if(api.configured)return api.rpc('reset_lab',{p_session:id,p_title:title,p_minutes:minutes});await archiveSession(id);return createSession(title,minutes);}
export async function sessionReport(id){if(api.configured)return api.rpc('teacher_report',{p_session:id});const session=localSessions().find(s=>s.id===id);if(!session)throw Error('Session not found.');return {session,teams:localTeams().filter(t=>(t.code||'DEMO')===session.code).map(t=>({id:t.teamId,name:t.name,emoji:t.emoji,state:t}))};}

export async function deleteSession(id){
 if(api.configured)return api.rpc('delete_lab',{p_session:id});
 const sessions=localSessions(),session=sessions.find(s=>s.id===id);
 if(!session)throw Error('Session not found.');
 const deleted=read('iflab-deleted-codes',[]);if(!deleted.includes(session.code))deleted.push(session.code);
 write('iflab-deleted-codes',deleted);
 for(const team of localTeams().filter(t=>(t.code||'DEMO')===session.code)){
  localStorage.removeItem(team.key);
  if(localStorage.getItem('iflab-last')===team.teamId)localStorage.removeItem('iflab-last');
  if(sessionStorage.getItem('iflab-active')===team.teamId)sessionStorage.removeItem('iflab-active');
 }
 write('iflab-sessions',sessions.filter(s=>s.id!==id));
}
