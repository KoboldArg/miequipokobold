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
      agents: d.agents.slice().sort(byName),
      actions: d.actions.slice(),
    };
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
    route();
  }

  /* ---------------- Navegación ---------------- */
  async function route() {
    await flushFicha();
    const m = location.hash.match(/^#\/agente\/([^/]+)$/);
    if (m && state.tl) {
      showFicha(decodeURIComponent(m[1]));
    } else {
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
      const target = document.getElementById(state.returnTo);
      state.returnTo = null;
      if (target) target.scrollIntoView({ block: 'center' });
    }
  }

  function refresh() {
    renderHeader();
    if (state.currentAgentId) {
      const a = state.data.agents.find((x) => x.id === state.currentAgentId);
      if (!a) { location.hash = '#/'; return; }
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
    await flushFicha();
    await store.clearSession();
    state.tl = null;
    state.currentAgentId = null;
    history.replaceState(null, '', '#/');
    showWelcome();
  }

  /* ---------------- Dashboard ---------------- */
  function renderDashboard() {
    renderPeriod();
    renderGoals();
    renderSummary();
    renderAgents();
    renderCompare();
    renderActions();
  }

  function renderPeriod() {
    $('#period-switch').innerHTML = config.periods.map((p) => `
      <button type="button" class="period-btn" role="radio" aria-checked="${p.id === state.periodId}" data-act="period" data-id="${p.id}">
        <strong>${esc(p.label)}</strong>
        <span>${p.id === state.periodId ? 'Estás viendo este período' : 'Ver este período'}</span>
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

  /* ----- C. Objetivos ----- */
  function renderGoals() {
    const { goals, agents } = state.data;
    const totals = calc.teamTotals(agents);
    $('#goals-sub').textContent = `Lo que querés alcanzar con tu equipo en ${periodLabel()}.`;
    $('#btn-add-goal-top').hidden = goals.length === 0;

    if (!goals.length) {
      $('#goals').innerHTML = `
        <div class="empty">
          <strong>Definí qué querés alcanzar con tu equipo en este período.</strong>
          <p>Podés sumar objetivos de ventas, reclutamiento, demos u otros.</p>
          <div class="btn-row"><button class="btn btn-primary" data-act="add-goal">+ Agregar objetivo</button></div>
        </div>`;
      return;
    }

    $('#goals').innerHTML = `<div class="goals-grid">${goals.map((g) => goalCard(g, totals)).join('')}</div>`;
  }

  function goalTitle(g) {
    const t = config.goalTypes[g.type] || config.goalTypes.otro;
    return g.description && g.description.trim() ? g.description : `Objetivo de ${t.label.toLowerCase()}`;
  }

  function goalCard(g, totals) {
    const t = config.goalTypes[g.type] || config.goalTypes.otro;
    const achieved = calc.goalAchieved(g, totals);
    const target = n(g.target);
    const pct = calc.percent(achieved, g.target);
    const left = calc.pending(achieved, g.target);
    const done = pct != null && pct >= 100;
    return `
      <article class="goal-card" style="--accent:${t.color}">
        <div class="goal-top">
          <span class="tag" style="--tag-bg:${t.soft};--tag-fg:${t.color === '#00AC46' ? '#008F3A' : t.color}">${t.label}</span>
          <div class="goal-actions">
            <button class="icon-btn" data-act="edit-goal" data-id="${g.id}" aria-label="Editar objetivo" title="Editar">${ICONS.edit}</button>
            <button class="icon-btn" data-act="delete-goal" data-id="${g.id}" aria-label="Eliminar objetivo" title="Eliminar">${ICONS.trash}</button>
          </div>
        </div>
        <h3>${esc(goalTitle(g))}</h3>
        ${calc.hasTarget(g.target) ? `
          <div class="goal-numbers"><strong>${achieved}</strong><span class="of">de ${target}</span></div>
          <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${calc.barWidth(pct)}"><span style="width:${calc.barWidth(pct)}%;background:${t.color}"></span></div>
          <div class="goal-foot">
            <span><span class="pct">${pct}%</span> de avance</span>
            ${done ? '<span class="goal-done">¡Objetivo cumplido!</span>' : `<span>Faltan <b>${left}</b></span>`}
          </div>`
        : `
          <div class="goal-numbers"><strong>${achieved}</strong><span class="of">alcanzadas</span></div>
          <p class="goal-note">Todavía no definiste la cantidad objetivo. <button class="btn btn-ghost btn-sm" data-act="edit-goal" data-id="${g.id}">Completar</button></p>`}
        ${g.auto && t.auto ? `<p class="goal-note">${t.autoText}.</p>` : ''}
      </article>`;
  }

  function goalForm(goal, presetType) {
    const isNew = !goal;
    const g = goal || { type: presetType || 'ventas', description: '', target: null, achieved: 0, auto: true };
    const totals = calc.teamTotals(state.data.agents);
    const typeOptions = Object.entries(config.goalTypes).map(([value, t]) => ({ value, label: t.label, color: t.color }));

    openModal({
      title: isNew ? 'Nuevo objetivo del equipo' : 'Editar objetivo',
      submitLabel: isNew ? 'Agregar objetivo' : 'Guardar cambios',
      body: `
        <div class="form-grid">
          <div class="field">
            <span class="field-label">1. Tipo de objetivo</span>
            ${choiceGroup('type', typeOptions, g.type)}
          </div>
          ${textField('description', '2. Descripción del objetivo', g.description, { placeholder: 'Ej.: alcanzar las ventas del equipo en el período' })}
          <div class="form-row-2">
            ${stepperField('target', '3. Cantidad objetivo', g.target)}
            <div id="achieved-wrap">${stepperField('achieved', '4. Cantidad alcanzada', n(g.achieved))}</div>
          </div>
          <label class="toggle" id="auto-wrap">
            <input type="checkbox" name="auto" ${g.auto ? 'checked' : ''}>
            <span id="auto-text"></span>
          </label>
        </div>`,
      onOpen: (form) => {
        const sync = () => {
          const type = form.elements.type.value;
          const t = config.goalTypes[type];
          const autoWrap = $('#auto-wrap', form);
          const achievedInput = form.elements.achieved;
          const stepBtns = $$('#achieved-wrap button', form);
          if (t.auto) {
            autoWrap.hidden = false;
            const what = type === 'ventas' ? 'ventas' : 'demos';
            $('#auto-text', form).innerHTML = `<b>Calcular automáticamente</b> con las ${what} cargadas en las fichas de mis agentes (hoy: ${type === 'ventas' ? totals.sales : totals.demos}).`;
            const auto = form.elements.auto.checked;
            achievedInput.disabled = auto;
            stepBtns.forEach((b) => { b.disabled = auto; });
            if (auto) achievedInput.value = type === 'ventas' ? totals.sales : totals.demos;
          } else {
            autoWrap.hidden = true;
            achievedInput.disabled = false;
            stepBtns.forEach((b) => { b.disabled = false; });
          }
        };
        // al desactivar el cálculo automático, la cantidad vuelve al último valor cargado a mano
        let manualValue = n(g.achieved);
        form.elements.achieved.addEventListener('input', () => { if (!form.elements.achieved.disabled) manualValue = n(form.elements.achieved.value); });
        form.addEventListener('change', (e) => {
          if (e.target.name === 'auto' || e.target.name === 'type') {
            const t = config.goalTypes[form.elements.type.value];
            if (!t.auto || !form.elements.auto.checked) form.elements.achieved.value = manualValue;
            sync();
          }
        });
        sync();
      },
      onSubmit: async (form) => {
        const type = form.elements.type.value;
        const t = config.goalTypes[type];
        const auto = t.auto && form.elements.auto.checked;
        const data = {
          type,
          description: form.elements.description.value.trim(),
          target: intOrNull(form.elements.target.value),
          achieved: auto ? n(goal ? goal.achieved : 0) : n(form.elements.achieved.value),
          auto,
        };
        if (!auto && form.elements.achieved.value !== '' && Number(form.elements.achieved.value) < 0) data.achieved = 0;
        return mutate(
          () => (isNew ? create('goals', data) : update('goals', goal.id, data)),
          isNew ? 'Objetivo agregado' : 'Objetivo actualizado'
        );
      },
    });
  }

  async function deleteGoal(id) {
    const g = state.data.goals.find((x) => x.id === id);
    if (!g) return;
    const ok = await confirmDialog({ title: '¿Eliminar este objetivo?', message: `Vas a eliminar "${goalTitle(g)}" de ${periodLabel()}. Esta acción no se puede deshacer.` });
    if (ok) mutate(() => remove('goals', id), 'Objetivo eliminado');
  }

  /* ----- D. Resumen ----- */
  function renderSummary() {
    const { agents, goals } = state.data;
    const t = calc.teamTotals(agents);
    const sg = calc.teamSalesGoal(goals);
    const salesGoalsCount = goals.filter((g) => g.type === 'ventas').length;

    let goalBody;
    if (sg && calc.hasTarget(sg.target)) {
      const achieved = calc.goalAchieved(sg, t);
      const pct = calc.percent(achieved, sg.target);
      const left = calc.pending(achieved, sg.target);
      goalBody = `
        <span class="stat-value">${achieved} <small>de ${n(sg.target)} ventas</small></span>
        <div class="bar bar-lg" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${calc.barWidth(pct)}"><span style="width:${calc.barWidth(pct)}%"></span></div>
        <div class="stat-goal-foot">
          <span>${pct}% de avance</span>
          <span>${left > 0 ? `Faltan ${left} ${left === 1 ? 'venta' : 'ventas'}` : '¡Objetivo alcanzado!'}</span>
        </div>
        ${salesGoalsCount > 1 ? `<span class="stat-sub">Según tu objetivo "${esc(goalTitle(sg))}".</span>` : ''}
        ${!sg.auto ? '<span class="stat-sub">Usa la cantidad alcanzada que cargaste a mano en el objetivo.</span>' : ''}`;
    } else if (sg) {
      goalBody = `
        <span class="stat-sub">Creaste un objetivo de ventas, pero falta definir la cantidad.</span>
        <button class="btn btn-primary btn-sm" data-act="edit-goal" data-id="${sg.id}">Completar cantidad</button>`;
    } else {
      goalBody = `
        <span class="stat-sub">Todavía no definiste un objetivo de ventas para tu equipo en este período.</span>
        <button class="btn btn-primary btn-sm" data-act="add-goal" data-type="ventas">+ Definir objetivo de ventas</button>`;
    }

    $('#summary').innerHTML = `
      <div class="stat" style="--icon:var(--purple)">
        <span class="stat-icon">${ICONS.users}</span>
        <span class="stat-label">Agentes en mi equipo</span>
        <span class="stat-value">${t.count}</span>
        <span class="stat-sub">${t.count ? `${t.active} ${t.active === 1 ? 'activa' : 'activas'}` : 'Sin agentes cargadas'}</span>
      </div>
      <div class="stat" style="--icon:var(--green)">
        <span class="stat-icon">${ICONS.bag}</span>
        <span class="stat-label">Ventas realizadas</span>
        <span class="stat-value">${t.sales}</span>
        <span class="stat-sub">Suma de todas tus agentes</span>
      </div>
      <div class="stat" style="--icon:var(--blue)">
        <span class="stat-icon">${ICONS.demo}</span>
        <span class="stat-label">Demos realizadas</span>
        <span class="stat-value">${t.demos}</span>
        <span class="stat-sub">Suma de todas tus agentes</span>
      </div>
      <div class="stat stat-goal">
        <span class="stat-icon">${ICONS.flag}</span>
        <span class="stat-label">Objetivo de ventas del equipo</span>
        ${goalBody}
      </div>`;
  }

  /* ----- 4. Mis agentes ----- */
  function filteredAgents() {
    const q = state.search.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
    return state.data.agents.filter((a) => {
      if (state.statusFilter === 'activas' && a.status === 'inactiva') return false;
      if (state.statusFilter === 'inactivas' && a.status !== 'inactiva') return false;
      if (q && !a.name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().includes(q)) return false;
      return true;
    });
  }

  function renderAgents() {
    const agents = state.data.agents;
    $('#agents-toolbar').hidden = agents.length === 0;
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
      message: `Se van a copiar ${other.agents.length} ${other.agents.length === 1 ? 'agente' : 'agentes'} con su nombre y estado. Los objetivos, demos, ventas y seguimientos empiezan en cero para ${periodLabel()}.`,
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
      name: '', status: 'activa', personalGoal: '', target: null,
      demosPlanned: null, demosDone: 0, sales: 0,
      notes: '', needs: '', nextAction: '', followUpDate: '',
    }, extra);
  }

  function agentCard(a) {
    const pct = calc.percent(a.sales, a.target);
    const left = calc.pending(a.sales, a.target);
    const sit = calc.agentSituation(a);
    const inactive = a.status === 'inactiva';
    return `
      <article class="agent-card ${inactive ? 'is-inactive' : ''}">
        <div class="agent-head">
          <span class="avatar" aria-hidden="true">${esc(initials(a.name))}</span>
          <div>
            <h3>${esc(a.name)}</h3>
            <div class="meta">
              <span class="pill ${inactive ? 'pill-inactive' : 'pill-active'}">${inactive ? 'Inactiva' : 'Activa'}</span>
              ${!inactive ? `<span class="pill"><span class="dot" style="--dot:${sit.color}"></span>${sit.label}</span>` : ''}
            </div>
          </div>
        </div>
        <div class="agent-stats">
          <div><b>${calc.hasTarget(a.target) ? n(a.target) : '–'}</b><span>Objetivo</span></div>
          <div><b>${n(a.demosDone)}</b><span>Demos</span></div>
          <div><b>${n(a.sales)}</b><span>Ventas</span></div>
        </div>
        <div class="agent-progress">
          <div class="bar"><span style="width:${calc.barWidth(pct)}%;background:${sit.color}"></span></div>
          <div class="agent-progress-label">
            ${pct == null
              ? '<span>Sin objetivo individual definido</span>'
              : `<span><b>${pct}%</b> de su objetivo</span><span>${left > 0 ? `Faltan ${left}` : '¡Meta alcanzada!'}</span>`}
          </div>
        </div>
        ${a.nextAction ? `<div class="next-action"><b>Próxima acción</b>${esc(a.nextAction)}${a.followUpDate ? ` · ${fmtDate(a.followUpDate)}` : ''}</div>` : ''}
        <div class="agent-foot">
          <button class="btn btn-soft btn-sm" data-act="view-agent" data-id="${a.id}">Ver seguimiento</button>
          <button class="btn btn-outline btn-sm" data-act="edit-agent" data-id="${a.id}">Editar</button>
          <button class="btn btn-ghost btn-sm" data-act="delete-agent" data-id="${a.id}">Eliminar</button>
        </div>
      </article>`;
  }

  function agentForm(agent) {
    const isNew = !agent;
    const a = agent || emptyAgent();
    openModal({
      title: isNew ? 'Nueva agente' : `Editar a ${a.name}`,
      submitLabel: isNew ? 'Agregar agente' : 'Guardar cambios',
      body: `
        <div class="form-grid">
          ${textField('name', 'Nombre y apellido', a.name, { placeholder: 'Ej.: María Pérez', autofocus: true })}
          <div class="field">
            <span class="field-label">Estado</span>
            ${choiceGroup('status', [{ value: 'activa', label: 'Activa' }, { value: 'inactiva', label: 'Inactiva', color: '#707070' }], a.status)}
          </div>
          <p class="form-section-title">Su período ${esc(periodLabel())}</p>
          <div class="form-row-2">
            ${stepperField('target', 'Objetivo de ventas', a.target, { placeholder: 'Sin definir' })}
            ${stepperField('sales', 'Ventas realizadas', n(a.sales))}
            ${stepperField('demosDone', 'Demos realizadas', n(a.demosDone))}
            ${stepperField('demosPlanned', 'Demos planificadas', a.demosPlanned, { optional: true, placeholder: 'Sin definir' })}
          </div>
          ${textField('nextAction', 'Próxima acción a realizar', a.nextAction, { optional: true, placeholder: 'Ej.: acompañarla en su próxima demo' })}
          <details class="more" ${!isNew && (a.notes || a.needs || a.personalGoal || a.followUpDate) ? 'open' : ''}>
            <summary>Seguimiento <span class="opt">&nbsp;(opcional)</span></summary>
            <div class="form-grid">
              ${textField('personalGoal', '¿Qué quiere conseguir?', a.personalGoal, { multiline: true, placeholder: 'Lo que ella se propone en este período' })}
              ${textField('needs', '¿Qué necesita trabajar esta agente?', a.needs, { multiline: true })}
              ${textField('notes', 'Observaciones', a.notes, { multiline: true })}
              ${textField('followUpDate', 'Fecha de seguimiento', a.followUpDate, { type: 'date' })}
            </div>
          </details>
        </div>`,
      onSubmit: async (form) => {
        const el = form.elements;
        const name = el.name.value.trim().replace(/\s+/g, ' ');
        if (!name) { showFieldError(el.name, 'Escribí el nombre de la agente.'); return false; }
        const data = {
          name,
          status: el.status.value === 'inactiva' ? 'inactiva' : 'activa',
          target: intOrNull(el.target.value),
          sales: n(el.sales.value),
          demosDone: n(el.demosDone.value),
          demosPlanned: intOrNull(el.demosPlanned.value),
          nextAction: el.nextAction.value.trim(),
          personalGoal: el.personalGoal.value.trim(),
          needs: el.needs.value.trim(),
          notes: el.notes.value.trim(),
          followUpDate: el.followUpDate.value,
        };
        return mutate(
          () => (isNew ? create('agents', emptyAgent(data)) : update('agents', agent.id, data)),
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
      message: `Se van a borrar sus datos de ${periodLabel()}${linked ? ` y ${linked === 1 ? 'su acción' : `sus ${linked} acciones`} de seguimiento` : ''}. Esta acción no se puede deshacer.`,
    });
    if (!ok) return;
    const wasInFicha = state.currentAgentId === id;
    if (wasInFicha) { cancelFichaSave(); state.currentAgentId = null; }
    await mutate(async () => {
      await store.removeWhere(state.tl.id, state.periodId, 'actions', 'agentId', id);
      await remove('agents', id);
    }, `${a.name} fue eliminada`);
    if (wasInFicha) location.hash = '#/';
  }

  /* ----- 6. Comparativa ----- */
  function renderCompare() {
    const agents = state.data.agents;
    if (!agents.length) {
      $('#compare').innerHTML = '<p class="section-sub">Cuando agregues agentes, vas a ver acá la comparación de todo tu equipo.</p>';
      return;
    }
    const rows = agents.slice().sort((a, b) => {
      const sa = calc.agentSituation(a), sb = calc.agentSituation(b);
      const pa = calc.percent(a.sales, a.target), pb = calc.percent(b.sales, b.target);
      if ((sa.order >= 5) !== (sb.order >= 5)) return sa.order >= 5 ? 1 : -1;
      if (pa != null && pb != null && pa !== pb) return pb - pa;
      return byName(a, b);
    });
    $('#compare').innerHTML = `
      <div class="legend">
        <span><span class="dot" style="--dot:var(--green)"></span>Buen avance o meta alcanzada</span>
        <span><span class="dot" style="--dot:var(--yellow)"></span>Necesita seguimiento</span>
        <span><span class="dot" style="--dot:var(--orange)"></span>Requiere atención</span>
        <span><span class="dot" style="--dot:var(--red)"></span>Necesita intervención</span>
        <span><span class="dot" style="--dot:var(--gray)"></span>Sin objetivo o inactiva</span>
      </div>
      <div class="compare-row compare-head">
        <span>Agente</span><span class="compare-num">Objetivo</span><span class="compare-num">Demos</span><span class="compare-num">Ventas</span><span>Avance</span>
      </div>
      ${rows.map((a) => {
        const pct = calc.percent(a.sales, a.target);
        const sit = calc.agentSituation(a);
        return `
          <div class="compare-row">
            <div class="compare-name">
              <span class="dot" style="--dot:${sit.color}" title="${esc(sit.label)}"></span>
              <div>
                <button type="button" data-act="view-agent" data-id="${a.id}" title="Ver seguimiento">${esc(a.name)}</button>
                <span class="compare-situation">${esc(sit.label)}</span>
              </div>
            </div>
            <span class="compare-num"><small>Objetivo</small>${calc.hasTarget(a.target) ? n(a.target) : '–'}</span>
            <span class="compare-num"><small>Demos</small>${n(a.demosDone)}</span>
            <span class="compare-num"><small>Ventas</small>${n(a.sales)}</span>
            <div class="compare-bar">
              <div class="bar"><span style="width:${calc.barWidth(pct)}%;background:${sit.color}"></span></div>
              ${pct == null ? '<span class="pct none">Sin objetivo</span>' : `<span class="pct">${pct}%</span>`}
            </div>
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
          <strong>Todavía no registraste acciones de seguimiento en ${esc(periodLabel())}.</strong>
          <p>Anotá qué vas a trabajar con cada agente esta semana: coordinar demos, acompañarla en una demo, conversar sobre su objetivo…</p>
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
    state.returnTo = 'sec-agents';
    $('#view-dashboard').hidden = true;
    const view = $('#view-agent');
    view.hidden = false;
    window.scrollTo(0, 0);

    const sit = calc.agentSituation(a);
    view.innerHTML = `
      <div class="ficha-top">
        <a class="btn btn-outline" href="#/">${ICONS.back} Volver a mi equipo</a>
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
        <section class="ficha-card">
          <h2><span class="num">1</span>Su objetivo</h2>
          <p class="hint">Qué quiere conseguir y cuántas ventas se propone en este período.</p>
          ${fichaText('personalGoal', '¿Qué quiere conseguir?', a.personalGoal, true, 'Ej.: lograr sus primeras 3 ventas para acceder al incentivo')}
          ${fichaStepper('target', 'Ventas que se propone realizar', a.target, 'Sin definir')}
        </section>

        <section class="ficha-card" style="--num-bg:#EAF2FA;--num-fg:#3782CD">
          <h2><span class="num">2</span>Su actividad</h2>
          <div class="form-row-2">
            ${fichaStepper('demosPlanned', 'Demos planificadas', a.demosPlanned, 'Sin definir')}
            ${fichaStepper('demosDone', 'Demos realizadas', n(a.demosDone))}
          </div>
          <div id="ficha-activity"></div>
        </section>

        <section class="ficha-card">
          <h2><span class="num">3</span>Sus resultados</h2>
          ${fichaStepper('sales', 'Ventas concretadas', n(a.sales))}
          <div id="ficha-results"></div>
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

      <section class="section">
        <div class="section-head">
          <div>
            <h2>Acciones de seguimiento con ${esc(a.name.split(' ')[0])}</h2>
            <p class="section-sub">Estas acciones también aparecen en "Mi seguimiento de esta semana".</p>
          </div>
          <button class="btn btn-primary" data-act="add-action" data-agent="${a.id}">+ Agregar acción</button>
        </div>
        <div id="ficha-actions"></div>
      </section>

      <div class="ficha-top" style="margin-top:20px">
        <a class="btn btn-outline" href="#/">${ICONS.back} Volver a mi equipo</a>
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
    if (['target', 'demosPlanned'].includes(f)) return intOrNull(el.value);
    if (['demosDone', 'sales'].includes(f)) return n(el.value);
    if (f === 'name') return el.value.trim().replace(/\s+/g, ' ');
    if (f === 'status') return el.value === 'inactiva' ? 'inactiva' : 'activa';
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

    const pct = calc.percent(a.sales, a.target);
    const left = calc.pending(a.sales, a.target);
    const res = $('#ficha-results');
    if (res) {
      res.innerHTML = pct == null
        ? `<div class="big-progress"><span>Definí en "Su objetivo" cuántas ventas se propone para ver su avance.</span></div>`
        : `<div class="big-progress">
            <div class="line"><strong>${n(a.sales)} de ${n(a.target)} ventas</strong><span class="pct" style="color:${sit.key === 'amarillo' ? '#8A7500' : sit.color}">${pct}%</span></div>
            <div class="bar bar-lg"><span style="width:${calc.barWidth(pct)}%;background:${sit.color}"></span></div>
            <span>${left > 0 ? `Le ${left === 1 ? 'falta' : 'faltan'} <b>${left}</b> ${left === 1 ? 'venta' : 'ventas'} para su objetivo.` : '<b>¡Alcanzó su objetivo!</b>'}</span>
          </div>`;
    }
    const act = $('#ficha-activity');
    if (act) {
      const planned = n(a.demosPlanned);
      const dp = calc.percent(a.demosDone, a.demosPlanned);
      act.innerHTML = planned > 0
        ? `<div class="big-progress">
            <div class="line"><span><b>${n(a.demosDone)}</b> de ${planned} demos planificadas</span><span class="pct" style="color:var(--blue)">${dp}%</span></div>
            <div class="bar"><span style="width:${calc.barWidth(dp)}%;background:var(--blue)"></span></div>
          </div>`
        : '';
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
    const sg = calc.teamSalesGoal(goals);
    const sgAchieved = sg ? calc.goalAchieved(sg, totals) : 0;
    const salesPct = sg ? calc.percent(sgAchieved, sg.target) : null;
    const openActions = sortActions(actions.filter((x) => x.status !== 'realizado'));

    $('#print-summary').innerHTML = `
      <div class="pr-head">
        <div><span class="logo">KOBOLD</span><h1>Gestión comercial de mi equipo</h1></div>
        <div class="pr-meta">Team Leader: <b>${esc(state.tl.name)}</b><br>Período: <b>${esc(periodLabel())}</b><br>Fecha: ${fmtDate(todayISO())}</div>
      </div>

      <h2>Resumen del equipo</h2>
      <div class="pr-stats">
        <div>Agentes<b>${totals.count}</b>${totals.active} activas</div>
        <div>Ventas realizadas<b>${totals.sales}</b></div>
        <div>Demos realizadas<b>${totals.demos}</b></div>
        <div>Objetivo de ventas<b>${sg && calc.hasTarget(sg.target) ? `${sgAchieved} de ${n(sg.target)}` : '–'}</b>${salesPct != null ? `${salesPct}% · faltan ${calc.pending(sgAchieved, sg.target)}` : 'Sin definir'}</div>
      </div>

      <h2>Objetivos del equipo</h2>
      ${goals.length ? `<table><thead><tr><th>Tipo</th><th>Objetivo</th><th>Meta</th><th>Alcanzado</th><th>Faltan</th><th>Avance</th></tr></thead><tbody>
        ${goals.map((g) => {
          const ach = calc.goalAchieved(g, totals); const p = calc.percent(ach, g.target);
          return `<tr><td>${esc((config.goalTypes[g.type] || config.goalTypes.otro).label)}</td><td>${esc(goalTitle(g))}</td><td>${calc.hasTarget(g.target) ? n(g.target) : '–'}</td><td>${ach}</td><td>${calc.hasTarget(g.target) ? calc.pending(ach, g.target) : '–'}</td><td>${p == null ? '–' : p + '%'}</td></tr>`;
        }).join('')}</tbody></table>` : '<p class="pr-empty">Sin objetivos cargados.</p>'}

      <h2>Mi equipo, agente por agente</h2>
      ${agents.length ? `<table><thead><tr><th>Agente</th><th>Estado</th><th>Objetivo</th><th>Demos</th><th>Ventas</th><th>Avance</th><th>Situación</th><th>Próxima acción</th></tr></thead><tbody>
        ${agents.map((a) => {
          const p = calc.percent(a.sales, a.target);
          return `<tr><td>${esc(a.name)}</td><td>${a.status === 'inactiva' ? 'Inactiva' : 'Activa'}</td><td>${calc.hasTarget(a.target) ? n(a.target) : '–'}</td><td>${n(a.demosDone)}${a.demosPlanned != null ? ` / ${n(a.demosPlanned)}` : ''}</td><td>${n(a.sales)}</td><td>${p == null ? '–' : p + '%'}</td><td>${esc(calc.agentSituation(a).label)}</td><td>${esc(a.nextAction)}${a.followUpDate ? ` (${fmtDate(a.followUpDate)})` : ''}</td></tr>`;
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
        case 'add-goal': goalForm(null, el.dataset.type); break;
        case 'edit-goal': goalForm(state.data.goals.find((g) => g.id === id)); break;
        case 'delete-goal': deleteGoal(id); break;
        case 'add-agent': agentForm(null); break;
        case 'edit-agent': agentForm(state.data.agents.find((a) => a.id === id)); break;
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

  document.addEventListener('DOMContentLoaded', init);
})();
