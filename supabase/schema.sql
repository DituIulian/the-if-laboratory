-- Safe to re-run: upgrades existing projects without deleting history. Run in Supabase SQL Editor. No service-role key belongs in the website.
begin;

create table if not exists public.lab_teachers (
  user_id uuid primary key references auth.users(id) on delete cascade
);
create table if not exists public.lab_sessions (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id),
  code text not null unique,
  title text not null check (char_length(title) between 1 and 60),
  minutes integer not null check (minutes between 5 and 60),
  is_open boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.lab_teams (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.lab_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  name text not null check (char_length(name) between 1 and 28),
  emoji text not null,
  started_at timestamptz not null default now(),
  deadline timestamptz not null,
  updated_at timestamptz not null default now(),
  state jsonb not null,
  unique(session_id,user_id),
  unique(session_id,name)
);
alter table public.lab_sessions add column if not exists archived_at timestamptz;
alter table public.lab_sessions add column if not exists parent_id uuid references public.lab_sessions(id);
create index if not exists lab_teams_session_idx on public.lab_teams(session_id);
alter table public.lab_teachers enable row level security;
alter table public.lab_sessions enable row level security;
alter table public.lab_teams enable row level security;
-- No direct table policies: all browser access goes through narrowly scoped RPCs.
revoke all on public.lab_teachers, public.lab_sessions, public.lab_teams from anon, authenticated;

create or replace function public.is_lab_teacher() returns boolean
language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.lab_teachers where user_id=auth.uid()); $$;

create or replace function public.create_lab(p_title text,p_minutes integer default 30)
returns jsonb language plpgsql security definer set search_path = public
as $$ declare s public.lab_sessions; begin
  if not public.is_lab_teacher() then raise exception 'This account is not registered as a teacher.'; end if;
  if length(trim(p_title)) not between 1 and 60 or p_minutes not between 5 and 60 then raise exception 'Check the session name and duration.'; end if;
  insert into public.lab_sessions(teacher_id,code,title,minutes)
  values(auth.uid(),upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),trim(p_title),p_minutes) returning * into s;
  return to_jsonb(s);
end $$;

create or replace function public.teacher_sessions() returns jsonb
language plpgsql security definer set search_path = public
as $$ begin
  if not public.is_lab_teacher() then raise exception 'This account is not registered as a teacher. Follow the teacher setup in README.md.'; end if;
  return coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from
    (select s.*, (select count(*) from public.lab_teams t where t.session_id=s.id) as team_count
     from public.lab_sessions s where s.teacher_id=auth.uid()) x),'[]'::jsonb);
end $$;

create or replace function public.set_lab_open(p_session uuid,p_open boolean) returns void
language plpgsql security definer set search_path = public
as $$ begin
  if not public.is_lab_teacher() then raise exception 'Teacher access required.'; end if;
  update public.lab_sessions set is_open=p_open where id=p_session and teacher_id=auth.uid() and archived_at is null;
  if not found then raise exception 'Session not found.'; end if;
end $$;

create or replace function public.join_lab(p_code text,p_name text,p_emoji text) returns jsonb
language plpgsql security definer set search_path = public
as $$ declare s public.lab_sessions; t public.lab_teams; begin
  if auth.uid() is null then raise exception 'Please reconnect and try again.'; end if;
  select * into s from public.lab_sessions where code=upper(trim(p_code));
  if not found then raise exception 'Session code not found. Ask your teacher to check it.'; end if;
  select * into t from public.lab_teams where session_id=s.id and user_id=auth.uid();
  if found then
    if now()>=t.deadline and t.state->>'status'='playing' then
      update public.lab_teams set state=jsonb_set(state,'{status}','"timeout"') where id=t.id returning * into t;
    end if;
    return to_jsonb(t)-'user_id';
  end if;
  if not s.is_open or s.archived_at is not null then raise exception 'This session is closed to new teams.'; end if;
  if length(trim(p_name)) not between 1 and 28 then raise exception 'Choose a team name of 1–28 characters.'; end if;
  if p_emoji not in ('🦊','🚀','🦉','🦖','🐙','⚡','🧠','🛸') then raise exception 'Choose one of the team mascots.'; end if;
  if (select count(*) from public.lab_teams where session_id=s.id)>=60 then raise exception 'This class session is full.'; end if;
  insert into public.lab_teams(session_id,user_id,name,emoji,deadline,state)
  values(s.id,auth.uid(),trim(p_name),p_emoji,now()+make_interval(mins=>s.minutes),
    jsonb_build_object('name',trim(p_name),'emoji',p_emoji,'room',0,'solved','[]'::jsonb,'attempts','{}'::jsonb,
      'hints','[]'::jsonb,'fragments','[]'::jsonb,'opened','[]'::jsonb,'status','playing','choice',null,'finishedAt',null,'bonusSolved','[]'::jsonb)) returning * into t;
  return to_jsonb(t)-'user_id';
