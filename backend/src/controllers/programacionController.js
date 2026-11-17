const pool = require('../config/db');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validarHorario({ fecha, horaInicio, horaFin, motivo }) {
  if (typeof fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)
    || !Number.isFinite(Date.parse(fecha)) || new Date(fecha).toISOString().slice(0, 10) !== fecha
    || typeof horaInicio !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(horaInicio)
    || typeof horaFin !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(horaFin)) return 'La fecha y las horas no son válidas.';
  if (horaInicio >= horaFin) return 'La hora final debe ser posterior a la inicial, dentro del mismo día.';
  if (new Date(`${fecha}T${horaInicio}:00-05:00`) <= new Date()) return 'El horario debe ser futuro (hora de Lima).';
  if (typeof motivo !== 'string' || motivo.trim().length < 8 || motivo.trim().length > 1000) return 'Describe el motivo con 8 a 1000 caracteres.';
  return null;
}

const listarProgramaciones = async (req, res) => {
  if (!UUID.test(req.params.cursoId)) return res.status(400).json({ error: 'Curso inválido.' });
  try {
    const curso = await pool.query('SELECT docente_id FROM curso WHERE id=$1 AND eliminado_en IS NULL', [req.params.cursoId]);
    if (!curso.rowCount) return res.status(404).json({ error: 'Curso no encontrado.' });
    if (curso.rows[0].docente_id !== req.user.id) return res.status(403).json({ error: 'No tienes acceso a este curso.' });
    const { rows } = await pool.query(`SELECT id, to_char(fecha, 'YYYY-MM-DD') AS fecha,
      to_char(hora_inicio AT TIME ZONE 'America/Lima', 'HH24:MI') AS "horaInicio",
      to_char(hora_fin_programada AT TIME ZONE 'America/Lima', 'HH24:MI') AS "horaFin"
      FROM sesion_clase WHERE curso_id=$1 AND estado='programada' ORDER BY hora_inicio`, [req.params.cursoId]);
    res.json({ sesiones: rows });
  } catch (error) { console.error('Listar programaciones:', error); res.status(500).json({ error: 'No se pudieron consultar las clases.' }); }
};

const guardarProgramacion = async (req, res) => {
  const cursoId = req.params.cursoId;
  const { sesionId, fecha, horaInicio, horaFin, motivo } = req.body;
  if (!UUID.test(cursoId) || (sesionId !== undefined && !UUID.test(sesionId))) return res.status(400).json({ error: 'Identificador inválido.' });
  const invalido = validarHorario(req.body);
  if (invalido) return res.status(400).json({ error: invalido });
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    // Same lock as opening a session: serialize this teacher's overlapping schedules.
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`horario-docente:${req.user.id}`]);
    const { rows } = await client.query(`SELECT c.*, p.fecha_inicio, p.fecha_fin, p.activo,
      ($2::date BETWEEN p.fecha_inicio AND p.fecha_fin) AS dentro_periodo
      FROM curso c JOIN periodo_academico p ON p.id=c.periodo_id WHERE c.id=$1 AND c.eliminado_en IS NULL FOR UPDATE OF c`, [cursoId, fecha]);
    const curso = rows[0];
    const fail = async (status, error) => { await client.query('ROLLBACK'); return res.status(status).json({ error }); };
    if (!curso) return await fail(404, 'Curso no encontrado.');
    if (curso.docente_id !== req.user.id) return await fail(403, 'No tienes acceso a este curso.');
    if (!curso.activo || !curso.dentro_periodo) return await fail(400, 'La fecha debe pertenecer al periodo académico activo del curso.');
    let anterior = null;
    if (sesionId) {
      anterior = (await client.query('SELECT * FROM sesion_clase WHERE id=$1 AND curso_id=$2 FOR UPDATE', [sesionId, cursoId])).rows[0];
      if (!anterior) return await fail(404, 'Clase no encontrada en este curso.');
      if (anterior.estado !== 'programada') return await fail(409, 'Solo se reprograman clases pendientes; las activas y cerradas conservan su horario.');
      if ((await client.query('SELECT 1 FROM asistencia WHERE sesion_id=$1 LIMIT 1', [sesionId])).rowCount) return await fail(409, 'Una clase con asistencias no se puede reprogramar.');
    }
    const inicio = `${fecha}T${horaInicio}:00-05:00`, fin = `${fecha}T${horaFin}:00-05:00`;
    const conflictos = await client.query(`SELECT 1 FROM sesion_clase s JOIN curso c ON c.id=s.curso_id
      WHERE c.docente_id=$1 AND s.estado IN ('programada','activa') AND ($2::uuid IS NULL OR s.id<>$2)
      AND s.hora_inicio<$4::timestamptz AND s.hora_fin_programada>$3::timestamptz LIMIT 1`, [req.user.id, sesionId || null, inicio, fin]);
    if (conflictos.rowCount) return await fail(409, 'Tienes otra clase en ese horario. Elige un horario sin cruces.');
    let sesion;
    if (sesionId) {
      sesion = (await client.query(`UPDATE sesion_clase SET fecha=$2, hora_inicio=$3, hora_fin_programada=$4,
        actualizado_en=now(), actualizado_por=$5 WHERE id=$1 RETURNING *`, [sesionId, fecha, inicio, fin, req.user.id])).rows[0];
    } else {
      const legacy = await client.query(`SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema()
        AND table_name='sesion_clase' AND column_name='tolerancia_tardanza_min'`);
      sesion = (await client.query(`INSERT INTO sesion_clase (curso_id,fecha,hora_inicio,hora_fin_programada,estado,tolerancia_marcado_min,creado_por${legacy.rowCount ? ',tolerancia_tardanza_min' : ''})
        VALUES ($1,$2,$3,$4,'programada',$5,$6${legacy.rowCount ? ',$5' : ''}) RETURNING *`, [cursoId,fecha,inicio,fin,curso.tolerancia_marcado_min,req.user.id])).rows[0];
    }
    await client.query(`INSERT INTO bitacora_auditoria (usuario_id,accion,entidad,entidad_id,datos_antes,datos_despues)
      VALUES ($1,$2,'sesion_clase',$3,$4,$5)`, [req.user.id, sesionId ? 'actualizar' : 'crear',sesion.id,
      anterior ? JSON.stringify(anterior) : null,JSON.stringify({ ...sesion,motivo:motivo.trim(),operacion:sesionId ? 'reprogramar' : 'programar' })]);
    await client.query('COMMIT');
    res.status(sesionId ? 200 : 201).json({ sesion, mensaje: sesionId ? 'Clase reprogramada. El cambio quedó en la auditoría.' : 'Clase programada.' });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('Guardar programación:', error);
    res.status(500).json({ error: 'No se pudo guardar la programación.' });
  } finally { client?.release(); }
};

module.exports = { listarProgramaciones, guardarProgramacion, validarHorario };
