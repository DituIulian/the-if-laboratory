const config=window.LAB_CONFIG||{};
export const configured=Boolean(config.supabaseUrl&&config.supabaseKey);
const base=(config.supabaseUrl||'').replace(/\/$/,'');
let auth;
try {auth=JSON.parse(localStorage.getItem('iflab-auth')||'null');}catch{auth=null;}
let refreshing;
function persist(data){auth={...data,expires_at:Date.now()+(data.expires_in||3600)*1000};localStorage.setItem('iflab-auth',JSON.stringify(auth));}
async function raw(path,body,token,method='POST'){
 const response=await fetch(base+path,{method,headers:{apikey:config.supabaseKey,'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(12000)});
 const data=await response.json().catch(()=>null);
 if(!response.ok)throw new Error(data?.msg||data?.message||data?.error_description||'The laboratory could not connect. Please try again.');
 return data;
}
async function token(){
 if(auth && Date.now()>auth.expires_at-60000){
   if(!refreshing)refreshing=raw('/auth/v1/token?grant_type=refresh_token',{refresh_token:auth.refresh_token}).then(persist).finally(()=>refreshing=null);
   await refreshing;
 }
 return auth?.access_token;
}
export function currentUser(){return auth?.user;}
export async function login(email,password){persist(await raw('/auth/v1/token?grant_type=password',{email,password}));return auth.user;}
export async function anonymous(){if(!auth)persist(await raw('/auth/v1/signup',{}));return auth.user;}
export async function logout(){try{await raw('/auth/v1/logout',{},await token());}finally{auth=null;localStorage.removeItem('iflab-auth');}}
export async function rpc(name,args={}){return raw(`/rest/v1/rpc/${name}`,args,await token());}
export async function joinSession(code,name,emoji){await anonymous();return rpc('join_lab',{p_code:code.toUpperCase(),p_name:name,p_emoji:emoji});}
export async function saveTeam(id,state){return rpc('save_lab_progress',{p_team:id,p_state:state});}
export async function board(code){return rpc('lab_board',{p_code:code.toUpperCase()});}
