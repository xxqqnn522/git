-- 在 Supabase SQL Editor 中运行；不修改游戏成绩。
begin;
create table if not exists public.milk_online_visitors (
  visitor_id uuid primary key,
  last_seen timestamptz not null default now()
);
alter table public.milk_online_visitors enable row level security;
revoke all on public.milk_online_visitors from anon,authenticated;
create index if not exists milk_online_last_seen on public.milk_online_visitors(last_seen);

create or replace function public.milk_presence_heartbeat(p_visitor_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  if p_visitor_id is null then raise exception 'Missing visitor ID'; end if;
  insert into public.milk_online_visitors(visitor_id,last_seen) values(p_visitor_id,now())
  on conflict(visitor_id) do update set last_seen=excluded.last_seen;
  delete from public.milk_online_visitors where last_seen<now()-interval '1 day';
end;
$$;
revoke all on function public.milk_presence_heartbeat(uuid) from public;
grant execute on function public.milk_presence_heartbeat(uuid) to anon;
-- 若已运行过公开人数的旧脚本，撤销旧接口的访客权限。
do $$ begin
  if to_regprocedure('public.milk_presence_ping(uuid)') is not null then
    revoke all on function public.milk_presence_ping(uuid) from public,anon,authenticated;
  end if;
end $$;
commit;
