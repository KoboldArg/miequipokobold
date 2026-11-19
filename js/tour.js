/* Tutorial "¿Cómo se usa?": recorre cada parte del dashboard paso a paso. */
window.KGC = window.KGC || {};

KGC.tour = (function () {
  const STEPS = [
    {
      el: '.period-bar', tab: 'resumen',
      title: 'Elegí el período',
      text: 'Cada período guarda su información por separado. Tocá P12 o P13 para ver y cargar los datos de ese período.',
    },
    {
      el: '#getting-started', tab: 'resumen',
      title: 'Cómo empezar',
      text: 'Tres pasos en orden: los objetivos del equipo, tus agentes y el objetivo de cada una. Esta guía desaparece cuando completás los tres.',
    },
    {
      el: '#tabs', tab: 'resumen',
      title: 'Tres pestañas',
      text: 'Resumen: cómo viene tu equipo. Mis agentes: cada una con sus números. Seguimiento: lo que vas a hacer esta semana.',
    },
    {
      el: '#sec-summary', tab: 'resumen',
      title: 'Objetivos de tu equipo',
      text: 'Tocá «+ Agregar objetivo» y elegí Ventas, Demos, Reclutamiento u Otro. Ventas y demos se suman solas con lo que cargás en cada agente; reclutamiento y otros los sumás con + y −.',
    },
    {
      el: '#sec-compare', tab: 'resumen',
      title: 'Cómo viene cada agente',
      text: 'Todas tus agentes comparadas. El color te ayuda a ver quién avanza bien y a quién conviene acompañar más.',
    },
    {
      el: '#sec-agents', tab: 'agentes',
      title: 'Tus agentes',
      text: 'Agregá a cada agente con su estado, su objetivo, lo que lleva hecho y su seguimiento. Con «Actualizar datos» corregís o sumás lo nuevo; en «Ver ficha» ves todo junto.',
    },
    {
      el: '#sec-actions', tab: 'seguimiento',
      title: 'Tu seguimiento de la semana',
      text: 'Anotá las acciones concretas que vas a hacer con cada agente y marcalas cuando las termines.',
    },
    {
      el: '[data-act="print"]', tab: 'resumen',
      title: 'Imprimir el resumen',
      text: 'Imprimí o guardá en PDF un resumen del equipo para llevar a tus reuniones.',
    },
    {
      el: '#btn-tour',
      title: '¡Listo!',
      text: 'Podés volver a ver esta guía cuando quieras desde este botón.',
    },
  ];

  let steps = [];
  let index = 0;
  let nodes = null;
  let raf = 0;

  /* Se saltea un paso si su parte no existe o está oculta a propósito (no por estar en otra pestaña). */
  const available = (el) => el && !el.hidden;

  function build() {
    const block = document.createElement('div');
    block.className = 'tour-block';
    const spot = document.createElement('div');
    spot.className = 'tour-spot';
    const card = document.createElement('div');
    card.className = 'tour-card';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    card.setAttribute('aria-labelledby', 'tour-title');
    card.innerHTML = `
      <button type="button" class="icon-btn tour-close" aria-label="Cerrar la guía">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>
      </button>
      <p class="tour-count"></p>
      <h2 id="tour-title"></h2>
      <p class="tour-text"></p>
      <div class="tour-btns">
        <button type="button" class="btn btn-ghost btn-sm tour-prev">Anterior</button>
        <button type="button" class="btn btn-primary btn-sm tour-next">Siguiente</button>
      </div>`;
    document.body.append(block, spot, card);
    card.querySelector('.tour-close').onclick = stop;
    card.querySelector('.tour-prev').onclick = () => go(index - 1);
    card.querySelector('.tour-next').onclick = () => (index >= steps.length - 1 ? stop() : go(index + 1));
    block.onclick = stop;
    return { block, spot, card };
  }

  function position() {
    if (!nodes) return;
    const target = document.querySelector(steps[index].el);
    if (!target) return;
    const r = target.getBoundingClientRect();
    const pad = 8;
    const top = Math.max(r.top - pad, 4);
    const bottom = Math.min(r.bottom + pad, window.innerHeight - 4);
    const { spot, card } = nodes;
    Object.assign(spot.style, {
      top: `${top}px`,
      left: `${Math.max(r.left - pad, 4)}px`,
      width: `${Math.min(r.width + pad * 2, window.innerWidth - 8)}px`,
      height: `${Math.max(bottom - top, 0)}px`,
    });

    if (window.innerWidth <= 640) {
      card.classList.add('is-sheet');
      card.style.top = card.style.left = '';
      return;
    }
    card.classList.remove('is-sheet');
    const ch = card.offsetHeight;
    const cw = card.offsetWidth;
    let cardTop;
    if (window.innerHeight - bottom >= ch + 16) cardTop = bottom + 12;
    else if (top >= ch + 16) cardTop = top - ch - 12;
    else cardTop = window.innerHeight - ch - 16;
    const left = Math.min(Math.max(r.left, 16), window.innerWidth - cw - 16);
    card.style.top = `${cardTop}px`;
    card.style.left = `${left}px`;
  }

  function onMove() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(position);
  }

  function go(i) {
    if (i < 0 || i >= steps.length) return;
    index = i;
    const step = steps[i];
    if (step.tab && KGC.app) KGC.app.setTab(step.tab);
    const target = document.querySelector(step.el);
    const header = document.querySelector('.topbar');
    const offset = (header ? header.offsetHeight : 0) + 16;
    const r = target.getBoundingClientRect();
    const fits = r.height < window.innerHeight - offset - 220;
    const y = window.scrollY + r.top - (fits ? Math.max(offset, (window.innerHeight - r.height) / 3) : offset);
    window.scrollTo({ top: Math.max(y, 0), behavior: 'auto' });

    const { card } = nodes;
    card.querySelector('.tour-count').textContent = `Paso ${i + 1} de ${steps.length}`;
    card.querySelector('#tour-title').textContent = step.title;
    card.querySelector('.tour-text').textContent = step.text;
    card.querySelector('.tour-prev').hidden = i === 0;
    card.querySelector('.tour-next').textContent = i === steps.length - 1 ? 'Terminar' : 'Siguiente';
    position();
    card.querySelector('.tour-next').focus();
  }

  function onKey(e) {
    if (e.key === 'Escape') stop();
    else if (e.key === 'ArrowRight') go(index + 1);
    else if (e.key === 'ArrowLeft') go(index - 1);
  }

  function start() {
    if (nodes) stop();
    steps = STEPS.filter((s) => available(document.querySelector(s.el)));
    if (!steps.length) return;
    nodes = build();
    document.body.classList.add('tour-open');
    window.addEventListener('scroll', onMove, { passive: true });
    window.addEventListener('resize', onMove);
    document.addEventListener('keydown', onKey);
    go(0);
  }

  function stop() {
    if (!nodes) return;
    nodes.block.remove();
    nodes.spot.remove();
    nodes.card.remove();
    nodes = null;
    document.body.classList.remove('tour-open');
    window.removeEventListener('scroll', onMove);
    window.removeEventListener('resize', onMove);
    document.removeEventListener('keydown', onKey);
    const btn = document.getElementById('btn-tour');
    if (btn) btn.focus();
  }

  /* Se muestra sola la primera vez que se usa la herramienta en este navegador. */
  function startOnce() {
    const KEY = 'kobold-gc:v1:tourSeen';
    try {
      if (localStorage.getItem(KEY)) return;
      localStorage.setItem(KEY, '1');
    } catch (e) {
      return;
    }
    setTimeout(start, 500);
  }

  return { start, stop, startOnce };
})();
