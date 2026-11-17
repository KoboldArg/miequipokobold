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

  function teamTotals(agents) {
    return agents.reduce(
      (t, a) => {
        t.count += 1;
        if (a.status !== 'inactiva') t.active += 1;
        t.sales += n(a.sales);
        t.demos += n(a.demosDone);
        return t;
      },
      { count: 0, active: 0, sales: 0, demos: 0 }
    );
  }

  /* Cantidad alcanzada de un objetivo del equipo.
   * Ventas y Demos pueden calcularse automáticamente con los datos de las agentes;
   * Reclutamiento y Otro siempre se cargan a mano. */
  function goalAchieved(goal, totals) {
    if (goal.auto && goal.type === 'ventas') return totals.sales;
    if (goal.auto && goal.type === 'demos') return totals.demos;
    return n(goal.achieved);
  }

  /* El objetivo general de ventas del equipo es el primer objetivo de tipo Ventas. */
  function teamSalesGoal(goals) {
    return goals.find((g) => g.type === 'ventas') || null;
  }

  /* Situación de una agente respecto de su objetivo individual de ventas. */
  function agentSituation(agent) {
    if (agent.status === 'inactiva') {
      return { key: 'inactiva', label: 'Inactiva', color: '#A3A3A3', order: 6 };
    }
    const pct = percent(agent.sales, agent.target);
    if (pct == null) {
      return { key: 'sin-objetivo', label: 'Sin objetivo definido', color: '#A3A3A3', order: 5 };
    }
    if (pct >= 100) return { key: 'verde', label: 'Meta alcanzada', color: '#00AC46', order: 0 };
    if (pct >= thresholds.good) return { key: 'verde', label: 'Buen avance', color: '#00AC46', order: 1 };
    if (pct >= thresholds.follow) return { key: 'amarillo', label: 'Necesita seguimiento', color: '#FAD400', order: 2 };
    const hasActivity = n(agent.demosDone) > 0 || n(agent.sales) > 0;
    if (hasActivity) return { key: 'naranja', label: 'Requiere atención', color: '#F5A01E', order: 3 };
    return { key: 'rojo', label: 'Necesita intervención', color: '#F0415F', order: 4 };
  }

  return { n, hasTarget, percent, pending, barWidth, teamTotals, goalAchieved, teamSalesGoal, agentSituation };
})();
