/* Reglas de cálculo. Funciones puras, sin acceso a pantalla ni a datos guardados. */
window.KGC = window.KGC || {};

KGC.calc = (function () {
  const { thresholds } = KGC.config;

  /* Convierte cualquier valor en una cantidad entera no negativa. */
  const n = (v) => {
    const x = Number(v);
    return Number.isFinite(x) && x > 0 ? Math.floor(x) : 0;
  };

  const hasTarget = (target) => n(target) > 0;

  /* Porcentaje de avance. Devuelve null si no hay objetivo (nunca divide por cero). */
  const percent = (achieved, target) => (hasTarget(target) ? Math.round((n(achieved) / n(target)) * 100) : null);

  /* Cuánto falta, sin valores negativos. */
  const pending = (achieved, target) => Math.max(n(target) - n(achieved), 0);

  /* Ancho de barra entre 0 y 100. */
  const barWidth = (pct) => (pct == null ? 0 : Math.max(0, Math.min(pct, 100)));

  /* Totales del equipo. Los objetivos individuales se suman solo de las agentes activas. */
  function teamTotals(agents) {
    return agents.reduce(
      (t, a) => {
        t.count += 1;
        t.sales += n(a.sales);
        t.demos += n(a.demosDone);
        t.demosScheduled += n(a.demosScheduled);
        if (a.status !== 'inactiva') {
          t.active += 1;
          t.salesTargets += n(a.target);
          t.demosTargets += n(a.demosTarget);
        }
        return t;
      },
      { count: 0, active: 0, sales: 0, demos: 0, demosScheduled: 0, salesTargets: 0, demosTargets: 0 }
    );
  }

  /* Color de una barra según el porcentaje alcanzado. */
  function levelColor(pct) {
    if (pct == null) return '#A3A3A3';
    if (pct >= thresholds.good) return '#00AC46';
    if (pct >= thresholds.follow) return '#FAD400';
    if (pct > 0) return '#F5A01E';
    return '#F0415F';
  }

  /* Objetivos del equipo.
   * Ventas y Demos se calculan solos con lo que se carga en cada agente.
   * Reclutamiento y Otro se van sumando a mano (con + y −).
   * Ventas, Demos y Reclutamiento son únicos por período; "Otro" puede haber varios. */
  const UNIQUE_TYPES = ['ventas', 'demos', 'reclutamiento'];
  const isAuto = (type) => type === 'ventas' || type === 'demos';

  function goalAchieved(goal, totals) {
    if (goal.type === 'ventas') return totals.sales;
    if (goal.type === 'demos') return totals.demos;
    return n(goal.achieved);
  }

  function findGoal(goals, type) {
    return goals.find((g) => g.type === type) || null;
  }

  /* ---------- Fechas (formato AAAA-MM-DD) ---------- */
  const DAY = 86400000;
  const toDay = (iso) => {
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
    let [y, m, d] = iso.split('-').map(Number);
    if (y < 100) y += 2000;
    return Date.UTC(y, m - 1, d) / DAY;
  };
  const fromDay = (day) => new Date(day * DAY).toISOString().slice(0, 10);
  const today = () => {
    const d = new Date();
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY;
  };

  /* Estado del período: cuántos días faltan para que termine. */
  function periodStatus(period, now = today()) {
    const start = toDay(period && period.start);
    const end = toDay(period && period.end);
    if (start == null || end == null) return null;
    if (now < start) return { state: 'future', days: start - now };
    if (now > end) return { state: 'past', days: now - end };
    return { state: 'current', days: end - now };
  }

  /* Plan GTK: 90 días desde la compra, meta de 6 ventas. */
  function gtkStatus(agent, now = today()) {
    if (!agent || !agent.gtk) return null;
    const { days, sales, warnDays } = KGC.config.gtk;
    const start = toDay(agent.purchaseDate);
    const salesLeft = Math.max(sales - n(agent.gtkSales), 0);
    if (start == null) return { noDate: true, salesLeft };
    const end = start + days;
    const daysLeft = end - now;
    let level = 'ok';
    if (salesLeft === 0) level = 'done';
    else if (daysLeft < 0) level = 'ended';
    else if (daysLeft <= warnDays) level = 'warn';
    return { endDate: fromDay(end), daysLeft, salesLeft, level };
  }

  /* Situación de una agente: se mide por su objetivo de ventas;
   * si no tiene objetivo de ventas pero sí de demos, se mide por demos. */
  function agentSituation(agent) {
    if (agent.status === 'inactiva') {
      return { key: 'inactiva', label: 'Inactiva', color: '#A3A3A3', order: 6 };
    }
    const pct = hasTarget(agent.target)
      ? percent(agent.sales, agent.target)
      : percent(agent.demosDone, agent.demosTarget);
    if (pct == null) {
      return { key: 'sin-objetivo', label: 'Sin objetivo definido', color: '#A3A3A3', order: 5 };
    }
    if (pct >= 100) return { key: 'verde', label: 'Meta alcanzada', color: '#00AC46', order: 0 };
    if (pct >= thresholds.good) return { key: 'verde', label: 'Buen avance', color: '#00AC46', order: 1 };
    if (pct >= thresholds.follow) return { key: 'amarillo', label: 'Necesita seguimiento', color: '#FAD400', order: 2 };
    const hasActivity = n(agent.demosDone) > 0 || n(agent.sales) > 0 || n(agent.demosScheduled) > 0;
    if (hasActivity) return { key: 'naranja', label: 'Requiere atención', color: '#F5A01E', order: 3 };
    return { key: 'rojo', label: 'Necesita intervención', color: '#F0415F', order: 4 };
  }

  return { periodStatus, gtkStatus, n, hasTarget, percent, pending, barWidth, teamTotals, levelColor, UNIQUE_TYPES, isAuto, goalAchieved, findGoal, agentSituation };
})();
