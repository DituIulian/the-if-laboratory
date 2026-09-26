import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {newState,answer,unlock} from '../engine.js';
import {ROOMS} from '../content.js';
test('database schema, teacher authorization, team isolation and live board',async()=>{
 const db=new PGlite();
 try {
 await db.exec(`create role anon; create role authenticated; create schema auth;
 create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 insert into auth.users values ('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002'),('00000000-0000-0000-0000-000000000003');`);
 await db.exec(await readFile('supabase/schema.sql','utf8'));
 const uid=async n=>db.query(`select set_config('test.uid',$1,false)`,['00000000-0000-0000-0000-'+String(n).padStart(12,'0')]);
 const rpc=async(sql,args=[])=> (await db.query(sql,args)).rows[0].result;
 await uid(2);
 await assert.rejects(rpc(`select public.create_lab('Unauthorized',30) result`),/not registered/);
 await uid(1);await db.exec(`insert into public.lab_teachers values ('00000000-0000-0000-0000-000000000001')`);
 const session=await rpc(`select public.create_lab('Class test',30) result`);assert.equal(session.code.length,8);
 await uid(2);const team=await rpc(`select public.join_lab($1,'Team One','🦊') result`,[session.code]);
 assert.equal(team.state.room,0);assert.equal(team.user_id,undefined);
 const repeated=await rpc(`select public.join_lab($1,'A different name','🚀') result`,[session.code]);assert.equal(repeated.id,team.id);
 await uid(3);await assert.rejects(rpc(`select public.save_lab_progress($1,'{}') result`,[team.id]),/does not belong/);
 await assert.rejects(rpc(`select public.join_lab($1,'Team One','🦊') result`,[session.code]),/already in use/);
 const other=await rpc(`select public.join_lab($1,'Team Two','🚀') result`,[session.code]);assert.notEqual(other.id,team.id);
 await uid(2);const s=newState('Team One','🦊');
 for(let i=0;i<ROOMS.length;i++){for(const p of ROOMS[i].puzzles)answer(s,p,p.answer);s.fragments.push(i);unlock(s,ROOMS[i].code);}
 const saved=await rpc(`select public.save_lab_progress($1,$2) result`,[team.id,JSON.stringify(s)]);assert.equal(saved.status,'escaped');
 const board=await rpc(`select public.lab_board($1) result`,[session.code]);assert.equal(board.teams.length,2);assert.equal(board.teams[0].solved,13);assert.equal(board.teams[0].status,'escaped');assert.equal(board.teams[0].user_id,undefined);
 await uid(1);await rpc(`select public.set_lab_open($1,false) result`,[session.id]);
 const sessions=await rpc('select public.teacher_sessions() result');assert.equal(sessions[0].team_count,2);assert.equal(sessions[0].is_open,false);
 await db.exec('set role anon');
 await assert.rejects(db.exec('select * from public.lab_teams'),/permission denied/);
 await assert.rejects(db.exec(`select public.create_lab('Bad',30)`),/permission denied/);
 assert.equal((await rpc(`select public.lab_board($1) result`,[session.code])).teams.length,2);
 await db.exec('reset role');
 await uid(3);await db.query(`update public.lab_teams set deadline=now()-interval '1 minute' where id=$1`,[other.id]);
 const timed=await rpc(`select public.save_lab_progress($1,$2) result`,[other.id,JSON.stringify(newState('Team Two','🚀'))]);assert.equal(timed.status,'timeout');
 await assert.rejects(rpc('select public.teacher_report($1) result',[session.id]),/Teacher access/);
 await assert.rejects(rpc("select public.reset_lab($1,'Bad reset',30) result",[session.id]),/Teacher access/);
 await db.query('insert into public.lab_teachers values ($1)',[uuidFor(3)]);
 await assert.rejects(rpc('select public.teacher_report($1) result',[session.id]),/Session not found/);
 await assert.rejects(rpc('select public.archive_lab($1) result',[session.id]),/Teacher access/);
 await uid(1);
 const before=await rpc('select public.teacher_report($1) result',[session.id]);assert.equal(before.teams[0].state.answerEvents.length,13);
 const next=await rpc("select public.reset_lab($1,'Next class',35) result",[session.id]);assert.notEqual(next.code,session.code);
 const history=await rpc('select public.teacher_report($1) result',[session.id]);assert.ok(history.session.archived_at);assert.deepEqual(history.teams,before.teams);
 await assert.rejects(rpc('select public.set_lab_open($1,true) result',[session.id]),/Session not found/);
 await db.exec(await readFile('supabase/schema.sql','utf8'));
 assert.equal((await rpc('select public.teacher_report($1) result',[session.id])).teams.length,2);
 await uid(2);const archivedSave=await rpc('select public.save_lab_progress($1,$2) result',[team.id,JSON.stringify(newState('Overwrite','🦊'))]);assert.equal(archivedSave.status,'escaped');
 } finally { await db.close(); }
});
function uuidFor(n){return '00000000-0000-0000-0000-'+String(n).padStart(12,'0');}