exception when unique_violation then raise exception 'That team name is already in use. Choose another name.';
end $$;

create or replace function public.save_lab_progress(p_team uuid,p_state jsonb) returns jsonb
language plpgsql security definer set search_path = public
as $$ declare t public.lab_teams; cleaned jsonb; next_status text; r integer; v text; n integer; ev jsonb; events jsonb; starts jsonb; errors integer;
  allowed text[] := array['r0a','r0b','r1a','r1b','r2a','r2b','r3a','r3b','r4a','r4b','r4c','r5a','r5b'];
begin
  select * into t from public.lab_teams where id=p_team and user_id=auth.uid() for update;
  if not found then raise exception 'This team does not belong to your browser session.'; end if;
  if exists(select 1 from public.lab_sessions where id=t.session_id and archived_at is not null) then return jsonb_build_object('deadline',t.deadline,'status',t.state->>'status'); end if;
  if pg_column_size(p_state)>120000 then raise exception 'Progress data is too large.'; end if;
  if jsonb_typeof(p_state->'solved') is distinct from 'array' or jsonb_typeof(p_state->'hints') is distinct from 'array'
    or jsonb_typeof(p_state->'attempts') is distinct from 'object' or jsonb_typeof(p_state->'opened') is distinct from 'array'
    or jsonb_typeof(p_state->'fragments') is distinct from 'array' then raise exception 'Invalid progress format.'; end if;
  r:=(p_state->>'room')::integer;
  if r is null or r not between 0 and 5 then raise exception 'Invalid room.'; end if;
  for v in select jsonb_array_elements_text(p_state->'solved') union select jsonb_array_elements_text(p_state->'hints') loop
    if not v=any(allowed) then raise exception 'Unknown puzzle.'; end if;
  end loop;
  if jsonb_array_length(p_state->'solved')<>(select count(distinct value) from jsonb_array_elements_text(p_state->'solved'))
    or jsonb_array_length(p_state->'hints')<>(select count(distinct value) from jsonb_array_elements_text(p_state->'hints')) then raise exception 'Duplicate puzzle data.'; end if;
  for v in select jsonb_array_elements_text(p_state->'fragments') union select jsonb_array_elements_text(p_state->'opened') loop
    if v not in ('0','1','2','3','4','5') then raise exception 'Invalid map fragment.'; end if;
  end loop;
  for v in select jsonb_object_keys(p_state->'attempts') loop
    n:=(p_state->'attempts'->>v)::integer;
    if not v=any(allowed) or n not between 1 and 1000 then raise exception 'Invalid attempt count.'; end if;
  end loop;
  -- Reject stale snapshots, so a reconnect cannot roll a team back to an earlier room.
  if r<(t.state->>'room')::integer or not ((p_state->'solved') @> (t.state->'solved')) then
    return jsonb_build_object('deadline',t.deadline,'status',t.state->>'status');
  end if;
  next_status:=p_state->>'status';
  if next_status is null or next_status not in ('playing','escaped','timeout') then raise exception 'Invalid mission status.'; end if;
  if next_status='escaped' and (jsonb_array_length(p_state->'solved')<>13 or not (p_state->'opened' @> '[0,1,2,3,4,5]'::jsonb)
    or not (p_state->'fragments' @> '[0,1,2,3,4,5]'::jsonb)) then raise exception 'Complete all six rooms first.'; end if;
  -- A finished mission is immutable; bonus research remains local.
  if t.state->>'status' in ('escaped','timeout','closed') then return jsonb_build_object('deadline',t.deadline,'status',t.state->>'status'); end if;
  if now()>=t.deadline then next_status:='timeout'; end if;
  events:=coalesce(p_state->'answerEvents','[]'::jsonb);starts:=coalesce(p_state->'questionStarted','{}'::jsonb);
  if jsonb_typeof(events)<>'array' or jsonb_array_length(events)>300 or jsonb_typeof(starts)<>'object' then raise exception 'Invalid answer log.'; end if;
  for ev in select * from jsonb_array_elements(events) loop
    if not (ev->>'question')=any(allowed) or (ev->>'selected')::integer not between 0 and 2
      or (ev->>'attempt')::integer not between 1 and 1000
      or (ev->>'at')::numeric<0 or coalesce((ev->>'elapsedMs')::numeric,0)<0
      or (ev->>'correct') not in ('true','false') then raise exception 'Invalid answer event.'; end if;
  end loop;
  errors:=greatest(0,least(coalesce((p_state->>'mistakeCount')::integer,0),10000));
  cleaned:=jsonb_build_object('name',t.name,'emoji',t.emoji,'room',r,'solved',p_state->'solved','attempts',p_state->'attempts',
    'hints',p_state->'hints','fragments',p_state->'fragments','opened',p_state->'opened','status',next_status,
    'choice',case when p_state->>'choice' in ('tea','dino') then p_state->>'choice' else null end,
    'startedAt',extract(epoch from t.started_at)*1000,'deadline',extract(epoch from t.deadline)*1000,
    'finishedAt',case when next_status='escaped' then extract(epoch from now())*1000 when next_status='timeout' then extract(epoch from t.deadline)*1000 else null end,
    'bonusSolved','[]'::jsonb,'answerEvents',events,'questionStarted',starts,'mistakeCount',errors,'retrySeconds',15+greatest(0,errors-1)*3,
    'retryAt',least(coalesce((p_state->>'retryAt')::numeric,0),extract(epoch from now())*1000+(15+greatest(0,errors-1)*3)*1000),
    'wrongStreak',greatest(0,least(coalesce((p_state->>'wrongStreak')::integer,0),100000)),
    'pendingVisitor',coalesce((p_state->>'pendingVisitor')::integer,0),'visitorShown',coalesce((p_state->>'visitorShown')::integer,0),'futureVisits',greatest(0,least(coalesce((p_state->>'futureVisits')::integer,0),100000)));
  update public.lab_teams set state=cleaned,updated_at=now() where id=t.id;
  return jsonb_build_object('deadline',t.deadline,'status',next_status);
