/* Gestión comercial de mi equipo | Kobold — lógica de pantalla */
(function () {
  'use strict';

  const { config, calc, store } = KGC;
  const { n } = calc;
  const GTK = config.gtk;

  /* ---------------- Estado ---------------- */
  const state = {
    tl: null,
    periods: config.periods.slice(),
    periodId: config.periods[0].id,
    data: { goals: [], agents: [], actions: [] },
    search: '',
    statusFilter: 'todas',
    actionFilter: 'abiertas',
    currentAgentId: null,
    tab: 'resumen',
  };

  /* ---------------- Utilidades ---------------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const periodLabel = (id = state.periodId) => (state.periods.find((p) => p.id === id) || {}).label || id;
  const initials = (name) => String(name || '').trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase() || '·';
  const byName = (a, b) => String(a.name).localeCompare(String(b.name), 'es', { sensitivity: 'base' });
  const byCreated = (a, b) => String(a.createdAt).localeCompare(String(b.createdAt));
  const todayISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  /* Corrige años escritos con dos dígitos en el calendario (ej. "26" queda como 0026 → 2026). */
  const fixDate = (iso) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
    if (!m) return '';
    let y = Number(m[1]);
    if (y < 100) y += 2000;
    else if (y < 1900) return '';
    return `${y}-${m[2]}-${m[3]}`;
  };
  const fmtDate = (iso) => {
    iso = fixDate(iso);
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  };
  const fmtShort = (iso) => {
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
    const [, m, d] = iso.split('-');
    return `${Number(d)}/${Number(m)}`;
  };
  const daysText = (d) => (d === 0 ? 'hoy' : d === 1 ? '1 día' : `${d} días`);

  /* Aviso del plan GTK (tarjeta, ficha y resumen). */
  function gtkNotice(a, detailed) {
    const st = calc.gtkStatus(a);
    if (!st) return '';
    if (st.noDate) return '<div class="gtk-note gtk-info"><b>Plan GTK:</b> falta cargar la fecha de compra de la máquina.</div>';
    const ventas = (k) => `${k} ${k === 1 ? 'venta' : 'ventas'}`;
    if (st.level === 'done') return `<div class="gtk-note gtk-done"><b>Plan GTK cumplido:</b> llegó a ${GTK.sales} ventas.</div>`;
    if (st.level === 'ended') return `<div class="gtk-note gtk-ended"><b>Plan GTK terminado</b> el ${fmtDate(st.endDate)}. Quedó en ${n(a.gtkSales)} de ${GTK.sales} ventas.</div>`;
    const when = st.daysLeft === 0 ? 'termina hoy' : `termina en ${daysText(st.daysLeft)}`;
    if (st.level === 'warn') {
      return `<div class="gtk-note gtk-warn"><b>¡Plan GTK ${when}!</b> (${fmtShort(st.endDate)}) Le ${st.salesLeft === 1 ? 'falta' : 'faltan'} ${ventas(st.salesLeft)} para llegar a ${GTK.sales}.${detailed ? ' Conviene darle un seguimiento extra.' : ''}</div>`;
    }
    return `<div class="gtk-note gtk-info"><b>Plan GTK:</b> ${when} (${fmtShort(st.endDate)}). Lleva ${n(a.gtkSales)} de ${GTK.sales} ventas.</div>`;
  }

  /* '' → null (sin dato) ; número → entero ≥ 0 */
  const intOrNull = (v) => (v === '' || v == null ? null : n(v));
  const agentName = (id) => {
    const a = state.data.agents.find((x) => x.id === id);
    return a ? a.name : '';
  };

  const ICONS = {
    edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4"/></svg>',
    trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg>',
    users: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/></svg>',
    bag: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14l-1 12H6L5 8zM9 8V6a3 3 0 0 1 6 0v2"/></svg>',
    demo: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5h18v11H3zM8 20h8M12 16v4"/><path d="m10 8.5 4 2-4 2z"/></svg>',
    flag: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></svg>',
    userPlus: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M19 8v6M16 11h6"/></svg>',
    back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>',
  };

  /* ---------------- Mensajes ---------------- */
  let toastTimer;
  function toast(msg, type) {
    const el = $('#toast');
    el.textContent = msg;
    el.className = 'toast show' + (type === 'error' ? ' error' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.className = 'toast' + (type === 'error' ? ' error' : ''); }, 2600);
  }

  function confirmDialog({ title, message, confirmLabel = 'Eliminar' }) {
    return new Promise((resolve) => {
      const dlg = $('#confirm');
      $('#confirm-title').textContent = title;
      $('#confirm-msg').textContent = message;
      $('#confirm-yes').textContent = confirmLabel;
      let answered = false;
      const finish = (val) => {
        if (answered) return;
        answered = true;
        if (dlg.open) dlg.close();
        resolve(val);
      };
      $('#confirm-yes').onclick = () => finish(true);
      $('#confirm-no').onclick = () => finish(false);
      dlg.onclose = () => finish(false);
      dlg.onclick = (e) => { if (e.target === dlg) finish(false); };
      dlg.showModal();
      $('#confirm-no').focus();
    });
  }

  /* ---------------- Modal de formularios ---------------- */
  function openModal({ title, body, submitLabel = 'Guardar', onSubmit, onOpen }) {
    const dlg = $('#modal');
    const form = $('#modal-form');
    $('#modal-title').textContent = title;
    $('#modal-body').innerHTML = body;
    $('#modal-submit').hidden = !submitLabel;
    $('.modal-foot [data-close]').textContent = submitLabel ? 'Cancelar' : 'Cerrar';
    if (submitLabel) $('#modal-submit').textContent = submitLabel;
    form.onsubmit = async (e) => {
      e.preventDefault();
      if (!onSubmit) return;
      const ok = await onSubmit(form);
      if (ok !== false && dlg.open) dlg.close();
    };
    if (!dlg.open) dlg.showModal();
    $('#modal-body').scrollTop = 0;
    if (onOpen) onOpen(form);
    const first = form.querySelector('[autofocus]') || form.querySelector('#modal-body input:not([type=radio]):not([type=checkbox]), #modal-body textarea');
    if (first && window.matchMedia('(min-width: 641px)').matches) first.focus();
  }
  function closeModal() { const d = $('#modal'); if (d.open) d.close(); }

  function showFieldError(input, msg) {
    input.classList.add('invalid');
    let err = input.closest('.field').querySelector('.field-error');
    if (!err) {
      err = document.createElement('p');
      err.className = 'field-error';
      input.closest('.field').appendChild(err);
    }
    err.textContent = msg;
    input.focus();
  }

  /* Componentes de formulario */
  const stepperField = (name, label, value, opts = {}) => `
    <div class="field">
      <label for="f-${name}">${label}${opts.optional ? ' <span class="opt">(opcional)</span>' : ''}</label>
      <div class="stepper">
        <button type="button" data-step="-1" aria-label="Restar uno">−</button>
        <input id="f-${name}" name="${name}" type="number" inputmode="numeric" min="0" step="1" value="${value == null ? '' : esc(value)}" ${opts.placeholder ? `placeholder="${esc(opts.placeholder)}"` : ''}>
        <button type="button" data-step="1" aria-label="Sumar uno">+</button>
      </div>
      ${opts.help ? `<p class="field-help">${opts.help}</p>` : ''}
    </div>`;

  const textField = (name, label, value, opts = {}) => `
    <div class="field">
      <label for="f-${name}">${label}${opts.optional ? ' <span class="opt">(opcional)</span>' : ''}</label>
      ${opts.multiline
        ? `<textarea id="f-${name}" name="${name}" placeholder="${esc(opts.placeholder || '')}" maxlength="1000">${esc(value || '')}</textarea>`
        : `<input id="f-${name}" name="${name}" type="${opts.type || 'text'}" value="${esc(value || '')}" placeholder="${esc(opts.placeholder || '')}" ${opts.type === 'date' ? '' : 'maxlength="200"'} ${opts.autofocus ? 'autofocus' : ''} ${opts.list ? `list="${opts.list}"` : ''}>`}
    </div>`;

  const choiceGroup = (name, options, selected) => `
    <div class="choice-group" role="radiogroup">
      ${options.map((o) => `
        <label class="choice" ${o.color ? `style="--c:${o.color}"` : ''}>
          <input type="radio" name="${name}" value="${esc(o.value)}" ${o.value === selected ? 'checked' : ''}>
          <span>${esc(o.label)}</span>
        </label>`).join('')}
    </div>`;

  /* Botones + / − de los contadores (delegado) */
  function stepInput(btn) {
    const input = btn.parentElement.querySelector('input');
    const next = Math.max(0, n(input.value) + Number(btn.dataset.step));
    input.value = next;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /* ---------------- Datos ---------------- */
  async function loadPeriod() {
    const d = await store.getPeriod(state.tl.id, state.periodId);
    state.data = {
      goals: d.goals.slice().sort(byCreated),
      agents: d.agents.map(normalizeAgent).sort(byName),
      actions: d.actions.map((x) => Object.assign({}, x, { date: fixDate(x.date) })),
    };
    state.prevAgents = [];
    const prev = prevPeriod();
    if (prev) {
      try {
        const p = await store.getPeriod(state.tl.id, prev.id);
        state.prevAgents = p.agents.map(normalizeAgent).sort(byName);
      } catch (err) {
        console.error(err);
      }
    }
  }

  /* Período anterior (según el orden de los períodos). Las agentes pasan de ese al actual. */
  function prevPeriod() {
    const i = state.periods.findIndex((p) => p.id === state.periodId);
    return i > 0 ? state.periods[i - 1] : null;
  }

  /* Agentes del período anterior que todavía no están en este (por nombre). */
  function missingAgents() {
    const here = new Set(state.data.agents.map((a) => fold(a.name)));
    return (state.prevAgents || []).filter((a) => !here.has(fold(a.name)));
  }

  /* Qué pasa de una agente al período siguiente: sus datos y su seguimiento.
   * Empiezan de cero los objetivos individuales y lo hecho (ventas y demos). */
  function carryAgent(a) {
    return emptyAgent({
      name: a.name,
      status: a.status,
      gtk: !!a.gtk,
      purchaseDate: a.purchaseDate || '',
      gtkSales: n(a.gtkSales),
      demosScheduled: n(a.demosScheduled),
      demosScheduledWith: a.demosScheduledWith || '',
      personalGoal: a.personalGoal || '',
      needs: a.needs || '',
      notes: a.notes || '',
      nextAction: a.nextAction || '',
      followUpDate: a.followUpDate || '',
    });
  }

  async function copyAgents(list) {
    for (const a of list.slice().sort(byName)) {
      const data = carryAgent(a);
      const saved = await create('agents', data);
      if (data.nextAction) await syncAgentAction(saved.id, '', data.nextAction, data.followUpDate);
    }
  }

  /* La primera vez que se abre un período vacío, se traen solas las agentes del anterior. */
  async function autoCarry() {
    if (state.data.agents.length || !(state.prevAgents || []).length) return false;
    const key = `kobold-gc:v1:carried:${state.tl.id}:${state.periodId}`;
    try { if (localStorage.getItem(key)) return false; } catch (e) { /* sin acceso */ }
    const prev = prevPeriod();
    try {
      await copyAgents(state.prevAgents);
      try { localStorage.setItem(key, '1'); } catch (e) { /* sin acceso */ }
      await loadPeriod();
      const k = state.data.agents.length;
      toast(`Trajimos tus ${k} ${k === 1 ? 'agente' : 'agentes'} de ${prev.label}. Sus ventas y demos empiezan en cero.`);
      return true;
    } catch (err) {
      console.error(err);
      toast('No pudimos traer tus agentes del período anterior. Probá de nuevo.', 'error');
      return false;
    }
  }

  /* Compatibilidad con la versión anterior: "demos planificadas" pasa a ser el objetivo de demos. */
  function normalizeAgent(a) {
    const x = Object.assign({}, a);
    if (x.demosTarget === undefined) x.demosTarget = x.demosPlanned == null ? null : n(x.demosPlanned);
    if (x.demosScheduled === undefined) x.demosScheduled = 0;
    if (x.demosScheduledWith == null) x.demosScheduledWith = '';
    x.gtk = !!x.gtk;
    x.purchaseDate = fixDate(x.purchaseDate);
    x.followUpDate = fixDate(x.followUpDate);
    if (x.gtkSales == null) x.gtkSales = 0;
    delete x.demosPlanned;
    return x;
  }

  /* Barra de avance: hechas (color lleno) + agendadas (mismo color, más claro). */
  function metric({ label, done, target, scheduled = null, unit, compact = false, color: fixed }) {
    const pct = calc.percent(done, target);
    const color = fixed || calc.levelColor(pct);
    const has = calc.hasTarget(target);
    const left = calc.pending(done, target);
    const doneW = calc.barWidth(pct);
    const schedW = has && scheduled ? Math.min(100 - doneW, Math.round((n(scheduled) / n(target)) * 100)) : 0;
    let foot = !has
      ? 'Sin objetivo definido'
      : left > 0 ? `${pct}% · faltan ${left}` : `${pct}% · ¡objetivo cumplido!`;
    if (compact) foot = has ? `<b>${n(done)} de ${n(target)}</b> · ${pct}%` : `<b>${n(done)}</b> · sin objetivo`;
    return `
      <div class="metric ${compact ? 'metric-compact' : ''}">
        <div class="metric-top">
          <span class="metric-label">${label}</span>
          <span class="metric-val"><b>${n(done)}</b>${has ? ` de ${n(target)}` : ''} ${unit}</span>
        </div>
        <div class="bar bar-split" role="img" aria-label="${n(done)} ${unit} hechas${has ? ` de ${n(target)}` : ''}${scheduled ? `, ${n(scheduled)} agendadas` : ''}">
          <span style="width:${doneW}%;background:${color}"></span>${schedW ? `<span class="sched" style="width:${schedW}%;background:${color}"></span>` : ''}
        </div>
        <div class="metric-foot">
          <span>${foot}</span>
          ${scheduled ? `<span class="sched-note"><i style="background:${color}"></i>${n(scheduled)} agendada${n(scheduled) === 1 ? '' : 's'}</span>` : ''}
        </div>
      </div>`;
  }

  async function mutate(fn, okMsg) {
    try {
      await fn();
      await loadPeriod();
      refresh();
      if (okMsg) toast(okMsg);
      return true;
    } catch (err) {
      console.error(err);
      toast('No pudimos guardar los cambios. Intentá de nuevo.', 'error');
      return false;
    }
  }
  const create = (coll, data) => store.create(state.tl.id, state.periodId, coll, data);
  const update = (coll, id, patch) => store.update(state.tl.id, state.periodId, coll, id, patch);
  const remove = (coll, id) => store.remove(state.tl.id, state.periodId, coll, id);

  /* ---------------- Inicio ---------------- */
  const isShared = () => store.mode === 'supabase';

  async function init() {
    bindGlobalEvents();
    setupWelcome();
    if (KGC.storeError) {
      showWelcome('No pudimos conectar con la base de datos. Revisá tu conexión a internet y volvé a cargar la página.');
      return;
    }
    try {
      if (isShared()) {
        const account = await store.getAccount();
        if (account) return openAccount(account);
        return showWelcome();
      }
      const session = await store.getSession();
      if (session && session.tlId) {
        const tl = await store.getTL(session.tlId);
        if (tl) {
          state.tl = tl;
          await loadPeriods(session.periodId);
          return enterApp();
        }
      }
      showWelcome();
    } catch (err) {
      console.error(err);
      showWelcome('No pudimos conectar con la base de datos. Revisá tu conexión y volvé a intentar.');
    }
  }

  /* Períodos: de la base (Supabase) o de la configuración (modo local). */
  async function loadPeriods(preferred) {
    try {
      const list = await store.getPeriods();
      if (list && list.length) state.periods = list;
    } catch (err) {
      console.error(err);
    }
    const saved = preferred || ((await store.getSession()) || {}).periodId;
    state.periodId = state.periods.some((p) => p.id === saved) ? saved : state.periods[0].id;
  }

  function setupWelcome() {
    $('#login-fields').hidden = !isShared();
    $('#name-fields').hidden = isShared();
    $('#welcome-submit').textContent = isShared() ? 'Ingresar' : 'Comenzar';
    $('#welcome-note').textContent = isShared()
      ? 'Si no tenés usuario o te olvidaste la contraseña, pedíselo a administración.'
      : 'Tu información se guarda en este navegador. Si ya ingresaste antes, escribí el mismo nombre para volver a tu espacio.';
    $('#pass-toggle').addEventListener('click', () => {
      const input = $('#login-pass');
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      $('#pass-toggle').textContent = show ? 'Ocultar' : 'Ver';
      $('#pass-toggle').setAttribute('aria-label', show ? 'Ocultar contraseña' : 'Mostrar contraseña');
    });
  }

  function welcomeError(msg, input) {
    const el = $('#welcome-error');
    el.textContent = msg;
    el.hidden = !msg;
    $$('#welcome-form input').forEach((i) => i.classList.remove('invalid'));
    if (input) { input.classList.add('invalid'); input.focus(); }
  }

  function showWelcome(message) {
    $('#screen-app').hidden = true;
    $('#screen-admin').hidden = true;
    $('#screen-welcome').hidden = false;
    document.title = 'Gestión comercial de mi equipo | Kobold';
    $('#welcome-name').value = '';
    $('#login-pass').value = '';
    $('#login-pass').type = 'password';
    $('#pass-toggle').textContent = 'Ver';
    welcomeError(message || '');
    const first = isShared() ? $('#login-user') : $('#welcome-name');
    setTimeout(() => first.focus(), 50);
  }

  async function handleWelcome(e) {
    e.preventDefault();
    const btn = $('#welcome-submit');
    if (isShared()) {
      const user = $('#login-user').value.trim();
      const pass = $('#login-pass').value;
      if (!user) return welcomeError('Escribí tu usuario.', $('#login-user'));
      if (!pass) return welcomeError('Escribí tu contraseña.', $('#login-pass'));
      btn.disabled = true;
      btn.textContent = 'Ingresando…';
      try {
        await store.signIn(user, pass);
        const account = await store.getAccount();
        $('#login-pass').value = '';
        await openAccount(account, true);
      } catch (err) {
        console.error(err);
        welcomeError(err.message === 'CREDENTIALS'
          ? 'El usuario o la contraseña no son correctos. Revisalos y probá de nuevo.'
          : 'No pudimos conectar. Revisá tu conexión a internet y probá de nuevo.', $('#login-pass'));
      } finally {
        btn.disabled = false;
        btn.textContent = 'Ingresar';
      }
      return;
    }

    const input = $('#welcome-name');
    const name = input.value.trim();
    if (!name) return welcomeError('Escribí tu nombre para comenzar.', input);
    try {
      state.tl = await store.findOrCreateTL(name);
      await loadPeriods();
      await saveSession();
      if (location.hash && location.hash !== '#/') history.replaceState(null, '', '#/');
      await enterApp();
      toast(`¡Hola, ${state.tl.name.split(' ')[0]}! Este es tu espacio.`);
    } catch (err) {
      console.error(err);
      toast('No pudimos abrir tu espacio. Intentá de nuevo.', 'error');
    }
  }

  /* Abre el espacio que corresponde a la cuenta: TL, administración o sin habilitar. */
  async function openAccount(account, greet) {
    if (account && account.tl) {
      state.tl = account.tl;
      await loadPeriods();
      if (greet && location.hash && location.hash !== '#/') history.replaceState(null, '', '#/');
      await enterApp();
      if (greet) toast(`¡Hola, ${state.tl.name.split(' ')[0]}!`);
      return;
    }
    if (account && account.isAdmin) {
      await loadPeriods();
      return KGC.admin.open({ name: account.adminName || account.email, periods: state.periods, periodId: state.periodId });
    }
    await store.signOut();
    showWelcome('Tu usuario todavía no está habilitado como Team Leader. Pedile a administración que lo active.');
  }

  const saveSession = () => store.setSession({ tlId: state.tl.id, periodId: state.periodId });

  async function enterApp() {
    $('#screen-welcome').hidden = true;
    $('#screen-admin').hidden = true;
    $('#screen-app').hidden = false;
    renderHeader();
    try {
      await loadPeriod();
      await autoCarry();
    } catch (err) {
      console.error(err);
      toast('No pudimos traer tus datos. Revisá tu conexión y volvé a cargar la página.', 'error');
    }
    await route();
    if (!state.currentAgentId) KGC.tour.startOnce();
  }

  /* ---------------- Navegación ---------------- */
  async function route() {
    await flushFicha();
    const m = location.hash.match(/^#\/agente\/([^/]+)$/);
    if (m && state.tl) {
      showFicha(decodeURIComponent(m[1]));
    } else {
      const t = location.hash.match(/^#\/(agentes|seguimiento)$/);
      state.tab = t ? t[1] : 'resumen';
      showDashboard();
    }
  }

  function showDashboard() {
    state.currentAgentId = null;
    $('#view-agent').hidden = true;
    $('#view-agent').innerHTML = '';
    $('#view-dashboard').hidden = false;
    renderDashboard();
    if (state.returnTo) {
      state.returnTo = null;
      const tabs = $('#tabs');
      window.scrollTo(0, Math.max(0, tabs.getBoundingClientRect().top + window.scrollY - 80));
    }
  }

  function refresh() {
    renderHeader();
    if (state.currentAgentId) {
      const a = state.data.agents.find((x) => x.id === state.currentAgentId);
      if (!a) { location.hash = '#/agentes'; return; }
      updateFichaComputed(a);
      renderFichaActions(a);
    } else {
      renderDashboard();
    }
  }

  /* ---------------- Encabezado ---------------- */
  function renderHeader() {
    $('#tl-name').textContent = state.tl.name;
    $('#tl-avatar').textContent = initials(state.tl.name);
    $('#tl-avatar-sm').textContent = initials(state.tl.name);
    $('#hello').textContent = `¡Hola, ${state.tl.name.split(' ')[0]}!`;
    document.title = `Gestión comercial de mi equipo | Kobold`;
  }

  function editTL() {
    openModal({
      title: 'Editar mi nombre',
      body: `<div class="form-grid">${textField('name', 'Nombre de la Team Leader', state.tl.name, { placeholder: 'Escribí tu nombre', autofocus: true })}</div>`,
      onSubmit: async (form) => {
        const input = form.elements.name;
        const name = input.value.trim();
        if (!name) { showFieldError(input, 'Escribí tu nombre.'); return false; }
        try {
          state.tl = await store.renameTL(state.tl.id, name);
          renderHeader();
          toast('Tu nombre se actualizó');
        } catch (err) {
          if (err.message === 'DUPLICATE') { showFieldError(input, 'Ya existe otro espacio con ese nombre en este navegador.'); return false; }
          toast('No pudimos guardar el cambio.', 'error');
          return false;
        }
      },
    });
  }

  async function logout() {
    closeModal();
    KGC.tour.stop();
    await flushFicha();
    await store.clearSession();
    state.tl = null;
    state.currentAgentId = null;
    history.replaceState(null, '', '#/');
    showWelcome();
  }

  /* ---------------- Dashboard ---------------- */
  const TABS = ['resumen', 'agentes', 'seguimiento'];

  function renderDashboard() {
    renderPeriod();
    renderTabs();
    renderStart();
    renderGoals();
    renderCompare();
    renderAgents();
    renderActions();
  }

  function renderTabs() {
    TABS.forEach((t) => {
      const on = state.tab === t;
      const btn = $(`#tab-${t}`);
      btn.setAttribute('aria-selected', String(on));
      btn.classList.toggle('is-active', on);
      $(`#panel-${t}`).hidden = !on;
    });
    updateBottomNav(state.tab);
  }

  /* Barra inferior del celular: también se ve dentro de la ficha (marca "Mis agentes"). */
  function updateBottomNav(active) {
    const agents = state.data.agents.length;
    const open = state.data.actions.filter((x) => x.status !== 'realizado').length;
    $('#count-agentes').textContent = agents || '';
    $('#count-seguimiento').textContent = open || '';
    $('#bcount-agentes').textContent = agents || '';
    $('#bcount-seguimiento').textContent = open || '';
    TABS.forEach((t) => {
      const b = $(`#bnav-${t}`);
      b.classList.toggle('is-active', t === active);
      if (t === active) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
  }

  function accountMenu() {
    openModal({
      title: 'Mi cuenta',
      submitLabel: null,
      body: `
        <div class="account-box">
          <span class="tl-avatar tl-avatar-lg" aria-hidden="true">${esc(initials(state.tl.name))}</span>
          <div><small>Team Leader</small><strong>${esc(state.tl.name)}</strong></div>
        </div>
        <div class="account-actions">
          <button type="button" class="btn btn-outline btn-block" data-act="edit-tl">${ICONS.edit} Editar mi nombre</button>
          <button type="button" class="btn btn-ghost btn-block" data-act="logout">Salir</button>
        </div>`,
    });
  }

  function setTab(tab) {
    if (!TABS.includes(tab)) tab = 'resumen';
    state.tab = tab;
    const hash = tab === 'resumen' ? '#/' : `#/${tab}`;
    if (state.currentAgentId) { location.hash = hash; return; }
    if (location.hash !== hash) history.replaceState(null, '', hash);
    renderTabs();
  }

  function renderPeriod() {
    $('#period-switch').innerHTML = state.periods.map((p) => `
      <button type="button" class="period-btn" role="radio" aria-checked="${p.id === state.periodId}" data-act="period" data-id="${p.id}">
        <strong>${esc(p.label)}</strong>
        ${p.start && p.end ? `<span class="period-dates">${fmtShort(p.start)} al ${fmtShort(p.end)}</span>` : ''}
      </button>`).join('');
    const cur = state.periods.find((p) => p.id === state.periodId);
    const st = calc.periodStatus(cur);
    const info = $('#period-info');
    info.hidden = !st;
    if (st) {
      info.className = `period-info is-${st.state}${st.state === 'current' && st.days <= 7 ? ' is-closing' : ''}`;
      info.innerHTML = st.state === 'current'
        ? (st.days === 0
          ? `<b>Hoy cierra ${esc(cur.label)}.</b> Último día para llegar a los objetivos.`
          : `Faltan <b>${daysText(st.days)}</b> para el cierre de ${esc(cur.label)} (${fmtShort(cur.end)}).`)
        : st.state === 'future'
          ? `${esc(cur.label)} empieza el ${fmtShort(cur.start)} (en ${daysText(st.days)}).`
          : `${esc(cur.label)} terminó el ${fmtShort(cur.end)}.`;
    }
  }

  async function changePeriod(id) {
    if (id === state.periodId) return;
    state.periodId = id;
    state.search = '';
    $('#agent-search').value = '';
    state.statusFilter = 'todas';
    await saveSession();
    await loadPeriod();
    const carried = await autoCarry();
    renderDashboard();
    if (!carried) toast(`Estás viendo ${periodLabel()}`);
  }

  /* ----- Objetivos del equipo ----- */
  const GOAL_INFO = {
    ventas: {
      label: 'Ventas', hint: 'Ventas del equipo', defaultTitle: 'Ventas del equipo', unit: 'ventas',
      icon: 'bag', color: '#00AC46', soft: '#E6F7ED', ink: '#008F3A',
      question: '¿Cuántas ventas querés lograr con tu equipo?',
      how: 'El avance se suma solo con las ventas que cargás en cada agente.',
    },
    demos: {
      label: 'Demos', hint: 'Demos del equipo', defaultTitle: 'Demos del equipo', unit: 'demos',
      icon: 'demo', color: '#3782CD', soft: '#EAF2FA', ink: '#2F6FAF',
      question: '¿Cuántas demos querés que haga tu equipo?',
      how: 'El avance se suma solo con las demos que cargás en cada agente.',
    },
    reclutamiento: {
      label: 'Reclutamiento', hint: 'Sumar agentes nuevas', defaultTitle: 'Incorporar agentes nuevas', unit: 'agentes',
      icon: 'userPlus', color: '#734BA5', soft: '#F1ECF7', ink: '#734BA5',
      question: '¿Cuántas agentes nuevas querés incorporar?',
      how: 'Cada vez que se sume una agente nueva, tocá el botón + en la tarjeta del objetivo.',
    },
    otro: {
      label: 'Otro', hint: 'Lo que vos quieras', defaultTitle: 'Otro objetivo', unit: '',
      icon: 'flag', color: '#F5A01E', soft: '#FEF4E4', ink: '#B66F00',
      question: '¿Cuántas veces o cuántas personas?',
      how: 'Vas sumando lo logrado con los botones + y − en la tarjeta del objetivo.',
    },
  };
  const GOAL_ORDER = { ventas: 0, demos: 1, reclutamiento: 2, otro: 3 };
  const goalInfo = (type) => GOAL_INFO[type] || GOAL_INFO.otro;
  const goalVars = (i) => `--c:${i.color};--c-soft:${i.soft};--c-ink:${i.ink}`;

  function goalTitle(g) {
    return g.description && g.description.trim() ? g.description : goalInfo(g.type).defaultTitle;
  }

  function goalTypeButtons() {
    return `<div class="goal-type-grid">${Object.entries(GOAL_INFO).map(([type, i]) => `
      <button type="button" class="goal-type" style="${goalVars(i)}" data-act="add-goal" data-type="${type}">
        <span class="goal-type-icon" aria-hidden="true">${ICONS[i.icon]}</span>
        <span class="goal-type-label">${i.label}</span>
        <span class="goal-type-hint">${i.hint}</span>
      </button>`).join('')}</div>`;
  }

  function renderGtkAlerts() {
    const box = $('#gtk-alerts');
    const list = state.data.agents
      .filter((a) => a.status !== 'inactiva')
      .map((a) => ({ a, st: calc.gtkStatus(a) }))
      .filter((x) => x.st && x.st.level === 'warn')
      .sort((x, y) => x.st.daysLeft - y.st.daysLeft);
    box.hidden = !list.length;
    box.innerHTML = list.length ? `
      <h2>Planes GTK por terminar</h2>
      <ul>
        ${list.map(({ a, st }) => `
          <li>
            <div><b>${esc(a.name)}</b><span>${st.daysLeft === 0 ? 'Termina hoy' : `Termina en ${daysText(st.daysLeft)}`} (${fmtShort(st.endDate)}) · le ${st.salesLeft === 1 ? 'falta' : 'faltan'} ${st.salesLeft} ${st.salesLeft === 1 ? 'venta' : 'ventas'}</span></div>
            <button class="btn btn-outline btn-sm" data-act="view-agent" data-id="${a.id}">Ver ficha</button>
          </li>`).join('')}
      </ul>` : '';
  }

  function renderGoals() {
    renderGtkAlerts();
    const { goals, agents } = state.data;
    const t = calc.teamTotals(agents);
    $('#team-size').textContent = t.count
      ? `${periodLabel()} · ${t.count} ${t.count === 1 ? 'agente' : 'agentes'} en el equipo (${t.active} ${t.active === 1 ? 'activa' : 'activas'})`
      : `${periodLabel()} · todavía sin agentes cargadas`;
    $('#btn-add-goal-top').hidden = goals.length === 0;

    if (!goals.length) {
      $('#goals').innerHTML = `
        <div class="goal-starter">
          <p class="goal-starter-title">¿Qué objetivo querés cargar para ${esc(periodLabel())}? Elegí uno para empezar:</p>
          ${goalTypeButtons()}
        </div>`;
      return;
    }
    const list = goals.slice().sort((a, b) => (GOAL_ORDER[a.type] ?? 3) - (GOAL_ORDER[b.type] ?? 3) || byCreated(a, b));
    $('#goals').innerHTML = `<div class="goals-grid">${list.map((g) => goalCard(g, t)).join('')}</div>`;
  }

  function goalCard(g, t) {
    const i = goalInfo(g.type);
    const auto = calc.isAuto(g.type);
    const done = calc.goalAchieved(g, t);
    const has = calc.hasTarget(g.target);
    const pct = calc.percent(done, g.target);
    const left = calc.pending(done, g.target);
    const scheduled = g.type === 'demos' ? t.demosScheduled : 0;
    const doneW = calc.barWidth(pct);
    const schedW = has && scheduled ? Math.min(100 - doneW, Math.round((scheduled / n(g.target)) * 100)) : 0;

    let note = '';
    if (auto && has && t.active) {
      const sum = g.type === 'ventas' ? t.salesTargets : t.demosTargets;
      const diff = n(g.target) - sum;
      if (!sum) note = `Todavía no le pusiste objetivo de ${i.unit} a tus agentes.`;
      else if (diff > 0) note = `Repartiste <b>${sum}</b> entre tus agentes. Te faltan repartir <b>${diff}</b>.`;
      else if (diff < 0) note = `Repartiste <b>${sum}</b> entre tus agentes: <b>${-diff}</b> más que el objetivo.`;
      else note = `Repartiste <b>${sum}</b> entre tus agentes ✓`;
    } else if (auto) {
      note = i.how;
    }

    const counter = auto ? '' : `
      <div class="mini-stepper" role="group" aria-label="Sumar o restar lo logrado">
        <button type="button" data-act="goal-step" data-id="${g.id}" data-delta="-1" aria-label="Restar uno" ${done === 0 ? 'disabled' : ''}>−</button>
        <button type="button" data-act="goal-step" data-id="${g.id}" data-delta="1" aria-label="Sumar uno">+</button>
      </div>`;

    return `
      <article class="tgoal" style="${goalVars(i)}">
        <div class="tgoal-head">
          <span class="tgoal-icon" aria-hidden="true">${ICONS[i.icon]}</span>
          <div class="tgoal-titles">
            <span class="tgoal-type">${i.label}</span>
            <h3>${esc(goalTitle(g))}</h3>
          </div>
          <div class="goal-actions">
            <button class="icon-btn" data-act="edit-goal" data-id="${g.id}" aria-label="Editar objetivo" title="Editar">${ICONS.edit}</button>
            <button class="icon-btn" data-act="delete-goal" data-id="${g.id}" aria-label="Eliminar objetivo" title="Eliminar">${ICONS.trash}</button>
          </div>
        </div>
        <div class="tgoal-row">
          <p class="tgoal-num"><b>${done}</b>${has ? ` de ${n(g.target)}` : ` ${auto ? i.unit : 'logrado'}`}</p>
          ${counter}
        </div>
        ${has ? `
          <div class="bar bar-lg bar-split" role="img" aria-label="${done} de ${n(g.target)}${scheduled ? `, ${scheduled} agendadas` : ''}">
            <span style="width:${doneW}%;background:${i.color}"></span>${schedW ? `<span class="sched" style="width:${schedW}%;background:${i.color}"></span>` : ''}
          </div>
          <div class="tgoal-foot">
            <span><b>${pct}%</b> de avance</span>
            ${left > 0 ? `<span>Faltan <b>${left}</b></span>` : '<span class="tgoal-done">¡Cumplido!</span>'}
          </div>
          ${scheduled ? `<p class="tgoal-sched"><i></i>${scheduled} ${scheduled === 1 ? 'demo agendada' : 'demos agendadas'} (todavía no hechas)</p>` : ''}`
        : `<button class="btn btn-primary btn-sm tgoal-cta" data-act="edit-goal" data-id="${g.id}">Poner cantidad objetivo</button>`}
        ${note ? `<p class="tgoal-note">${note}</p>` : ''}
      </article>`;
  }

  /* Agregar o editar un objetivo. Sin tipo: primero se elige el tipo. */
  function goalForm(goal, presetType) {
    const isNew = !goal;
    if (isNew && !presetType) {
      openModal({
        title: '¿Qué objetivo querés agregar?',
        body: goalTypeButtons(),
        submitLabel: null,
      });
      return;
    }
    const existing = isNew && calc.UNIQUE_TYPES.includes(presetType) ? calc.findGoal(state.data.goals, presetType) : null;
    if (existing) {
      toast(`Ya tenés un objetivo de ${goalInfo(presetType).label.toLowerCase()}: podés cambiarlo acá`);
      goalForm(existing);
      return;
    }
    const g = goal || { type: presetType, description: '', target: null, achieved: 0 };
    const typeOptions = Object.entries(GOAL_INFO).map(([value, i]) => ({ value, label: i.label, color: i.color }));

    openModal({
      title: isNew ? 'Nuevo objetivo del equipo' : 'Editar objetivo',
      submitLabel: isNew ? 'Agregar objetivo' : 'Guardar cambios',
      body: `
        <div class="form-grid">
          <div class="field">
            <span class="field-label">Tipo de objetivo</span>
            ${choiceGroup('type', typeOptions, g.type)}
          </div>
          <div class="field">
            <label for="f-description" id="lbl-description"></label>
            <input id="f-description" name="description" type="text" maxlength="200" value="${esc(g.description || '')}">
          </div>
          ${stepperField('target', '<span id="lbl-target"></span>', g.target, { placeholder: 'Sin definir' })}
          <div id="achieved-wrap">${stepperField('achieved', 'Lo logrado hasta hoy', n(g.achieved))}</div>
          <p class="how-box" id="how-box"></p>
        </div>`,
      onOpen: (form) => {
        const el = form.elements;
        const sync = () => {
          const type = el.type.value;
          const i = goalInfo(type);
          const auto = calc.isAuto(type);
          $('#lbl-description', form).innerHTML = type === 'otro'
            ? '¿Qué querés lograr?'
            : 'Nombre del objetivo <span class="opt">(opcional)</span>';
          el.description.placeholder = type === 'otro' ? 'Ej.: activar a 2 agentes inactivas' : i.defaultTitle;
          $('#lbl-target', form).textContent = `${i.question} (${periodLabel()})`;
          $('#achieved-wrap', form).hidden = auto || isNew;
          $('#how-box', form).textContent = i.how;
        };
        form.onchange = (e) => { if (e.target.name === 'type') sync(); };
        sync();
      },
      onSubmit: async (form) => {
        const el = form.elements;
        const type = el.type.value;
        const description = el.description.value.trim();
        if (type === 'otro' && !description) { showFieldError(el.description, 'Escribí qué querés lograr.'); return false; }
        if (calc.UNIQUE_TYPES.includes(type)) {
          const other = calc.findGoal(state.data.goals, type);
          if (other && (!goal || other.id !== goal.id)) {
            showFieldError(el.description, `Ya tenés un objetivo de ${goalInfo(type).label.toLowerCase()} en este período. Editá ese.`);
            return false;
          }
        }
        const data = { type, description, target: intOrNull(el.target.value) };
        if (!calc.isAuto(type)) data.achieved = isNew ? 0 : n(el.achieved.value);
        return mutate(
          () => (isNew ? create('goals', Object.assign({ achieved: 0 }, data)) : update('goals', goal.id, data)),
          isNew ? 'Objetivo agregado' : 'Objetivo actualizado'
        );
      },
    });
  }

  function stepGoal(id, delta) {
    const g = state.data.goals.find((x) => x.id === id);
    if (!g) return;
    const achieved = Math.max(0, n(g.achieved) + delta);
    if (achieved === n(g.achieved)) return;
    mutate(() => update('goals', id, { achieved }));
  }

  async function deleteGoal(id) {
    const g = state.data.goals.find((x) => x.id === id);
    if (!g) return;
    const ok = await confirmDialog({ title: '¿Eliminar este objetivo?', message: `Vas a eliminar "${goalTitle(g)}" de ${periodLabel()}. Esta acción no se puede deshacer.` });
    if (ok) mutate(() => remove('goals', id), 'Objetivo eliminado');
  }

  /* ----- Cómo empezar: los 3 pasos principales ----- */
  function renderStart() {
    const { goals, agents } = state.data;
    const active = agents.filter((a) => a.status !== 'inactiva');
    const missing = active.filter((a) => !calc.hasTarget(a.target) && !calc.hasTarget(a.demosTarget));
    const steps = [
      { done: goals.length > 0, title: 'Definí los objetivos de tu equipo', detail: 'Ventas, demos, reclutamiento u otro.', btn: '+ Agregar objetivo', act: 'data-act="add-goal"' },
      { done: agents.length > 0, title: 'Agregá a tus agentes', detail: 'Con su estado, lo que lleva hecho y su seguimiento.', btn: '+ Agregar agente', act: 'data-act="add-agent"' },
      {
        done: agents.length > 0 && missing.length === 0,
        title: 'Poné un objetivo a cada agente',
        detail: missing.length && agents.length ? `Faltan: ${missing.slice(0, 4).map((a) => esc(a.name.split(' ')[0])).join(', ')}${missing.length > 4 ? '…' : ''}` : 'De ventas y de demos, para el período.',
        btn: 'Ir a mis agentes', act: 'data-act="tab" data-tab="agentes"',
      },
    ];
    const box = $('#getting-started');
    if (steps.every((s) => s.done)) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;
    const next = steps.findIndex((s) => !s.done);
    box.innerHTML = `
      <h2>Cómo empezar en ${esc(periodLabel())}</h2>
      <ol class="start-steps">
        ${steps.map((s, i) => `
          <li class="start-step ${s.done ? 'is-done' : ''} ${i === next ? 'is-next' : ''}">
            <span class="start-num" aria-hidden="true">${s.done ? ICONS.check : i + 1}</span>
            <div class="start-text"><b>${s.title}</b><span>${s.done ? 'Listo' : s.detail}</span></div>
            ${!s.done && i === next ? `<button class="btn btn-primary btn-sm" ${s.act}>${s.btn}</button>` : ''}
          </li>`).join('')}
      </ol>`;
  }

  /* ----- Mis agentes ----- */
  const fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

  function filteredAgents() {
    const q = fold(state.search);
    return state.data.agents.filter((a) => {
      if (state.statusFilter === 'activas' && a.status === 'inactiva') return false;
      if (state.statusFilter === 'inactivas' && a.status !== 'inactiva') return false;
      if (q && !fold(a.name).includes(q)) return false;
      return true;
    });
  }

  function renderAgents() {
    const agents = state.data.agents;
    const showTools = agents.length >= 4;
    $('#agents-toolbar').hidden = !showTools;
    $('#btn-add-agent-top').hidden = agents.length === 0;

    const prev = prevPeriod();
    const missing = missingAgents();
    if (!agents.length) {
      $('#agents').innerHTML = `
        <div class="empty">
          <strong>Todavía no agregaste agentes a tu equipo.</strong>
          <p>Comenzá agregando a tu primera agente.</p>
          <div class="btn-row">
            <button class="btn btn-primary" data-act="add-agent">+ Agregar agente</button>
            ${missing.length ? `<button class="btn btn-outline" data-act="import-agents">Traer mis ${missing.length} ${missing.length === 1 ? 'agente' : 'agentes'} de ${esc(prev.label)}</button>` : ''}
          </div>
        </div>`;
      return;
    }
    if (!showTools) { state.search = ''; state.statusFilter = 'todas'; $('#agent-search').value = ''; }

    const counts = {
      todas: agents.length,
      activas: agents.filter((a) => a.status !== 'inactiva').length,
      inactivas: agents.filter((a) => a.status === 'inactiva').length,
    };
    $('#status-filter').innerHTML = [['todas', 'Todas'], ['activas', 'Activas'], ['inactivas', 'Inactivas']].map(([v, l]) => `
      <button type="button" class="chip" role="radio" aria-checked="${state.statusFilter === v}" data-act="filter-status" data-value="${v}">${l}<span class="count">${counts[v]}</span></button>`).join('');

    const list = filteredAgents();
    if (!list.length) {
      $('#agents').innerHTML = `
        <div class="empty">
          <strong>No encontramos agentes con esa búsqueda.</strong>
          <p>Probá con otro nombre o cambiá el filtro de estado.</p>
          <div class="btn-row"><button class="btn btn-outline" data-act="clear-filters">Ver todas</button></div>
        </div>`;
      return;
    }
    const missingBar = missing.length ? `
      <div class="carry-bar">
        <p>${missing.length === 1 ? 'Hay 1 agente' : `Hay ${missing.length} agentes`} de ${esc(prev.label)} que no ${missing.length === 1 ? 'está' : 'están'} en este período: <b>${missing.slice(0, 4).map((a) => esc(a.name)).join(', ')}${missing.length > 4 ? '…' : ''}</b></p>
        <button class="btn btn-outline btn-sm" data-act="import-agents">Traer ${missing.length === 1 ? 'a esa agente' : `a las ${missing.length}`}</button>
      </div>` : '';
    $('#agents').innerHTML = `${missingBar}<div class="agents-grid">${list.map(agentCard).join('')}</div>`;
  }

  async function importAgents() {
    const list = missingAgents();
    const prev = prevPeriod();
    if (!list.length || !prev) return;
    const ok = await confirmDialog({
      title: `¿Traer ${list.length === 1 ? 'a esta agente' : `estas ${list.length} agentes`} de ${prev.label}?`,
      message: `Se copian con su estado, plan GTK, seguimiento y demos agendadas. Las ventas, las demos hechas y los objetivos individuales empiezan en cero en ${periodLabel()}.`,
      confirmLabel: 'Sí, traerlas',
    });
    if (!ok) return;
    mutate(() => copyAgents(list), list.length === 1 ? 'Agente agregada a este período' : 'Agentes agregadas a este período');
  }

  function emptyAgent(extra) {
    return Object.assign({
      name: '', status: 'activa', personalGoal: '',
      target: null, sales: 0,
      demosTarget: null, demosDone: 0, demosScheduled: 0, demosScheduledWith: '',
      gtk: false, purchaseDate: '', gtkSales: 0,
      notes: '', needs: '', nextAction: '', followUpDate: '',
    }, extra);
  }

  const SALES_COLOR = '#00AC46';
  const DEMOS_COLOR = '#3782CD';

  function agentCard(a) {
    const sit = calc.agentSituation(a);
    const inactive = a.status === 'inactiva';
    return `
      <article class="agent-card ${inactive ? 'is-inactive' : ''}">
        <div class="agent-head">
          <span class="avatar" aria-hidden="true">${esc(initials(a.name))}</span>
          <div>
            <h3>${esc(a.name)}</h3>
            <div class="meta">
              ${inactive ? '<span class="pill pill-inactive">Inactiva</span>' : `<span class="pill"><span class="dot" style="--dot:${sit.color}"></span>${sit.label}</span>`}
              ${a.gtk ? '<span class="pill pill-gtk">Plan GTK</span>' : ''}
            </div>
          </div>
        </div>
        ${gtkNotice(a)}
        ${metric({ label: 'Ventas', done: a.sales, target: a.target, unit: 'ventas', color: SALES_COLOR })}
        ${metric({ label: 'Demos', done: a.demosDone, target: a.demosTarget, scheduled: a.demosScheduled, unit: 'demos', color: DEMOS_COLOR })}
        ${n(a.demosScheduled) && a.demosScheduledWith ? `<p class="sched-with"><b>Agendadas con:</b> ${esc(a.demosScheduledWith)}</p>` : ''}
        ${a.nextAction ? `<div class="next-action"><b>Próxima acción</b>${esc(a.nextAction)}${a.followUpDate ? ` · ${fmtDate(a.followUpDate)}` : ''}</div>` : ''}
        <div class="agent-foot">
          <button class="btn btn-primary btn-sm" data-act="edit-agent" data-id="${a.id}">${ICONS.edit} Actualizar datos</button>
          <button class="btn btn-outline btn-sm" data-act="view-agent" data-id="${a.id}">Ver ficha</button>
        </div>
      </article>`;
  }

  const sameName = (name, exceptId) => state.data.agents.some((a) => a.id !== exceptId && fold(a.name) === fold(name));

  /* Formulario completo de la agente: sirve para agregarla y para actualizarla. */
  function agentForm(agent) {
    const isNew = !agent;
    const a = agent || emptyAgent();
    const P = esc(periodLabel());
    openModal({
      title: isNew ? 'Nueva agente' : `Actualizar a ${a.name}`,
      submitLabel: isNew ? 'Agregar agente' : 'Guardar cambios',
      body: `
        <div class="form-grid">
          <section class="form-step">
            <p class="form-step-title"><span class="form-step-num">1</span>Sus datos</p>
            ${textField('name', 'Nombre y apellido', a.name, { placeholder: 'Ej.: María Pérez', autofocus: isNew })}
            <div class="field">
              <span class="field-label">Estado</span>
              ${choiceGroup('status', [{ value: 'activa', label: 'Activa' }, { value: 'inactiva', label: 'Inactiva', color: '#707070' }], a.status)}
            </div>
            <label class="toggle">
              <input type="checkbox" name="gtk" ${a.gtk ? 'checked' : ''}>
              <span><b>Está en plan GTK</b> (${GTK.days} días desde la compra de la máquina para llegar a ${GTK.sales} ventas)</span>
            </label>
            <div class="form-row-2" id="gtk-wrap">
              ${textField('purchaseDate', 'Fecha de compra de la máquina', a.purchaseDate, { type: 'date' })}
              ${stepperField('gtkSales', `Ventas en el plan (de ${GTK.sales})`, n(a.gtkSales))}
            </div>
          </section>

          <section class="form-step">
            <p class="form-step-title"><span class="form-step-num">2</span>Su objetivo para ${P}</p>
            <p class="field-help">Lo que vos le proponés para el período. Si todavía no lo sabés, dejalo vacío.</p>
            <div class="form-row-2">
              ${stepperField('target', 'Objetivo de ventas', a.target, { placeholder: 'Sin definir' })}
              ${stepperField('demosTarget', 'Objetivo de demos', a.demosTarget, { placeholder: 'Sin definir' })}
            </div>
          </section>

          <section class="form-step">
            <p class="form-step-title"><span class="form-step-num">3</span>Lo que lleva hecho en ${P}</p>
            <p class="field-help">Si recién la agregás, dejá todo en 0 y lo vas actualizando. Las <b>demos agendadas</b> tienen fecha pero todavía no se hicieron.</p>
            <div class="form-row-2">
              ${stepperField('sales', 'Ventas hechas', n(a.sales))}
              ${stepperField('demosDone', 'Demos hechas', n(a.demosDone))}
              ${stepperField('demosScheduled', 'Demos agendadas', n(a.demosScheduled))}
            </div>
            <div class="field" id="sched-with-wrap">
              <label for="f-demosScheduledWith">¿Con quién son las demos agendadas?</label>
              <textarea id="f-demosScheduledWith" name="demosScheduledWith" maxlength="1000" placeholder="Ej.: Marta López (jueves 21), familia Díaz (sábado)">${esc(a.demosScheduledWith || '')}</textarea>
            </div>
          </section>

          <section class="form-step">
            <p class="form-step-title"><span class="form-step-num">4</span>Seguimiento <span class="opt">(opcional)</span></p>
            ${textField('personalGoal', '¿Qué quiere conseguir? (incentivo, meta personal)', a.personalGoal, { multiline: true, placeholder: 'Ej.: llegar a 4 ventas para el incentivo del período' })}
            ${textField('needs', '¿Qué necesita trabajar?', a.needs, { multiline: true, placeholder: 'Dificultades o aspectos a acompañar' })}
            <div class="form-row-2">
              ${textField('nextAction', 'Próxima acción', a.nextAction, { placeholder: 'Ej.: acompañarla en una demo' })}
              ${textField('followUpDate', 'Fecha de seguimiento', a.followUpDate, { type: 'date' })}
            </div>
            <p class="field-help">La próxima acción también aparece en la pestaña <b>Seguimiento</b>.</p>
            ${textField('notes', 'Observaciones', a.notes, { multiline: true })}
          </section>
          ${isNew ? '' : `
          <div class="form-danger">
            <button type="button" class="btn btn-ghost btn-danger-text" data-act="delete-agent" data-id="${a.id}">${ICONS.trash} Eliminar agente</button>
          </div>`}
        </div>`,
      onOpen: (form) => {
        const el = form.elements;
        const sync = () => {
          $('#sched-with-wrap', form).hidden = n(el.demosScheduled.value) === 0 && !el.demosScheduledWith.value.trim();
          $('#gtk-wrap', form).hidden = !el.gtk.checked;
        };
        form.oninput = sync;
        form.onchange = sync;
        sync();
      },
      onSubmit: async (form) => {
        const el = form.elements;
        const name = el.name.value.trim().replace(/\s+/g, ' ');
        if (!name) { showFieldError(el.name, 'Escribí el nombre de la agente.'); return false; }
        if (sameName(name, agent && agent.id)) { showFieldError(el.name, `Ya tenés una agente llamada ${name} en este período.`); return false; }
        const data = {
          name,
          status: el.status.value === 'inactiva' ? 'inactiva' : 'activa',
          target: intOrNull(el.target.value),
          demosTarget: intOrNull(el.demosTarget.value),
          sales: n(el.sales.value),
          demosDone: n(el.demosDone.value),
          demosScheduled: n(el.demosScheduled.value),
          demosScheduledWith: el.demosScheduledWith.value.trim(),
          gtk: el.gtk.checked,
          purchaseDate: el.gtk.checked ? fixDate(el.purchaseDate.value) : '',
          gtkSales: el.gtk.checked ? n(el.gtkSales.value) : 0,
          personalGoal: el.personalGoal.value.trim(),
          needs: el.needs.value.trim(),
          nextAction: el.nextAction.value.trim(),
          followUpDate: fixDate(el.followUpDate.value),
          notes: el.notes.value.trim(),
        };
        if (isNew && state.tab !== 'agentes') setTab('agentes');
        return mutate(
          async () => {
            const saved = isNew ? await create('agents', emptyAgent(data)) : await update('agents', agent.id, data);
            await syncAgentAction(saved.id, isNew ? '' : agent.nextAction, data.nextAction, data.followUpDate);
          },
          isNew ? `${name} se sumó a tu equipo` : 'Cambios guardados'
        );
      },
    });
  }

  async function deleteAgent(id) {
    const a = state.data.agents.find((x) => x.id === id);
    if (!a) return;
    const linked = state.data.actions.filter((x) => x.agentId === id).length;
    const ok = await confirmDialog({
      title: `¿Eliminar a ${a.name}?`,
      message: `Se borran sus datos de ${periodLabel()}${linked ? ` y ${linked === 1 ? 'su acción' : `sus ${linked} acciones`} de seguimiento` : ''}, y sus ventas y demos dejan de sumar al equipo. Si dejó de trabajar, mejor marcala como inactiva. Esta acción no se puede deshacer.`,
    });
    if (!ok) return;
    closeModal();
    const wasInFicha = state.currentAgentId === id;
    if (wasInFicha) { cancelFichaSave(); state.currentAgentId = null; }
    await mutate(async () => {
      await store.removeWhere(state.tl.id, state.periodId, 'actions', 'agentId', id);
      await remove('agents', id);
    }, `${a.name} fue eliminada`);
    if (wasInFicha) location.hash = '#/agentes';
  }

  /* ----- 6. Comparativa ----- */
  function renderCompare() {
    const agents = state.data.agents;
    if (!agents.length) {
      $('#sec-compare').hidden = true;
      return;
    }
    $('#sec-compare').hidden = false;
    const pctOf = (a) => {
      const p = calc.hasTarget(a.target) ? calc.percent(a.sales, a.target) : calc.percent(a.demosDone, a.demosTarget);
      return p == null ? -1 : p;
    };
    const rows = agents.slice().sort((a, b) => {
      const ia = a.status === 'inactiva', ib = b.status === 'inactiva';
      if (ia !== ib) return ia ? 1 : -1;
      if (pctOf(a) !== pctOf(b)) return pctOf(b) - pctOf(a);
      return byName(a, b);
    });
    $('#compare').innerHTML = `
      <div class="legend">
        <span><span class="dot" style="--dot:var(--green)"></span>Buen avance</span>
        <span><span class="dot" style="--dot:var(--yellow)"></span>Necesita seguimiento</span>
        <span><span class="dot" style="--dot:var(--orange)"></span>Requiere atención</span>
        <span><span class="dot" style="--dot:var(--red)"></span>Necesita intervención</span>
        <span class="legend-sep"></span>
        <span><i class="swatch" style="background:#00AC46"></i>Ventas</span>
        <span><i class="swatch" style="background:#3782CD"></i>Demos</span>
        <span><span class="legend-sched"></span>Demos agendadas</span>
      </div>
      <div class="compare-row compare-head">
        <span>Agente</span><span>Ventas</span><span>Demos</span>
      </div>
      ${rows.map((a) => {
        const sit = calc.agentSituation(a);
        return `
          <div class="compare-row ${a.status === 'inactiva' ? 'is-inactive' : ''}">
            <div class="compare-name">
              <span class="dot" style="--dot:${sit.color}" title="${esc(sit.label)}"></span>
              <div>
                <button type="button" data-act="view-agent" data-id="${a.id}" title="Ver seguimiento">${esc(a.name)}</button>
                <span class="compare-situation">${esc(sit.label)}</span>
              </div>
            </div>
            ${metric({ label: 'Ventas', done: a.sales, target: a.target, unit: '', compact: true, color: SALES_COLOR })}
            ${metric({ label: 'Demos', done: a.demosDone, target: a.demosTarget, scheduled: a.demosScheduled, unit: '', compact: true, color: DEMOS_COLOR })}
          </div>`;
      }).join('')}`;
  }

  /* ----- 7. Seguimiento semanal ----- */
  function sortActions(list) {
    const rank = { en_proceso: 0, pendiente: 1, realizado: 2 };
    return list.slice().sort((a, b) => {
      const doneA = a.status === 'realizado', doneB = b.status === 'realizado';
      if (doneA !== doneB) return doneA ? 1 : -1;
      const da = a.date || '9999-99-99', db = b.date || '9999-99-99';
      if (da !== db) return da.localeCompare(db);
      if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
      return byCreated(a, b);
    });
  }

  function actionItem(x, { showAgent = true } = {}) {
    const done = x.status === 'realizado';
    const late = !done && x.date && x.date < todayISO();
    const who = x.agentId ? agentName(x.agentId) : '';
    return `
      <li class="action-item ${done ? 'is-done' : ''}">
        <button class="check" data-act="toggle-action" data-id="${x.id}" aria-label="${done ? 'Marcar como pendiente' : 'Marcar como realizada'}" title="${done ? 'Marcar como pendiente' : 'Marcar como realizada'}">${ICONS.check}</button>
        <div>
          <div class="action-topic">${esc(x.topic)}</div>
          ${x.nextAction ? `<div class="action-next">Próxima acción: ${esc(x.nextAction)}</div>` : ''}
          <div class="action-meta">
            ${showAgent ? `<span><b>${who ? esc(who) : 'Todo el equipo'}</b></span>` : ''}
            ${x.date ? `<span class="${late ? 'late' : ''}">${late ? 'Vencida · ' : ''}${fmtDate(x.date)}</span>` : ''}
            <span class="pill st-${x.status}">${config.actionStatuses[x.status] || ''}</span>
          </div>
        </div>
        <div class="action-btns">
          <button class="icon-btn" data-act="edit-action" data-id="${x.id}" aria-label="Editar acción" title="Editar">${ICONS.edit}</button>
          <button class="icon-btn" data-act="delete-action" data-id="${x.id}" aria-label="Eliminar acción" title="Eliminar">${ICONS.trash}</button>
        </div>
      </li>`;
  }

  function renderActions() {
    const all = state.data.actions;
    $('#btn-add-action-top').hidden = all.length === 0;
    if (!all.length) {
      $('#actions').innerHTML = `
        <div class="empty">
          <strong>Todavía no hay acciones para esta semana.</strong>
          <div class="btn-row"><button class="btn btn-primary" data-act="add-action">+ Agregar acción</button></div>
        </div>`;
      return;
    }
    const open = all.filter((x) => x.status !== 'realizado');
    const done = all.filter((x) => x.status === 'realizado');
    const list = state.actionFilter === 'abiertas' ? open : state.actionFilter === 'realizadas' ? done : all;
    const tabs = [['abiertas', 'Por hacer', open.length], ['realizadas', 'Realizadas', done.length], ['todas', 'Todas', all.length]];
    $('#actions').innerHTML = `
      <div class="chips" role="radiogroup" aria-label="Filtrar acciones" style="margin-bottom:14px">
        ${tabs.map(([v, l, c]) => `<button type="button" class="chip" role="radio" aria-checked="${state.actionFilter === v}" data-act="filter-actions" data-value="${v}">${l}<span class="count">${c}</span></button>`).join('')}
      </div>
      ${list.length
        ? `<ul class="action-list">${sortActions(list).map((x) => actionItem(x)).join('')}</ul>`
        : `<p class="section-sub">${state.actionFilter === 'abiertas' ? '¡No tenés acciones pendientes! Buen trabajo.' : 'Todavía no marcaste acciones como realizadas.'}</p>`}`;
  }

  function actionForm(action, presetAgentId) {
    const isNew = !action;
    const x = action || { agentId: presetAgentId || '', topic: '', nextAction: '', date: '', status: 'pendiente' };
    const agents = state.data.agents;
    openModal({
      title: isNew ? 'Nueva acción de seguimiento' : 'Editar acción',
      submitLabel: isNew ? 'Agregar acción' : 'Guardar cambios',
      body: `
        <div class="form-grid">
          <div class="field">
            <label for="f-agentId">Agente</label>
            <select id="f-agentId" name="agentId">
              <option value="">Todo el equipo</option>
              ${agents.map((a) => `<option value="${a.id}" ${a.id === x.agentId ? 'selected' : ''}>${esc(a.name)}${a.status === 'inactiva' ? ' (inactiva)' : ''}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label for="f-topic">¿Qué vamos a trabajar?</label>
            <input id="f-topic" name="topic" type="text" maxlength="200" value="${esc(x.topic)}" placeholder="Elegí una opción o escribí la tuya" ${presetAgentId || action ? 'autofocus' : ''}>
            <div class="suggestions">
              ${config.actionSuggestions.map((s) => `<button type="button" data-suggest="${esc(s)}">${esc(s)}</button>`).join('')}
            </div>
          </div>
          ${textField('nextAction', 'Próxima acción', x.nextAction, { optional: true, placeholder: 'Ej.: llamarla el lunes para coordinar' })}
          ${textField('date', 'Fecha prevista', x.date, { type: 'date', optional: true })}
          <div class="field">
            <span class="field-label">Estado</span>
            ${choiceGroup('status', [
              { value: 'pendiente', label: 'Pendiente', color: '#707070' },
              { value: 'en_proceso', label: 'En proceso', color: '#252525' },
              { value: 'realizado', label: 'Realizado', color: '#00AC46' },
            ], x.status)}
          </div>
        </div>`,
      onOpen: (form) => {
        $$('[data-suggest]', form).forEach((b) => b.addEventListener('click', () => {
          form.elements.topic.value = b.dataset.suggest;
          form.elements.topic.classList.remove('invalid');
        }));
      },
      onSubmit: async (form) => {
        const el = form.elements;
        const topic = el.topic.value.trim();
        if (!topic) { showFieldError(el.topic, 'Contanos qué van a trabajar.'); return false; }
        const data = {
          agentId: el.agentId.value,
          topic,
          nextAction: el.nextAction.value.trim(),
          date: fixDate(el.date.value),
          status: el.status.value,
        };
        return mutate(
          async () => {
            if (isNew) { await create('actions', data); return; }
            await update('actions', action.id, data);
            // si esta acción es la "próxima acción" de la agente, se actualiza también en su ficha
            const ag = action.agentId && state.data.agents.find((a) => a.id === action.agentId);
            if (ag && String(ag.nextAction || '').trim() === action.topic && data.agentId === action.agentId) {
              await update('agents', ag.id, { nextAction: data.topic, followUpDate: data.date });
            }
          },
          isNew ? 'Acción agregada' : 'Acción actualizada'
        );
      },
    });
  }

  /* La "próxima acción" que se escribe en la agente aparece en Seguimiento:
   * se crea una acción pendiente para esa agente, y si después se cambia el texto
   * o la fecha, se actualiza esa misma acción (no se duplica). */
  async function syncAgentAction(agentId, prevText, nextText, date) {
    const next = String(nextText || '').trim();
    if (!next) return;
    const prev = String(prevText || '').trim();
    const open = state.data.actions.filter((x) => x.agentId === agentId && x.status !== 'realizado');
    const match = (prev && open.find((x) => x.topic === prev)) || open.find((x) => x.topic === next);
    if (match) {
      if (match.topic !== next || (match.date || '') !== (date || '')) {
        await update('actions', match.id, { topic: next, date: date || '' });
      }
    } else {
      await create('actions', { agentId, topic: next, nextAction: '', date: date || '', status: 'pendiente' });
    }
  }

  function toggleAction(id) {
    const x = state.data.actions.find((a) => a.id === id);
    if (!x) return;
    const next = x.status === 'realizado' ? 'pendiente' : 'realizado';
    const ag = x.agentId && state.data.agents.find((a) => a.id === x.agentId);
    mutate(async () => {
      await update('actions', id, { status: next });
      if (next === 'realizado' && ag && String(ag.nextAction || '').trim() === x.topic) {
        await update('agents', ag.id, { nextAction: '', followUpDate: '' });
      }
    }, next === 'realizado' ? '¡Acción realizada!' : 'La acción volvió a pendiente');
  }

  async function deleteAction(id) {
    const x = state.data.actions.find((a) => a.id === id);
    if (!x) return;
    const ok = await confirmDialog({ title: '¿Eliminar esta acción?', message: `Vas a eliminar "${x.topic}". Esta acción no se puede deshacer.` });
    if (ok) mutate(() => remove('actions', id), 'Acción eliminada');
  }

  /* ---------------- 5. Ficha individual ---------------- */
  let fichaPatch = {};
  let fichaTimer = null;
  let fichaSaving = Promise.resolve();

  function showFicha(id) {
    const a = state.data.agents.find((x) => x.id === id);
    if (!a) { history.replaceState(null, '', '#/'); showDashboard(); return; }
    state.currentAgentId = id;
    state.returnTo = true;
    updateBottomNav('agentes');
    $('#view-dashboard').hidden = true;
    const view = $('#view-agent');
    view.hidden = false;
    window.scrollTo(0, 0);

    const sit = calc.agentSituation(a);
    view.innerHTML = `
      <div class="ficha-top">
        <a class="btn btn-outline" href="#/agentes">${ICONS.back} Volver a mis agentes</a>
        <span class="saved-indicator" id="saved-indicator">✓ Cambios guardados</span>
      </div>

      <div class="ficha-head">
        <span class="avatar" id="ficha-avatar" aria-hidden="true">${esc(initials(a.name))}</span>
        <div class="ficha-name">
          <input type="text" data-field="name" value="${esc(a.name)}" aria-label="Nombre y apellido" maxlength="200">
          <span class="period-label">Ficha de seguimiento · ${esc(periodLabel())}</span>
          <span class="situation-chip" id="ficha-situation"><span class="dot" style="--dot:${sit.color}"></span>${esc(sit.label)}</span>
        </div>
        <div class="field">
          <span class="field-label">Estado</span>
          ${choiceGroup('ficha-status', [{ value: 'activa', label: 'Activa' }, { value: 'inactiva', label: 'Inactiva', color: '#707070' }], a.status).replace(/name="ficha-status"/g, 'name="ficha-status" data-field="status"')}
        </div>
      </div>

      <div class="ficha-grid">
        <section class="ficha-card ficha-gtk-card">
          <label class="toggle toggle-sm">
            <input type="checkbox" data-field="gtk" ${a.gtk ? 'checked' : ''}>
            <span><b>Está en plan GTK</b> (${GTK.days} días desde la compra para llegar a ${GTK.sales} ventas)</span>
          </label>
          <div class="form-row-2" id="ficha-gtk-fields" ${a.gtk ? '' : 'hidden'}>
            <div class="field">
              <label for="ff-purchaseDate">Fecha de compra de la máquina</label>
              <input id="ff-purchaseDate" type="date" data-field="purchaseDate" value="${esc(a.purchaseDate || '')}">
            </div>
            ${fichaStepper('gtkSales', `Ventas en el plan (de ${GTK.sales})`, n(a.gtkSales))}
          </div>
          <div id="ficha-gtk"></div>
        </section>

        <section class="ficha-card">
          <h2><span class="num">1</span>Su objetivo</h2>
          ${fichaText('personalGoal', '¿Qué quiere conseguir? (incentivo, meta personal)', a.personalGoal, true, 'Ej.: llegar a 4 ventas para el incentivo del período')}
          <p class="ficha-sub">Objetivos que le proponés para ${esc(periodLabel())}</p>
          <div class="form-row-2">
            ${fichaStepper('target', 'Objetivo de ventas', a.target, 'Sin definir')}
            ${fichaStepper('demosTarget', 'Objetivo de demos', a.demosTarget, 'Sin definir')}
          </div>
        </section>

        <section class="ficha-card" style="--num-bg:#EAF2FA;--num-fg:#3782CD">
          <h2><span class="num">2</span>Sus demos</h2>
          <div class="form-row-2">
            ${fichaStepper('demosDone', 'Demos hechas', n(a.demosDone))}
            ${fichaStepper('demosScheduled', 'Demos agendadas', n(a.demosScheduled))}
          </div>
          ${fichaText('demosScheduledWith', '¿Con quién son las demos agendadas?', a.demosScheduledWith, true, 'Ej.: Marta López (jueves 21), familia Díaz (sábado)')}
          <div id="ficha-demos"></div>
        </section>

        <section class="ficha-card">
          <h2><span class="num">3</span>Sus ventas</h2>
          ${fichaStepper('sales', 'Ventas hechas', n(a.sales))}
          <div id="ficha-sales"></div>
        </section>

        <section class="ficha-card" style="--num-bg:#F0F0F0;--num-fg:#4A4A4A">
          <h2><span class="num">4</span>Su seguimiento</h2>
          ${fichaText('notes', 'Observaciones', a.notes, true)}
          ${fichaText('needs', '¿Qué necesita trabajar?', a.needs, true, 'Dificultades o aspectos a acompañar')}
          ${fichaText('nextAction', 'Próximos pasos', a.nextAction, false, 'Ej.: acompañarla en su próxima demo')}
          <div class="field">
            <label for="ff-followUpDate">Fecha de seguimiento <span class="opt">(opcional)</span></label>
            <input id="ff-followUpDate" type="date" data-field="followUpDate" value="${esc(a.followUpDate || '')}">
          </div>
        </section>
      </div>

      <section class="section sec-actions">
        <div class="section-head">
          <div class="sec-title">
            <span class="sec-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M9 6h11M9 12h11M9 18h11M3.5 6l1.2 1.2L7 5M3.5 12l1.2 1.2L7 11M3.5 18l1.2 1.2L7 17"/></svg></span>
            <h2>Acciones de seguimiento con ${esc(a.name.split(' ')[0])}</h2>
          </div>
          <button class="btn btn-primary" data-act="add-action" data-agent="${a.id}">+ Agregar acción</button>
        </div>
        <div id="ficha-actions"></div>
      </section>

      <div class="ficha-top" style="margin-top:20px">
        <a class="btn btn-outline" href="#/agentes">${ICONS.back} Volver a mis agentes</a>
        <button class="btn btn-ghost" data-act="delete-agent" data-id="${a.id}">${ICONS.trash} Eliminar agente</button>
      </div>`;

    updateFichaComputed(a);
    renderFichaActions(a);
  }

  function fichaStepper(field, label, value, placeholder) {
    return `
      <div class="field">
        <label for="ff-${field}">${label}</label>
        <div class="stepper">
          <button type="button" data-step="-1" aria-label="Restar uno">−</button>
          <input id="ff-${field}" type="number" inputmode="numeric" min="0" step="1" data-field="${field}" value="${value == null ? '' : esc(value)}" ${placeholder ? `placeholder="${esc(placeholder)}"` : ''}>
          <button type="button" data-step="1" aria-label="Sumar uno">+</button>
        </div>
      </div>`;
  }

  function fichaText(field, label, value, multiline, placeholder = '') {
    return `
      <div class="field">
        <label for="ff-${field}">${label}</label>
        ${multiline
          ? `<textarea id="ff-${field}" data-field="${field}" placeholder="${esc(placeholder)}" maxlength="1000">${esc(value || '')}</textarea>`
          : `<input id="ff-${field}" type="text" data-field="${field}" value="${esc(value || '')}" placeholder="${esc(placeholder)}" maxlength="200">`}
      </div>`;
  }

  function fichaValue(el) {
    const f = el.dataset.field;
    if (['target', 'demosTarget'].includes(f)) return intOrNull(el.value);
    if (['demosDone', 'demosScheduled', 'sales', 'gtkSales'].includes(f)) return n(el.value);
    if (f === 'gtk') return el.checked;
    if (f === 'name') return el.value.trim().replace(/\s+/g, ' ');
    if (f === 'status') return el.value === 'inactiva' ? 'inactiva' : 'activa';
    return el.type === 'date' ? fixDate(el.value) : el.value.trim();
  }

  /* Si en un calendario se escribe el año con dos dígitos, se corrige al salir del campo. */
  document.addEventListener('change', (e) => {
    const el = e.target;
    if (el && el.type === 'date' && el.value) {
      const fixed = fixDate(el.value);
      if (fixed && fixed !== el.value) el.value = fixed;
    }
  }, true);

  function onFichaInput(e) {
    const el = e.target;
    if (!el.dataset || !el.dataset.field || !state.currentAgentId) return;
    if (el.type === 'radio' && !el.checked) return;
    fichaPatch[el.dataset.field] = fichaValue(el);
    // vista previa inmediata de los cálculos
    const a = state.data.agents.find((x) => x.id === state.currentAgentId);
    if (a) updateFichaComputed(Object.assign({}, a, fichaPatch));
    clearTimeout(fichaTimer);
    const immediate = e.type === 'change';
    fichaTimer = setTimeout(flushFicha, immediate ? 0 : 600);
  }

  function cancelFichaSave() {
    clearTimeout(fichaTimer);
    fichaPatch = {};
  }

  function flushFicha() {
    clearTimeout(fichaTimer);
    const id = state.currentAgentId;
    const patch = fichaPatch;
    fichaPatch = {};
    if (!id || !Object.keys(patch).length) return fichaSaving;
    if ('name' in patch && !patch.name) {
      delete patch.name; // no se guarda un nombre vacío
      const input = $('#view-agent [data-field="name"]');
      const a = state.data.agents.find((x) => x.id === id);
      if (input && a && document.activeElement !== input) input.value = a.name;
      if (!Object.keys(patch).length) return fichaSaving;
    }
    fichaSaving = fichaSaving.then(async () => {
      try {
        const before = state.data.agents.find((x) => x.id === id) || {};
        const saved = await update('agents', id, patch);
        if ('nextAction' in patch || 'followUpDate' in patch) {
          await syncAgentAction(id, before.nextAction, saved.nextAction, saved.followUpDate);
        }
        await loadPeriod();
        const a = state.data.agents.find((x) => x.id === id);
        if (a && state.currentAgentId === id) {
          updateFichaComputed(a);
          renderFichaActions(a);
          const ind = $('#saved-indicator');
          if (ind) {
            ind.classList.add('show');
            clearTimeout(ind._t);
            ind._t = setTimeout(() => ind.classList.remove('show'), 1800);
          }
        }
      } catch (err) {
        console.error(err);
        toast('No pudimos guardar los cambios. Intentá de nuevo.', 'error');
      }
    });
    return fichaSaving;
  }

  function updateFichaComputed(a) {
    const view = $('#view-agent');
    if (view.hidden) return;
    const sit = calc.agentSituation(a);
    const sitEl = $('#ficha-situation');
    if (sitEl) sitEl.innerHTML = `<span class="dot" style="--dot:${sit.color}"></span>${esc(sit.label)}`;
    const av = $('#ficha-avatar');
    if (av && a.name) av.textContent = initials(a.name);

    const salesBox = $('#ficha-sales');
    if (salesBox) {
      salesBox.innerHTML = `<div class="big-progress">${calc.hasTarget(a.target)
        ? metric({ label: 'Avance de ventas', done: a.sales, target: a.target, unit: 'ventas', color: SALES_COLOR })
        : '<span>Definí su objetivo de ventas en "Su objetivo" para ver el avance.</span>'}</div>`;
    }
    const gtkBox = $('#ficha-gtk');
    if (gtkBox) gtkBox.innerHTML = gtkNotice(a, true);
    const gtkFields = $('#ficha-gtk-fields');
    if (gtkFields) gtkFields.hidden = !a.gtk;
    const demosBox = $('#ficha-demos');
    if (demosBox) {
      const sched = n(a.demosScheduled);
      const reach = n(a.demosDone) + sched;
      let note = '';
      if (calc.hasTarget(a.demosTarget) && sched) {
        note = reach >= n(a.demosTarget)
          ? '<p class="ficha-note">Si hace las demos agendadas, <b>cumple su objetivo</b>.</p>'
          : `<p class="ficha-note">Si hace las agendadas llega a <b>${reach} de ${n(a.demosTarget)}</b>: le faltaría agendar ${n(a.demosTarget) - reach}.</p>`;
      }
      demosBox.innerHTML = `<div class="big-progress">${calc.hasTarget(a.demosTarget)
        ? metric({ label: 'Avance de demos', done: a.demosDone, target: a.demosTarget, scheduled: sched, unit: 'demos', color: DEMOS_COLOR }) + note
        : '<span>Definí su objetivo de demos en "Su objetivo" para ver el avance.</span>'}</div>`;
    }
  }

  function renderFichaActions(a) {
    const box = $('#ficha-actions');
    if (!box) return;
    const list = state.data.actions.filter((x) => x.agentId === a.id);
    box.innerHTML = list.length
      ? `<ul class="action-list">${sortActions(list).map((x) => actionItem(x, { showAgent: false })).join('')}</ul>`
      : '<p class="section-sub">Todavía no hay acciones registradas para esta agente.</p>';
  }

  /* ---------------- Imprimir resumen ---------------- */
  function gtkPrint(a) {
    const g = calc.gtkStatus(a);
    if (!g) return '–';
    if (g.noDate) return 'Sin fecha';
    const estado = g.level === 'ended' ? 'terminó' : g.level === 'done' ? 'cumplido' : `cierra ${fmtShort(g.endDate)}`;
    return `${n(a.gtkSales)}/${GTK.sales} · ${estado}`;
  }

  function printSummary() {
    const { goals, agents, actions } = state.data;
    const totals = calc.teamTotals(agents);
    const sortedGoals = goals.slice().sort((x, y) => (GOAL_ORDER[x.type] ?? 3) - (GOAL_ORDER[y.type] ?? 3));
    const fmtGoal = (done, target) => (calc.hasTarget(target) ? `${n(done)} / ${n(target)} (${calc.percent(done, target)}%)` : `${n(done)} / –`);
    const openActions = sortActions(actions.filter((x) => x.status !== 'realizado'));

    $('#print-summary').innerHTML = `
      <div class="pr-head">
        <div><span class="logo">KOBOLD</span><h1>Gestión comercial de mi equipo</h1></div>
        <div class="pr-meta">Team Leader: <b>${esc(state.tl.name)}</b><br>Período: <b>${esc(periodLabel())}</b><br>Fecha: ${fmtDate(todayISO())}</div>
      </div>

      <h2>Objetivos de mi equipo</h2>
      <p>${totals.count} agentes (${totals.active} activas) · ${totals.sales} ventas hechas · ${totals.demos} demos hechas${totals.demosScheduled ? ` · ${totals.demosScheduled} demos agendadas` : ''}</p>
      ${sortedGoals.length ? `<table><thead><tr><th>Tipo</th><th>Objetivo</th><th>Meta</th><th>Logrado</th><th>Faltan</th><th>Avance</th></tr></thead><tbody>
        ${sortedGoals.map((g) => {
          const ach = calc.goalAchieved(g, totals); const p = calc.percent(ach, g.target);
          return `<tr><td>${goalInfo(g.type).label}</td><td>${esc(goalTitle(g))}</td><td>${calc.hasTarget(g.target) ? n(g.target) : '–'}</td><td>${ach}</td><td>${calc.hasTarget(g.target) ? calc.pending(ach, g.target) : '–'}</td><td>${p == null ? '–' : p + '%'}</td></tr>`;
        }).join('')}</tbody></table>` : '<p class="pr-empty">Sin objetivos cargados.</p>'}

      <h2>Mi equipo, agente por agente</h2>
      ${agents.length ? `<table><thead><tr><th>Agente</th><th>Estado</th><th>Ventas (hechas / objetivo)</th><th>Demos (hechas / objetivo)</th><th>Demos agendadas</th><th>Plan GTK</th><th>Situación</th><th>Próxima acción</th></tr></thead><tbody>
        ${agents.map((a) => {
          return `<tr><td>${esc(a.name)}</td><td>${a.status === 'inactiva' ? 'Inactiva' : 'Activa'}</td><td>${fmtGoal(a.sales, a.target)}</td><td>${fmtGoal(a.demosDone, a.demosTarget)}</td><td>${n(a.demosScheduled)}${a.demosScheduledWith ? ` (${esc(a.demosScheduledWith)})` : ''}</td><td>${gtkPrint(a)}</td><td>${esc(calc.agentSituation(a).label)}</td><td>${esc(a.nextAction)}${a.followUpDate ? ` (${fmtDate(a.followUpDate)})` : ''}</td></tr>`;
        }).join('')}</tbody></table>` : '<p class="pr-empty">Sin agentes cargadas.</p>'}

      <h2>Mi seguimiento (acciones por hacer)</h2>
      ${openActions.length ? `<table><thead><tr><th>Agente</th><th>Qué vamos a trabajar</th><th>Próxima acción</th><th>Fecha</th><th>Estado</th></tr></thead><tbody>
        ${openActions.map((x) => `<tr><td>${esc(x.agentId ? agentName(x.agentId) : 'Todo el equipo')}</td><td>${esc(x.topic)}</td><td>${esc(x.nextAction)}</td><td>${fmtDate(x.date)}</td><td>${config.actionStatuses[x.status]}</td></tr>`).join('')}
      </tbody></table>` : '<p class="pr-empty">Sin acciones pendientes.</p>'}`;
    window.print();
  }

  /* ---------------- Eventos ---------------- */
  function bindGlobalEvents() {
    $('#welcome-form').addEventListener('submit', handleWelcome);
    $('#welcome-form').addEventListener('input', () => welcomeError(''));

    $('#agent-search').addEventListener('input', (e) => {
      state.search = e.target.value;
      renderAgents();
    });

    $('#modal').addEventListener('click', (e) => {
      if (e.target === $('#modal') || e.target.closest('[data-close]')) closeModal();
    });
    $('#modal').addEventListener('input', (e) => {
      if (e.target.classList.contains('invalid')) {
        e.target.classList.remove('invalid');
        const err = e.target.closest('.field') && e.target.closest('.field').querySelector('.field-error');
        if (err) err.remove();
      }
    });

    const view = $('#view-agent');
    view.addEventListener('input', onFichaInput);
    view.addEventListener('change', onFichaInput);

    document.addEventListener('click', (e) => {
      const stepBtn = e.target.closest('[data-step]');
      if (stepBtn) { stepInput(stepBtn); return; }

      const el = e.target.closest('[data-act]');
      if (!el) return;
      const { act, id } = el.dataset;
      switch (act) {
        case 'edit-tl': editTL(); break;
        case 'account': accountMenu(); break;
        case 'logout': logout(); break;
        case 'period': changePeriod(id); break;
        case 'print': printSummary(); break;
        case 'tour': if (state.currentAgentId) { location.hash = '#/'; setTimeout(KGC.tour.start, 300); } else KGC.tour.start(); break;
        case 'tab': setTab(el.dataset.tab); break;
        case 'goal-step': stepGoal(id, Number(el.dataset.delta)); break;
        case 'add-goal': goalForm(null, el.dataset.type); break;
        case 'edit-goal': goalForm(state.data.goals.find((g) => g.id === id)); break;
        case 'delete-goal': deleteGoal(id); break;
        case 'add-agent': agentForm(); break;
        case 'edit-agent': agentForm(state.data.agents.find((a) => a.id === id)); break;

        case 'delete-agent': deleteAgent(id); break;
        case 'view-agent': location.hash = `#/agente/${encodeURIComponent(id)}`; break;
        case 'import-agents': importAgents(); break;
        case 'filter-status': state.statusFilter = el.dataset.value; renderAgents(); break;
        case 'clear-filters': state.statusFilter = 'todas'; state.search = ''; $('#agent-search').value = ''; renderAgents(); break;
        case 'add-action': actionForm(null, el.dataset.agent); break;
        case 'edit-action': actionForm(state.data.actions.find((x) => x.id === id)); break;
        case 'delete-action': deleteAction(id); break;
        case 'toggle-action': toggleAction(id); break;
        case 'filter-actions': state.actionFilter = el.dataset.value; renderActions(); break;
        default: break;
      }
    });

    window.addEventListener('hashchange', () => { if (state.tl) route(); });
    window.addEventListener('beforeunload', () => { flushFicha(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) flushFicha(); });
  }

  KGC.app = { setTab, logout, toast, esc, initials, metric, ICONS };
  document.addEventListener('DOMContentLoaded', init);
})();
