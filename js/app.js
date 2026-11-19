/* Gestión comercial de mi equipo | Kobold — lógica de pantalla */
(function () {
  'use strict';

  const { config, calc, store } = KGC;
  const { n } = calc;

  /* ---------------- Estado ---------------- */
  const state = {
    tl: null,
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
  const periodLabel = (id = state.periodId) => (config.periods.find((p) => p.id === id) || {}).label || id;
  const initials = (name) => String(name || '').trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase() || '·';
  const byName = (a, b) => String(a.name).localeCompare(String(b.name), 'es', { sensitivity: 'base' });
  const byCreated = (a, b) => String(a.createdAt).localeCompare(String(b.createdAt));
  const todayISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const fmtDate = (iso) => {
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  };
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
    $('#modal-submit').textContent = submitLabel;
    form.onsubmit = async (e) => {
      e.preventDefault();
      const ok = await onSubmit(form);
      if (ok !== false && dlg.open) dlg.close();
    };
    dlg.showModal();
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
      actions: d.actions.slice(),
    };
  }

  /* Compatibilidad con la versión anterior: "demos planificadas" pasa a ser el objetivo de demos. */
  function normalizeAgent(a) {
    const x = Object.assign({}, a);
    if (x.demosTarget === undefined) x.demosTarget = x.demosPlanned == null ? null : n(x.demosPlanned);
    if (x.demosScheduled === undefined) x.demosScheduled = 0;
    delete x.demosPlanned;
    return x;
  }

  /* Barra de avance: hechas (color lleno) + agendadas (mismo color, más claro). */
  function metric({ label, done, target, scheduled = null, unit, compact = false }) {
    const pct = calc.percent(done, target);
    const color = calc.levelColor(pct);
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
  async function init() {
    bindGlobalEvents();
    const session = await store.getSession();
    if (session && session.tlId) {
      const tl = await store.getTL(session.tlId);
      if (tl) {
        state.tl = tl;
        if (config.periods.some((p) => p.id === session.periodId)) state.periodId = session.periodId;
        return enterApp();
      }
    }
    showWelcome();
  }

  function showWelcome() {
    $('#screen-app').hidden = true;
    $('#screen-welcome').hidden = false;
    document.title = 'Gestión comercial de mi equipo | Kobold';
    const input = $('#welcome-name');
    input.value = '';
    $('#welcome-error').hidden = true;
    input.classList.remove('invalid');
    setTimeout(() => input.focus(), 50);
  }

  async function handleWelcome(e) {
    e.preventDefault();
    const input = $('#welcome-name');
    const name = input.value.trim();
    if (!name) {
      $('#welcome-error').hidden = false;
      input.classList.add('invalid');
      input.focus();
      return;
    }
    try {
      state.tl = await store.findOrCreateTL(name);
      await saveSession();
      if (location.hash && location.hash !== '#/') history.replaceState(null, '', '#/');
      await enterApp();
      toast(`¡Hola, ${state.tl.name.split(' ')[0]}! Este es tu espacio.`);
    } catch (err) {
      console.error(err);
      toast('No pudimos abrir tu espacio. Intentá de nuevo.', 'error');
    }
  }

  const saveSession = () => store.setSession({ tlId: state.tl.id, periodId: state.periodId });

  async function enterApp() {
    $('#screen-welcome').hidden = true;
    $('#screen-app').hidden = false;
    renderHeader();
    await loadPeriod();
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
    renderTeamGoals();
    renderOtherGoals();
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
    const agents = state.data.agents.length;
    const open = state.data.actions.filter((x) => x.status !== 'realizado').length;
    $('#count-agentes').textContent = agents || '';
    $('#count-seguimiento').textContent = open || '';
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
    $('#period-switch').innerHTML = config.periods.map((p) => `
      <button type="button" class="period-btn" role="radio" aria-checked="${p.id === state.periodId}" data-act="period" data-id="${p.id}">
        <strong>${esc(p.label)}</strong>
      </button>`).join('');
  }

  async function changePeriod(id) {
    if (id === state.periodId) return;
    state.periodId = id;
    state.search = '';
    $('#agent-search').value = '';
    state.statusFilter = 'todas';
    await saveSession();
    await loadPeriod();
    renderDashboard();
    toast(`Estás viendo ${periodLabel()}`);
  }

  /* ----- Objetivos del equipo ----- */
  const MAIN_INFO = {
    ventas: {
      title: 'Ventas', unit: 'ventas', unit1: 'venta', icon: 'bag', color: '#00AC46', soft: '#E6F7ED', ink: '#008F3A',
      question: '¿Cuántas ventas querés lograr con tu equipo?',
      help: 'Las ventas hechas se suman solas con lo que cargás en cada agente.',
    },
    demos: {
      title: 'Demos', unit: 'demos', unit1: 'demo', icon: 'demo', color: '#3782CD', soft: '#EAF2FA', ink: '#2F6FAF',
      question: '¿Cuántas demos querés que haga tu equipo?',
      help: 'Las demos hechas y agendadas se suman solas con lo que cargás en cada agente.',
    },
    reclutamiento: {
      title: 'Agentes nuevas', unit: 'agentes nuevas', unit1: 'agente nueva', icon: 'userPlus', color: '#734BA5', soft: '#F1ECF7', ink: '#734BA5',
      question: '¿Cuántas agentes nuevas querés sumar al equipo?',
      help: 'Se cuentan solas las agentes que agregues marcadas como «nueva».',
    },
  };

  function renderTeamGoals() {
    const { goals, agents } = state.data;
    const t = calc.teamTotals(agents);
    const main = calc.mainGoals(goals);
    $('#team-size').textContent = t.count
      ? `${periodLabel()} · ${t.count} ${t.count === 1 ? 'agente' : 'agentes'} en el equipo (${t.active} ${t.active === 1 ? 'activa' : 'activas'})`
      : `${periodLabel()} · todavía sin agentes cargadas`;
    $('#team-goals').innerHTML = calc.MAIN_TYPES.map((type) => teamGoalCard(type, main[type], t, agents)).join('');
  }

  function teamGoalCard(type, goal, t, agents) {
    const info = MAIN_INFO[type];
    const done = calc.mainAchieved(type, t);
    const target = goal ? goal.target : null;
    const has = calc.hasTarget(target);
    const pct = calc.percent(done, target);
    const left = calc.pending(done, target);
    const scheduled = type === 'demos' ? t.demosScheduled : 0;
    const doneW = calc.barWidth(pct);
    const schedW = has && scheduled ? Math.min(100 - doneW, Math.round((scheduled / n(target)) * 100)) : 0;

    let note = '';
    if (type === 'ventas' || type === 'demos') {
      const sum = type === 'ventas' ? t.salesTargets : t.demosTargets;
      if (has && t.active) {
        const diff = n(target) - sum;
        if (!sum) note = `Todavía no le pusiste objetivo de ${info.unit} a tus agentes.`;
        else if (diff > 0) note = `Repartiste <b>${sum}</b> entre tus agentes. Te faltan repartir <b>${diff}</b>.`;
        else if (diff < 0) note = `Repartiste <b>${sum}</b> entre tus agentes: <b>${-diff}</b> más que el objetivo del equipo.`;
        else note = `Repartiste <b>${sum}</b> entre tus agentes ✓`;
      }
    } else {
      const nuevas = agents.filter((a) => a.isNew).map((a) => esc(a.name.split(' ')[0]));
      note = nuevas.length
        ? `Nuevas: ${nuevas.join(', ')}`
        : 'Cuando agregues una agente, marcala como «nueva» y se suma acá.';
    }

    return `
      <article class="tgoal" style="--c:${info.color};--c-soft:${info.soft};--c-ink:${info.ink}">
        <div class="tgoal-head">
          <span class="tgoal-icon" aria-hidden="true">${ICONS[info.icon]}</span>
          <h3>${info.title}</h3>
          ${has ? `<button class="btn btn-ghost btn-sm tgoal-edit" data-act="main-goal" data-type="${type}" aria-label="Cambiar el objetivo de ${info.title.toLowerCase()}">${ICONS.edit} Cambiar</button>` : ''}
        </div>
        ${has ? `
          <p class="tgoal-num"><b>${done}</b> de ${n(target)}</p>
          <div class="bar bar-lg bar-split" role="img" aria-label="${done} de ${n(target)} ${info.unit}${scheduled ? `, ${scheduled} agendadas` : ''}">
            <span style="width:${doneW}%;background:${info.color}"></span>${schedW ? `<span class="sched" style="width:${schedW}%;background:${info.color}"></span>` : ''}
          </div>
          <div class="tgoal-foot">
            <span><b>${pct}%</b></span>
            ${left > 0 ? `<span>Faltan <b>${left}</b></span>` : '<span class="tgoal-done">¡Cumplido!</span>'}
          </div>
          ${scheduled ? `<p class="tgoal-sched"><i></i>${scheduled} ${scheduled === 1 ? 'demo agendada' : 'demos agendadas'}</p>` : ''}`
        : `
          <p class="tgoal-num"><b>${done}</b> ${done === 1 ? info.unit1 : info.unit}</p>
          <button class="btn btn-primary btn-sm" data-act="main-goal" data-type="${type}">Definir objetivo</button>`}
        ${note ? `<p class="tgoal-note">${note}</p>` : ''}
      </article>`;
  }

  function mainGoalForm(type) {
    const info = MAIN_INFO[type];
    const goal = calc.mainGoals(state.data.goals)[type];
    openModal({
      title: `Objetivo de ${info.title.toLowerCase()} del equipo`,
      submitLabel: 'Guardar',
      body: `
        <div class="form-grid">
          ${stepperField('target', `${info.question} <span class="opt">${esc(periodLabel())}</span>`, goal ? goal.target : null, { placeholder: 'Sin definir', help: info.help })}
        </div>`,
      onSubmit: async (form) => {
        const target = intOrNull(form.elements.target.value);
        return mutate(async () => {
          if (goal) await update('goals', goal.id, { target });
          else await create('goals', { type, description: '', target, achieved: 0 });
        }, target ? 'Objetivo guardado' : 'Objetivo sin definir');
      },
    });
  }

  /* ----- Otros objetivos (se cargan a mano) ----- */
  function goalTitle(g) {
    const t = config.goalTypes[g.type] || config.goalTypes.otro;
    return g.description && g.description.trim() ? g.description : `Objetivo de ${t.label.toLowerCase()}`;
  }

  function renderOtherGoals() {
    const others = calc.otherGoals(state.data.goals);
    $('#other-goals').innerHTML = `
      <div class="other-goals">
        <div class="other-head">
          <h3>Otros objetivos</h3>
          <button class="btn btn-ghost btn-sm" data-act="add-goal">+ Agregar otro objetivo</button>
        </div>
        ${others.length ? `<ul class="other-list">${others.map((g) => {
          const has = calc.hasTarget(g.target);
          const pct = calc.percent(g.achieved, g.target);
          return `
            <li class="other-row">
              <div class="other-main">
                <span class="other-title">${esc(goalTitle(g))}</span>
                ${has ? `<div class="bar"><span style="width:${calc.barWidth(pct)}%;background:var(--orange)"></span></div>` : ''}
              </div>
              <div class="mini-stepper" role="group" aria-label="Cantidad lograda">
                <button type="button" data-act="goal-step" data-id="${g.id}" data-delta="-1" aria-label="Restar uno" ${n(g.achieved) === 0 ? 'disabled' : ''}>−</button>
                <span><b>${n(g.achieved)}</b>${has ? ` de ${n(g.target)}` : ''}</span>
                <button type="button" data-act="goal-step" data-id="${g.id}" data-delta="1" aria-label="Sumar uno">+</button>
              </div>
              <div class="other-btns">
                <button class="icon-btn" data-act="edit-goal" data-id="${g.id}" aria-label="Editar objetivo" title="Editar">${ICONS.edit}</button>
                <button class="icon-btn" data-act="delete-goal" data-id="${g.id}" aria-label="Eliminar objetivo" title="Eliminar">${ICONS.trash}</button>
              </div>
            </li>`;
        }).join('')}</ul>` : '<p class="other-empty">Por ejemplo: activar a 2 agentes inactivas, o capacitar al equipo en un producto.</p>'}
      </div>`;
  }

  function goalForm(goal) {
    const isNew = !goal;
    const g = goal || { type: 'otro', description: '', target: null, achieved: 0 };
    openModal({
      title: isNew ? 'Otro objetivo del equipo' : 'Editar objetivo',
      submitLabel: isNew ? 'Agregar objetivo' : 'Guardar cambios',
      body: `
        <div class="form-grid">
          ${textField('description', '¿Qué querés lograr?', g.description, { placeholder: 'Ej.: activar a 2 agentes inactivas', autofocus: true })}
          ${stepperField('target', '¿Cuántas?', g.target, { placeholder: 'Sin definir', help: 'Después vas sumando lo logrado con los botones + y − en el resumen.' })}
        </div>`,
      onSubmit: async (form) => {
        const el = form.elements;
        const description = el.description.value.trim();
        if (!description) { showFieldError(el.description, 'Escribí qué querés lograr.'); return false; }
        const data = { description, target: intOrNull(el.target.value) };
        if (isNew) Object.assign(data, { type: 'otro', achieved: 0 });
        return mutate(
          () => (isNew ? create('goals', data) : update('goals', goal.id, data)),
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

    if (!agents.length) {
      const other = config.periods.find((p) => p.id !== state.periodId);
      $('#agents').innerHTML = `
        <div class="empty">
          <strong>Todavía no agregaste agentes a tu equipo.</strong>
          <p>Comenzá agregando a tu primera agente.</p>
          <div class="btn-row">
            <button class="btn btn-primary" data-act="add-agent">+ Agregar agente</button>
            ${other ? `<button class="btn btn-outline" data-act="import-agents" data-from="${other.id}" hidden id="btn-import">Traer mis agentes de ${esc(other.label)}</button>` : ''}
          </div>
        </div>`;
      if (other) maybeShowImport(other.id);
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
    $('#agents').innerHTML = `<div class="agents-grid">${list.map(agentCard).join('')}</div>`;
  }

  async function maybeShowImport(fromId) {
    const other = await store.getPeriod(state.tl.id, fromId);
    const btn = $('#btn-import');
    if (btn && other.agents.length && !state.data.agents.length) {
      btn.hidden = false;
      btn.textContent = `Traer mis ${other.agents.length} ${other.agents.length === 1 ? 'agente' : 'agentes'} de ${periodLabel(fromId)}`;
    }
  }

  async function importAgents(fromId) {
    const other = await store.getPeriod(state.tl.id, fromId);
    if (!other.agents.length) return;
    const ok = await confirmDialog({
      title: `¿Traer tus agentes de ${periodLabel(fromId)}?`,
      message: `Se van a copiar ${other.agents.length} ${other.agents.length === 1 ? 'agente' : 'agentes'} con su nombre y estado. Los objetivos, demos y ventas empiezan en cero para ${periodLabel()}.`,
      confirmLabel: 'Sí, traerlas',
    });
    if (!ok) return;
    mutate(async () => {
      for (const a of other.agents.slice().sort(byName)) {
        await create('agents', emptyAgent({ name: a.name, status: a.status }));
      }
    }, 'Agentes agregadas a este período');
  }

  function emptyAgent(extra) {
    return Object.assign({
      name: '', status: 'activa', isNew: false, personalGoal: '',
      target: null, sales: 0,
      demosTarget: null, demosDone: 0, demosScheduled: 0,
      notes: '', needs: '', nextAction: '', followUpDate: '',
    }, extra);
  }

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
              ${a.isNew ? '<span class="pill pill-new">Nueva</span>' : ''}
            </div>
          </div>
        </div>
        ${metric({ label: 'Ventas', done: a.sales, target: a.target, unit: 'ventas' })}
        ${metric({ label: 'Demos', done: a.demosDone, target: a.demosTarget, scheduled: a.demosScheduled, unit: 'demos' })}
        ${a.nextAction ? `<div class="next-action"><b>Próxima acción</b>${esc(a.nextAction)}${a.followUpDate ? ` · ${fmtDate(a.followUpDate)}` : ''}</div>` : ''}
        <div class="agent-foot">
          <button class="btn btn-primary btn-sm" data-act="progress" data-id="${a.id}">Cargar avance</button>
          <button class="btn btn-outline btn-sm" data-act="view-agent" data-id="${a.id}">Ver ficha</button>
        </div>
      </article>`;
  }

  const sameName = (name, exceptId) => state.data.agents.some((a) => a.id !== exceptId && fold(a.name) === fold(name));

  /* Alta de una agente: solo lo necesario. El resto se completa después. */
  function agentForm() {
    openModal({
      title: 'Nueva agente',
      submitLabel: 'Agregar agente',
      body: `
        <div class="form-grid">
          ${textField('name', 'Nombre y apellido', '', { placeholder: 'Ej.: María Pérez', autofocus: true })}
          <label class="toggle toggle-new">
            <input type="checkbox" name="isNew">
            <span><b>Es nueva:</b> se sumó al equipo en ${esc(periodLabel())}. Cuenta para el objetivo de agentes nuevas.</span>
          </label>
          <div class="form-block form-block-goals">
            <p class="form-block-title">${ICONS.flag} Sus objetivos para ${esc(periodLabel())}</p>
            <div class="form-row-2">
              ${stepperField('target', 'Ventas', null, { placeholder: 'Sin definir' })}
              ${stepperField('demosTarget', 'Demos', null, { placeholder: 'Sin definir' })}
            </div>
            <p class="field-help">Podés dejarlos vacíos y completarlos después en su ficha.</p>
          </div>
        </div>`,
      onSubmit: async (form) => {
        const el = form.elements;
        const name = el.name.value.trim().replace(/\s+/g, ' ');
        if (!name) { showFieldError(el.name, 'Escribí el nombre de la agente.'); return false; }
        if (sameName(name)) { showFieldError(el.name, `Ya tenés una agente llamada ${name} en este período.`); return false; }
        const data = emptyAgent({
          name,
          isNew: el.isNew.checked,
          target: intOrNull(el.target.value),
          demosTarget: intOrNull(el.demosTarget.value),
        });
        return mutate(() => create('agents', data), `${name} se sumó a tu equipo`);
      },
    });
  }

  /* "Cargar avance": lo que se actualiza cada semana, en una sola ventana. */
  function progressForm(a) {
    if (!a) return;
    openModal({
      title: `Avance de ${a.name}`,
      submitLabel: 'Guardar avance',
      body: `
        <div class="form-grid">
          <div class="form-block form-block-sales">
            <p class="form-block-title">${ICONS.bag} Ventas</p>
            ${stepperField('sales', 'Ventas hechas', n(a.sales), { help: calc.hasTarget(a.target) ? `Su objetivo: ${n(a.target)}` : 'Sin objetivo definido' })}
          </div>
          <div class="form-block form-block-demos">
            <p class="form-block-title">${ICONS.demo} Demos</p>
            <div class="form-row-2">
              ${stepperField('demosDone', 'Demos hechas', n(a.demosDone), { help: calc.hasTarget(a.demosTarget) ? `Su objetivo: ${n(a.demosTarget)}` : 'Sin objetivo definido' })}
              ${stepperField('demosScheduled', 'Demos agendadas', n(a.demosScheduled), { help: 'Con fecha, todavía no hechas' })}
            </div>
            <button type="button" class="btn btn-soft btn-sm btn-convert" id="btn-convert">✓ Se hizo una demo agendada</button>
          </div>
          ${textField('nextAction', 'Próxima acción', a.nextAction, { optional: true, placeholder: 'Ej.: acompañarla en su próxima demo' })}
        </div>`,
      onOpen: (form) => {
        const el = form.elements;
        const sync = () => { $('#btn-convert', form).hidden = n(el.demosScheduled.value) === 0; };
        form.oninput = sync;
        $('#btn-convert', form).addEventListener('click', () => {
          if (n(el.demosScheduled.value) === 0) return;
          el.demosScheduled.value = n(el.demosScheduled.value) - 1;
          el.demosDone.value = n(el.demosDone.value) + 1;
          sync();
        });
        sync();
      },
      onSubmit: async (form) => {
        const el = form.elements;
        const data = {
          sales: n(el.sales.value),
          demosDone: n(el.demosDone.value),
          demosScheduled: n(el.demosScheduled.value),
          nextAction: el.nextAction.value.trim(),
        };
        return mutate(() => update('agents', a.id, data), 'Avance guardado');
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
        <span><span class="dot" style="--dot:var(--purple)"></span>Recién empieza</span>
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
            ${metric({ label: 'Ventas', done: a.sales, target: a.target, unit: '', compact: true })}
            ${metric({ label: 'Demos', done: a.demosDone, target: a.demosTarget, scheduled: a.demosScheduled, unit: '', compact: true })}
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
              { value: 'pendiente', label: 'Pendiente', color: '#F5A01E' },
              { value: 'en_proceso', label: 'En proceso', color: '#3782CD' },
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
          date: el.date.value,
          status: el.status.value,
        };
        return mutate(
          () => (isNew ? create('actions', data) : update('actions', action.id, data)),
          isNew ? 'Acción agregada' : 'Acción actualizada'
        );
      },
    });
  }

  function toggleAction(id) {
    const x = state.data.actions.find((a) => a.id === id);
    if (!x) return;
    const next = x.status === 'realizado' ? 'pendiente' : 'realizado';
    mutate(() => update('actions', id, { status: next }), next === 'realizado' ? '¡Acción realizada!' : 'La acción volvió a pendiente');
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
          <label class="toggle toggle-new toggle-sm">
            <input type="checkbox" data-field="isNew" ${a.isNew ? 'checked' : ''}>
            <span><b>Es nueva</b> (se sumó en ${esc(periodLabel())})</span>
          </label>
        </div>
      </div>

      <div class="ficha-grid">
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
          <button type="button" class="btn btn-soft btn-sm btn-convert" data-act="ficha-convert" id="ficha-convert">✓ Se hizo una demo agendada</button>
          <div id="ficha-demos"></div>
        </section>

        <section class="ficha-card">
          <h2><span class="num">3</span>Sus ventas</h2>
          ${fichaStepper('sales', 'Ventas hechas', n(a.sales))}
          <div id="ficha-sales"></div>
        </section>

        <section class="ficha-card" style="--num-bg:#FEF4E4;--num-fg:#B66F00">
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

  /* Pasa una demo de "agendada" a "hecha" en la ficha. */
  function fichaConvert() {
    const sched = $('#ff-demosScheduled');
    const done = $('#ff-demosDone');
    if (!sched || !done || n(sched.value) === 0) return;
    sched.value = n(sched.value) - 1;
    done.value = n(done.value) + 1;
    [sched, done].forEach((el) => el.dispatchEvent(new Event('change', { bubbles: true })));
    toast('Demo pasada a hecha');
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
    if (['demosDone', 'demosScheduled', 'sales'].includes(f)) return n(el.value);
    if (f === 'name') return el.value.trim().replace(/\s+/g, ' ');
    if (f === 'status') return el.value === 'inactiva' ? 'inactiva' : 'activa';
    if (f === 'isNew') return el.checked;
    return el.type === 'date' ? el.value : el.value.trim();
  }

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
        await update('agents', id, patch);
        await loadPeriod();
        const a = state.data.agents.find((x) => x.id === id);
        if (a && state.currentAgentId === id) {
          updateFichaComputed(a);
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
        ? metric({ label: 'Avance de ventas', done: a.sales, target: a.target, unit: 'ventas' })
        : '<span>Definí su objetivo de ventas en "Su objetivo" para ver el avance.</span>'}</div>`;
    }
    const conv = $('#ficha-convert');
    if (conv) conv.hidden = n(a.demosScheduled) === 0;
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
        ? metric({ label: 'Avance de demos', done: a.demosDone, target: a.demosTarget, scheduled: sched, unit: 'demos' }) + note
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
  function printSummary() {
    const { goals, agents, actions } = state.data;
    const totals = calc.teamTotals(agents);
    const main = calc.mainGoals(goals);
    const teamLine = (type) => {
      const goal = main[type];
      const done = calc.mainAchieved(type, totals);
      if (!goal || !calc.hasTarget(goal.target)) return `<b>${done}</b>sin objetivo definido`;
      return `<b>${done} de ${n(goal.target)}</b>${calc.percent(done, goal.target)}% · faltan ${calc.pending(done, goal.target)}`;
    };
    const others = calc.otherGoals(goals);
    const fmtGoal = (done, target) => (calc.hasTarget(target) ? `${n(done)} / ${n(target)} (${calc.percent(done, target)}%)` : `${n(done)} / –`);
    const openActions = sortActions(actions.filter((x) => x.status !== 'realizado'));

    $('#print-summary').innerHTML = `
      <div class="pr-head">
        <div><span class="logo">KOBOLD</span><h1>Gestión comercial de mi equipo</h1></div>
        <div class="pr-meta">Team Leader: <b>${esc(state.tl.name)}</b><br>Período: <b>${esc(periodLabel())}</b><br>Fecha: ${fmtDate(todayISO())}</div>
      </div>

      <h2>Objetivos de mi equipo</h2>
      <div class="pr-stats">
        <div>Ventas${teamLine('ventas')}</div>
        <div>Demos${teamLine('demos')}${totals.demosScheduled ? ` · ${totals.demosScheduled} agendadas` : ''}</div>
        <div>Agentes nuevas${teamLine('reclutamiento')}</div>
        <div>Equipo<b>${totals.count} agentes</b>${totals.active} activas</div>
      </div>
      ${others.length ? `<table><thead><tr><th>Otros objetivos</th><th>Meta</th><th>Logrado</th><th>Avance</th></tr></thead><tbody>
        ${others.map((g) => {
          const p = calc.percent(g.achieved, g.target);
          return `<tr><td>${esc(goalTitle(g))}</td><td>${calc.hasTarget(g.target) ? n(g.target) : '–'}</td><td>${n(g.achieved)}</td><td>${p == null ? '–' : p + '%'}</td></tr>`;
        }).join('')}</tbody></table>` : ''}

      <h2>Mi equipo, agente por agente</h2>
      ${agents.length ? `<table><thead><tr><th>Agente</th><th>Estado</th><th>Ventas (hechas / objetivo)</th><th>Demos (hechas / objetivo)</th><th>Demos agendadas</th><th>Situación</th><th>Próxima acción</th></tr></thead><tbody>
        ${agents.map((a) => {
          return `<tr><td>${esc(a.name)}</td><td>${a.status === 'inactiva' ? 'Inactiva' : 'Activa'}${a.isNew ? ' · Nueva' : ''}</td><td>${fmtGoal(a.sales, a.target)}</td><td>${fmtGoal(a.demosDone, a.demosTarget)}</td><td>${n(a.demosScheduled)}</td><td>${esc(calc.agentSituation(a).label)}</td><td>${esc(a.nextAction)}${a.followUpDate ? ` (${fmtDate(a.followUpDate)})` : ''}</td></tr>`;
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
    $('#welcome-name').addEventListener('input', () => {
      $('#welcome-error').hidden = true;
      $('#welcome-name').classList.remove('invalid');
    });

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
        case 'logout': logout(); break;
        case 'period': changePeriod(id); break;
        case 'print': printSummary(); break;
        case 'tour': if (state.currentAgentId) { location.hash = '#/'; setTimeout(KGC.tour.start, 300); } else KGC.tour.start(); break;
        case 'tab': setTab(el.dataset.tab); break;
        case 'main-goal': mainGoalForm(el.dataset.type); break;
        case 'goal-step': stepGoal(id, Number(el.dataset.delta)); break;
        case 'ficha-convert': fichaConvert(); break;
        case 'progress': progressForm(state.data.agents.find((a) => a.id === id)); break;
        case 'add-goal': goalForm(null); break;
        case 'edit-goal': goalForm(state.data.goals.find((g) => g.id === id)); break;
        case 'delete-goal': deleteGoal(id); break;
        case 'add-agent': agentForm(); break;

        case 'delete-agent': deleteAgent(id); break;
        case 'view-agent': location.hash = `#/agente/${encodeURIComponent(id)}`; break;
        case 'import-agents': importAgents(el.dataset.from); break;
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

  KGC.app = { setTab };
  document.addEventListener('DOMContentLoaded', init);
})();
