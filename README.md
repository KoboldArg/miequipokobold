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
| `supabase/schema.sql` | Esquema propuesto para la base compartida |

## Agregar un período

Sumar una línea en `js/config.js` → `periods`, por ejemplo `{ id: 'P01-2027', label: 'P01 · 2027' }`.

## Tipografía

La hoja de estilos usa `Vorwerk` si está instalada en la computadora; si no, `Nunito` (Google Fonts) y luego la fuente del sistema. Para incluir Vorwerk como archivo, agregar un `@font-face` al inicio de `css/styles.css`.

## Paso a base de datos compartida (Supabase)

Toda la app usa `KGC.store` (definido al final de `js/storage.js`) con funciones asíncronas: `findOrCreateTL`, `getPeriod`, `create`, `update`, `remove`, `removeWhere`, etc. Para conectar Supabase:

1. Crear las tablas con `supabase/schema.sql` (incluye seguridad por TL y rol de administración).
2. Escribir `KGC.createSupabaseStore(client)` respetando la misma interfaz: cada colección (`goals`, `agents`, `actions`) es una tabla filtrada por `tl_id` y `period_id`.
3. Reemplazar el ingreso por nombre por el inicio de sesión de Supabase Auth.
4. Cambiar `KGC.store = KGC.createLocalStore()` por el nuevo store.
