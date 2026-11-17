// Pruebas del reporte de asistencia. No necesitan base de datos: se simulan las consultas.
const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');
process.env.JWT_SECRET ||= 'secreto-de-prueba-123456';
const pool = require('../src/config/db');
const { descargarReporteCurso, construirDatos } = require('../src/controllers/reporteController');
const { crc32 } = require('../src/utils/zip');

const DOCENTE = 'doc-1';
const sesiones = ['s1', 's2', 's3', 's4'].map((id, i) => ({ id, fecha: `2026-10-0${i + 1}` }));
const alumnos = [{ id: 'a1', codigo: 'U1', nombres: 'Ana', apellidos: 'Ñahui' }, { id: 'a2', codigo: 'U2', nombres: 'Beto', apellidos: 'Díaz' }];
const registros = [
  ...['s1', 's2', 's3', 's4'].map((s, i) => ({ sesion_id: s, alumno_id: 'a1', estado: ['presente', 'tardanza', 'presente', 'justificada'][i] })),
  ...['s1', 's2', 's3', 's4'].map((s, i) => ({ sesion_id: s, alumno_id: 'a2', estado: ['presente', 'falta', 'falta', 'presente'][i] })),
];

const original = pool.query;
beforeEach(() => {
  pool.query = async (sql, params) => {
    if (sql.includes('FROM curso c')) return params[0] === 'no-existe' ? { rowCount: 0, rows: [] } : { rowCount: 1, rows: [{ id: 'c1', codigo: 'CS101', nombre: 'Software', seccion: '01', docente_id: DOCENTE, umbral_riesgo_pct: '25.00', docente: 'Docente Uno', periodo: '2026-II' }] };
    if (sql.includes('FROM sesion_clase')) return { rows: sesiones };
    if (sql.includes('FROM matricula')) return { rows: alumnos };
    if (sql.includes('FROM asistencia')) return { rows: registros };
    throw new Error(`consulta inesperada: ${sql.slice(0, 40)}`);
  };
});
afterEach(() => { pool.query = original; });

const res = () => ({ statusCode: 200, cabeceras: {}, cuerpo: undefined,
  set(c) { Object.assign(this.cabeceras, c); return this; }, status(c) { this.statusCode = c; return this; },
  json(b) { this.cuerpo = b; return this; }, end(b) { this.cuerpo = b; return this; } });
const pedir = async (query, user = { id: DOCENTE, rol: 'docente' }, cursoId = 'c1') => { const r = res(); await descargarReporteCurso({ params: { cursoId }, query, user }, r); return r; };

test('construirDatos: totales por alumno y riesgo según el umbral del curso', async () => {
  const d = await construirDatos('c1', { desde: '', hasta: '' });
  const [ana, beto] = d.alumnos;
  assert.equal(ana.nombre, 'Ñahui, Ana');
  assert.deepEqual([ana.presentes, ana.tardanzas, ana.faltas, ana.justificadas], [2, 1, 0, 1]);
  assert.equal(ana.asistencia, 0.75);       // presente + tardanza cuentan como asistencia
  assert.equal(ana.enRiesgo, false);
  assert.deepEqual([beto.presentes, beto.faltas], [2, 2]);
  assert.equal(beto.enRiesgo, true);        // 50% de faltas
  assert.equal(beto.nivel, 'critico');      // supera el umbral del curso (25%)
  assert.equal(ana.nivel, null);
  assert.deepEqual(ana.estados, ['presente', 'tardanza', 'presente', 'justificada']);
});

test('descarga xlsx y pdf con cabeceras y archivo válido', async () => {
  const x = await pedir({ formato: 'xlsx' });
  assert.equal(x.statusCode, 200);
  assert.match(x.cabeceras['Content-Disposition'], /attachment; filename="asistencia_CS101_01_\d{4}-\d{2}-\d{2}\.xlsx"/);
  assert.equal(x.cuerpo.subarray(0, 4).toString('hex'), '504b0304');
  // el CRC y el contenido del primer archivo del ZIP deben ser consistentes
  const nombreLen = x.cuerpo.readUInt16LE(26), comprimido = x.cuerpo.readUInt32LE(18);
  const datos = zlib.inflateRawSync(x.cuerpo.subarray(30 + nombreLen, 30 + nombreLen + comprimido));
  assert.equal(crc32(datos), x.cuerpo.readUInt32LE(14));

  const p = await pedir({ formato: 'pdf' });
  assert.equal(p.statusCode, 200);
  assert.equal(p.cuerpo.subarray(0, 5).toString(), '%PDF-');
  assert.ok(p.cuerpo.subarray(-6).toString().includes('%%EOF'));
});

test('validaciones y permisos', async () => {
  assert.equal((await pedir({ formato: 'doc' })).statusCode, 400);
  assert.equal((await pedir({ formato: 'pdf', desde: '31/10/2026' })).statusCode, 400);
  assert.equal((await pedir({ formato: 'pdf', desde: '2026-02-30' })).statusCode, 400);
  assert.equal((await pedir({ formato: 'pdf', desde: ['2026-10-01'] })).statusCode, 400);
  assert.equal((await pedir({ formato: 'pdf', desde: '2026-11-01', hasta: '2026-10-01' })).statusCode, 400);
  assert.equal((await pedir({ formato: 'pdf' }, { id: 'otro-docente', rol: 'docente' })).statusCode, 403);
  assert.equal((await pedir({ formato: 'pdf' }, { id: 'admin-1', rol: 'admin' })).statusCode, 200);
  assert.equal((await pedir({ formato: 'pdf' }, { id: DOCENTE, rol: 'docente' }, 'no-existe')).statusCode, 404);
});

test('rechaza rangos demasiado grandes sin exportar un informe parcial', async () => {
  const consulta = pool.query;
  pool.query = async (sql, params) => sql.includes('FROM sesion_clase')
    ? { rows: Array.from({ length: 121 }, (_, i) => ({ id: `s${i}`, fecha: '2026-10-01' })) }
    : consulta(sql, params);
  const resultado = await pedir({ formato: 'xlsx' });
  assert.equal(resultado.statusCode, 400);
  assert.match(resultado.cuerpo.error, /120 sesiones/);
});
