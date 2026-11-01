-- ============================================================================
-- NoMorePanza - Esquema Completo para Supabase (Postgres 15+)
-- Regla del Reto:
--   - 7 días por semana, hasta 2 días de descanso permitidos por semana sin multa.
--   - Cada día adicional sin entrenar genera una multa de $50 MXN.
--   - Todo día entrenado exige foto de prueba + métricas del smartwatch
--     (Apple Watch, Samsung Galaxy Watch, Huawei Watch vía Strava, Bluetooth o Captura).
-- ============================================================================

create extension if not exists "pgcrypto";

-- 1. TABLA DE PERFILES DE USUARIO (Sincronizada con Supabase Auth)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text not null default 'Atleta',
  avatar_url text,
  watch_brand text not null default 'apple'
    check (watch_brand in ('apple', 'samsung', 'huawei', 'garmin', 'other')),
  strava_athlete_id bigint unique,
  strava_access_token text,
  strava_refresh_token text,
  strava_token_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. TABLA DE REGISTROS DIARIOS (Entrenamiento o Día de Descanso)
create table if not exists public.workout_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  workout_date date not null default (now() at time zone 'America/Mexico_City')::date,
  log_type text not null default 'workout'
    check (log_type in ('workout', 'rest')),
  watch_brand text not null default 'apple'
    check (watch_brand in ('apple', 'samsung', 'huawei', 'garmin', 'other')),
  sync_source text not null default 'watch_screenshot'
    check (sync_source in ('strava_oauth', 'web_bluetooth', 'watch_screenshot')),
  activity_type text not null default 'Entrenamiento Funcional',
  duration_minutes integer not null default 0
    check (duration_minutes >= 0 and duration_minutes <= 1440),
  calories_burned integer not null default 0
    check (calories_burned >= 0 and calories_burned <= 15000),
  avg_heart_rate integer
    check (avg_heart_rate is null or (avg_heart_rate >= 35 and avg_heart_rate <= 240)),
  max_heart_rate integer
    check (max_heart_rate is null or (max_heart_rate >= 35 and max_heart_rate <= 250)),
  steps integer not null default 0
    check (steps >= 0),
  proof_photo_url text,
  watch_photo_url text,
  external_activity_id text,
  notes text,
  created_at timestamptz not null default now(),
  -- Regla estricta: si es 'workout', la foto de prueba es obligatoria y debe durar mínimo 15 min
  constraint workout_requires_photo check (
    log_type = 'rest' or (proof_photo_url is not null and length(trim(proof_photo_url)) > 0)
  ),
  constraint unique_user_workout_per_day unique (user_id, workout_date)
);

-- 3. TABLA DE MULTAS ($50 MXN por cada día fallado después de los 2 descansos semanales)
create table if not exists public.penalties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  penalty_date date not null,
  week_start date not null,
  amount_mxn integer not null default 50 check (amount_mxn > 0),
  reason text not null default 'Falta de entrenamiento (>2 días de descanso en la semana)',
  is_paid boolean not null default false,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  constraint unique_user_penalty_per_day unique (user_id, penalty_date)
);

-- 4. ÍNDICES DE RENDIMIENTO (Foreign keys y búsquedas frecuentes)
create index if not exists idx_workout_logs_user_date
  on public.workout_logs (user_id, workout_date desc);

create index if not exists idx_workout_logs_date
  on public.workout_logs (workout_date desc);

create index if not exists idx_penalties_user_paid
  on public.penalties (user_id, is_paid, penalty_date desc);

create index if not exists idx_penalties_week_start
  on public.penalties (week_start desc);

-- 5. TRIGGER PARA CREAR PERFIL AUTOMÁTICAMENTE AL REGISTRARSE (Google / Email)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(coalesce(new.email, 'Atleta'), '@', 1)
    ),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(public.profiles.full_name, excluded.full_name),
        avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url),
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 6. FUNCIÓN PARA CALCULAR MULTAS DE LA SEMANA (2 descansos gratis/semana, 3er fallo = $50 MXN)
create or replace function public.reconcile_weekly_penalties(p_target_date date default ((now() at time zone 'America/Mexico_City')::date - 1))
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_week_start date := date_trunc('week', p_target_date::timestamp)::date;
  v_cutoff_date date := least(p_target_date, (v_week_start + 6));
  v_inserted_count integer := 0;
  r_user record;
  r_day date;
  v_missed_so_far integer;
  v_has_workout boolean;
begin
  -- Si aún no empieza la semana solicitada, no hacer nada
  if v_cutoff_date < v_week_start then
    return 0;
  end if;

  for r_user in select id from public.profiles loop
    v_missed_so_far := 0;

    for r_day in
      select gs::date
      from generate_series(v_week_start::timestamp, v_cutoff_date::timestamp, interval '1 day') as gs
      order by gs asc
    loop
      select exists (
        select 1
        from public.workout_logs wl
        where wl.user_id = r_user.id
          and wl.workout_date = r_day
          and wl.log_type = 'workout'
      ) into v_has_workout;

      if not v_has_workout then
        v_missed_so_far := v_missed_so_far + 1;
        -- Los primeros 2 días sin entrenar de la semana son de descanso libre (sin multa)
        if v_missed_so_far > 2 then
          insert into public.penalties (user_id, penalty_date, week_start, amount_mxn, reason)
          values (
            r_user.id,
            r_day,
            v_week_start,
            50,
            format('Día #%s sin entrenar en la semana (máximo 2 descansos permitidos)', v_missed_so_far)
          )
          on conflict (user_id, penalty_date) do nothing;

          v_inserted_count := v_inserted_count + 1;
        end if;
      end if;
    end loop;
  end loop;

  return v_inserted_count;
