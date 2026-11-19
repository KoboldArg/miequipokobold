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
        if (a.isNew) t.newAgents += 1;
        if (a.status !== 'inactiva') {
          t.active += 1;
          t.salesTargets += n(a.target);
          t.demosTargets += n(a.demosTarget);
        }
        return t;
      },
      { count: 0, active: 0, newAgents: 0, sales: 0, demos: 0, demosScheduled: 0, salesTargets: 0, demosTargets: 0 }
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
   * Ventas, Demos y Reclutamiento son objetivos fijos (uno por período) y su avance
   * se calcula solo con los datos de las agentes. "Otros" objetivos se cargan a mano. */
  const MAIN_TYPES = ['ventas', 'demos', 'reclutamiento'];

  function mainGoals(goals) {
    const out = {};
    MAIN_TYPES.forEach((type) => { out[type] = goals.find((g) => g.type === type) || null; });
    return out;
  }

  function otherGoals(goals) {
    const main = mainGoals(goals);
    const ids = new Set(Object.values(main).filter(Boolean).map((g) => g.id));
    return goals.filter((g) => !ids.has(g.id));
  }

  function mainAchieved(type, totals) {
    if (type === 'ventas') return totals.sales;
    if (type === 'demos') return totals.demos;
    if (type === 'reclutamiento') return totals.newAgents;
    return 0;
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
    if (agent.isNew) return { key: 'nueva', label: 'Recién empieza', color: '#734BA5', order: 4 };
    return { key: 'rojo', label: 'Necesita intervención', color: '#F0415F', order: 4 };
  }

  return { n, hasTarget, percent, pending, barWidth, teamTotals, levelColor, MAIN_TYPES, mainGoals, otherGoals, mainAchieved, agentSituation };
})();
