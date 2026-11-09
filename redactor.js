// Redactor de contratos (pantalla del simulador «contratos»). Todo ocurre en el navegador: no se envía, no se guarda.
// El texto lo genera contratos.js (sin DOM, con pruebas). Acá solo hay pantalla, eventos delegados y descargas.
// Sin manejadores en línea: los botones llevan data-rc="acción" y las acciones válidas están registradas en ACC_RC.
// Los datos del formulario viven solo en memoria (E); al recargar la página se pierden a propósito (privacidad).
const Redactor = (() => {
  const E = { tipo: 'traduccion', v: {}, notas: true, anexo: false };
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const marcar = t => esc(t).replace(/\[completar: [^\]]*\]/g, m => `<mark>${m}</mark>`);
  const orden = ['traduccion', 'edicion', 'cesion', 'encargo', 'ilustracion', 'correccion', 'coedicion', 'autoedicion', 'audiolibro'];
  const vals = () => E.v[E.tipo] || (E.v[E.tipo] = Contratos.defaults(E.tipo));
  const aviso = t => { if (typeof window.aviso === 'function') window.aviso(t); else { const a = document.getElementById('rc-estado'); if (a) a.textContent = t; } };
  const esCampoElegible = c => /^(inc|var)_/.test(c.id);

  // --- Formulario ---
  function campo(c, v) {
    const id = 'rc-' + c.id, ayuda = c.ayuda ? `<span class="chico tenue rc-ayuda" id="${id}-a">${esc(c.ayuda)}</span>` : '', d = c.ayuda ? ` aria-describedby="${id}-a"` : '';
    const oculto = Contratos.visible(c, v) ? '' : ' hidden';
    let h;
    if (c.tipo === 'check') h = `<label class="fila rc-check"><input type="checkbox" id="${id}" data-rc-campo="${esc(c.id)}"${d}${v[c.id] ? ' checked' : ''}> <span>${esc(c.etq)}</span></label>${ayuda}`;
    else if (c.tipo === 'opcion') h = `<label for="${id}">${esc(c.etq)}</label>${ayuda}<select id="${id}" data-rc-campo="${esc(c.id)}"${d}>${c.opciones.map(([k, t]) => `<option value="${esc(k)}"${v[c.id] === k ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
    else { const n = c.tipo === 'num'; h = `<label for="${id}">${esc(c.etq)}</label>${ayuda}<input id="${id}" data-rc-campo="${esc(c.id)}" data-rc-num="${n ? 1 : 0}" ${n ? 'type="number" min="0" step="any" inputmode="decimal"' : 'type="text"'} autocomplete="off"${d} value="${esc(v[c.id])}" class="u-w100">`; }
    return `<div class="rc-campo" id="${id}-w"${oculto}>${h}</div>`;
  }
  function campos(lista, v) {
    let sal = '', grupo = null, abierto = false;
    lista.forEach(c => {
      const g = c.grupo || '';
      if (g !== grupo) { if (abierto) sal += '</fieldset>'; abierto = false; if (g) { sal += `<fieldset class="rc-grupo"><legend>${esc(g)}</legend>`; abierto = true; } grupo = g; }
      sal += campo(c, v);
    });
    return sal + (abierto ? '</fieldset>' : '');
  }

  // --- Vista previa ---
  function previa() {
    const r = Contratos.generar(E.tipo, vals());
    const avisos = r.avisos.length ? `<div class="tarjeta rc-avisos" role="status">${r.avisos.map(a => `<p class="u-mb4 chico">⚠️ ${esc(a)}</p>`).join('')}</div>` : '';
    const refs = c => c.ref.length ? `<p class="chico u-mt6">${c.ref.map(x => x.tipo ? `<button type="button" class="enlace" data-rc="tipo" data-rc-v="${esc(x.tipo)}">${esc(x.t)}</button>` : `<a href="/simuladores/${esc(x.sim)}.html">${esc(x.t)}</a>`).join(' · ')}</p>` : '';
    return avisos + r.clausulas.map(c => `<article class="tarjeta rc-clausula"><h3 class="u-mb4">${c.n}. ${esc(c.t)}</h3>
      <p class="u-m0">${marcar(c.texto)}</p>
      <p class="u-mt6 chico tenue">Fuente: ${esc(c.fuente)}${c.variante ? ` · Redacción elegida: ${esc(c.variante)}` : ''}</p>
      ${c.revisar ? '<p class="u-mt6 chico"><span class="chip ojo">A revisar por abogado/a</span></p>' : ''}
      ${E.notas && c.porque ? `<p class="u-mt6 chico rc-porque"><b>Por qué esto importa.</b> ${esc(c.porque)}</p>` : ''}${E.notas ? refs(c) : ''}</article>`).join('');
  }
  const estado = () => { const r = Contratos.generar(E.tipo, vals()); return r.falta.length ? `Faltan ${r.falta.length} dato${r.falta.length === 1 ? '' : 's'}: ${r.falta.join(', ')}. En el texto quedan marcados como [completar].` : 'No falta ningún dato.'; };

  function actualizar() {
    const v = vals(), p = document.getElementById('rc-prev'); if (!p) return;
    p.innerHTML = previa();
    const st = document.getElementById('rc-estado'), t = estado(); if (st && st.textContent !== t) st.textContent = t;
    Contratos.MODELOS[E.tipo].campos.forEach(c => { const w = document.getElementById('rc-' + c.id + '-w'); if (w) w.hidden = !Contratos.visible(c, v); });
  }

  function vista() {
    montar();
    const m = Contratos.MODELOS[E.tipo], v = vals(), todos = m.campos;
    const datos = todos.filter(c => !esCampoElegible(c)), eleg = todos.filter(esCampoElegible);
    const pestana = k => `<button type="button" class="btn ch ${E.tipo === k ? '' : 'lin'}" aria-pressed="${E.tipo === k}" data-rc="tipo" data-rc-v="${k}">${esc(Contratos.MODELOS[k].corto)}</button>`;
    return `<div id="rc-raiz">
      ${Contratos.franja(E.tipo) ? `<div class="tarjeta rc-franja" role="note"><p class="u-m0"><b>${esc(Contratos.franja(E.tipo).t)}.</b> ${esc(Contratos.franja(E.tipo).d)}</p></div>` : ''}
      <div class="tarjeta rc-aviso" role="note"><p class="u-m0"><b>Plantillas orientativas, no asesoramiento legal.</b> Antes de firmar, conviene que las revise un/a abogado/a. Las cláusulas marcadas «a revisar por abogado/a» son las que no se apoyan en una norma o admiten opciones que merecen opinión profesional. Todo se arma en tu navegador: lo que escribís no se envía ni se guarda en ningún lado y se pierde al cerrar o recargar la página.</p></div>
      <div class="u-mb10 eligen" role="group" aria-label="Tipo de contrato">${orden.map(pestana).join('')}</div>
      <p class="u-mt0 chico" id="rc-desc">${esc(m.d)}</p>
      <div class="rc-cols"><div>
        <form class="tarjeta" id="rc-form" autocomplete="off"><h3 class="u-mb4">Datos</h3>${campos(datos, v)}</form>
        ${eleg.length ? `<form class="tarjeta" aria-label="Cláusulas a elegir"><h3 class="u-mb4">Cláusulas a elegir</h3><p class="chico tenue u-mt0">Sumá o sacá cláusulas y elegí cómo se redactan.</p>${campos(eleg, v)}</form>` : ''}
        <p><button type="button" class="btn lin ch" data-rc="limpiar">Borrar lo que cargué en este contrato</button></p>
      </div>
      <div><div class="rc-acciones" role="group" aria-label="Llevarte el contrato">
          <button type="button" class="btn" data-rc="copiar">Copiar el texto</button>
          <button type="button" class="btn sec" data-rc="md">Descargar .md</button>
          <button type="button" class="btn sec" data-rc="txt">Descargar .txt</button>
          <button type="button" class="btn sec" data-rc="docx">Descargar .docx</button>
          <button type="button" class="btn sec" data-rc="imprimir">Imprimir o guardar como PDF</button></div>
        <div class="rc-opciones"><label class="fila rc-check"><input type="checkbox" data-rc-opt="notas"${E.notas ? ' checked' : ''}> <span>Mostrar «por qué esto importa» en cada cláusula</span></label>
          <label class="fila rc-check"><input type="checkbox" data-rc-opt="anexo"${E.anexo ? ' checked' : ''}> <span>Agregar al archivo un anexo con las notas y las fuentes</span></label></div>
        <p class="u-mb8 chico tenue" id="rc-estado" role="status">${esc(estado())}</p>
        <div id="rc-prev">${previa()}</div></div></div></div>`;
  }

  // --- Salidas ---
  const bajar = (nombre, datos, tipo) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([datos], { type: tipo })); a.download = nombre; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); };
  const antes = () => { const r = Contratos.generar(E.tipo, vals()); if (r.falta.length) aviso(`Faltan ${r.falta.length} dato${r.falta.length === 1 ? '' : 's'}: quedan marcados como [completar].`); };
  const opciones = () => ({ notas: E.anexo });
  const ACC_RC = {
    tipo: k => { if (!Contratos.MODELOS[k]) return; E.tipo = k; const r = document.getElementById('rc-raiz'); if (r) r.outerHTML = vista(); const b = document.querySelector('[data-rc="tipo"][aria-pressed="true"]'); if (b) b.focus(); },
    limpiar: () => { delete E.v[E.tipo]; const r = document.getElementById('rc-raiz'); if (r) r.outerHTML = vista(); aviso('Se borró lo que cargaste en este contrato.'); },
    copiar: () => { antes(); const t = Contratos.texto(E.tipo, vals(), opciones()); if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(() => aviso('Contrato copiado.'), () => aviso('No se pudo copiar. Descargalo en su lugar.')); else aviso('No se pudo copiar. Descargalo en su lugar.'); },
    md: () => { antes(); bajar(`contrato-${E.tipo}.md`, Contratos.documento(E.tipo, vals(), opciones()), 'text/markdown;charset=utf-8'); },
    txt: () => { antes(); bajar(`contrato-${E.tipo}.txt`, Contratos.texto(E.tipo, vals(), opciones()), 'text/plain;charset=utf-8'); },
    docx: () => { antes(); bajar(`contrato-${E.tipo}.docx`, Contratos.docx(E.tipo, vals(), opciones()), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'); },
    // Imprimir: el contrato se arma en un nodo hijo de <body> y, mientras se imprime, el resto de la página se oculta (ver .rc-imprimiendo en componentes.css).
    imprimir: () => {
      antes(); const n = document.createElement('div'); n.id = 'rc-impresion'; n.className = 'rc-doc'; n.innerHTML = Contratos.html(E.tipo, vals(), opciones()); document.body.appendChild(n); document.body.classList.add('rc-imprimiendo');
      const fin = () => { document.body.classList.remove('rc-imprimiendo'); n.remove(); };
      window.addEventListener('afterprint', fin, { once: true }); setTimeout(() => window.print(), 50); setTimeout(fin, 120000);
    }
  };

  // --- Eventos delegados (se registran una sola vez) ---
  let listo = false;
  function montar() {
    if (listo) return; listo = true;
    document.addEventListener('click', e => {
      const b = e.target.closest && e.target.closest('[data-rc]'); if (!b || !document.getElementById('rc-raiz')) return;
      const f = ACC_RC[b.getAttribute('data-rc')]; if (f) { e.preventDefault(); f(b.getAttribute('data-rc-v')); }
    });
    const cambio = e => {
      const t = e.target; if (!t || !t.getAttribute || !document.getElementById('rc-raiz')) return;
      const opt = t.getAttribute('data-rc-opt'); if (opt) { E[opt] = t.checked; actualizar(); return; }
      const id = t.getAttribute('data-rc-campo'); if (!id) return;
      const v = vals();
      v[id] = t.type === 'checkbox' ? t.checked : t.getAttribute('data-rc-num') === '1' ? (t.value === '' ? '' : Number(t.value)) : t.value;
      actualizar();
    };
    document.addEventListener('submit', e => { if (e.target.closest && e.target.closest('#rc-raiz')) e.preventDefault(); });
    document.addEventListener('input', cambio);
    document.addEventListener('change', cambio);
  }

  return { vista, ACC_RC, estado: () => E };
})();
