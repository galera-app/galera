#!/usr/bin/env node
// Todas las pruebas de unidad de JS, con cobertura medida y trinquete («no baja»). Un solo comando, sin dependencias:
//   node tools/pruebas_unidad.mjs              corre todo y controla que la cobertura no baje
//   node tools/pruebas_unidad.mjs --actualizar sube la base de cobertura (tools/cobertura-base.json)
// Usa el corredor de Node (node --test) con su cobertura integrada; pide Node 22 o más (reporter lcov).
// Queda afuera tools/probar_prensa.mjs: necesita bajar el motor Typst de npm (ver tools/bajar_typst.py) y corre en su propio paso del CI.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(RAIZ);   // las rutas del informe son relativas a la raíz
if (Number(process.versions.node.split('.')[0]) < 22) { console.error('Hace falta Node 22 o más (tenés ' + process.version + ').'); process.exit(2); }

const sueltas = ['probar_simuladores.js', 'probar_lomo.js', 'probar_imprenta.js', 'probar_contratos.js'].map(f => 'tools/' + f);
const nuevas = fs.readdirSync('tools/pruebas').filter(f => f.endsWith('.test.js')).sort().map(f => 'tools/pruebas/' + f);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'galera-cob-'));
const lcov = path.join(tmp, 'lcov.info');

const r = spawnSync(process.execPath, ['--test', '--experimental-test-coverage', '--test-reporter=spec', '--test-reporter-destination=stdout',
  '--test-reporter=lcov', '--test-reporter-destination=' + lcov, ...sueltas, ...nuevas], { stdio: 'inherit' });
if (r.status !== 0) { console.error('\nHay pruebas que fallan: no se controla la cobertura.'); process.exit(r.status || 1); }

const c = spawnSync(process.execPath, ['tools/controlar_cobertura.mjs', lcov, ...process.argv.slice(2).filter(a => a === '--actualizar')], { stdio: 'inherit' });
fs.rmSync(tmp, { recursive: true, force: true });
process.exit(c.status || 0);
