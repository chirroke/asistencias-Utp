// Pruebas de las alertas de riesgo. No necesitan base de datos: se simulan las consultas.
const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
process.env.JWT_SECRET ||= 'secreto-de-prueba-123456';
const pool = require('../src/config/db');
const { clasificarRiesgo } = require('../src/utils/riesgo');
const { evaluarRiesgoCurso } = require('../src/services/riesgoService');
const { obtenerAlumnosEnRiesgo } = require('../src/controllers/docenteController');

test('clasificarRiesgo: advertencia desde 20%, crítico desde el umbral del curso, y mínimo de sesiones', () => {
  assert.equal(clasificarRiesgo(0, 10, 30).nivel, null);
  assert.equal(clasificarRiesgo(1, 10, 30).nivel, null);            // 10%
  assert.equal(clasificarRiesgo(2, 10, 30).nivel, 'advertencia');   // 20%
  assert.equal(clasificarRiesgo(3, 10, 30).nivel, 'critico');       // 30%
  assert.equal(clasificarRiesgo(3, 3, 30).nivel, null);             // solo 3 sesiones: aún no se evalúa
  assert.equal(clasificarRiesgo(1, 4, 30).nivel, 'advertencia');    // 25%
  assert.equal(clasificarRiesgo(1, 5, 15).nivel, 'critico');        // umbral del curso menor a 20 manda
  assert.equal(clasificarRiesgo(2, 10, '30.00').porcentajeFaltas, 20);
});

// --- Base de datos simulada
let totalSesiones, faltasPorAlumno, alertas;
const original = pool.query;
beforeEach(() => {
  totalSesiones = 10; alertas = [];
  faltasPorAlumno = { a1: 0, a2: 2, a3: 3 };
  pool.query = async (sql, params) => {
    if (sql.includes('FROM curso c')) return { rowCount: 1, rows: [{ id: 'c1', codigo: 'CS101', nombre: 'Software', seccion: '01', docente_id: 'd1' }] };
    if (sql.includes('FROM curso WHERE')) return { rowCount: 1, rows: [{ id: 'c1', codigo: 'CS101', nombre: 'Software', seccion: '01', umbral_riesgo_pct: '30.00' }] };
    if (sql.includes('FROM sesion_clase')) return { rows: [{ total: totalSesiones }] };
    if (sql.includes('FROM matricula')) return { rows: Object.entries(faltasPorAlumno).map(([id, faltas]) => ({ id, nombres: id.toUpperCase(), apellidos: 'Apellido', codigo: `U-${id}`, faltas })) };
    if (sql.includes('FROM alerta_riesgo')) return { rows: alertas.map((a) => ({ alumno_id: a.alumno_id, nivel: a.nivel })) };
    if (sql.includes('INSERT INTO alerta_riesgo')) { alertas.push({ alumno_id: params[0], nivel: params[2], pct: params[3], umbral: params[4] }); return { rowCount: 1 }; }
    if (sql.includes('FROM periodo_academico') || sql.includes('JOIN periodo_academico')) return { rows: [{ id: 'c1' }] };
    throw new Error(`consulta inesperada: ${sql.slice(0, 50)}`);
  };
});
afterEach(() => { pool.query = original; });

test('evaluarRiesgoCurso: crea la alerta una sola vez por alumno y nivel', async () => {
  const nuevas = await evaluarRiesgoCurso('c1');
  assert.deepEqual(nuevas.map((n) => [n.alumnoId, n.nivel]), [['a2', 'advertencia'], ['a3', 'critico']]);
  const critica = alertas.find((a) => a.alumno_id === 'a3');
  assert.equal(critica.pct, 70);        // 30% de faltas → 70% de asistencia
  assert.equal(critica.umbral, 30);

  // Otra clase cerrada sin cambios: no se repite nada
  assert.deepEqual(await evaluarRiesgoCurso('c1'), []);
  assert.equal(alertas.length, 2);

  // a2 empeora a crítico → alerta nueva de ese nivel (la de advertencia se conserva)
  faltasPorAlumno.a2 = 3;
  const escalada = await evaluarRiesgoCurso('c1');
  assert.deepEqual(escalada.map((n) => [n.alumnoId, n.nivel]), [['a2', 'critico']]);
  assert.equal(alertas.length, 3);
});

test('evaluarRiesgoCurso: con pocas sesiones no alerta, y un error de BD no rompe el cierre', async () => {
  totalSesiones = 3;
  assert.deepEqual(await evaluarRiesgoCurso('c1'), []);
  pool.query = async () => { throw new Error('BD caída'); };
  assert.deepEqual(await evaluarRiesgoCurso('c1'), []);   // no lanza
});

test('docente: lista alumnos en riesgo ordenados (crítico primero)', async () => {
  const res = { statusCode: 200, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
  await obtenerAlumnosEnRiesgo({ user: { id: 'd1', rol: 'docente' } }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.alumnos.map((a) => [a.alumno_id, a.nivel, a.porcentaje_faltas]), [['a3', 'critico', 30], ['a2', 'advertencia', 20]]);
  assert.equal(res.body.alumnos[0].nombre, 'Apellido, A3');
});
