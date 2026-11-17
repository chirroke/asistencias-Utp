const pool = require('../config/db');
const { validateSelfieSignature } = require('../middleware/uploadEvidence');
const crypto = require('crypto');
const { validateEvidenceSignature } = require('../middleware/uploadEvidence');

const leerEmbedding = (value) => {
  try {
    const embedding = typeof value === 'string' ? JSON.parse(value) : value;
    if (!Array.isArray(embedding) || embedding.length !== 128 || embedding.some((n) => !Number.isFinite(n) || n < -1 || n > 1)) return null;
    return embedding;
  } catch { return null; }
};

// Marca como tardanza a quien escanea después de la tolerancia contada desde el inicio de la sesión.
const clasificarMarcacion = (horaInicio, toleranciaMin, ahora = Date.now()) => {
  const minutosDesdeInicio = Math.floor((ahora - new Date(horaInicio).getTime()) / 60000);
  const minutosTarde = Math.max(0, minutosDesdeInicio - Number(toleranciaMin || 0));
  return { estado: minutosTarde > 0 ? 'tardanza' : 'presente', minutosTarde };
};

const registrarRostroAlumno = async (req, res) => {
  if (!validateSelfieSignature(req.file)) return res.status(400).json({ error: 'Toma una foto JPEG válida de tu rostro.' });
  const embedding = leerEmbedding(req.body.embedding);
  if (!embedding) return res.status(400).json({ error: 'No se pudo validar el patrón facial. Reinicia la cámara y vuelve a capturar.' });
  try {
    const result = await pool.query(
      `UPDATE alumno SET foto_referencia = $1, rostro_embedding = $2, rostro_modelo = $3,
                         rostro_actualizado_en = now()
       WHERE usuario_id = $4 RETURNING usuario_id`,
      [req.file.buffer, JSON.stringify(embedding), 'face-api-1.7.15', req.user.id]
    );
    if (!result.rowCount) return res.status(404).json({ error: 'No existe un perfil de alumno para esta cuenta.' });
    res.json({ message: 'Foto y patrón facial registrados. Ya puedes marcar asistencia con QR.', embeddingRegistrado: true });
  } catch (error) {
    console.error('Error al guardar referencia facial:', error.message);
    res.status(500).json({ error: 'No se pudo guardar tu foto. Verifica que la migración biométrica esté aplicada.' });
  }
};

// Si la migración de alertas aún no se aplicó, el panel del alumno sigue funcionando sin ellas.
const obtenerAlertasAlumno = async (alumnoId) => {
  try {
    const { rows } = await pool.query(
      `SELECT ar.id, ar.nivel::text AS nivel, ar.porcentaje_asistencia::float AS porcentaje_asistencia,
              ar.umbral_aplicado::float AS umbral_aplicado, ar.leida, ar.generada_en,
              c.codigo, c.nombre AS curso, c.seccion
       FROM alerta_riesgo ar JOIN curso c ON c.id = ar.curso_id
       WHERE ar.alumno_id = $1 AND c.eliminado_en IS NULL
       ORDER BY ar.generada_en DESC LIMIT 20`, [alumnoId]);
    return rows;
  } catch (error) {
    console.error('No se pudieron leer las alertas del alumno:', error.message);
    return [];
  }
};

const marcarAlertasLeidas = async (req, res) => {
  const { id } = req.params;
  if (id && !/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ error: 'Identificador de alerta inválido.' });
  try {
    const { rowCount } = await pool.query(
      `UPDATE alerta_riesgo SET leida = TRUE, leida_en = now()
       WHERE alumno_id = $1 AND leida = FALSE AND ($2::uuid IS NULL OR id = $2::uuid)`, [req.user.id, id || null]);
    res.json({ actualizadas: rowCount });
  } catch (error) {
    console.error('Error al marcar alertas como leídas:', error.message);
    res.status(500).json({ error: 'No se pudo actualizar la alerta.' });
  }
};

