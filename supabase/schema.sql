-- Esquema propuesto para la etapa con base de datos compartida (Supabase).
-- Replica las colecciones que hoy se guardan en LocalStorage (ver js/storage.js).
-- No se usa en la versión actual.

create table team_leaders (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid unique references auth.users(id) on delete cascade, -- acceso individual de cada TL
  name        text not null,
  created_at  timestamptz not null default now()
);

create table admins (
  user_id uuid primary key references auth.users(id) on delete cascade -- vista general de administración
);

-- Objetivos del equipo ('goals')
create table goals (
  id          uuid primary key default gen_random_uuid(),
  tl_id       uuid not null references team_leaders(id) on delete cascade,
  period_id   text not null,                       -- 'P12-2026', 'P13-2026', ...
  type        text not null check (type in ('ventas','reclutamiento','demos','otro')),
  description text not null default '',
  target      integer check (target >= 0),         -- null = sin definir
  achieved    integer not null default 0 check (achieved >= 0),
  auto        boolean not null default false,      -- ventas/demos calculadas con los datos de las agentes
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Agentes por período ('agents')
create table agents (
  id             uuid primary key default gen_random_uuid(),
  tl_id          uuid not null references team_leaders(id) on delete cascade,
  period_id      text not null,
  name           text not null,
  status         text not null default 'activa' check (status in ('activa','inactiva')),
  personal_goal  text not null default '',
  target         integer check (target >= 0),
  demos_planned  integer check (demos_planned >= 0),
  demos_done     integer not null default 0 check (demos_done >= 0),
  sales          integer not null default 0 check (sales >= 0),
  notes          text not null default '',
  needs          text not null default '',
  next_action    text not null default '',
  follow_up_date date,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Seguimiento semanal ('actions')
create table actions (
  id          uuid primary key default gen_random_uuid(),
  tl_id       uuid not null references team_leaders(id) on delete cascade,
  period_id   text not null,
  agent_id    uuid references agents(id) on delete cascade, -- null = todo el equipo
  topic       text not null,
  next_action text not null default '',
  date        date,
  status      text not null default 'pendiente' check (status in ('pendiente','en_proceso','realizado')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index on goals   (tl_id, period_id);
create index on agents  (tl_id, period_id);
create index on actions (tl_id, period_id);

-- Seguridad: cada TL ve solo lo suyo; administración ve todo.
alter table team_leaders enable row level security;
alter table goals   enable row level security;
alter table agents  enable row level security;
alter table actions enable row level security;

create policy "tl propia" on team_leaders
  for all using (user_id = auth.uid() or exists (select 1 from admins where admins.user_id = auth.uid()));

create policy "goals de la tl" on goals
  for all using (tl_id in (select id from team_leaders where user_id = auth.uid())
                 or exists (select 1 from admins where admins.user_id = auth.uid()));
create policy "agents de la tl" on agents
  for all using (tl_id in (select id from team_leaders where user_id = auth.uid())
                 or exists (select 1 from admins where admins.user_id = auth.uid()));
create policy "actions de la tl" on actions
  for all using (tl_id in (select id from team_leaders where user_id = auth.uid())
                 or exists (select 1 from admins where admins.user_id = auth.uid()));
