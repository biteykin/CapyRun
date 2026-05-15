create or replace function public.dash_fast_days(days integer default 30)
returns table (
  d date,
  workouts integer,
  time_sec integer,
  distance_m numeric,
  kcal numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    coalesce(w.local_date, w.start_time::date, w.created_at::date) as d,
    count(*)::integer as workouts,
    coalesce(sum(coalesce(w.duration_sec, 0)), 0)::integer as time_sec,
    coalesce(sum(coalesce(w.distance_m, 0)), 0)::numeric as distance_m,
    coalesce(sum(coalesce(w.calories_kcal, 0)), 0)::numeric as kcal
  from public.workouts w
  where w.user_id = auth.uid()
    and w.deleted_at is null
    and coalesce(w.local_date, w.start_time::date, w.created_at::date)
      >= current_date - greatest(days - 1, 0)
  group by 1
  order by 1;
$$;

create or replace function public.dash_fast_weeks(weeks integer default 12)
returns table (
  week_start date,
  workouts integer,
  time_sec integer,
  distance_m numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    date_trunc('week', coalesce(w.local_date, w.start_time::date, w.created_at::date))::date as week_start,
    count(*)::integer as workouts,
    coalesce(sum(coalesce(w.duration_sec, 0)), 0)::integer as time_sec,
    coalesce(sum(coalesce(w.distance_m, 0)), 0)::numeric as distance_m
  from public.workouts w
  where w.user_id = auth.uid()
    and w.deleted_at is null
    and coalesce(w.local_date, w.start_time::date, w.created_at::date)
      >= current_date - (greatest(weeks, 1) * 7)
  group by 1
  order by 1;
$$;

create or replace function public.dash_fast_weekday(days integer default 30)
returns table (
  dow integer,
  workouts integer,
  time_sec integer
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    extract(isodow from coalesce(w.local_date, w.start_time::date, w.created_at::date))::integer as dow,
    count(*)::integer as workouts,
    coalesce(sum(coalesce(w.duration_sec, 0)), 0)::integer as time_sec
  from public.workouts w
  where w.user_id = auth.uid()
    and w.deleted_at is null
    and coalesce(w.local_date, w.start_time::date, w.created_at::date)
      >= current_date - greatest(days - 1, 0)
  group by 1
  order by 1;
$$;

create or replace function public.dash_fast_sport_mix(days integer default 30)
returns table (
  sport text,
  workouts integer,
  time_sec integer
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    coalesce(nullif(w.sport, ''), 'other') as sport,
    count(*)::integer as workouts,
    coalesce(sum(coalesce(w.duration_sec, 0)), 0)::integer as time_sec
  from public.workouts w
  where w.user_id = auth.uid()
    and w.deleted_at is null
    and coalesce(w.local_date, w.start_time::date, w.created_at::date)
      >= current_date - greatest(days - 1, 0)
  group by 1
  order by time_sec desc, workouts desc, sport;
$$;
