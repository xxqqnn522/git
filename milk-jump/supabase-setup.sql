-- 在你自己的 Supabase 项目 SQL Editor 中运行一次。
create table if not exists public.milk_game_runs (
  run_id uuid primary key,
  player_id uuid not null,
  nickname text not null check (char_length(nickname) between 1 and 20),
  difficulty text not null check (difficulty in ('easy','hard','hell')),
  score integer not null check (score between 0 and 1000000),
  duration_ms integer not null check (duration_ms between 0 and 2147483647),
  reason text not null check (reason in ('failed','restart','difficulty')),
  created_at timestamptz not null default now()
);
alter table public.milk_game_runs enable row level security;
revoke all on public.milk_game_runs from anon, authenticated;
create index if not exists milk_runs_ranking on public.milk_game_runs(difficulty, score desc, created_at);

create or replace function public.milk_record_run(
  p_run_id uuid, p_player_id uuid, p_nickname text, p_difficulty text,
  p_score integer, p_duration_ms integer, p_reason text
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_nickname is null or char_length(trim(p_nickname)) not between 1 and 20
    or p_difficulty is null or p_difficulty not in ('easy','hard','hell')
    or p_score is null or p_score not between 0 and 1000000
    or p_duration_ms is null or p_duration_ms < 0
    or p_reason is null or p_reason not in ('failed','restart','difficulty') then
    raise exception 'Invalid game record';
  end if;
  insert into public.milk_game_runs(run_id,player_id,nickname,difficulty,score,duration_ms,reason)
  values(p_run_id,p_player_id,trim(p_nickname),p_difficulty,p_score,p_duration_ms,p_reason)
  on conflict(run_id) do nothing;
end;
$$;

create or replace function public.milk_top_ten(p_difficulty text)
returns table(nickname text, score integer, achieved_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select best.nickname,best.score,best.created_at
  from (
    select distinct on (r.player_id) r.player_id,r.nickname,r.score,r.created_at,r.run_id
    from public.milk_game_runs r where r.difficulty=p_difficulty
    order by r.player_id,r.score desc,r.created_at,r.run_id
  ) best
  order by best.score desc,best.created_at,best.run_id limit 10;
$$;
revoke all on function public.milk_record_run(uuid,uuid,text,text,integer,integer,text) from public;
revoke all on function public.milk_top_ten(text) from public;
grant execute on function public.milk_record_run(uuid,uuid,text,text,integer,integer,text) to anon;
grant execute on function public.milk_top_ten(text) to anon;