end $$;

-- The shared board intentionally exposes only team nicknames and progress to people with its code.
-- It never returns teacher email addresses, auth IDs or answer state.
create or replace function public.lab_board(p_code text) returns jsonb
language plpgsql stable security definer set search_path = public
as $$ declare s public.lab_sessions; teams jsonb; begin
  select * into s from public.lab_sessions where code=upper(trim(p_code));
  if not found then raise exception 'Session not found.'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'emoji',t.emoji,'room',(t.state->>'room')::integer,
    'solved',jsonb_array_length(t.state->'solved'),'hints',jsonb_array_length(t.state->'hints'),
    'attempts',(select coalesce(sum(value::integer),0) from jsonb_each_text(t.state->'attempts')),
    'status',case when now()>=t.deadline and t.state->>'status'='playing' then 'timeout' else t.state->>'status' end,
    'deadline',t.deadline,'updated_at',t.updated_at) order by lower(t.name)),'[]'::jsonb) into teams
  from public.lab_teams t where t.session_id=s.id;
  return jsonb_build_object('title',s.title,'code',s.code,'is_open',s.is_open,'teams',teams);
end $$;

revoke all on function public.is_lab_teacher() from public, anon, authenticated;
revoke all on function public.create_lab(text,integer) from public, anon, authenticated;
revoke all on function public.teacher_sessions() from public, anon, authenticated;
revoke all on function public.set_lab_open(uuid,boolean) from public, anon, authenticated;
revoke all on function public.join_lab(text,text,text) from public, anon, authenticated;
revoke all on function public.save_lab_progress(uuid,jsonb) from public, anon, authenticated;
revoke all on function public.lab_board(text) from public, anon, authenticated;
grant execute on function public.create_lab(text,integer), public.teacher_sessions(), public.set_lab_open(uuid,boolean),
  public.join_lab(text,text,text), public.save_lab_progress(uuid,jsonb) to authenticated;
