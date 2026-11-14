#!/usr/bin/env node
// Trinquete de cobertura: la de líneas de cada archivo del sitio (y la total) no puede BAJAR respecto de tools/cobertura-base.json.
// No hay meta de porcentaje: solo «no baja». Lee un informe lcov (el que escribe `node --test --test-reporter=lcov`).
// Uso: node tools/controlar_cobertura.mjs <lcov.info> [--actualizar]
//   --actualizar  reescribe la base: cada valor solo puede subir (nunca se baja una base a mano con este comando).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = path.join(RAIZ, 'tools', 'cobertura-base.json');
const args = process.argv.slice(2);
const actualizar = args.includes('--actualizar');
const lcov = args.find(a => !a.startsWith('--'));
if (!lcov || !fs.existsSync(lcov)) { console.error('Falta el informe lcov: node tools/controlar_cobertura.mjs <lcov.info> [--actualizar]'); process.exit(2); }

// Solo el código del sitio: archivos .js de la raíz del repo (no tools/, no vendor/, no pruebas).
function leer(texto) {
  const por = {}; let act = null;
  for (const l of texto.split(/\r?\n/)) {
    if (l.startsWith('SF:')) { const f = l.slice(3).replace(/[\\]/g, '/').replace(/^\.\//, ''); act = /^[\w.-]+\.js$/.test(f) ? (por[f] = { lh: 0, lf: 0 }) : null; }
    else if (act && l.startsWith('LH:')) act.lh = Number(l.slice(3));
    else if (act && l.startsWith('LF:')) act.lf = Number(l.slice(3));
  }
  return por;
}
const abajo = x => Math.floor(x * 100) / 100;   // dos decimales, redondeando hacia abajo (nunca se promete de más)
const pct = o => o.lf ? abajo(100 * o.lh / o.lf) : 100;

const hoy = leer(fs.readFileSync(lcov, 'utf8'));
const archivos = Object.keys(hoy).sort();
if (!archivos.length) { console.error('El informe no trae ningún archivo del sitio: ¿se corrió desde la raíz del repo?'); process.exit(2); }
const tot = archivos.reduce((s, f) => ({ lh: s.lh + hoy[f].lh, lf: s.lf + hoy[f].lf }), { lh: 0, lf: 0 });
const base = fs.existsSync(BASE) ? JSON.parse(fs.readFileSync(BASE, 'utf8')) : { total: 0, archivos: {} };

const fallas = [];
for (const [f, antes] of Object.entries(base.archivos)) {
  if (!hoy[f]) { fallas.push(`${f}: estaba en la base y ya no se mide (¿se dejó de cargar en las pruebas?)`); continue; }
  if (pct(hoy[f]) < antes) fallas.push(`${f}: bajó de ${antes} % a ${pct(hoy[f])} %`);
}
if (pct(tot) < base.total) fallas.push(`total: bajó de ${base.total} % a ${pct(tot)} %`);
const nuevos = archivos.filter(f => !(f in base.archivos));

console.log(`Cobertura de líneas (total ${pct(tot)} %, base ${base.total} %):`);
archivos.forEach(f => console.log(`  ${f.padEnd(20)} ${String(pct(hoy[f])).padStart(6)} %   (base ${f in base.archivos ? base.archivos[f] + ' %' : 'sin base'})`));
if (nuevos.length && !actualizar) console.log(`Archivos sin base (no frenan): ${nuevos.join(', ')}. Se suman con --actualizar.`);

if (fallas.length) { console.error('\nLa cobertura bajó:\n  ' + fallas.join('\n  ')); process.exit(1); }

if (actualizar) {
  const nueva = { total: Math.max(base.total, pct(tot)), archivos: {} };
  for (const f of archivos) nueva.archivos[f] = Math.max(base.archivos[f] || 0, pct(hoy[f]));
  for (const f of Object.keys(base.archivos)) if (!(f in nueva.archivos)) nueva.archivos[f] = base.archivos[f];
  fs.writeFileSync(BASE, JSON.stringify(nueva, null, 2) + '\n');
  console.log('Base actualizada: tools/cobertura-base.json');
} else console.log('Sin bajas respecto de la base.');
