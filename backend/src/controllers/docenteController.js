const pool = require('../config/db');
const { validateEvidenceSignature } = require('../middleware/uploadEvidence');

const reportarIncidencia = async (req, res) => {
  const { sesion_id, tipo, descripcion } = req.body;
  const file = req.file;
  const tipos = ['falla_pc', 'problema_red', 'otro'];
  if (!sesion_id || !tipos.includes(tipo) || typeof descripcion !== 'string' || descripcion.trim().length < 5) {
    return res.status(400).json({ error: 'Completa el tipo y la descripción de la incidencia.' });
  }
  if (!file || !validateEvidenceSignature(file)) {
    return res.status(400).json({ error: 'Adjunta una evidencia válida en PDF, JPG o PNG (máximo 5 MB).' });
  }
  try {
    const session = await pool.query(
      `SELECT s.id FROM sesion_clase s JOIN curso c ON c.id = s.curso_id
       WHERE s.id = $1 AND s.estado = 'activa' AND c.docente_id = $2`, [sesion_id, req.user.id]
    );
    if (!session.rowCount) return res.status(404).json({ error: 'No hay una sesión activa tuya para asociar esta incidencia.' });
    const { rows } = await pool.query(
      `INSERT INTO incidencia_docente
         (docente_id, sesion_id, tipo, descripcion, archivo_nombre, archivo_mime, archivo_contenido)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, creado_en, estado`,
      [req.user.id, sesion_id, tipo, descripcion.trim(), file.originalname.replace(/[\r\n"\\]/g, '_').slice(0, 200), file.mimetype, file.buffer]
    );
    res.status(201).json({ message: 'Incidencia enviada al administrador para verificación.', incidencia: rows[0] });
  } catch (error) {
    console.error('Error al reportar incidencia docente:', error.message);
    res.status(500).json({ error: 'No se pudo enviar la incidencia.' });
  }
};

const { calcularRiesgoCurso } = require('../services/riesgoService');

// Calcula el riesgo actual de alumnos matriculados en cursos del período activo del docente.
const obtenerAlumnosEnRiesgo = async (req, res) => {
  try {
    const cursos = await pool.query(
      `SELECT c.id FROM curso c JOIN periodo_academico p ON p.id = c.periodo_id AND p.activo = TRUE
       WHERE c.docente_id = $1 AND c.eliminado_en IS NULL ORDER BY c.nombre, c.seccion`, [req.user.id]);
    const alumnos = [];
    for (const { id } of cursos.rows) {
      const situacion = await calcularRiesgoCurso(id);
      if (!situacion) continue;
      for (const alumno of situacion.alumnos.filter((item) => item.nivel)) {
        alumnos.push({
          curso_id: id,
          curso: situacion.curso.nombre,
          codigo_curso: situacion.curso.codigo,
          seccion: situacion.curso.seccion,
          alumno_id: alumno.id,
          nombre: `${alumno.apellidos}, ${alumno.nombres}`,
          codigo: alumno.codigo,
          faltas: alumno.faltas,
          sesiones: situacion.totalSesiones,
          porcentaje_faltas: alumno.porcentajeFaltas,
          nivel: alumno.nivel,
          limite_critico: alumno.criticoPct,
        });
      }
    }
    alumnos.sort((a, b) => (a.nivel === b.nivel ? b.porcentaje_faltas - a.porcentaje_faltas : a.nivel === 'critico' ? -1 : 1));
    res.json({ alumnos });
  } catch (error) {
    console.error('Error al calcular alumnos en riesgo:', error.message);
    res.status(500).json({ error: 'No se pudo calcular el riesgo de tus alumnos.' });
  }
};

module.exports = { reportarIncidencia, obtenerAlumnosEnRiesgo };
