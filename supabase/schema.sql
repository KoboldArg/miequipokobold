-- =====================================================================
-- Gestión comercial de mi equipo | Kobold — base de datos (Supabase)
-- PASO 1: pegar TODO este archivo en Supabase → SQL Editor → New query → Run.
-- Se puede volver a correr sin problema (no borra datos).
-- =====================================================================

-- ---------- Períodos (para sumar más en el futuro sin tocar la app) ----------
create table if not exists periods (
  id          text primary key,          -- 'P12-2026'
  label       text not null,             -- 'P12 · 2026'
  sort_order  integer not null default 0,
  active      boolean not null default true
);
insert into periods (id, label, sort_order) values
  ('P12-2026', 'P12 · 2026', 12),
  ('P13-2026', 'P13 · 2026', 13)
on conflict (id) do nothing;

-- ---------- Personas ----------
create table if not exists team_leaders (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid unique not null references auth.users(id) on delete cascade,
  name        text not null,
  created_at  timestamptz not null default now()
);

create table if not exists admins (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  name        text not null default ''
);

-- ---------- Objetivos del equipo ----------
create table if not exists goals (
  id          uuid primary key default gen_random_uuid(),
  tl_id       uuid not null references team_leaders(id) on delete cascade,
  period_id   text not null references periods(id),
  type        text not null check (type in ('ventas', 'demos', 'reclutamiento', 'otro')),
  description text not null default '',
  target      integer check (target >= 0),               -- null = sin definir
  achieved    integer not null default 0 check (achieved >= 0), -- solo reclutamiento y otro
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
-- Ventas, demos y reclutamiento: uno por TL y período. "Otro": los que quieran.
create unique index if not exists goals_unique_type
  on goals (tl_id, period_id, type) where type <> 'otro';

-- ---------- Agentes (por período) ----------
create table if not exists agents (
  id              uuid primary key default gen_random_uuid(),
  tl_id           uuid not null references team_leaders(id) on delete cascade,
  period_id       text not null references periods(id),
  name            text not null,
  status          text not null default 'activa' check (status in ('activa', 'inactiva')),
  target          integer check (target >= 0),            -- objetivo de ventas
  sales           integer not null default 0 check (sales >= 0),
  demos_target    integer check (demos_target >= 0),      -- objetivo de demos
  demos_done      integer not null default 0 check (demos_done >= 0),
  demos_scheduled integer not null default 0 check (demos_scheduled >= 0),
  personal_goal   text not null default '',               -- qué quiere conseguir (incentivo, meta)
  needs           text not null default '',
  next_action     text not null default '',
  follow_up_date  date,
  notes           text not null default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ---------- Seguimiento semanal ----------
create table if not exists actions (
  id          uuid primary key default gen_random_uuid(),
  tl_id       uuid not null references team_leaders(id) on delete cascade,
  period_id   text not null references periods(id),
  agent_id    uuid references agents(id) on delete cascade,  -- null = todo el equipo
  topic       text not null,
  next_action text not null default '',
  date        date,
  status      text not null default 'pendiente' check (status in ('pendiente', 'en_proceso', 'realizado')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists goals_tl_period   on goals   (tl_id, period_id);
create index if not exists agents_tl_period  on agents  (tl_id, period_id);
create index if not exists actions_tl_period on actions (tl_id, period_id);

-- ---------- Fecha de última modificación ----------
create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists goals_touch on goals;
create trigger goals_touch before update on goals for each row execute function touch_updated_at();
drop trigger if exists agents_touch on agents;
create trigger agents_touch before update on agents for each row execute function touch_updated_at();
drop trigger if exists actions_touch on actions;
create trigger actions_touch before update on actions for each row execute function touch_updated_at();

-- ---------- Funciones de ayuda para los permisos ----------
create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where user_id = auth.uid());
$$;

create or replace function my_tl_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from team_leaders where user_id = auth.uid();
$$;

-- ---------- Seguridad: cada TL ve y edita solo lo suyo; administración ve todo ----------
alter table periods      enable row level security;
alter table team_leaders enable row level security;
alter table admins       enable row level security;
alter table goals        enable row level security;
alter table agents       enable row level security;
alter table actions      enable row level security;

drop policy if exists "periodos: leer" on periods;
create policy "periodos: leer" on periods for select to authenticated using (true);
drop policy if exists "periodos: admin edita" on periods;
create policy "periodos: admin edita" on periods for all to authenticated using (is_admin()) with check (is_admin());

drop policy if exists "tl: ver" on team_leaders;
create policy "tl: ver" on team_leaders for select to authenticated using (user_id = auth.uid() or is_admin());
drop policy if exists "tl: cambiar su nombre" on team_leaders;
create policy "tl: cambiar su nombre" on team_leaders for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "admins: verse" on admins;
create policy "admins: verse" on admins for select to authenticated using (user_id = auth.uid());

drop policy if exists "goals: tl" on goals;
create policy "goals: tl" on goals for all to authenticated using (tl_id = my_tl_id()) with check (tl_id = my_tl_id());
drop policy if exists "goals: admin lee" on goals;
create policy "goals: admin lee" on goals for select to authenticated using (is_admin());

drop policy if exists "agents: tl" on agents;
create policy "agents: tl" on agents for all to authenticated using (tl_id = my_tl_id()) with check (tl_id = my_tl_id());
drop policy if exists "agents: admin lee" on agents;
create policy "agents: admin lee" on agents for select to authenticated using (is_admin());

drop policy if exists "actions: tl" on actions;
create policy "actions: tl" on actions for all to authenticated using (tl_id = my_tl_id()) with check (tl_id = my_tl_id());
drop policy if exists "actions: admin lee" on actions;
create policy "actions: admin lee" on actions for select to authenticated using (is_admin());