const obtenerResumen = async (req, res) => {
  try {
    const alumno = await pool.query(
      `SELECT u.nombres, u.apellidos, al.codigo_alumno
       FROM usuario u JOIN alumno al ON al.usuario_id = u.id WHERE u.id = $1 AND u.activo = TRUE`, [req.user.id]
    );
    if (!alumno.rowCount) return res.status(404).json({ error: 'No existe el perfil de alumno para esta cuenta.' });
    const { rows: cursos } = await pool.query(
      `SELECT c.id, c.codigo, c.nombre, c.seccion, d.nombres || ' ' || d.apellidos AS docente,
              activa.id AS sesion_activa_id, activa.fecha AS sesion_activa_fecha,
              COALESCE(hist.total_clases, 0)::int AS total_clases,
              COALESCE(hist.presentes, 0)::int AS presentes,
              COALESCE(hist.faltas, 0)::int AS faltas,
              COALESCE(hist.justificadas, 0)::int AS justificadas
       FROM matricula m JOIN curso c ON c.id = m.curso_id
       LEFT JOIN usuario d ON d.id = c.docente_id
       LEFT JOIN LATERAL (
         SELECT s.id, s.fecha FROM sesion_clase s WHERE s.curso_id = c.id AND s.estado = 'activa'
         ORDER BY s.hora_inicio DESC LIMIT 1
       ) activa ON TRUE
       LEFT JOIN LATERAL (
         SELECT COUNT(DISTINCT s.id) FILTER (WHERE s.estado = 'cerrada') AS total_clases,
                COUNT(a.id) FILTER (WHERE a.estado IN ('presente', 'tardanza')) AS presentes,
                COUNT(a.id) FILTER (WHERE a.estado = 'falta') AS faltas,
                COUNT(a.id) FILTER (WHERE a.estado = 'justificada') AS justificadas
         FROM sesion_clase s LEFT JOIN asistencia a ON a.sesion_id = s.id AND a.alumno_id = m.alumno_id
         WHERE s.curso_id = c.id AND s.estado = 'cerrada'
       ) hist ON TRUE
       WHERE m.alumno_id = $1 AND m.estado = 'activa' AND c.eliminado_en IS NULL
       ORDER BY c.nombre`, [req.user.id]
    );
    const totales = cursos.reduce((sum, curso) => ({
      clases: sum.clases + curso.total_clases,
      presentes: sum.presentes + curso.presentes,
      faltas: sum.faltas + curso.faltas,
      justificadas: sum.justificadas + curso.justificadas,
    }), { clases: 0, presentes: 0, faltas: 0, justificadas: 0 });
    const { rows: solicitudes } = await pool.query(
      `SELECT j.id, j.motivo, j.estado, j.creado_en, j.archivo_nombre,
              c.nombre AS curso, s.fecha AS fecha_sesion
       FROM justificacion j JOIN curso c ON c.id = j.curso_id
       LEFT JOIN justificacion_asistencia ja ON ja.justificacion_id = j.id
       LEFT JOIN asistencia a ON a.id = ja.asistencia_id
       LEFT JOIN sesion_clase s ON s.id = a.sesion_id
      WHERE j.alumno_id = $1 ORDER BY j.creado_en DESC LIMIT 10`, [req.user.id]
    );
    const { rows: historial } = await pool.query(
      `SELECT a.id AS asistencia_id, a.estado, a.registrado_en,
              s.id AS sesion_id, s.fecha, s.hora_inicio,
              c.id AS curso_id, c.nombre AS curso, c.codigo, c.seccion
       FROM asistencia a
       JOIN sesion_clase s ON s.id = a.sesion_id
       JOIN curso c ON c.id = s.curso_id
       WHERE a.alumno_id = $1 AND s.estado = 'cerrada'
       ORDER BY s.fecha DESC, s.hora_inicio DESC
       LIMIT 60`, [req.user.id]
    );
    const { rows: faltasJustificables } = await pool.query(
      `SELECT a.id AS asistencia_id, s.fecha, c.id AS curso_id, c.nombre AS curso, c.seccion
       FROM asistencia a JOIN sesion_clase s ON s.id = a.sesion_id JOIN curso c ON c.id = s.curso_id
       WHERE a.alumno_id = $1 AND a.estado = 'falta' AND s.estado = 'cerrada'
         AND NOT EXISTS (
           SELECT 1 FROM justificacion_asistencia ja JOIN justificacion j ON j.id = ja.justificacion_id
           WHERE ja.asistencia_id = a.id AND j.estado = 'pendiente'
         ) ORDER BY s.fecha DESC LIMIT 20`, [req.user.id]
    );
    res.json({
      alumno: { ...alumno.rows[0], codigo: alumno.rows[0].codigo_alumno },
      resumen: { ...totales, porcentajeFaltas: totales.clases ? Math.round(totales.faltas * 1000 / totales.clases) / 10 : 0 },
      cursos,
      justificaciones: solicitudes,
      faltasJustificables,
      historial,
      alertas: await obtenerAlertasAlumno(req.user.id),
    });
  } catch (error) {
    console.error('Error al obtener el dashboard del alumno:', error.message);
    res.status(500).json({ error: 'No se pudo cargar el panel del alumno.' });
  }
};

