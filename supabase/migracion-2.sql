-- =====================================================================
-- Actualización 2: fechas de los períodos, demos agendadas "con quién" y plan GTK.
-- Pegar en Supabase → SQL Editor → Run. Se puede correr más de una vez.
-- =====================================================================

alter table periods add column if not exists start_date date;
alter table periods add column if not exists end_date date;
update periods set start_date = '2026-11-02', end_date = '2026-11-29' where id = 'P12-2026';
update periods set start_date = '2026-11-30', end_date = '2026-12-27' where id = 'P13-2026';

alter table agents add column if not exists demos_scheduled_with text not null default '';
alter table agents add column if not exists gtk boolean not null default false;
alter table agents add column if not exists purchase_date date;
alter table agents add column if not exists gtk_sales integer not null default 0 check (gtk_sales >= 0);
