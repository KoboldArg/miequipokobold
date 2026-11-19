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
    const btn = e.target.closest('[data-admin-period]');
    if (!btn || btn.dataset.adminPeriod === ctx.periodId) return;
    ctx.periodId = btn.dataset.adminPeriod;
    KGC.store.setSession({ periodId: ctx.periodId });
    render();
  }

  async function render() {
    $('#admin-period-switch').innerHTML = ctx.periods.map((p) => `
      <button type="button" class="period-btn" role="radio" aria-checked="${p.id === ctx.periodId}" data-admin-period="${p.id}">
        <strong>${esc(p.label)}</strong>
        ${p.start && p.end ? `<span class="period-dates">${fmtShort(p.start)} al ${fmtShort(p.end)}</span>` : ''}
      </button>`).join('');
    $('#admin-totals').innerHTML = '<p class="section-sub">Cargando…</p>';
    $('#admin-tls').innerHTML = '';
    let data;
    try {
      data = await KGC.store.getAdminPeriod(ctx.periodId);
    } catch (err) {
      console.error(err);
      $('#admin-totals').innerHTML = '<p class="field-error">No pudimos traer los datos. Revisá tu conexión y volvé a cargar la página.</p>';
      return;
    }
    renderTotals(data);
    renderTLs(data);
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
          ${agents.length ? `
            <details class="admin-agents">
              <summary>Ver sus ${agents.length} ${agents.length === 1 ? 'agente' : 'agentes'}</summary>
              <ul>
                ${agents.map((a) => {
                  const sit = calc.agentSituation(a);
                  const fmt = (done, target) => (calc.hasTarget(target) ? `${n(done)} de ${n(target)}` : `${n(done)}`);
                  return `
                    <li>
                      <div class="admin-agent-name"><span class="dot" style="--dot:${sit.color}" title="${esc(sit.label)}"></span><b>${esc(a.name)}</b><small>${esc(sit.label)}</small></div>
                      <div class="admin-agent-nums">
                        <span>Ventas <b>${fmt(a.sales, a.target)}</b></span>
                        <span>Demos <b>${fmt(a.demosDone, a.demosTarget)}</b>${n(a.demosScheduled) ? ` · ${n(a.demosScheduled)} agend.` : ''}</span>
                      </div>
                      ${gtkLine(a)}
                      ${a.nextAction ? `<p class="admin-agent-next">Próxima acción: ${esc(a.nextAction)}</p>` : ''}
                    </li>`;
                }).join('')}
              </ul>
            </details>` : ''}`}
      </article>`;
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