end;
$$;

-- 7. VISTA GAMIFICADA DEL LEADERBOARD (Con security_invoker = true para respetar RLS)
create or replace view public.leaderboard_stats
with (security_invoker = true)
as
with current_week_bounds as (
  select
    date_trunc('week', (now() at time zone 'America/Mexico_City'))::date as week_start,
    (now() at time zone 'America/Mexico_City')::date as today_mx
),
workout_agg as (
  select
    wl.user_id,
    count(*) filter (where wl.log_type = 'workout') as total_workouts,
    count(*) filter (
      where wl.log_type = 'workout'
        and wl.workout_date >= (select week_start from current_week_bounds)
    ) as week_workouts,
    count(*) filter (
      where wl.log_type = 'rest'
        and wl.workout_date >= (select week_start from current_week_bounds)
    ) as week_declared_rests,
    coalesce(sum(wl.calories_burned) filter (where wl.log_type = 'workout'), 0) as total_calories,
    coalesce(sum(wl.duration_minutes) filter (where wl.log_type = 'workout'), 0) as total_minutes
  from public.workout_logs wl
  group by wl.user_id
),
penalty_agg as (
  select
    pe.user_id,
    count(*) as total_missed_penalty_days,
    coalesce(sum(pe.amount_mxn), 0) as total_fine_mxn,
    coalesce(sum(pe.amount_mxn) filter (where pe.is_paid = false), 0) as unpaid_fine_mxn
  from public.penalties pe
  group by pe.user_id
)
select
  p.id as user_id,
  p.full_name,
  p.avatar_url,
  p.watch_brand,
  coalesce(wa.total_workouts, 0)::integer as total_workouts,
  coalesce(wa.week_workouts, 0)::integer as week_workouts,
  greatest(0, 2 - coalesce(wa.week_declared_rests, 0))::integer as remaining_rest_days_this_week,
  coalesce(wa.total_calories, 0)::integer as total_calories,
  coalesce(wa.total_minutes, 0)::integer as total_minutes,
  coalesce(pa.total_missed_penalty_days, 0)::integer as penalty_days,
  coalesce(pa.total_fine_mxn, 0)::integer as total_fine_mxn,
  coalesce(pa.unpaid_fine_mxn, 0)::integer as unpaid_fine_mxn,
  -- Puntos gamificados: +100 por día entrenado, +1 por cada 10 kcal, -75 por cada día de multa
  (
    (coalesce(wa.total_workouts, 0) * 100) +
    floor(coalesce(wa.total_calories, 0) / 10.0) -
    (coalesce(pa.total_missed_penalty_days, 0) * 75)
  )::integer as xp_score
from public.profiles p
left join workout_agg wa on wa.user_id = p.id
left join penalty_agg pa on pa.user_id = p.id;

-- 8. ROW LEVEL SECURITY (RLS) Y PERMISOS DE ROLES
alter table public.profiles enable row level security;
alter table public.workout_logs enable row level security;
alter table public.penalties enable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.workout_logs to authenticated;
grant select, insert, update on public.penalties to authenticated;
grant select on public.leaderboard_stats to authenticated;

-- Políticas para profiles: Todos en el grupo pueden ver los perfiles, cada quien edita el suyo
create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using ( true );

create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check ( (select auth.uid()) = id );

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using ( (select auth.uid()) = id )
  with check ( (select auth.uid()) = id );

-- Políticas para workout_logs: Todos los miembros ven las pruebas del grupo, solo el dueño sube/edita la suya
create policy "workout_logs_select_group"
  on public.workout_logs for select
  to authenticated
  using ( true );

create policy "workout_logs_insert_own"
  on public.workout_logs for insert
  to authenticated
  with check ( (select auth.uid()) = user_id );

create policy "workout_logs_update_own"
  on public.workout_logs for update
  to authenticated
  using ( (select auth.uid()) = user_id )
  with check ( (select auth.uid()) = user_id );

create policy "workout_logs_delete_own"
  on public.workout_logs for delete
  to authenticated
  using ( (select auth.uid()) = user_id );

-- Políticas para penalties: Todos ven la tabla de deudores, el usuario puede registrar o marcar pagada
create policy "penalties_select_group"
  on public.penalties for select
  to authenticated
  using ( true );

create policy "penalties_insert_authenticated"
  on public.penalties for insert
  to authenticated
  with check ( (select auth.uid()) = user_id );

create policy "penalties_update_own"
  on public.penalties for update
  to authenticated
  using ( (select auth.uid()) = user_id )
  with check ( (select auth.uid()) = user_id );

-- 9. STORAGE BUCKET PARA FOTOS DE PRUEBA Y CAPTURAS DE SMARTWATCH
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'workout-proofs',
  'workout-proofs',
  true,
  10485760, -- 10 MB límite por imagen
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do nothing;

-- Storage requiere SELECT + INSERT + UPDATE para permitir subida y reemplazo (upsert)
create policy "workout_proofs_public_select"
  on storage.objects for select
  to public
  using ( bucket_id = 'workout-proofs' );

create policy "workout_proofs_auth_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'workout-proofs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "workout_proofs_auth_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'workout-proofs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'workout-proofs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
