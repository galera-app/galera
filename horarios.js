// Lógica de horarios: choques, huecos y combinaciones sugeridas. Sin DOM, para poder probarla aparte.
//
// Comisión: { id, materia, tipo: 'Teórico' | 'Práctico' | 'Teórico-práctico', nombre, docente?, aula?, modalidad?,
//             bloques: [{ dia: 1..6 (lunes a sábado), desde: 'HH:MM', hasta: 'HH:MM' }] }
// De cada materia se cursa UNA comisión por cada tipo que tenga (un teórico y un práctico, por ejemplo).
var Horarios = (function () {
  var DIAS = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

  function min(hhmm) { var p = String(hhmm).split(':'); return Number(p[0]) * 60 + Number(p[1] || 0); }
  function hhmm(m) { return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); }

  function sePisan(a, b) { return a.dia === b.dia && min(a.desde) < min(b.hasta) && min(b.desde) < min(a.hasta); }

  // Choques entre comisiones elegidas: [{ a, b, dia, desde, hasta }] (una entrada por par de bloques que se pisan).
  function choques(comisiones) {
    var out = [];
    for (var i = 0; i < comisiones.length; i++) {
      for (var j = i + 1; j < comisiones.length; j++) {
        comisiones[i].bloques.forEach(function (x) {
          comisiones[j].bloques.forEach(function (y) {
            if (sePisan(x, y)) out.push({ a: comisiones[i], b: comisiones[j], dia: x.dia,
              desde: hhmm(Math.max(min(x.desde), min(y.desde))), hasta: hhmm(Math.min(min(x.hasta), min(y.hasta))) });
          });
        });
      }
    }
    return out;
  }

  // Resumen de una grilla: días que se cursa, horas de clase, huecos (minutos libres entre clases del mismo día)
  // y minutos que caen en horarios bloqueados (trabajo, etc.).
  function resumen(comisiones, bloqueos) {
    var porDia = {}, clase = 0, enBloqueo = 0;
    comisiones.forEach(function (c) {
      c.bloques.forEach(function (b) {
        (porDia[b.dia] = porDia[b.dia] || []).push(b);
        clase += min(b.hasta) - min(b.desde);
        (bloqueos || []).forEach(function (q) {
          if (sePisan(b, q)) enBloqueo += Math.min(min(b.hasta), min(q.hasta)) - Math.max(min(b.desde), min(q.desde));
        });
      });
    });
    var huecos = 0, salida = 0, entrada = 24 * 60;
    Object.keys(porDia).forEach(function (d) {
      var L = porDia[d].slice().sort(function (x, y) { return min(x.desde) - min(y.desde); });
      for (var i = 1; i < L.length; i++) huecos += Math.max(0, min(L[i].desde) - min(L[i - 1].hasta));
      entrada = Math.min(entrada, min(L[0].desde));
      salida = Math.max(salida, min(L[L.length - 1].hasta));
    });
    var dias = Object.keys(porDia).map(Number).sort();
    return { dias: dias, clase: clase, huecos: huecos, enBloqueo: enBloqueo, entrada: dias.length ? hhmm(entrada) : '', salida: dias.length ? hhmm(salida) : '' };
  }

  // Grupos a resolver: una entrada por (materia, tipo) con sus comisiones posibles.
  function grupos(materias, comisiones) {
    var g = [];
    materias.forEach(function (m) {
      var tipos = {};
      comisiones.filter(function (c) { return c.materia === m; }).forEach(function (c) { (tipos[c.tipo] = tipos[c.tipo] || []).push(c); });
      Object.keys(tipos).forEach(function (t) { g.push({ materia: m, tipo: t, opciones: tipos[t] }); });
    });
    return g;
  }

  // Busca las mejores combinaciones. Menor puntaje = mejor: un choque pesa más que cualquier otra cosa;
  // después, pisar un horario bloqueado; después, días y huecos.
  // Primera pasada: descarta apenas aparece un choque (poda), así recorre solo combinaciones posibles y llega
  // lejos aunque haya muchas materias. Si ninguna combinación está libre de choques, segunda pasada sin podar.
  // pref: { bloqueos: [{dia, desde, hasta}], sinSabado: bool, fijas: { 'materia|tipo': idComision } }
  function sugerir(materias, comisiones, pref, cuantas) {
    pref = pref || {};
    var G = grupos(materias, comisiones).filter(function (g) { return g.opciones.length; });
    if (!G.length) return { combinaciones: [], total: 0, recortado: false, sinChoques: false };
    G.forEach(function (g) {
      var fija = (pref.fijas || {})[g.materia + '|' + g.tipo];
      if (fija) g.opciones = g.opciones.filter(function (c) { return c.id === fija; });
    });
    G = G.filter(function (g) { return g.opciones.length; });
    // Primero los grupos con menos opciones (los teóricos únicos): los choques se detectan antes.
    G.sort(function (a, b) { return a.opciones.length - b.opciones.length; });
    var total = G.reduce(function (n, g) { return n * g.opciones.length; }, 1);
    var LIMITE = 20000, probadas, mejores;
    function puntaje(sel) {
      var ch = choques(sel), r = resumen(sel, pref.bloqueos);
      var p = ch.length * 100000 + r.enBloqueo * 50 + r.dias.length * 120 + r.huecos;
      if (pref.sinSabado && r.dias.indexOf(6) >= 0) p += 5000;
      return { p: p, choques: ch, resumen: r };
    }
    function choca(c, sel) {
      return sel.some(function (s) { return s.bloques.some(function (x) { return c.bloques.some(function (y) { return sePisan(x, y); }); }); });
    }
    function correr(podar) {
      probadas = 0; mejores = [];
      (function rec(i, sel) {
        if (probadas >= LIMITE) return;
        if (i === G.length) {
          probadas++;
          var s = puntaje(sel);
          mejores.push({ comisiones: sel.slice(), puntaje: s.p, choques: s.choques, resumen: s.resumen });
          if (mejores.length > 60) { mejores.sort(function (a, b) { return a.puntaje - b.puntaje; }); mejores.length = 30; }
          return;
        }
        G[i].opciones.forEach(function (c) {
          if (podar && choca(c, sel)) return;
          sel.push(c); rec(i + 1, sel); sel.pop();
        });
      })(0, []);
    }
    correr(true);
    var sinChoques = mejores.length > 0;
    if (!sinChoques) correr(false);
    mejores.sort(function (a, b) { return a.puntaje - b.puntaje; });
    return { combinaciones: mejores.slice(0, cuantas || 5), total: total, recortado: probadas >= LIMITE, sinChoques: sinChoques };
  }

  // ---- Exportar al calendario (.ics) ----
  // Fechas 'AAAA-MM-DD' en UTC para que el cambio de hora del navegador no corra ningún día.
  function dia(s) { var p = s.split('-').map(Number); return new Date(Date.UTC(p[0], p[1] - 1, p[2])); }
  function iso(d) { return d.toISOString().slice(0, 10); }
  function mas(s, n) { var d = dia(s); d.setUTCDate(d.getUTCDate() + n); return iso(d); }

  // Clases de cada bloque elegido dentro del cuatrimestre: primera y última fecha, y los feriados que caen ese día.
  // periodo: { desde, hasta }; feriados: ['AAAA-MM-DD'].
  function clases(comisiones, periodo, feriados) {
    var out = [];
    comisiones.forEach(function (c) {
      c.bloques.forEach(function (b, i) {
        var primera = mas(periodo.desde, (b.dia - dia(periodo.desde).getUTCDay() + 7) % 7);
        if (primera > periodo.hasta) return;
        var ultima = mas(primera, Math.floor((dia(periodo.hasta) - dia(primera)) / 6048e5) * 7);
        var sin = (feriados || []).filter(function (f) { return f >= primera && f <= ultima && dia(f).getUTCDay() === b.dia; }).sort();
        out.push({ c: c, b: b, i: i, primera: primera, ultima: ultima, sin: sin });
      });
    });
    return out;
  }

  // Texto .ics. Evento: { uid, t, fecha, desde?, hasta? ('HH:MM'; sin hora es de día entero), ultima? (se repite
  // cada semana hasta esa fecha), sin? (fechas salteadas), lugar?, nota? }. Hora de Buenos Aires (UTC-3, sin horario de verano).
  var TZ = 'America/Argentina/Buenos_Aires';
  function texto(s) { return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r\n?|\n/g, '\\n'); }
  function plegar(linea) { // líneas de hasta 75 bytes (RFC 5545)
    var out = [], act = '', n = 0;
    Array.from(linea).forEach(function (ch) {
      var cp = ch.codePointAt(0), b = cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
      if (n + b > (out.length ? 74 : 75)) { out.push(act); act = ''; n = 0; }
      act += ch; n += b;
    });
    out.push(act);
    return out.join('\r\n ');
  }
  function ics(eventos, sello) {
    var f = function (s) { return s.replace(/-/g, ''); }, h = function (s) { return s.replace(':', '') + '00'; };
    var L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Cursada//ficha.github.io//ES', 'CALSCALE:GREGORIAN',
      'BEGIN:VTIMEZONE', 'TZID:' + TZ, 'BEGIN:STANDARD', 'DTSTART:19700101T000000', 'TZOFFSETFROM:-0300', 'TZOFFSETTO:-0300', 'TZNAME:-03', 'END:STANDARD', 'END:VTIMEZONE'];
    eventos.forEach(function (e) {
      L.push('BEGIN:VEVENT', 'UID:' + e.uid, 'DTSTAMP:' + f(sello || iso(new Date())) + 'T000000Z');
      if (e.desde) L.push('DTSTART;TZID=' + TZ + ':' + f(e.fecha) + 'T' + h(e.desde), 'DTEND;TZID=' + TZ + ':' + f(e.fecha) + 'T' + h(e.hasta || hhmm(min(e.desde) + 120)));
      else L.push('DTSTART;VALUE=DATE:' + f(e.fecha), 'DTEND;VALUE=DATE:' + f(mas(e.fecha, 1)));
      // UNTIL va en UTC: las 23:59:59 de Buenos Aires del último día son las 02:59:59 del día siguiente.
      if (e.ultima) L.push('RRULE:FREQ=WEEKLY;UNTIL=' + f(mas(e.ultima, 1)) + 'T025959Z');
      if (e.desde && e.sin && e.sin.length) L.push('EXDATE;TZID=' + TZ + ':' + e.sin.map(function (x) { return f(x) + 'T' + h(e.desde); }).join(','));
      L.push('SUMMARY:' + texto(e.t));
      if (e.lugar) L.push('LOCATION:' + texto(e.lugar));
      if (e.nota) L.push('DESCRIPTION:' + texto(e.nota));
      L.push('END:VEVENT');
    });
    L.push('END:VCALENDAR');
    return L.map(plegar).join('\r\n') + '\r\n';
  }

  return { DIAS: DIAS, min: min, hhmm: hhmm, sePisan: sePisan, choques: choques, resumen: resumen, grupos: grupos, sugerir: sugerir, clases: clases, ics: ics };
})();
