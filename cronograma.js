// Cronograma de un proyecto editorial con tres métodos: Gantt, PERT y Roy (método de los potenciales, MPM).
// Sin DOM: lo usa app.js y lo prueba probar.py.
// Una tarea: { id, t (nombre), d (duración en días hábiles), a, m, b (PERT: optimista, probable, pesimista), pre: [ids] }
const Cronograma = (() => {
  const n = Num.parse;   // lector compartido (num.js): acepta 4,6 y 4.6
  const METODOS = {
    gantt: { t: 'Gantt', d: 'Barras sobre el calendario: qué se hace cuándo y qué se superpone. Duraciones fijas.' },
    pert: { t: 'PERT', d: 'Red de actividades con tres estimaciones por tarea (optimista, probable, pesimista): da la duración esperada y la probabilidad de llegar a una fecha.' },
    roy: { t: 'Roy (MPM)', d: 'Red de potenciales: cada tarea es un nodo con sus fechas más temprana y más tardía. Muestra la ruta crítica y las holguras.' }
  };

  // Ejemplo: libro de narrativa, con las etapas base de la producción.
  const EJEMPLO = [
    { id: 'T1', t: 'Contratación y derechos', d: 5, a: 3, m: 5, b: 10, pre: [] },
    { id: 'T2', t: 'Edición de mesa', d: 15, a: 10, m: 15, b: 25, pre: ['T1'] },
    { id: 'T3', t: 'Corrección de estilo', d: 10, a: 7, m: 10, b: 15, pre: ['T2'] },
    { id: 'T4', t: 'Diseño de tapa', d: 8, a: 5, m: 8, b: 14, pre: ['T2'] },
    { id: 'T5', t: 'Diagramación', d: 7, a: 5, m: 7, b: 12, pre: ['T3'] },
    { id: 'T6', t: 'Primera corrección de pruebas', d: 5, a: 3, m: 5, b: 8, pre: ['T5'] },
    { id: 'T7', t: 'Segunda corrección de pruebas', d: 3, a: 2, m: 3, b: 5, pre: ['T6'] },
    { id: 'T8', t: 'ISBN y ficha CIP', d: 5, a: 2, m: 5, b: 10, pre: ['T2'] },
    { id: 'T9', t: 'Aprobación final', d: 2, a: 1, m: 2, b: 4, pre: ['T7', 'T4', 'T8'] },
    { id: 'T10', t: 'Imprenta', d: 15, a: 10, m: 15, b: 25, pre: ['T9'] },
    { id: 'T11', t: 'Distribución y lanzamiento', d: 5, a: 3, m: 5, b: 10, pre: ['T10'] }
  ];

  // Una predecesora es un id ('T1', termina→empieza sin retardo) o { id, tipo: 'FS'|'SS'|'FF'|'SF', lag: días (puede ser negativo) }.
  const TIPOS = {
    FS: 'termina → empieza', SS: 'empieza → empieza', FF: 'termina → termina', SF: 'empieza → termina'
  };
  const rel = p => typeof p === 'string' ? { id: p, tipo: 'FS', lag: 0 }
    : { id: String(p.id), tipo: TIPOS[p.tipo] ? p.tipo : 'FS', lag: Number.isFinite(+p.lag) ? +p.lag : 0 };
  const rels = x => (x.pre || []).map(rel);
  const idsPre = x => [...new Set(rels(x).map(r => r.id))];
  // Inicio más temprano que la relación impone a la tarea x (de duración d) dado el predecesor p ya calculado.
  const minEs = (r, p, d) => r.tipo === 'FS' ? p.ef + r.lag : r.tipo === 'SS' ? p.es + r.lag : r.tipo === 'FF' ? p.ef + r.lag - d : p.es + r.lag - d;
  // Fin más tardío que la relación impone al predecesor, dado el sucesor s y la duración d del predecesor.
  const maxLf = (r, s, d) => r.tipo === 'FS' ? s.ls - r.lag : r.tipo === 'SS' ? s.ls - r.lag + d : r.tipo === 'FF' ? s.lf - r.lag : s.lf - r.lag + d;
  const num = v => { const x = n(v); return Number.isFinite(x) && x >= 0 ? x : 0; };

  // Duración esperada y varianza de PERT. Si faltan las tres estimaciones, usa la duración fija (varianza 0).
  function pertDe(x) {
    const a = num(x.a), m = num(x.m), b = num(x.b);
    if (!(m > 0 || b > 0 || a > 0)) { const d = num(x.d); return { te: d, v: 0, ok: false }; }
    const mm = m || (a + b) / 2;
    return { te: (a + 4 * mm + b) / 6, v: Math.pow((b - a) / 6, 2), ok: true };
  }

  // Orden topológico (Kahn). Devuelve { orden } o { error } con un mensaje claro si hay ciclo o predecesoras que no existen.
  function ordenar(ts) {
    const ids = new Set(ts.map(x => x.id));
    if (ids.size !== ts.length) return { error: 'Hay dos tareas con el mismo identificador.' };
    for (const x of ts) for (const p of idsPre(x)) {
      if (!ids.has(p)) return { error: `«${x.t}» depende de una tarea que no existe (${p}).` };
      if (p === x.id) return { error: `«${x.t}» no puede depender de sí misma.` };
    }
    const falta = new Map(ts.map(x => [x.id, idsPre(x).length])), sig = new Map(ts.map(x => [x.id, []]));
    ts.forEach(x => idsPre(x).forEach(p => sig.get(p).push(x.id)));
    const cola = ts.filter(x => falta.get(x.id) === 0).map(x => x.id), orden = [];
    while (cola.length) {
      const id = cola.shift(); orden.push(id);
      sig.get(id).forEach(s => { falta.set(s, falta.get(s) - 1); if (falta.get(s) === 0) cola.push(s); });
    }
    if (orden.length < ts.length) {
      const en = ts.filter(x => !orden.includes(x.id)).map(x => x.t);
      return { error: `Las dependencias forman un ciclo (${en.join(', ')}): una tarea no puede esperar, directa o indirectamente, a sí misma.` };
    }
    return { orden };
  }

  // Camino crítico. Roy, Gantt y PERT comparten esta cuenta; cambia la duración de cada tarea (fija o esperada).
  // Devuelve por tarea: dur, es, ef (más temprana), ls, lf (más tardía), hol (holgura total), hl (holgura libre), crit.
  function calcular(ts, metodo) {
    const o = ordenar(ts);
    if (o.error) return { error: o.error };
    const por = new Map(ts.map(x => [x.id, x])), r = new Map();
    const dur = x => (x.na ? 0 : metodo === 'pert' ? pertDe(x).te : num(x.d));
    o.orden.forEach(id => {
      const x = por.get(id), d = dur(x), es = Math.max(0, ...rels(x).map(q => minEs(q, r.get(q.id), d)));
      r.set(id, { id, dur: d, es, ef: es + d });
    });
    const total = Math.max(0, ...[...r.values()].map(v => v.ef));
    const suc = new Map(ts.map(x => [x.id, []]));
    ts.forEach(x => rels(x).forEach(q => suc.get(q.id).push({ id: x.id, q })));
    [...o.orden].reverse().forEach(id => {
      const v = r.get(id), s = suc.get(id);
      v.lf = s.length ? Math.min(...s.map(k => maxLf(k.q, r.get(k.id), v.dur))) : total;
      v.ls = v.lf - v.dur;
      v.hol = v.ls - v.es;
      // holgura libre: cuánto puede correrse sin mover el inicio de ningún sucesor
      v.hl = s.length ? Math.min(...s.map(k => { const w = r.get(k.id); return w.es - minEs(k.q, v, w.dur); })) : total - v.ef;
    });
    const eps = 1e-9;
    r.forEach(v => { v.crit = Math.abs(v.hol) < eps; });
    const tareas = ts.map(x => ({ ...r.get(x.id), t: x.t, f: x.f || '', na: !!x.na, pre: idsPre(x), rels: rels(x) }));
    return { tareas, total, criticas: tareas.filter(v => v.crit).map(v => v.id), ruta: rutaCritica(tareas) };
  }

  // Una ruta crítica de punta a punta (si hay varias, la primera por orden de carga).
  function rutaCritica(tareas) {
    const por = new Map(tareas.map(v => [v.id, v])), cr = tareas.filter(v => v.crit);
    const ajustada = (v, q) => { const p = por.get(q.id); return p.crit && Math.abs(minEs(q, p, v.dur) - v.es) < 1e-9; };
    let act = cr.filter(v => v.es === 0 && !v.rels.some(q => ajustada(v, q)))[0] || cr[0];
    const ruta = [];
    while (act && !ruta.includes(act.id)) {
      ruta.push(act.id);
      const prev = act;
      act = cr.find(v => v.rels.some(q => q.id === prev.id && ajustada(v, q)));
    }
    return ruta;
  }

  // Normal estándar acumulada (aproximación de Abramowitz y Stegun, error < 1e-7).
  function normal(z) {
    const t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989423 * Math.exp(-z * z / 2);
    const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return z > 0 ? 1 - p : p;
  }

  // PERT: duración esperada del proyecto, desvío de la ruta crítica y probabilidad de terminar en `plazo` días.
  function pert(ts, plazo) {
    const c = calcular(ts, 'pert');
    if (c.error) return c;
    const por = new Map(ts.map(x => [x.id, x]));
    const varianza = c.ruta.reduce((s, id) => s + pertDe(por.get(id)).v, 0);
    const desvio = Math.sqrt(varianza), p = num(plazo);
    const prob = !p ? null : desvio > 0 ? normal((p - c.total) / desvio) : (p >= c.total ? 1 : 0);
    const tareas = c.tareas.map(v => Object.assign(v, { varianza: pertDe(por.get(v.id)).v, estimado: pertDe(por.get(v.id)).ok }));
    return Object.assign(c, { tareas, varianza, desvio, plazo: p || null, prob });
  }

  // Columna de cada tarea en la red: 0 si no depende de nadie; si no, una más que su predecesora más a la derecha.
  function niveles(ts) {
    const o = ordenar(ts); if (o.error) return {};
    const por = new Map(ts.map(x => [x.id, x])), nv = {};
    o.orden.forEach(id => { nv[id] = Math.max(-1, ...idsPre(por.get(id)).map(p => nv[p])) + 1; });
    return nv;
  }

  // Compara los tres métodos con las mismas tareas.
  function comparar(ts, plazo) {
    const g = calcular(ts, 'gantt'), r = calcular(ts, 'roy'), p = pert(ts, plazo);
    if (g.error) return { error: g.error };
    return { gantt: g, roy: r, pert: p, igualRutaGR: JSON.stringify(g.criticas) === JSON.stringify(r.criticas) };
  }

  // Días hábiles → fechas. Salta sábados, domingos y los feriados que le pases ('AAAA-MM-DD').
  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  function sumarHabiles(desde, dias, feriados) {
    const f = new Set(feriados || []), d = new Date(desde + 'T12:00:00');
    let falta = Math.round(dias);
    const habil = x => x.getDay() % 6 !== 0 && !f.has(iso(x));
    while (!habil(d)) d.setDate(d.getDate() + 1);
    while (falta > 0) { d.setDate(d.getDate() + 1); if (habil(d)) falta--; }
    return iso(d);
  }


  // ---------- Calendario ----------
  // Fecha de inicio de una tarea que empieza en el día hábil `off` (0 = primer día hábil desde `inicio`) y de fin (último día hábil que ocupa).
  const hab = (d, f) => d.getDay() % 6 !== 0 && !f.has(iso(d));
  function restarHabiles(hasta, dias, feriados) {
    const f = new Set(feriados || []), d = new Date(hasta + 'T12:00:00');
    let falta = Math.round(dias);
    while (!hab(d, f)) d.setDate(d.getDate() - 1);
    while (falta > 0) { d.setDate(d.getDate() - 1); if (hab(d, f)) falta--; }
    return iso(d);
  }
  // Días hábiles entre dos fechas (a < b da positivo), para ver cuánto falta.
  function habilesEntre(a, b, feriados) {
    const f = new Set(feriados || []), d = new Date(a + 'T12:00:00'), fin = new Date(b + 'T12:00:00'), s = d <= fin ? 1 : -1;
    let n = 0;
    while (iso(d) !== iso(fin)) { d.setDate(d.getDate() + s); if (hab(d, f)) n += s; }
    return n;
  }
  // Pasa el resultado de calcular() a fechas. modo 'desde': arranca en `fecha`. modo 'hasta': termina en `fecha` (se calcula hacia atrás);
  // lo que cae antes de `hoy` queda marcado como tarde (no llega).
  function fechas(res, modo, fecha, feriados, hoy) {
    if (!res || res.error || !fecha) return null;
    const total = Math.ceil(res.total - 1e-9);
    const inicio = modo === 'hasta' ? restarHabiles(fecha, Math.max(0, total - 1), feriados) : sumarHabiles(fecha, 0, feriados);
    const dia = k => sumarHabiles(inicio, Math.max(0, Math.round(k)), feriados);
    const tareas = res.tareas.map(v => {
      const desde = dia(v.es), hasta = v.ef > v.es ? dia(Math.max(v.es, Math.ceil(v.ef - 1e-9) - 1)) : desde;
      return { id: v.id, desde, hasta, tarde: !!hoy && desde < hoy && modo === 'hasta' };
    });
    const fin = tareas.reduce((m, v) => (v.hasta > m ? v.hasta : m), inicio);
    return { inicio, fin, tareas, tarde: tareas.filter(v => v.tarde).map(v => v.id), llega: !hoy || modo !== 'hasta' || inicio >= hoy };
  }

  // ---------- Exportaciones ----------
  const csvc = v => { v = String(v == null ? '' : v); return /[",;\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  function aCsv(ts, res, fe) {
    const por = new Map((fe ? fe.tareas : []).map(v => [v.id, v]));
    const cab = ['N.º', 'Fase', 'Tarea', 'Rol sugerido', 'Responsable', 'Días', 'Optimista', 'Probable', 'Pesimista', 'Previas', 'Inicio', 'Fin', 'Holgura', 'Crítica', 'No aplica'];
    const nro = new Map(ts.map((x, i) => [x.id, i + 1]));
    const r = new Map((res && res.tareas || []).map(v => [v.id, v]));
    const filas = ts.map((x, i) => {
      const v = r.get(x.id) || {}, f = por.get(x.id) || {};
      return [i + 1, x.f || '', x.t, x.q || '', x.r || '', x.d, x.a, x.m, x.b, rels(x).map(q => nro.get(q.id) + (q.tipo === 'FS' && !q.lag ? '' : q.tipo + (q.lag ? (q.lag > 0 ? '+' : '') + q.lag : ''))).join(' '),
        f.desde || '', f.hasta || '', v.hol == null ? '' : Math.round(v.hol * 10) / 10, v.crit ? 'sí' : '', x.na ? 'sí' : ''];
    });
    return '\ufeff' + [cab, ...filas].map(f => f.map(csvc).join(';')).join('\r\n') + '\r\n';
  }
  const ymd = s => s.replace(/-/g, '');
  const icsT = s => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  function aIcs(ts, fe, titulo) {
    const por = new Map((fe ? fe.tareas : []).map(v => [v.id, v]));
    const sig = s => { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + 1); return iso(d); };
    const ev = ts.filter(x => !x.na && por.has(x.id)).map(x => {
      const f = por.get(x.id);
      return ['BEGIN:VEVENT', `UID:${x.id}-${ymd(f.desde)}@cursada.ficha.github.io`, 'DTSTAMP:20260101T000000Z', `DTSTART;VALUE=DATE:${ymd(f.desde)}`, `DTEND;VALUE=DATE:${ymd(sig(f.hasta))}`,
        `SUMMARY:${icsT((titulo ? titulo + ': ' : '') + x.t)}`, ...(x.q ? [`DESCRIPTION:${icsT('Responsable: ' + x.q)}`] : []), 'END:VEVENT'].join('\r\n');
    });
    return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Galera//Planificador de libros//ES', 'CALSCALE:GREGORIAN', ...ev, 'END:VCALENDAR'].join('\r\n') + '\r\n';
  }

  // Sanea lo que viene de afuera (localStorage o link): ids únicos, números, predecesoras existentes.
  function sanear(raw, max) {
    if (!Array.isArray(raw)) return [];
    const vistos = new Set(), out = [];
    raw.slice(0, max || 60).forEach((x, i) => {
      if (!x || typeof x !== 'object') return;
      let id = String(x.id || 'T' + (i + 1)).replace(/[^\w-]/g, '').slice(0, 12) || 'T' + (i + 1);
      while (vistos.has(id)) id += '_';
      vistos.add(id);
      const c = v => { const s = String(v == null ? '' : v).replace(/[^\d.,]/g, '').slice(0, 6); return s; };
      out.push({ id, f: /^[A-E]$/.test(x.f) ? x.f : '', q: String(x.q || '').replace(/[<>]/g, '').slice(0, 60), r: String(x.r || '').replace(/[<>]/g, '').slice(0, 60), na: x.na ? 1 : 0, hito: x.hito ? 1 : 0, t: String(x.t || '').replace(/[<>]/g, '').slice(0, 80), d: c(x.d), a: c(x.a), m: c(x.m), b: c(x.b), pre: Array.isArray(x.pre) ? x.pre.map(p => typeof p === 'string' ? String(p).slice(0, 12) : p && typeof p === 'object' ? { id: String(p.id || '').slice(0, 12), tipo: TIPOS[p.tipo] ? p.tipo : 'FS', lag: Math.max(-365, Math.min(365, Math.round(+p.lag) || 0)) } : '') : [] });
    });
    out.forEach(x => {
      const vistas = new Set();
      x.pre = x.pre.filter(p => { const r = rel(p); const k = r.id + r.tipo; if (!vistos.has(r.id) || r.id === x.id || vistas.has(k)) return false; vistas.add(k); return true; })
        .map(p => { const r = rel(p); return r.tipo === 'FS' && !r.lag ? r.id : r; });
    });
    return out;
  }

  return { METODOS, TIPOS, EJEMPLO, rels, calcular, pert, comparar, ordenar, niveles, pertDe, normal, sumarHabiles, restarHabiles, habilesEntre, fechas, aCsv, aIcs, sanear };
})();
if (typeof module !== 'undefined') module.exports = Cronograma;
