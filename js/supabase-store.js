/* Capa de datos con Supabase: base compartida, ingreso con usuario y contraseña
 * y vista de administración. Respeta la misma interfaz que el store local
 * (ver js/storage.js), así el resto de la app no cambia. */
window.KGC = window.KGC || {};

KGC.createSupabaseStore = function createSupabaseStore(cfg) {
  const client = window.supabase.createClient(cfg.url, cfg.key, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: 'kobold-gc-auth' },
  });

  const TABLES = { goals: 'goals', agents: 'agents', actions: 'actions' };

  /* Nombres en la app (camelCase) ↔ columnas en la base (snake_case). */
  const FIELDS = {
    goals: { type: 'type', description: 'description', target: 'target', achieved: 'achieved' },
    agents: {
      name: 'name', status: 'status', target: 'target', sales: 'sales',
      demosTarget: 'demos_target', demosDone: 'demos_done', demosScheduled: 'demos_scheduled',
      personalGoal: 'personal_goal', needs: 'needs', nextAction: 'next_action',
      followUpDate: 'follow_up_date', notes: 'notes',
      demosScheduledWith: 'demos_scheduled_with', gtk: 'gtk', purchaseDate: 'purchase_date', gtkSales: 'gtk_sales',
    },
    actions: { agentId: 'agent_id', topic: 'topic', nextAction: 'next_action', date: 'date', status: 'status' },
  };
  /* Campos que en la app son '' y en la base son null. */
  const EMPTY_AS_NULL = new Set(['follow_up_date', 'date', 'agent_id', 'purchase_date']);

  function toDb(coll, obj) {
    const out = {};
    Object.entries(FIELDS[coll]).forEach(([app, db]) => {
      if (!(app in obj)) return;
      let v = obj[app];
      if (EMPTY_AS_NULL.has(db) && (v === '' || v === undefined)) v = null;
      out[db] = v;
    });
    return out;
  }

  function fromDb(coll, row) {
    const out = { id: row.id, createdAt: row.created_at, updatedAt: row.updated_at };
    Object.entries(FIELDS[coll]).forEach(([app, db]) => {
      let v = row[db];
      if (EMPTY_AS_NULL.has(db) && v == null) v = '';
      out[app] = v;
    });
    return out;
  }

  const check = ({ data, error }) => {
    if (error) throw error;
    return data;
  };

  const PERIOD_KEY = 'kobold-gc:v1:period';
  const readPeriod = () => { try { return localStorage.getItem(PERIOD_KEY); } catch (e) { return null; } };
  const writePeriod = (id) => { try { localStorage.setItem(PERIOD_KEY, id); } catch (e) { /* sin acceso */ } };

  /* Usuario → mail: las TL escriben solo su usuario ("laura"); administración, el mail completo. */
  const toEmail = (user) => {
    const u = String(user || '').trim().toLowerCase();
    return u.includes('@') ? u : `${u}@${cfg.tlDomain}`;
  };

  return {
    mode: 'supabase',

    /* ---------- Ingreso ---------- */
    async signIn(user, password) {
      const { error } = await client.auth.signInWithPassword({ email: toEmail(user), password });
      if (error) {
        const e = new Error(/invalid/i.test(error.message) ? 'CREDENTIALS' : 'NETWORK');
        e.cause = error;
        throw e;
      }
    },

    async signOut() {
      await client.auth.signOut();
    },

    /* Quién está conectada: TL, administración o nadie. */
    async getAccount() {
      const { data } = await client.auth.getSession();
      const session = data && data.session;
      if (!session) return null;
      const uid = session.user.id;
      const [tl, admin] = await Promise.all([
        client.from('team_leaders').select('id, name').eq('user_id', uid).maybeSingle(),
        client.from('admins').select('user_id, name').eq('user_id', uid).maybeSingle(),
      ]);
      if (tl.error) throw tl.error;
      if (admin.error) throw admin.error;
      return {
        email: session.user.email,
        tl: tl.data ? { id: tl.data.id, name: tl.data.name } : null,
        isAdmin: !!admin.data,
        adminName: admin.data ? admin.data.name : '',
      };
    },

    async getPeriods() {
      const rows = check(await client.from('periods').select('*').eq('active', true).order('sort_order'));
      /* Si la base todavía no tiene las fechas, se toman de la configuración. */
      const local = (id) => (KGC.config.periods.find((p) => p.id === id) || {});
      return rows.map((p) => ({ id: p.id, label: p.label, start: p.start_date || local(p.id).start || '', end: p.end_date || local(p.id).end || '' }));
    },

    /* ---------- Compatibilidad con la interfaz local ---------- */
    async getSession() { return { periodId: readPeriod() }; },
    async setSession(s) { if (s && s.periodId) writePeriod(s.periodId); },
    async clearSession() { await this.signOut(); },

    async getTL(id) {
      const row = check(await client.from('team_leaders').select('id, name').eq('id', id).maybeSingle());
      return row ? { id: row.id, name: row.name } : null;
    },

    async renameTL(id, name) {
      const row = check(await client.from('team_leaders').update({ name: name.trim().replace(/\s+/g, ' ') }).eq('id', id).select('id, name').single());
      return { id: row.id, name: row.name };
    },

    async getPeriod(tlId, periodId) {
      const q = (t) => client.from(t).select('*').eq('tl_id', tlId).eq('period_id', periodId);
      const [g, a, x] = await Promise.all([q('goals'), q('agents'), q('actions')]);
      return {
        goals: check(g).map((r) => fromDb('goals', r)),
        agents: check(a).map((r) => fromDb('agents', r)),
        actions: check(x).map((r) => fromDb('actions', r)),
      };
    },

    async create(tlId, periodId, coll, data) {
      const row = check(await client.from(TABLES[coll])
        .insert(Object.assign(toDb(coll, data), { tl_id: tlId, period_id: periodId }))
        .select('*').single());
      return fromDb(coll, row);
    },

    async update(tlId, periodId, coll, id, patch) {
      const row = check(await client.from(TABLES[coll]).update(toDb(coll, patch)).eq('id', id).select('*').single());
      return fromDb(coll, row);
    },

    async remove(tlId, periodId, coll, id) {
      check(await client.from(TABLES[coll]).delete().eq('id', id));
    },

    async removeWhere(tlId, periodId, coll, field, value) {
      const db = FIELDS[coll][field] || field;
      check(await client.from(TABLES[coll]).delete().eq('tl_id', tlId).eq('period_id', periodId).eq(db, value));
    },

    /* ---------- Administración: todo lo cargado en un período ---------- */
    async getAdminPeriod(periodId) {
      const [tls, g, a, x] = await Promise.all([
        client.from('team_leaders').select('id, name').order('name'),
        client.from('goals').select('*').eq('period_id', periodId),
        client.from('agents').select('*').eq('period_id', periodId),
        client.from('actions').select('*').eq('period_id', periodId),
      ]);
      const by = (rows, coll) => check(rows).map((r) => Object.assign(fromDb(coll, r), { tlId: r.tl_id }));
      return {
        tls: check(tls),
        goals: by(g, 'goals'),
        agents: by(a, 'agents'),
        actions: by(x, 'actions'),
      };
    },
  };
};

/* Si hay datos de Supabase en la configuración, la app usa la base compartida. */
(function chooseStore() {
  const cfg = KGC.config.supabase;
  if (!cfg) return;
  if (!window.supabase || !window.supabase.createClient) {
    KGC.storeError = 'NO_LIB';
    return;
  }
  KGC.store = KGC.createSupabaseStore(cfg);
})();
