// Pruebas que NO necesitan base de datos.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

test('clasificarMarcacion: dentro de la tolerancia es presente, fuera es tardanza', () => {
  // alumnoController importa el pool; se evita abrir conexión cargando solo la función.
  process.env.JWT_SECRET ||= 'secreto-de-prueba-123456';
  const { clasificarMarcacion } = require('../src/controllers/alumnoController');
  const inicio = new Date('2026-11-10T08:00:00Z').getTime();
  const min = (m) => inicio + m * 60000;
  assert.deepEqual(clasificarMarcacion(inicio, 15, min(0)), { estado: 'presente', minutosTarde: 0 });
  assert.deepEqual(clasificarMarcacion(inicio, 15, min(15)), { estado: 'presente', minutosTarde: 0 });
  assert.deepEqual(clasificarMarcacion(inicio, 15, min(16)), { estado: 'tardanza', minutosTarde: 1 });
  assert.deepEqual(clasificarMarcacion(inicio, 15, min(40)), { estado: 'tardanza', minutosTarde: 25 });
  assert.deepEqual(clasificarMarcacion(inicio, null, min(1)), { estado: 'tardanza', minutosTarde: 1 });
});

test('secrets: en producción sin JWT_SECRET el servidor no arranca', () => {
  // Se ejecuta desde una carpeta sin .env para que el archivo real del proyecto no influya en la prueba.
  const ruta = require('node:path').resolve(__dirname, '../src/config/secrets');
  const cargar = (env) => spawnSync(process.execPath, ['-e', `require(${JSON.stringify(ruta)})`], { cwd: require('node:os').tmpdir(), env: { PATH: process.env.PATH, ...env }, encoding: 'utf8' });
  assert.notEqual(cargar({ NODE_ENV: 'production' }).status, 0);
  assert.notEqual(cargar({ NODE_ENV: 'production', JWT_SECRET: 'secreto_desarrollo' }).status, 0);
  assert.equal(cargar({ NODE_ENV: 'production', JWT_SECRET: 'una-clave-larga-y-aleatoria' }).status, 0);
  assert.equal(cargar({ RENDER: 'true' }).status === 0, false);
  assert.equal(cargar({}).status, 0); // desarrollo: avisa pero funciona
});