const registrarConQR = async (req, res) => {
  const selfie = req.file;
  if (!validateSelfieSignature(selfie)) {
    return res.status(400).json({ error: 'Toma una selfie JPEG para confirmar tu marcación.' });
  }
  const embeddingCapturado = leerEmbedding(req.body.embedding);
  if (!embeddingCapturado) return res.status(400).json({ error: 'No se pudo analizar tu rostro. Asegúrate de que la cámara te detecte antes de marcar.' });
  let payload;
  try { payload = typeof req.body.qr === 'string' ? JSON.parse(req.body.qr) : req.body.qr; }
  catch { return res.status(400).json({ error: 'El contenido del QR no es válido.' }); }
  if (!payload?.sesion_id || typeof payload.token !== 'string') {
    return res.status(400).json({ error: 'El QR no contiene una sesión y token válidos.' });
  }
  if (typeof payload.sesion_id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(payload.sesion_id)) {
    return res.status(400).json({ error: 'El QR no contiene un identificador de sesión válido.' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT s.id, s.curso_id, s.fecha, s.token_qr, s.expira_en, s.estado, s.hora_inicio, s.hora_fin_programada,
              COALESCE(s.tolerancia_marcado_min, c.tolerancia_marcado_min, 0) AS tolerancia_min,
              c.nombre AS curso, c.seccion
       FROM sesion_clase s JOIN curso c ON c.id = s.curso_id
       JOIN periodo_academico p ON p.id = c.periodo_id AND p.activo = TRUE
       WHERE s.id = $1 FOR UPDATE OF s`, [payload.sesion_id]
    );
    if (!rows.length || rows[0].estado !== 'activa' || !rows[0].expira_en || new Date(rows[0].expira_en) <= new Date()
      || new Date(rows[0].hora_fin_programada) <= new Date()) {
      await client.query('ROLLBACK');
      return res.status(410).json({ error: 'El QR venció o la sesión ya fue cerrada. Pide al docente que proyecte el QR vigente.' });
    }
    const saved = rows[0].token_qr || '';
    const received = payload.token;
    const savedBytes = Buffer.from(saved);
    const receivedBytes = Buffer.from(received);
    const matches = savedBytes.length === receivedBytes.length && crypto.timingSafeEqual(savedBytes, receivedBytes);
    if (!matches) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'El QR ya no es válido. Escanea el código actual.' });
    }
    const enrollment = await client.query(
      `SELECT 1 FROM matricula WHERE curso_id = $1 AND alumno_id = $2 AND estado = 'activa'`,
      [rows[0].curso_id, req.user.id]
    );
    if (!enrollment.rowCount) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'No estás matriculado en este curso.' });
    }
    const faceResult = await client.query('SELECT rostro_embedding FROM alumno WHERE usuario_id = $1', [req.user.id]);
    const embeddingGuardado = faceResult.rows[0]?.rostro_embedding ? leerEmbedding(faceResult.rows[0].rostro_embedding) : null;
    if (!embeddingGuardado) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Primero registra tu foto facial desde Perfil → Seguridad biométrica.' });
    }
    const distance = Math.sqrt(embeddingGuardado.reduce((sum, value, index) => sum + (value - embeddingCapturado[index]) ** 2, 0));
    const threshold = Number(process.env.FACE_MATCH_THRESHOLD || 0.6);
    if (distance > threshold) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'El rostro no coincide con el que registraste. Vuelve a intentar con buena luz o solicita marcación manual al docente.' });
    }
    const score = Math.max(0, Math.min(1, 1 - distance));
    const { estado: estadoMarcado, minutosTarde } = clasificarMarcacion(rows[0].hora_inicio, rows[0].tolerancia_min);
    const attendance = await client.query(
      `INSERT INTO asistencia (sesion_id, alumno_id, estado, origen, foto_marcacion, puntaje_facial, minutos_tardanza)
       VALUES ($1, $2, $3, 'qr_dinamico', $4, $5, $6)
       ON CONFLICT (sesion_id, alumno_id) DO NOTHING RETURNING id, registrado_en`,
      [rows[0].id, req.user.id, estadoMarcado, selfie.buffer, score, minutosTarde || null]
    );
    if (!attendance.rowCount) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Tu asistencia ya fue registrada para esta sesión.' });
    }
    await client.query('COMMIT');
    const wss = req.app.get('wss');
    if (wss) for (const socket of wss.clients) {
      if (socket.readyState === 1 && socket.sesionId === rows[0].id) socket.send(JSON.stringify({ type: 'asistencia_actualizada', sesionId: rows[0].id }));
    }
    res.status(201).json({
      message: estadoMarcado === 'tardanza' ? `Asistencia registrada con tardanza (${minutosTarde} min).` : 'Asistencia registrada.',
      estado: estadoMarcado,
      minutos_tardanza: minutosTarde,
      curso: rows[0].curso, seccion: rows[0].seccion, registrado_en: attendance.rows[0].registrado_en,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al registrar asistencia con QR:', error.message);
    res.status(500).json({ error: 'No se pudo registrar la asistencia.' });
  } finally {
    client.release();
  }
};

const enviarJustificacion = async (req, res) => {
  const { asistencia_id, motivo } = req.body;
  const file = req.file;
  if (!asistencia_id || typeof motivo !== 'string' || motivo.trim().length < 5) {
    return res.status(400).json({ error: 'Indica la inasistencia y describe el motivo (mínimo 5 caracteres).' });
  }
  if (!file) return res.status(400).json({ error: 'Adjunta una evidencia en PDF o imagen (JPG/PNG).' });
  if (!validateEvidenceSignature(file)) return res.status(400).json({ error: 'El archivo no coincide con el tipo PDF o imagen declarado.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const attendance = await client.query(
      `SELECT a.id, a.estado, a.sesion_id, s.curso_id, s.fecha, s.estado AS estado_sesion
       FROM asistencia a JOIN sesion_clase s ON s.id = a.sesion_id
       WHERE a.id = $1 AND a.alumno_id = $2 FOR UPDATE OF a`, [asistencia_id, req.user.id]
    );
    if (!attendance.rowCount || attendance.rows[0].estado !== 'falta' || attendance.rows[0].estado_sesion !== 'cerrada') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Solo puedes justificar una falta de una sesión cerrada.' });
    }
    const duplicate = await client.query(
      `SELECT 1 FROM justificacion_asistencia ja JOIN justificacion j ON j.id = ja.justificacion_id
       WHERE ja.asistencia_id = $1 AND j.estado = 'pendiente'`, [asistencia_id]
    );
    if (duplicate.rowCount) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Ya enviaste una justificación para esta falta.' });
    }
    const inserted = await client.query(
      `INSERT INTO justificacion
         (alumno_id, curso_id, motivo, fecha_inicio, fecha_fin, estado, archivo_nombre, archivo_mime, archivo_contenido, creado_por)
       VALUES ($1, $2, $3, $4, $4, 'pendiente', $5, $6, $7, $1) RETURNING id`,
      [req.user.id, attendance.rows[0].curso_id, motivo.trim(), attendance.rows[0].fecha,
        file.originalname.replace(/[\r\n"\\]/g, '_').slice(0, 200), file.mimetype, file.buffer]
    );
    await client.query(
      'INSERT INTO justificacion_asistencia (justificacion_id, asistencia_id) VALUES ($1, $2)',
      [inserted.rows[0].id, attendance.rows[0].id]
    );
    await client.query('COMMIT');
    res.status(201).json({ message: 'Justificación enviada para revisión.', id: inserted.rows[0].id });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al enviar justificación:', error.message);
    res.status(500).json({ error: 'No se pudo enviar la justificación.' });
  } finally {
    client.release();
  }
};

module.exports = { obtenerResumen, registrarConQR, registrarRostroAlumno, enviarJustificacion, clasificarMarcacion, marcarAlertasLeidas };
