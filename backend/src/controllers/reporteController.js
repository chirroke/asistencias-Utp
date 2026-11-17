// Reporte de asistencia por curso en Excel (.xlsx) o PDF.
const pool = require('../config/db');
const { generarXlsx } = require('../utils/reporteXlsx');
const { generarPdf } = require('../utils/reportePdf');
const { clasificarRiesgo } = require('../utils/riesgo');

const FORMATOS = {
  xlsx: { tipo: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', generar: generarXlsx },
  pdf: { tipo: 'application/pdf', generar: generarPdf },
};
const MAX_SESIONES = 120;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const esFechaValida = (valor) => typeof valor === 'string' && FECHA.test(valor)
  && !Number.isNaN(Date.parse(valor)) && new Date(valor).toISOString().slice(0, 10) === valor;

const nombreArchivoSeguro = (texto) => String(texto).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');

/** Reúne los datos del curso y calcula los totales por alumno. */
const construirDatos = async (cursoId, { desde, hasta }) => {
  const curso = await pool.query(
    `SELECT c.id, c.codigo, c.nombre, c.seccion, c.docente_id, c.umbral_riesgo_pct,
            TRIM(CONCAT(u.nombres, ' ', u.apellidos)) AS docente, p.codigo AS periodo
     FROM curso c
     LEFT JOIN usuario u ON u.id = c.docente_id
     LEFT JOIN periodo_academico p ON p.id = c.periodo_id
     WHERE c.id = $1 AND c.eliminado_en IS NULL`, [cursoId]);
  if (!curso.rowCount) return null;
  const c = curso.rows[0];

  // Solo sesiones cerradas: en las abiertas todavía no se marcaron las faltas.
  const sesiones = (await pool.query(
    `SELECT id, to_char(fecha, 'YYYY-MM-DD') AS fecha
     FROM sesion_clase
     WHERE curso_id = $1 AND estado = 'cerrada'
       AND ($2::date IS NULL OR fecha >= $2::date) AND ($3::date IS NULL OR fecha <= $3::date)
     ORDER BY fecha, hora_inicio
     LIMIT ${MAX_SESIONES + 1}`, [cursoId, desde || null, hasta || null])).rows;
  if (sesiones.length > MAX_SESIONES) {
    const error = new Error(`El rango supera ${MAX_SESIONES} sesiones. Reduce las fechas del reporte.`);
    error.status = 400;
    throw error;
  }

  const matriculados = (await pool.query(
    `SELECT u.id, al.codigo_alumno AS codigo, u.nombres, u.apellidos
     FROM matricula m
     JOIN usuario u ON u.id = m.alumno_id
     JOIN alumno al ON al.usuario_id = u.id
     WHERE m.curso_id = $1 AND m.estado = 'activa'
     ORDER BY u.apellidos, u.nombres`, [cursoId])).rows;

  const registros = sesiones.length
    ? (await pool.query('SELECT sesion_id, alumno_id, estado FROM asistencia WHERE sesion_id = ANY($1::uuid[])', [sesiones.map((s) => s.id)])).rows
    : [];
  const porAlumnoYSesion = new Map(registros.map((r) => [`${r.alumno_id}|${r.sesion_id}`, r.estado]));

  const total = sesiones.length;
  const { advertenciaPct, criticoPct } = clasificarRiesgo(0, total, c.umbral_riesgo_pct);
  const alumnos = matriculados.map((a) => {
    const estados = sesiones.map((s) => porAlumnoYSesion.get(`${a.id}|${s.id}`) || null);
    const contar = (estado) => estados.filter((e) => e === estado).length;
    const presentes = contar('presente'), tardanzas = contar('tardanza'), faltas = contar('falta'), justificadas = contar('justificada');
    return {
      codigo: a.codigo, nombre: `${a.apellidos}, ${a.nombres}`, estados,
      presentes, tardanzas, faltas, justificadas,
      asistencia: total ? (presentes + tardanzas) / total : 0,
      ...(({ nivel }) => ({ nivel, enRiesgo: Boolean(nivel) }))(clasificarRiesgo(faltas, total, c.umbral_riesgo_pct)),
    };
  });

  return { curso: c, rango: { desde, hasta }, generado: new Date(), sesiones, alumnos, advertenciaPct, criticoPct };
};

const descargarReporteCurso = async (req, res) => {
  const { cursoId } = req.params;
  const formato = String(req.query.formato || 'xlsx').toLowerCase();
  const desde = req.query.desde || '';
  const hasta = req.query.hasta || '';

  if (!FORMATOS[formato]) return res.status(400).json({ error: 'El formato debe ser xlsx o pdf' });
  if ((desde && !esFechaValida(desde)) || (hasta && !esFechaValida(hasta))) {
    return res.status(400).json({ error: 'Las fechas desde y hasta deben tener formato AAAA-MM-DD' });
  }
  if (desde && hasta && desde > hasta) return res.status(400).json({ error: 'La fecha "desde" no puede ser posterior a "hasta"' });

  try {
    const datos = await construirDatos(cursoId, { desde, hasta });
    if (!datos) return res.status(404).json({ error: 'Curso no encontrado' });
    if (req.user.rol !== 'admin' && datos.curso.docente_id !== req.user.id) {
      return res.status(403).json({ error: 'No tienes acceso a este curso' });
    }

    const archivo = FORMATOS[formato].generar(datos);
    const nombre = `asistencia_${nombreArchivoSeguro(datos.curso.codigo)}_${nombreArchivoSeguro(datos.curso.seccion)}_${new Date().toISOString().slice(0, 10)}.${formato}`;
    res.set({
      'Content-Type': FORMATOS[formato].tipo,
      'Content-Disposition': `attachment; filename="${nombre}"`,
      'Content-Length': archivo.length,
      'Cache-Control': 'no-store',
    });
    return res.end(archivo);
  } catch (error) {
    if (error.status === 400) return res.status(400).json({ error: error.message });
    console.error('Error al generar el reporte:', error);
    return res.status(500).json({ error: 'No se pudo generar el reporte' });
  }
};

module.exports = { descargarReporteCurso, construirDatos };
