// Galera: «Qué vas a rendir» en Calendario. Lo baja app.js junto con horarios.js (MARCO.carga, grupo «horarios»)
// solo en Horarios y Calendario: así no pesa en el resto de las pantallas. Usa los globales de app.js (D, E, V, esc, fmt...).
// QUÉ VAS A RENDIR: de las mesas publicadas (Edición, las materias del plan que se rinden en otras carreras
// e idiomas), la persona tilda los llamados a los que va y se los lleva al calendario en un .ics.
const nombreMesa = x => x.nombre + (x.catedra ? ' (cátedra ' + x.catedra + ')' : '');
const claveMesa = (tn, x) => [tn.id, x.materia || '', nombreMesa(x).replace(/\|/g, '/'), x.fecha, x.hora || ''].join('|');
const grupoMesa = x => x.origen === 'Lenguas Modernas' ? 'idiomas' : x.origen ? 'otras' : 'edicion';
const GRUPOS_MESA = [['edicion', 'Edición'], ['otras', 'De otras carreras'], ['idiomas', 'Idiomas']];
// La materia del plan a la que corresponde una mesa (para abrirla desde el calendario): ella misma o la electiva que la tiene de opción.
const materiaDelPlan = id => !id ? '' : ((D.plan.materias.find(m => m.id === id || (m.opciones || []).some(o => o.id === id)) || {}).id || '');
function mesasElegidas() {
  const R = E.rendir || [];
  return D.mesas.flatMap(tn => tn.mesas.filter(x => R.indexOf(claveMesa(tn, x)) >= 0).map(x => Object.assign({ turno: tn.nombre, clave: claveMesa(tn, x) }, x)))
    .sort((a, b) => (a.fecha + a.hora) < (b.fecha + b.hora) ? -1 : 1);
}
function alternarMesa(k) {
  const R = E.rendir = E.rendir || [], i = R.indexOf(k);
  if (i >= 0) R.splice(i, 1); else if (R.length < 200 && RE_MESA.test(k)) R.push(k);
  guardar(); render();
}
function limpiarMesas() { E.rendir = []; guardar(); render(); aviso('Listo: no queda ninguna mesa elegida'); }
// Misma mesa, mismo UID: si se baja dos veces, el calendario la actualiza en vez de duplicarla.
const huellaMesa = k => { let h = 5381; for (let i = 0; i < k.length; i++) h = ((h << 5) + h + k.charCodeAt(i)) >>> 0; return h.toString(36); };
function exportarMesas() {
  const sel = mesasElegidas().filter(x => x.fecha >= hoy());
  if (!sel.length) return aviso('Elegí primero qué vas a rendir');
  const evs = sel.map(x => ({
    uid: 'galera-mesa-' + x.fecha.replace(/-/g, '') + '-' + huellaMesa(x.clave) + '@galera.com.ar',
    t: (grupoMesa(x) === 'idiomas' ? 'Examen libre de ' : 'Final de ') + nombreMesa(x) + (x.llamado ? ' (' + x.llamado.toLowerCase() + ')' : ''),
    fecha: x.fecha, desde: /^\d\d:\d\d$/.test(x.hora || '') ? x.hora : '', lugar: x.aula ? 'Aula ' + x.aula : '',
    nota: [x.turno + (x.origen ? ', mesa de ' + x.origen : '') + '.', 'Inscribite antes en SIU Guaraní.',
      'Cartelera sujeta a cambios: confirmá en la planilla de la Facultad (academica.filo.uba.ar/horarios-de-materias-y-seminarios). Armado con Galera, galera.com.ar/'].join('\n')
  }));
  descargar('mis-mesas-galera.ics', Horarios.ics(evs, hoy()), 'text/calendar');
  aviso(evs.length === 1 ? 'Se bajó 1 mesa' : 'Se bajaron ' + evs.length + ' mesas');
}
function panelMesas() {
  const t = hoy(), R = E.rendir || [];
  const vigentes = D.mesas.filter(tn => tn.mesas.some(x => x.fecha >= t));
  if (!vigentes.length) return D.mesas.length ? `<div class="gl-sec"><h2 class="gl-t2">Qué vas a rendir</h2></div><p class="gl-chico">Las mesas del último turno ya pasaron. Cuando la Facultad publique el próximo, aparecen acá solas.</p>` : '';
  const g = V.mesaGrupo || 'edicion', sel = mesasElegidas().filter(x => x.fecha >= t);
  // Las materias que tenés regulares o en curso llevan una marca: son las que seguramente quieras rendir.
  const tuyas = D.plan.materias.filter(m => ['regular', 'cursando'].indexOf((E.materias[m.id] || {}).estado) >= 0).flatMap(m => [m.id].concat((m.opciones || []).map(o => o.id)));
  const mismoDia = sel.filter((x, i) => sel.some((o, j) => j !== i && o.fecha === x.fecha && o.hora === x.hora));
  const seg = `<div class="gl-seg" role="group" aria-label="Qué mesas ver">${GRUPOS_MESA.map(([k, n]) => {
    const c = sel.filter(x => grupoMesa(x) === k).length;
    return `<button type="button" class="${g === k ? 'on' : ''}" aria-pressed="${g === k}" data-clic="vAsig" data-clic-a="[&quot;mesaGrupo&quot;,${arg(k)}]">${n}${c ? ' (' + c + ')' : ''}</button>`;
  }).join('')}</div>`;
  const bloques = vigentes.map(tn => {
    const porNombre = {};
    tn.mesas.filter(x => grupoMesa(x) === g && x.fecha >= t).forEach(x => { (porNombre[nombreMesa(x)] = porNombre[nombreMesa(x)] || []).push(x); });
    const filas = Object.keys(porNombre).sort((a, b) => a.localeCompare(b, 'es')).map(n => {
      const L = porNombre[n], x0 = L[0], tuya = L.some(x => x.materia && tuyas.indexOf(x.materia) >= 0);
      const datos = [x0.origen && x0.origen !== 'Lenguas Modernas' && 'Se rinde en ' + x0.origen, tuya && 'La tenés regular o en curso'].filter(Boolean);
      return `<div class="gl-mesa"><div class="gl-mesa-nom"><b>${esc(n)}</b>${datos.length ? `<span class="gl-chico">${datos.map(esc).join(' · ')}</span>` : ''}</div>
        <div class="gl-mesa-ll">${L.map(x => {
          const k = claveMesa(tn, x), on = R.indexOf(k) >= 0;
          return `<button type="button" class="gl-mesa-op ${on ? 'on' : ''}" aria-pressed="${on}" data-clic="alternarMesa" data-clic-a="[${arg(k)}]"><i class="gl-cal-ck ${on ? 'on' : ''}" aria-hidden="true"></i><span>${esc(fmt(x.fecha))}${x.hora ? ', ' + esc(x.hora) + ' h' : ''}<span class="gl-chico">${esc([x.llamado, x.aula && 'aula ' + x.aula].filter(Boolean).join(' · ') || 'Mesa')}</span></span></button>`;
        }).join('')}</div></div>`;
    }).join('');
    return `<div class="gl-tarjeta"><p class="gl-rotulo">${esc(tn.nombre)}</p>${filas || '<p class="gl-chico">En este turno no quedan mesas de este grupo por delante.</p>'}
      <p class="gl-chico">${esc(tn.nota)} Cargadas el ${fmt(tn.actualizado)}. <a href="${urlSegura(tn.fuente)}" target="_blank" rel="noopener">Ver la planilla de la Facultad</a>.</p></div>`;
  }).join('');
  return `<section class="gl-mesas" aria-label="Qué vas a rendir"><div class="gl-sec"><h2 class="gl-t2">Qué vas a rendir</h2>
    <span class="gl-flex">${sel.length ? `<button class="gl-btn gl-btn--sec gl-btn--c" type="button" data-clic="exportarMesas">Llevar ${sel.length === 1 ? 'la mesa' : 'las ' + sel.length + ' mesas'} al calendario (.ics)</button><button class="gl-btn gl-btn--ter gl-btn--c" type="button" data-clic="limpiarMesas">Borrar la elección</button>` : ''}</span></div>
    <p class="gl-chico">Tildá los llamados a los que pensás ir: quedan en tu calendario (en «Mis fechas») y los bajás en un archivo .ics para Google Calendar, iPhone u Outlook. Están las materias de Edición, las del plan que se rinden en otras carreras y los idiomas de Lenguas Modernas. Lo que elegís queda solo en este navegador.</p>
    ${mismoDia.length ? `<p class="gl-chico"><b>Ojo:</b> ${esc(mismoDia.map(nombreMesa).filter((x, i, a) => a.indexOf(x) === i).join(', '))}: caen el mismo día y a la misma hora.</p>` : ''}
    ${seg}${bloques}</section>`;
}
