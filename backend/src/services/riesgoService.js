const pool = require('../config/db');
const { clasificarRiesgo } = require('../utils/riesgo');

/** Situación actual de cada alumno matriculado en un curso (calculada al momento). */
const calcularRiesgoCurso = async (cursoId) => {
  const curso = await pool.query(
    'SELECT id, codigo, nombre, seccion, umbral_riesgo_pct FROM curso WHERE id = $1 AND eliminado_en IS NULL', [cursoId]);
  if (!curso.rowCount) return null;
  const total = (await pool.query(
    `SELECT COUNT(*)::int AS total FROM sesion_clase WHERE curso_id = $1 AND estado = 'cerrada'`, [cursoId])).rows[0].total;
  const { rows } = await pool.query(
    `SELECT u.id, u.nombres, u.apellidos, al.codigo_alumno AS codigo,
            COUNT(a.id) FILTER (WHERE a.estado = 'falta')::int AS faltas
     FROM matricula m
     JOIN usuario u ON u.id = m.alumno_id
     JOIN alumno al ON al.usuario_id = u.id
     LEFT JOIN sesion_clase s ON s.curso_id = m.curso_id AND s.estado = 'cerrada'
     LEFT JOIN asistencia a ON a.sesion_id = s.id AND a.alumno_id = m.alumno_id
     WHERE m.curso_id = $1 AND m.estado = 'activa'
     GROUP BY u.id, u.nombres, u.apellidos, al.codigo_alumno
     ORDER BY u.apellidos, u.nombres`, [cursoId]);
  const alumnos = rows.map((a) => ({ ...a, ...clasificarRiesgo(a.faltas, total, curso.rows[0].umbral_riesgo_pct) }));
  return { curso: curso.rows[0], totalSesiones: total, alumnos };
};

/**
 * Se llama al cerrar una sesión. Guarda una alerta cuando el alumno entra a un nivel nuevo
 * (una por alumno, curso y nivel: así no se repite en cada clase). Nunca debe romper el cierre.
 */
const evaluarRiesgoCurso = async (cursoId) => {
  try {
    const situacion = await calcularRiesgoCurso(cursoId);
    if (!situacion) return [];
    const enRiesgo = situacion.alumnos.filter((a) => a.nivel);
    if (!enRiesgo.length) return [];
    const previas = await pool.query('SELECT alumno_id, nivel::text AS nivel FROM alerta_riesgo WHERE curso_id = $1', [cursoId]);
    const yaExiste = new Set(previas.rows.map((p) => `${p.alumno_id}|${p.nivel}`));
    const nuevas = [];
    for (const a of enRiesgo) {
      if (yaExiste.has(`${a.id}|${a.nivel}`)) continue;
      const umbral = a.nivel === 'critico' ? a.criticoPct : a.advertenciaPct;
      await pool.query(
        `INSERT INTO alerta_riesgo (alumno_id, curso_id, nivel, porcentaje_asistencia, umbral_aplicado)
         VALUES ($1, $2, $3::nivel_alerta, $4, $5) ON CONFLICT DO NOTHING`,
        [a.id, cursoId, a.nivel, Math.max(0, Math.min(100, 100 - a.porcentajeFaltas)), umbral]
      );
      nuevas.push({ alumnoId: a.id, nivel: a.nivel });
    }
    return nuevas;
  } catch (error) {
    console.error('No se pudieron evaluar las alertas de riesgo:', error.message);
    return [];
  }
};

module.exports = { calcularRiesgoCurso, evaluarRiesgoCurso };
