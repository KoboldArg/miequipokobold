# Gestión comercial de mi equipo | Kobold

Herramienta interna para que cada Team Leader gestione su equipo por período: objetivos del equipo, agentes, demos, ventas, ficha individual y seguimiento semanal.

## Cómo usarla

Abrir `index.html` con doble clic (Chrome, Edge, Firefox o Safari). No necesita instalación ni servidor.

- Los datos se guardan en **este navegador y este dispositivo** (LocalStorage). Si se borra el historial / datos de sitios, se pierden. Usar **Imprimir resumen** (o guardarlo como PDF) para tener una copia.
- Cada TL entra escribiendo su nombre. Escribiendo el mismo nombre vuelve a su espacio.
- Cada período (P12 · 2026, P13 · 2026) guarda su información por separado.

## Estructura

| Archivo | Qué contiene |
|---|---|
| `index.html` | Estructura de las pantallas |
| `css/styles.css` | Identidad visual Kobold, responsive e impresión |
| `js/config.js` | Períodos, tipos de objetivo, estados, criterios de color |
| `js/calc.js` | Reglas de cálculo (porcentajes, pendientes, totales, situación de cada agente) |
| `js/storage.js` | **Capa de datos**. Única parte que toca LocalStorage |
| `js/app.js` | Pantallas e interacción |
| `js/tour.js` | Tutorial «¿Cómo se usa?» (se abre solo la primera vez) |
| `supabase/schema.sql` | Esquema propuesto para la base compartida |

## Datos de cada agente

Por período: estado (activa / inactiva), objetivo de ventas, objetivo de demos, ventas hechas, demos hechas, demos agendadas (con fecha, todavía no hechas) y seguimiento (qué quiere conseguir, qué necesita trabajar, próxima acción, fecha, observaciones).

## Objetivos del equipo

Tipos: Ventas, Demos, Reclutamiento (uno de cada uno por período) y Otro (los que se quiera).
- Ventas y Demos se suman solos con lo que se carga en cada agente.
- Reclutamiento y Otro se suman a mano con + y − en la tarjeta del objetivo.

Al cambiar archivos CSS/JS, subir el número `?v=` en `index.html` para que los navegadores carguen la versión nueva.

## Agregar un período

Sumar una línea en `js/config.js` → `periods`, por ejemplo `{ id: 'P01-2027', label: 'P01 · 2027' }`.

## Tipografía

La hoja de estilos usa `Vorwerk` si está instalada en la computadora; si no, `Nunito` (Google Fonts) y luego la fuente del sistema. Para incluir Vorwerk como archivo, agregar un `@font-face` al inicio de `css/styles.css`.

## Base compartida (Supabase)

La app usa Supabase si `js/config.js` tiene el bloque `supabase` (URL, clave publishable y dominio de usuarios de TL). Sin ese bloque, vuelve a guardar solo en el navegador.

- **TL**: entran con su usuario (ej. `laura`) y contraseña; la app completa `@tl.tharsa.com.ar`.
- **Administración**: entra con su mail completo y ve el panel con todas las TL (solo lectura).
- `js/supabase-store.js`: conexión y conversión de datos. `js/admin.js`: panel de administración.

Configuración en Supabase:
1. `supabase/schema.sql` (tablas, períodos, permisos y accesos).
2. Authentication: sin registro libre y sin confirmación por mail.
3. Crear usuarios en Authentication → Users y vincularlos con `supabase/usuarios.sql`.
4. Para sumar un período: `insert into periods (id, label, sort_order) values ('P01-2027', 'P01 · 2027', 14);`
