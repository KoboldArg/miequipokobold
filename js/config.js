/* Configuración general de la herramienta.
 * Para sumar períodos nuevos, agregarlos a la lista `periods`. */
window.KGC = window.KGC || {};

KGC.config = {
  appName: 'Gestión comercial de mi equipo',

  /* Base compartida. La clave "publishable" es pública por diseño: las reglas de la base
   * (supabase/schema.sql) limitan qué ve cada persona. Para usar solo este navegador, borrar este bloque. */
  supabase: {
    url: 'https://fmcpgrxqnacvxvqmzrjs.supabase.co',
    key: 'sb_publishable_Vcvb0moNzD5fph3XLZzAEw_zz5EOr-U',
    tlDomain: 'tl.tharsa.com.ar', // las TL escriben "laura" y entran como laura@tl.tharsa.com.ar
  },

  /* Períodos de respaldo (con Supabase, los períodos salen de la tabla "periods"). */
  periods: [
    { id: 'P12-2026', label: 'P12 · 2026' },
    { id: 'P13-2026', label: 'P13 · 2026' },
  ],

  goalTypes: {
    ventas:        { label: 'Ventas',        color: '#00AC46', soft: '#E6F7ED', auto: true,  autoText: 'Se calcula con las ventas de tus agentes' },
    reclutamiento: { label: 'Reclutamiento', color: '#734BA5', soft: '#F1ECF7', auto: false },
    demos:         { label: 'Demos',         color: '#3782CD', soft: '#EAF2FA', auto: true,  autoText: 'Se calcula con las demos de tus agentes' },
    otro:          { label: 'Otro',          color: '#F5A01E', soft: '#FEF4E4', auto: false },
  },

  actionStatuses: {
    pendiente:  'Pendiente',
    en_proceso: 'En proceso',
    realizado:  'Realizado',
  },

  actionSuggestions: [
    'Coordinar nuevas demos',
    'Retomar potenciales pendientes',
    'Acompañar una demo',
    'Trabajar el objetivo individual',
    'Conversar para conocer su motivación',
    'Acompañar a una agente nueva en sus primeras ventas',
  ],

  /* Criterios de color del avance individual (porcentaje del objetivo de ventas). */
  thresholds: {
    good: 75,   // 75% o más → verde
    follow: 40, // entre 40% y 74% → amarillo; menos de 40% → naranja (con actividad) o rojo (sin actividad)
  },
};