grant execute on function public.lab_board(text) to anon, authenticated;
create or replace function public.archive_lab(p_session uuid) returns void
language plpgsql security definer set search_path = public
as $$ begin
 if not public.is_lab_teacher() or not exists(select 1 from public.lab_sessions where id=p_session and teacher_id=auth.uid()) then raise exception 'Teacher access required for this session.'; end if;
 update public.lab_sessions set archived_at=coalesce(archived_at,now()),is_open=false where id=p_session;
 update public.lab_teams set state=state || jsonb_build_object('status',case when now()>=deadline then 'timeout' else 'closed' end,'finishedAt',extract(epoch from least(now(),deadline))*1000),updated_at=now()
 where session_id=p_session and state->>'status'='playing';
end $$;

create or replace function public.reset_lab(p_session uuid,p_title text,p_minutes integer default 30) returns jsonb
language plpgsql security definer set search_path = public
as $$ declare created jsonb; begin
 if not public.is_lab_teacher() or not exists(select 1 from public.lab_sessions where id=p_session and teacher_id=auth.uid()) then raise exception 'Teacher access required for this session.'; end if;
 perform public.archive_lab(p_session);
 created:=public.create_lab(p_title,p_minutes);
 update public.lab_sessions set parent_id=p_session where id=(created->>'id')::uuid;
 return created;
end $$;

create or replace function public.teacher_report(p_session uuid) returns jsonb
language plpgsql stable security definer set search_path = public
as $$ declare s public.lab_sessions; teams jsonb; begin
 if not public.is_lab_teacher() then raise exception 'Teacher access required.'; end if;
 select * into s from public.lab_sessions where id=p_session and teacher_id=auth.uid();
 if not found then raise exception 'Session not found.'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'emoji',emoji,'started_at',started_at,'updated_at',updated_at,'state',state) order by name),'[]'::jsonb) into teams from public.lab_teams where session_id=s.id;
 return jsonb_build_object('session',to_jsonb(s),'teams',teams);
end $$;
revoke all on function public.archive_lab(uuid),public.reset_lab(uuid,text,integer),public.teacher_report(uuid) from public,anon,authenticated;
grant execute on function public.archive_lab(uuid),public.reset_lab(uuid,text,integer),public.teacher_report(uuid) to authenticated;
create or replace function public.delete_lab(p_session uuid) returns void
language plpgsql security definer set search_path = public
as $$ begin
 if not public.is_lab_teacher() or not exists(
   select 1 from public.lab_sessions where id=p_session and teacher_id=auth.uid()
 ) then raise exception 'Teacher access required for this session.'; end if;
 -- Keep subsequent classes created through Reset; detach only their history link.
 update public.lab_sessions set parent_id=null where parent_id=p_session;
 delete from public.lab_sessions where id=p_session and teacher_id=auth.uid();
 -- Associated teams are removed by the existing ON DELETE CASCADE foreign key.
end $$;
revoke all on function public.delete_lab(uuid) from public,anon,authenticated;
grant execute on function public.delete_lab(uuid) to authenticated;
commit;
