/* Capa de datos.
 *
 * Toda la aplicación lee y escribe SOLO a través de este objeto ("store").
 * Hoy usa LocalStorage. Para pasar a una base compartida (por ejemplo Supabase)
 * alcanza con crear otro store que respete la misma interfaz (todas las
 * funciones son asíncronas) y cambiar la línea `KGC.store = ...` al final.
 *
 * Interfaz:
 *   getSession() / setSession(s) / clearSession()
 *   findOrCreateTL(name) -> { id, name }
 *   getTL(id)            -> { id, name } | null
 *   renameTL(id, name)   -> { id, name }   (lanza Error('DUPLICATE') si el nombre ya existe)
 *   getPeriod(tlId, periodId) -> { goals: [], agents: [], actions: [] }
 *   create(tlId, periodId, collection, data)      -> item
 *   update(tlId, periodId, collection, id, patch) -> item
 *   remove(tlId, periodId, collection, id)
 *   removeWhere(tlId, periodId, collection, field, value)
 *
 * Colecciones ("collection"): 'goals' (objetivos del equipo), 'agents' (agentes
 * con sus objetivos, demos, ventas y seguimiento) y 'actions' (seguimiento semanal).
 * Cada una se corresponde con una tabla en supabase/schema.sql.
 */
window.KGC = window.KGC || {};

KGC.createLocalStore = function createLocalStore() {
  const PREFIX = 'kobold-gc:v1:';
  const COLLECTIONS = ['goals', 'agents', 'actions'];

  const read = (key, fallback) => {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  };
  const write = (key, value) => localStorage.setItem(PREFIX + key, JSON.stringify(value));

  const uid = () =>
    (window.crypto && crypto.randomUUID)
      ? crypto.randomUUID()
      : Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

  const normalizeName = (s) =>
    String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');

  const periodKey = (tlId, periodId) => `tl:${tlId}:period:${periodId}`;

  const loadPeriod = (tlId, periodId) => {
    const saved = read(periodKey(tlId, periodId), null) || {};
    const data = {};
    COLLECTIONS.forEach((c) => { data[c] = Array.isArray(saved[c]) ? saved[c] : []; });
    return data;
  };

  const checkCollection = (c) => {
    if (!COLLECTIONS.includes(c)) throw new Error('Colección desconocida: ' + c);
  };

  return {
    async getSession() { return read('session', null); },
    async setSession(session) { write('session', session); },
    async clearSession() { localStorage.removeItem(PREFIX + 'session'); },

    async findOrCreateTL(name) {
      const tls = read('tls', []);
      const key = normalizeName(name);
      let tl = tls.find((t) => t.key === key);
      if (!tl) {
        tl = { id: uid(), name: name.trim().replace(/\s+/g, ' '), key, createdAt: new Date().toISOString() };
        tls.push(tl);
        write('tls', tls);
      }
      return { id: tl.id, name: tl.name };
    },

    async getTL(id) {
      const tl = read('tls', []).find((t) => t.id === id);
      return tl ? { id: tl.id, name: tl.name } : null;
    },

    async renameTL(id, name) {
      const tls = read('tls', []);
      const key = normalizeName(name);
      if (tls.some((t) => t.key === key && t.id !== id)) throw new Error('DUPLICATE');
      const tl = tls.find((t) => t.id === id);
      if (!tl) throw new Error('NOT_FOUND');
      tl.name = name.trim().replace(/\s+/g, ' ');
      tl.key = key;
      write('tls', tls);
      return { id: tl.id, name: tl.name };
    },

    async getPeriod(tlId, periodId) {
      return loadPeriod(tlId, periodId);
    },

    async create(tlId, periodId, collection, data) {
      checkCollection(collection);
      const period = loadPeriod(tlId, periodId);
      const now = new Date().toISOString();
      const item = Object.assign({}, data, { id: uid(), createdAt: now, updatedAt: now });
      period[collection].push(item);
      write(periodKey(tlId, periodId), period);
      return item;
    },

    async update(tlId, periodId, collection, id, patch) {
      checkCollection(collection);
      const period = loadPeriod(tlId, periodId);
      const item = period[collection].find((x) => x.id === id);
      if (!item) throw new Error('NOT_FOUND');
      Object.assign(item, patch, { id, updatedAt: new Date().toISOString() });
      write(periodKey(tlId, periodId), period);
      return item;
    },

    async remove(tlId, periodId, collection, id) {
      checkCollection(collection);
      const period = loadPeriod(tlId, periodId);
      period[collection] = period[collection].filter((x) => x.id !== id);
      write(periodKey(tlId, periodId), period);
    },

    async removeWhere(tlId, periodId, collection, field, value) {
      checkCollection(collection);
      const period = loadPeriod(tlId, periodId);
      period[collection] = period[collection].filter((x) => x[field] !== value);
      write(periodKey(tlId, periodId), period);
    },
  };
};

/* Punto único de conexión. En el futuro: KGC.store = KGC.createSupabaseStore(cliente); */
KGC.store = KGC.createLocalStore();
