/* Panel de administración: ve (sin modificar) lo que carga cada Team Leader. */
window.KGC = window.KGC || {};

KGC.admin = (function () {
  const { calc } = KGC;
  const { n } = calc;
  const $ = (sel) => document.querySelector(sel);
  const SALES = '#00AC46';
  const DEMOS = '#3782CD';
  let ctx = { name: '', periods: [], periodId: '' };
  let bound = false;

  const app = () => KGC.app;
  const esc = (s) => app().esc(s);
  const periodLabel = (id = ctx.periodId) => (ctx.periods.find((p) => p.id === id) || {}).label || id;
  const fmtShort = (iso) => (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${Number(iso.slice(8))}/${Number(iso.slice(5, 7))}` : '');
  const goalTitle = (g, fallback) => (g.description && g.description.trim() ? g.description : fallback);

  function open({ name, periods, periodId }) {
    ctx = { name, periods, periodId };
    $('#screen-welcome').hidden = true;
    $('#screen-app').hidden = true;
    $('#screen-admin').hidden = false;
    document.title = 'Panel de administración | Kobold';
    $('#admin-name').textContent = name;
    $('#admin-avatar').textContent = app().initials(name);
    $('#admin-hello').textContent = `¡Hola, ${String(name).split(/[\s@]/)[0]}!`;
    if (!bound) {
      $('#screen-admin').addEventListener('click', onClick);
      bound = true;
    }
    render();
  }

  function onClick(e) {
    const tlBtn = e.target.closest('[data-admin-tl]');
    if (tlBtn) {
      ctx.detail = tlBtn.dataset.adminTl;
      show();
      window.scrollTo(0, 0);
      return;
    }
    if (e.target.closest('[data-admin-back]')) {
      ctx.detail = null;
      show();
      window.scrollTo(0, 0);
      return;
    }
    const btn = e.target.closest('[data-admin-period]');
    if (!btn || btn.dataset.adminPeriod === ctx.periodId) return;
    ctx.periodId = btn.dataset.adminPeriod;
    KGC.store.setSession({ periodId: ctx.periodId });
    render();
  }

  /* Muestra el resumen de todas las TL o el detalle de una. */
  function show() {
    if (!ctx.data) return;
    const tl = ctx.detail && ctx.data.tls.find((x) => x.id === ctx.detail);
    if (tl) {
      $('#admin-totals').hidden = true;
      renderDetail(tl);
    } else {
      ctx.detail = null;
      $('#admin-totals').hidden = false;
      renderTotals(ctx.data);
      renderTLs(ctx.data);
    }
  }

  async function render() {
    $('#admin-period-switch').innerHTML = ctx.periods.map((p) => `
      <button type="button" class="period-btn" role="radio" aria-checked="${p.id === ctx.periodId}" data-admin-period="${p.id}">
        <strong>${esc(p.label)}</strong>
        ${p.start && p.end ? `<span class="period-dates">${fmtShort(p.start)} al ${fmtShort(p.end)}</span>` : ''}
      </button>`).join('');
    $('#admin-totals').hidden = false;
    $('#admin-totals').innerHTML = '<p class="section-sub">Cargando…</p>';
    $('#admin-tls').innerHTML = '';
    try {
      ctx.data = await KGC.store.getAdminPeriod(ctx.periodId);
    } catch (err) {
      console.error(err);
      $('#admin-totals').innerHTML = '<p class="field-error">No pudimos traer los datos. Revisá tu conexión y volvé a cargar la página.</p>';
      return;
    }
    show();
  }

  function renderTotals({ tls, agents }) {
    const t = calc.teamTotals(agents);
    $('#admin-totals').innerHTML = `
      <div class="section-head">
        <div class="sec-title">
          <span class="sec-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg></span>
          <div>
            <h2>Todo el equipo comercial</h2>
            <p class="section-sub">${esc(periodLabel())} · suma de todas las Team Leaders</p>
          </div>
        </div>
      </div>
      <div class="admin-stats">
        <div><b>${tls.length}</b><span>Team Leaders</span></div>
        <div><b>${t.count}</b><span>Agentes (${t.active} activas)</span></div>
        <div><b>${t.sales}</b><span>Ventas hechas</span></div>
        <div><b>${t.demos}</b><span>Demos hechas${t.demosScheduled ? ` · ${t.demosScheduled} agendadas` : ''}</span></div>
      </div>`;
  }

  function renderTLs({ tls, goals, agents, actions }) {
    if (!tls.length) {
      $('#admin-tls').innerHTML = `
        <div class="empty"><strong>Todavía no hay Team Leaders habilitadas.</strong>
        <p>Se suman desde Supabase (Authentication → Users y el archivo usuarios.sql).</p></div>`;
      return;
    }
    $('#admin-tls').innerHTML = `<div class="admin-grid">${tls.map((tl) => tlCard(
      tl,
      goals.filter((g) => g.tlId === tl.id),
      agents.filter((a) => a.tlId === tl.id).sort((a, b) => a.name.localeCompare(b.name, 'es')),
      actions.filter((x) => x.tlId === tl.id),
    )).join('')}</div>`;
  }

  function tlCard(tl, goals, agents, actions) {
    const t = calc.teamTotals(agents);
    const metric = app().metric;
    const sales = calc.findGoal(goals, 'ventas');
    const demos = calc.findGoal(goals, 'demos');
    const recruit = calc.findGoal(goals, 'reclutamiento');
    const others = goals.filter((g) => g.type === 'otro');
    const open = actions.filter((x) => x.status !== 'realizado').length;
    const empty = !goals.length && !agents.length;

    return `
      <article class="section admin-tl">
        <div class="admin-tl-head">
          <span class="tl-avatar" aria-hidden="true">${esc(app().initials(tl.name))}</span>
          <div>
            <h3>${esc(tl.name)}</h3>
            <p class="section-sub">${t.count} ${t.count === 1 ? 'agente' : 'agentes'} (${t.active} ${t.active === 1 ? 'activa' : 'activas'}) · ${open} ${open === 1 ? 'acción pendiente' : 'acciones pendientes'}</p>
          </div>
        </div>
        ${empty ? '<p class="other-empty">Todavía no cargó datos en este período.</p>' : `
          <div class="admin-metrics">
            ${metric({ label: 'Ventas del equipo', done: t.sales, target: sales && sales.target, unit: 'ventas', color: SALES })}
            ${metric({ label: 'Demos del equipo', done: t.demos, target: demos && demos.target, scheduled: t.demosScheduled, unit: 'demos', color: DEMOS })}
            ${recruit ? metric({ label: 'Reclutamiento', done: recruit.achieved, target: recruit.target, unit: 'nuevas', color: '#734BA5' }) : ''}
            ${others.map((g) => metric({ label: esc(goalTitle(g, 'Otro objetivo')), done: g.achieved, target: g.target, unit: '', color: '#F5A01E' })).join('')}
          </div>
`}
        <button class="btn btn-primary btn-sm admin-open" data-admin-tl="${tl.id}">Ver el detalle de ${esc(tl.name.split(' ')[0])}</button>
      </article>`;
  }

  /* ---------- Detalle de una Team Leader ---------- */
  function renderDetail(tl) {
    const { goals, agents, actions } = ctx.data;
    const g = goals.filter((x) => x.tlId === tl.id);
    const ag = agents.filter((x) => x.tlId === tl.id).sort((a, b) => a.name.localeCompare(b.name, 'es'));
    const ac = actions.filter((x) => x.tlId === tl.id);
    const t = calc.teamTotals(ag);
    const metric = app().metric;
    const nameOf = (id) => (ag.find((a) => a.id === id) || {}).name || '';
    const order = { ventas: 0, demos: 1, reclutamiento: 2, otro: 3 };
    const goalLabel = { ventas: 'Ventas', demos: 'Demos', reclutamiento: 'Reclutamiento', otro: 'Otro' };
    const goalColor = { ventas: SALES, demos: DEMOS, reclutamiento: '#734BA5', otro: '#F5A01E' };
    const open = ac.filter((x) => x.status !== 'realizado').sort((x, y) => (x.date || '9').localeCompare(y.date || '9'));
    const done = ac.length - open.length;
    const short = (done2, target) => (calc.hasTarget(target) ? `${n(done2)}/${n(target)}` : `${n(done2)}`);
    const text = (label, v) => (v && String(v).trim() ? `<div class="admin-fact"><span>${label}</span><p>${esc(v)}</p></div>` : '');
    const dateTxt = (iso) => (iso ? `${iso.slice(8)}/${iso.slice(5, 7)}` : '');

    $('#admin-tls').innerHTML = `
      <div class="ficha-top">
        <button class="btn btn-outline" data-admin-back>${app().ICONS.back} Volver a todas las TL</button>
      </div>
      <section class="section admin-detail-head">
        <div class="admin-tl-head">
          <span class="tl-avatar tl-avatar-lg" aria-hidden="true">${esc(app().initials(tl.name))}</span>
          <div>
            <h2>${esc(tl.name)}</h2>
            <p class="section-sub">${esc(periodLabel())} · ${t.count} ${t.count === 1 ? 'agente' : 'agentes'} (${t.active} activas) · ${t.sales} ventas · ${t.demos} demos${t.demosScheduled ? ` · ${t.demosScheduled} agendadas` : ''}</p>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="section-head"><h2>Objetivos del equipo</h2></div>
        ${g.length ? `<div class="admin-goals">${g.slice().sort((x, y) => (order[x.type] ?? 3) - (order[y.type] ?? 3)).map((x) => {
          const doneG = x.type === 'ventas' ? t.sales : x.type === 'demos' ? t.demos : n(x.achieved);
          return `<div class="admin-goal">${metric({
            label: esc(goalTitle(x, goalLabel[x.type] || 'Objetivo')),
            done: doneG, target: x.target,
            scheduled: x.type === 'demos' ? t.demosScheduled : null,
            unit: '', color: goalColor[x.type] || '#F5A01E',
          })}</div>`;
        }).join('')}</div>` : '<p class="other-empty">Todavía no cargó objetivos en este período.</p>'}
      </section>

      <section class="section">
        <div class="section-head"><h2>Sus agentes</h2></div>
        ${ag.length ? `<div class="admin-agent-list">${ag.map((a) => {
          const sit = calc.agentSituation(a);
          return `
            <details class="admin-agent">
              <summary>
                <span class="dot" style="--dot:${sit.color}" title="${esc(sit.label)}"></span>
                <span class="admin-agent-title"><b>${esc(a.name)}</b><small>${esc(sit.label)}${a.gtk ? ' · Plan GTK' : ''}</small></span>
                <span class="admin-agent-short">Ventas ${short(a.sales, a.target)} · Demos ${short(a.demosDone, a.demosTarget)}</span>
              </summary>
              <div class="admin-agent-body">
                <div class="admin-goals">
                  ${metric({ label: 'Ventas', done: a.sales, target: a.target, unit: 'ventas', color: SALES })}
                  ${metric({ label: 'Demos', done: a.demosDone, target: a.demosTarget, scheduled: a.demosScheduled, unit: 'demos', color: DEMOS })}
                </div>
                ${gtkLine(a)}
                ${text('Demos agendadas con', a.demosScheduledWith)}
                ${text('Qué quiere conseguir', a.personalGoal)}
                ${text('Qué necesita trabajar', a.needs)}
                ${text('Próxima acción', a.nextAction ? `${a.nextAction}${a.followUpDate ? ` (${dateTxt(a.followUpDate)})` : ''}` : '')}
                ${text('Observaciones', a.notes)}
              </div>
            </details>`;
        }).join('')}</div>` : '<p class="other-empty">Todavía no cargó agentes en este período.</p>'}
      </section>

      <section class="section">
        <div class="section-head"><h2>Seguimiento</h2><p class="section-sub">${open.length} por hacer · ${done} realizadas</p></div>
        ${open.length ? `<ul class="admin-actions">${open.map((x) => `
          <li><b>${esc(x.topic)}</b><span>${esc(x.agentId ? nameOf(x.agentId) : 'Todo el equipo')}${x.date ? ` · ${dateTxt(x.date)}` : ''}${x.status === 'en_proceso' ? ' · En proceso' : ''}</span></li>`).join('')}</ul>`
          : '<p class="other-empty">No tiene acciones pendientes.</p>'}
      </section>`;
  }

  function gtkLine(a) {
    const g = calc.gtkStatus(a);
    if (!g) return '';
    const total = KGC.config.gtk.sales;
    if (g.noDate) return '<p class="admin-agent-next"><b>Plan GTK</b> · sin fecha de compra</p>';
    if (g.level === 'done') return `<p class="admin-agent-next"><b>Plan GTK</b> · cumplido (${total} ventas)</p>`;
    if (g.level === 'ended') return `<p class="admin-agent-next"><b>Plan GTK</b> · terminó con ${n(a.gtkSales)} de ${total}</p>`;
    const cls = g.level === 'warn' ? ' admin-gtk-warn' : '';
    return `<p class="admin-agent-next${cls}"><b>Plan GTK</b> · ${n(a.gtkSales)} de ${total} ventas · cierra el ${fmtShort(g.endDate)} (${g.daysLeft} días)</p>`;
  }

  return { open };
})();
