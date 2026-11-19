-- =====================================================================
-- PASO 3: vincular los usuarios creados en Authentication → Users.
-- Reemplazar los mails/usuarios y nombres de ejemplo, y correr en el SQL Editor.
-- (Este archivo está en un repositorio público: no guardar acá mails reales.)
-- =====================================================================

-- Administración (pueden ver lo que carga cada TL)
insert into admins (user_id, name)
select id, 'Nombre Admin 1' from auth.users where email = 'admin1@ejemplo.com'
on conflict (user_id) do update set name = excluded.name;

insert into admins (user_id, name)
select id, 'Nombre Admin 2' from auth.users where email = 'admin2@ejemplo.com'
on conflict (user_id) do update set name = excluded.name;

-- Team Leaders: una línea por TL (usuario@tl.dominio que se creó en Authentication)
insert into team_leaders (user_id, name)
select id, 'Nombre de la TL' from auth.users where email = 'usuario1@tl.ejemplo.com'
on conflict (user_id) do update set name = excluded.name;

-- Revisar que quedaron todas:
select tl.name, u.email from team_leaders tl join auth.users u on u.id = tl.user_id order by tl.name;
