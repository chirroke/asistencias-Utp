const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const pool = require('../src/config/db');
const controller = require('../src/controllers/sesionController');

after(async () => pool.end());

const respuesta = () => ({
  statusCode: 200,
  body: undefined,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

test('flujo docente: sesión, QR, WebSocket, asistencia manual, historial y cierre', async () => {
  const client = await pool.connect();
  const queryOriginal = pool.query.bind(pool);
  const connectOriginal = pool.connect.bind(pool);
  const traducir = (sql) => {
    if (typeof sql !== 'string') return sql;
    if (/^\s*BEGIN\s*$/i.test(sql)) return 'SAVEPOINT docente_test';
    if (/^\s*COMMIT\s*$/i.test(sql)) return 'RELEASE SAVEPOINT docente_test';
    if (/^\s*ROLLBACK\s*$/i.test(sql)) return 'ROLLBACK TO SAVEPOINT docente_test';
    return sql;
  };
  let transactionStarted = false;

  try {
    await client.query('BEGIN');
    transactionStarted = true;
    pool.query = (sql, params) => client.query(traducir(sql), params);
    pool.connect = async () => ({ query: (sql, params) => client.query(traducir(sql), params), release() {} });

    const testId = crypto.randomUUID().replaceAll('-', '').slice(0, 8);
    const docente = await client.query(
      `INSERT INTO usuario (correo, contrasena_hash, nombres, apellidos, rol)
       VALUES ($1, 'integration-test-hash', 'Docente', 'Temporal', 'docente') RETURNING id`,
      [`integration-${testId}@utp.edu.pe`]
    );
    const periodo = await client.query(
      `INSERT INTO periodo_academico (codigo, fecha_inicio, fecha_fin, activo)
       VALUES ($1, CURRENT_DATE, CURRENT_DATE + 120, TRUE) RETURNING id`,
      [`T${testId}`]
    );

    const courseSchema = await client.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = current_schema() AND table_name = 'curso'`
    );
    const availableCourseColumns = new Set(courseSchema.rows.map((row) => row.column_name));
    const courseColumns = ['periodo_id', 'docente_id', 'codigo', 'nombre', 'seccion', 'tolerancia_marcado_min', 'umbral_riesgo_pct'];
    const courseValues = [periodo.rows[0].id, docente.rows[0].id, `T${testId}`, 'Curso de integración', '01', 15, 30];
    if (availableCourseColumns.has('tolerancia_tardanza_min')) {
      courseColumns.push('tolerancia_tardanza_min');
      courseValues.push(15);
    }
    const courseParams = courseValues.map((_, i) => `$${i + 1}`).join(', ');
    const curso = await client.query(
      `INSERT INTO curso (${courseColumns.join(', ')}) VALUES (${courseParams}) RETURNING id`,
      courseValues
    );
    const alumnoUser = await client.query(
      `INSERT INTO usuario (correo, contrasena_hash, nombres, apellidos, rol)
       VALUES ($1, 'integration-test-hash', 'Alumno', 'Temporal', 'alumno') RETURNING id`,
      [`integration-alumno-${testId}@utp.edu.pe`]
    );
    await client.query(
      `INSERT INTO alumno (usuario_id, codigo_alumno) VALUES ($1, $2)`,
      [alumnoUser.rows[0].id, `T${testId}`]
    );
    await client.query(
      `INSERT INTO matricula (curso_id, alumno_id, estado) VALUES ($1, $2, 'activa')`,
      [curso.rows[0].id, alumnoUser.rows[0].id]
    );

    const eventos = [];
    const socket = { readyState: 1, sesionId: null, send: (message) => eventos.push(JSON.parse(message)) };
    const req = {
      user: { id: docente.rows[0].id, rol: 'docente' },
      body: { curso_id: curso.rows[0].id },
      params: {}, query: {},
      app: { get: () => ({ clients: new Set([socket]) }) },
    };

    let res = respuesta();
    await controller.abrirSesion(req, res);
    assert.ok([200, 201].includes(res.statusCode), res.body?.error);
    const sesionId = res.body.sesion.id;
    socket.sesionId = sesionId;

    res = respuesta();
    req.body = { sesion_id: sesionId, duracion_segundos: 20 };
    await controller.generarQR(req, res);
    assert.equal(res.statusCode, 200, res.body?.error);
    assert.equal(JSON.parse(res.body.qr_code).sesion_id, sesionId);

    res = respuesta();
    req.params = { id: sesionId };
    await controller.emitirTicketWebSocket(req, res);
    assert.ok(res.body.ticket);

    res = respuesta();
    req.body = { sesion_id: sesionId, alumno_id: alumnoUser.rows[0].id, motivo: 'Prueba' };
    await controller.registrarManual(req, res);
    assert.equal(res.statusCode, 201, res.body?.error);
    assert.equal(eventos.at(-1)?.sesionId, sesionId);

    res = respuesta();
    await controller.obtenerAsistenciaVivo(req, res);
    assert.equal(res.statusCode, 200, res.body?.error);
    assert.equal(res.body.alumnos.find((a) => a.id === alumnoUser.rows[0].id).estado, 'presente');

    res = respuesta();
    req.params = { cursoId: curso.rows[0].id };
    req.query = {};
    await controller.obtenerHistorialCurso(req, res);
    assert.equal(res.statusCode, 200, res.body?.error);
    assert.ok(res.body.sesiones.some((sesion) => sesion.id === sesionId));

    res = respuesta();
    req.params = { id: sesionId };
    await controller.obtenerDetalleSesion(req, res);
    assert.equal(res.statusCode, 200, res.body?.error);
    assert.equal(res.body.alumnos[0].estado, 'presente');

    res = respuesta();
    req.body = { sesion_id: sesionId, motivo: 'Prueba transaccional' };
    await controller.checkinDocente(req, res);
    assert.equal(res.statusCode, 201, res.body?.error);

    res = respuesta();
    await controller.cerrarSesionManual({ ...req, params: { id: sesionId } }, res);
    assert.equal(res.statusCode, 200, res.body?.error);

    // Programar, mover, validar acceso/cruces y abrir respetando el horario.
    const programacion = require('../src/controllers/programacionController');
    const manana = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const base = { fecha: manana, horaInicio: '08:00', horaFin: '10:00', motivo: 'Cambio de horario por actividad académica' };
    const programarReq = { user: req.user, params: { cursoId: curso.rows[0].id }, body: base };
    res = respuesta();
    await programacion.guardarProgramacion(programarReq, res);
    assert.equal(res.statusCode, 201, res.body?.error);
    const programadaId = res.body.sesion.id;
    res = respuesta();
    await programacion.guardarProgramacion(programarReq, res);
    assert.equal(res.statusCode, 409, 'rechaza horarios superpuestos');
    res = respuesta();
    await programacion.guardarProgramacion({ ...programarReq, user: { id: alumnoUser.rows[0].id }, body: { ...base, sesionId: programadaId } }, res);
    assert.equal(res.statusCode, 403, 'rechaza otro propietario');
    res = respuesta();
    await programacion.guardarProgramacion({ ...programarReq, body: { ...base, sesionId, horaInicio: '12:00', horaFin: '14:00' } }, res);
    assert.equal(res.statusCode, 409, 'conserva la sesión cerrada');
    res = respuesta();
    await programacion.guardarProgramacion({ ...programarReq, body: { ...base, sesionId: programadaId, horaInicio: '10:00', horaFin: '12:00' } }, res);
    assert.equal(res.statusCode, 200, res.body?.error);
    const auditoria = (await client.query("SELECT datos_antes,datos_despues FROM bitacora_auditoria WHERE entidad_id=$1 AND accion='actualizar'", [programadaId])).rows;
    assert.equal(auditoria.length, 1);
    assert.equal(auditoria[0].datos_despues.operacion, 'reprogramar');
    assert.notEqual(auditoria[0].datos_antes.hora_inicio, auditoria[0].datos_despues.hora_inicio);
    res = respuesta();
    await controller.abrirSesion({ ...req, body: { curso_id: curso.rows[0].id } }, res);
    assert.equal(res.statusCode, 409, 'no permite abrir antes del horario');
    await client.query("UPDATE sesion_clase SET hora_inicio=now()-interval '5 minutes',hora_fin_programada=now()+interval '55 minutes' WHERE id=$1", [programadaId]);
    res = respuesta();
    await controller.abrirSesion({ ...req, body: { curso_id: curso.rows[0].id } }, res);
    assert.equal(res.statusCode, 200, res.body?.error);
    assert.equal(res.body.sesion.id, programadaId, 'activa la misma sesión programada');
    assert.equal(res.body.sesion.estado, 'activa');
    res = respuesta();
    await programacion.guardarProgramacion({ ...programarReq, body: { ...base, sesionId: programadaId } }, res);
    assert.equal(res.statusCode, 409, 'no mueve sesiones activas');

    // General report counts real records once, including withdrawn students.
    const { construirGeneral, descargarGeneral } = require('../src/controllers/reporteGeneralController');
    await client.query("UPDATE matricula SET estado='retirada' WHERE curso_id=$1 AND alumno_id=$2", [curso.rows[0].id,alumnoUser.rows[0].id]);
    const general = await construirGeneral({ cursoId: curso.rows[0].id });
    assert.equal(general.alumnos.length, 1);
    assert.equal(general.alumnos[0].sesiones, 1);
    assert.equal(general.alumnos[0].presentes, 1);
    assert.equal(general.alumnos[0].asistencia, 1);
    const vacio = await construirGeneral({ cursoId: curso.rows[0].id, desde: manana });
    assert.equal(vacio.alumnos[0].sesiones, 0);
    assert.equal(vacio.alumnos[0].asistencia, 0);
    for (const formato of ['pdf','xlsx']) {
      const download = { ...respuesta(), set(headers) { this.headers=headers; }, end(data) { this.data=data; } };
      await descargarGeneral({ user: { rol:'admin' }, query: { cursoId: curso.rows[0].id, formato } }, download);
      assert.equal(download.statusCode, 200, download.body?.error);
      assert.equal(download.data.subarray(0, formato==='pdf' ? 5 : 2).toString(), formato==='pdf' ? '%PDF-' : 'PK');
    }
    res = respuesta();
    await descargarGeneral({ user: { rol:'docente' }, query: {} }, res);
    assert.equal(res.statusCode, 403);
    res = respuesta();
    await descargarGeneral({ user: { rol:'admin' }, query: { desde:'2026-02-30' } }, res);
    assert.equal(res.statusCode, 400);
  } finally {
    if (transactionStarted) await client.query('ROLLBACK');
    pool.query = queryOriginal;
    pool.connect = connectOriginal;
    client.release();
  }
});
