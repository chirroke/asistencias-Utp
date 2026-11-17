// Prueba del flujo del ALUMNO: escanear el QR, selfie y validación facial.
// Usa la base de datos real dentro de una transacción que se deshace al terminar (no deja datos).
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const pool = require('../src/config/db');
const sesiones = require('../src/controllers/sesionController');
const alumnos = require('../src/controllers/alumnoController');

after(async () => pool.end());

const respuesta = () => ({
  statusCode: 200, body: undefined,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

const rostro = (valor) => Array.from({ length: 128 }, () => valor);
const selfie = { buffer: Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(2048, 1)]) };

test('flujo alumno: QR válido, doble marcación, rostro distinto, token falso, tardanza y QR vencido', async () => {
  const client = await pool.connect();
  const queryOriginal = pool.query.bind(pool);
  const connectOriginal = pool.connect.bind(pool);
  let iniciada = false;

  // Los controladores abren su propia transacción (BEGIN/COMMIT/ROLLBACK). Dentro de la transacción
  // de la prueba se convierten en SAVEPOINT para que nada se confirme en la base de datos.
  const traducir = (sql) => {
    if (typeof sql !== 'string') return sql;
    if (/^\s*BEGIN\s*$/i.test(sql)) return 'SAVEPOINT escaneo';
    if (/^\s*COMMIT\s*$/i.test(sql)) return 'RELEASE SAVEPOINT escaneo';
    if (/^\s*ROLLBACK\s*$/i.test(sql)) return 'ROLLBACK TO SAVEPOINT escaneo';
    return sql;
  };

  try {
    await client.query('BEGIN');
    iniciada = true;
    pool.query = (sql, params) => client.query(traducir(sql), params);
    pool.connect = async () => ({ query: (sql, params) => client.query(traducir(sql), params), release() {} });

    const id = crypto.randomUUID().replaceAll('-', '').slice(0, 8);
    const docente = (await client.query(
      `INSERT INTO usuario (correo, contrasena_hash, nombres, apellidos, rol)
       VALUES ($1, 'hash-de-prueba', 'Docente', 'Escaneo', 'docente') RETURNING id`, [`esc-doc-${id}@utp.edu.pe`])).rows[0];
    const periodo = (await client.query(
      `INSERT INTO periodo_academico (codigo, fecha_inicio, fecha_fin, activo)
       VALUES ($1, CURRENT_DATE, CURRENT_DATE + 120, TRUE) RETURNING id`, [`E${id}`])).rows[0];

    const columnas = new Set((await client.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'curso'`)).rows.map((r) => r.column_name));
    const cols = ['periodo_id', 'docente_id', 'codigo', 'nombre', 'seccion', 'tolerancia_marcado_min', 'umbral_riesgo_pct'];
    const vals = [periodo.id, docente.id, `E${id}`, 'Curso de escaneo', '01', 15, 30];
    if (columnas.has('tolerancia_tardanza_min')) { cols.push('tolerancia_tardanza_min'); vals.push(15); }
    const curso = (await client.query(
      `INSERT INTO curso (${cols.join(', ')}) VALUES (${vals.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING id`, vals)).rows[0];

    const crearAlumno = async (sufijo, valorRostro) => {
      const u = (await client.query(
        `INSERT INTO usuario (correo, contrasena_hash, nombres, apellidos, rol)
         VALUES ($1, 'hash-de-prueba', 'Alumno', $2, 'alumno') RETURNING id`, [`esc-${sufijo}-${id}@utp.edu.pe`, sufijo])).rows[0];
      await client.query(`INSERT INTO alumno (usuario_id, codigo_alumno) VALUES ($1, $2)`, [u.id, `E${sufijo}${id}`.slice(0, 20)]);
      await client.query(`UPDATE alumno SET rostro_embedding = $1 WHERE usuario_id = $2`, [JSON.stringify(rostro(valorRostro)), u.id]);
      await client.query(`INSERT INTO matricula (curso_id, alumno_id, estado) VALUES ($1, $2, 'activa')`, [curso.id, u.id]);
      return u.id;
    };
    const ana = await crearAlumno('a', 0.1);   // llega puntual
    const beto = await crearAlumno('b', 0.1);  // su rostro NO coincidirá
    const carla = await crearAlumno('c', 0.1); // llega tarde

    // El docente abre la sesión y genera el QR vigente.
    const reqDocente = { user: { id: docente.id, rol: 'docente' }, body: { curso_id: curso.id }, params: {}, query: {}, app: { get: () => undefined } };
    let res = respuesta();
    await sesiones.abrirSesion(reqDocente, res);
    assert.ok([200, 201].includes(res.statusCode), res.body?.error);
    const sesionId = res.body.sesion.id;
    res = respuesta();
    reqDocente.body = { sesion_id: sesionId, duracion_segundos: 60 };
    await sesiones.generarQR(reqDocente, res);
    assert.equal(res.statusCode, 200, res.body?.error);
    const qr = JSON.parse(res.body.qr_code);

    const escanear = async (alumnoId, { token = qr.token, embedding = rostro(0.1) } = {}) => {
      const r = respuesta();
      await alumnos.registrarConQR({
        user: { id: alumnoId, rol: 'alumno' }, file: selfie,
        body: { qr: JSON.stringify({ sesion_id: sesionId, token }), embedding },
        app: { get: () => undefined },
      }, r);
      return r;
    };
    const guardada = async (alumnoId) => (await client.query(
      `SELECT estado, minutos_tardanza, origen FROM asistencia WHERE sesion_id = $1 AND alumno_id = $2`, [sesionId, alumnoId])).rows[0];

    // 1) QR vigente + rostro correcto → presente
    res = await escanear(ana);
    assert.equal(res.statusCode, 201, res.body?.error);
    assert.equal(res.body.estado, 'presente');
    assert.deepEqual(await guardada(ana), { estado: 'presente', minutos_tardanza: null, origen: 'qr_dinamico' });

    // 2) Segunda marcación del mismo alumno → 409
    res = await escanear(ana);
    assert.equal(res.statusCode, 409);

    // 3) Rostro distinto → 403 y no se guarda nada
    res = await escanear(beto, { embedding: rostro(0.9) });
    assert.equal(res.statusCode, 403);
    assert.equal(await guardada(beto), undefined);

    // 4) Token que no corresponde al QR actual → 400
    res = await escanear(beto, { token: 'token-falso' });
    assert.equal(res.statusCode, 400);

    // Un token con caracteres multibyte no debe producir un error interno.
    res = await escanear(beto, { token: 'ñ'.repeat(qr.token.length) });
    assert.equal(res.statusCode, 400);

    // 5) Llega después de la tolerancia (15 min) → tardanza con minutos
    await client.query(`UPDATE sesion_clase SET hora_inicio = now() - interval '40 minutes' WHERE id = $1`, [sesionId]);
    res = await escanear(carla);
    assert.equal(res.statusCode, 201, res.body?.error);
    assert.equal(res.body.estado, 'tardanza');
    const tarde = await guardada(carla);
    assert.equal(tarde.estado, 'tardanza');
    assert.ok(tarde.minutos_tardanza >= 24 && tarde.minutos_tardanza <= 26, `minutos_tardanza=${tarde.minutos_tardanza}`);

    // 6) QR vencido → 410
    await client.query(`UPDATE sesion_clase SET expira_en = now() - interval '1 second' WHERE id = $1`, [sesionId]);
    res = await escanear(beto);
    assert.equal(res.statusCode, 410);

    // El horario termina antes de que corra el job: tampoco se puede marcar.
    await client.query(`UPDATE sesion_clase SET expira_en = now() + interval '1 minute', hora_fin_programada = now() - interval '1 second' WHERE id = $1`, [sesionId]);
    res = await escanear(beto);
    assert.equal(res.statusCode, 410);

    // Cierre real: materializa faltas y los reportes conservan presente/tardanza/falta.
    res = respuesta();
    await sesiones.cerrarSesionManual({ ...reqDocente, params: { id: sesionId } }, res);
    assert.equal(res.statusCode, 200, res.body?.error);
    const { construirDatos } = require('../src/controllers/reporteController');
    const reporte = await construirDatos(curso.id, { desde: '', hasta: '' });
    assert.equal(reporte.sesiones.length, 1);
    assert.equal(reporte.alumnos.reduce((sum, a) => sum + a.presentes, 0), 1);
    assert.equal(reporte.alumnos.reduce((sum, a) => sum + a.tardanzas, 0), 1);
    assert.equal(reporte.alumnos.reduce((sum, a) => sum + a.faltas, 0), 1);
    const { calcularRiesgoCurso } = require('../src/services/riesgoService');
    const riesgo = await calcularRiesgoCurso(curso.id);
    assert.equal(riesgo.totalSesiones, 1);
    assert.equal(riesgo.alumnos.find((a) => a.id === beto).faltas, 1);
  } finally {
    if (iniciada) await client.query('ROLLBACK');
    pool.query = queryOriginal;
    pool.connect = connectOriginal;
    client.release();
  }
});
