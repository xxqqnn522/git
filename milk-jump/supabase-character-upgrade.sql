-- 在 Supabase SQL Editor 中执行；保留所有旧成绩和原接口。
begin;
alter table public.milk_game_runs add column if not exists character_name text;
create or replace function public.milk_record_run_v2(
  p_run_id uuid, p_player_id uuid, p_nickname text, p_difficulty text,
  p_score integer, p_duration_ms integer, p_reason text, p_character text
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_character is null or p_character not in ('奶蛋','奶鼠','奶娃','奶狗','奶鸡','袋鼠','未记录')
    or p_nickname is null or char_length(trim(p_nickname)) not between 1 and 20
    or p_difficulty is null or p_difficulty not in ('easy','hard','hell')
    or p_score is null or p_score not between 0 and 1000000
    or p_duration_ms is null or p_duration_ms < 0
    or p_reason is null or p_reason not in ('failed','restart','difficulty') then
    raise exception 'Invalid game record';
  end if;
  insert into public.milk_game_runs(run_id,player_id,nickname,difficulty,score,duration_ms,reason,character_name)
  values(p_run_id,p_player_id,trim(p_nickname),p_difficulty,p_score,p_duration_ms,p_reason,p_character)
  on conflict(run_id) do nothing;
end;
$$;

create or replace function public.milk_top_ten_v2(p_difficulty text)
returns table(nickname text, character_name text, score integer, achieved_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select best.nickname,coalesce(best.character_name,'未记录'),best.score,best.created_at
  from (
    select distinct on (r.player_id) r.player_id,r.nickname,r.character_name,r.score,r.created_at,r.run_id
    from public.milk_game_runs r where r.difficulty=p_difficulty
    order by r.player_id,r.score desc,r.created_at,r.run_id
  ) best
  order by best.score desc,best.created_at,best.run_id limit 10;
$$;
revoke all on function public.milk_record_run_v2(uuid,uuid,text,text,integer,integer,text,text) from public;
revoke all on function public.milk_top_ten_v2(text) from public;
grant execute on function public.milk_record_run_v2(uuid,uuid,text,text,integer,integer,text,text) to anon;
grant execute on function public.milk_top_ten_v2(text) to anon;
commit;
