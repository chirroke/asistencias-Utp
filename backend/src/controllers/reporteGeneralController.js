const pool = require('../config/db');
const { generarXlsxGeneral } = require('../utils/reporteXlsx');
const { generarPdf } = require('../utils/reportePdf');
const fechaValida = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)
  && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s;

const construirGeneral = async ({ cursoId = '', desde = '', hasta = '' }) => {
  // Aggregate sessions separately so joining attendance does not multiply session counts.
  const { rows } = await pool.query(`SELECT c.codigo,c.nombre,c.seccion,p.codigo AS periodo,
    concat_ws(' ',u.nombres,u.apellidos) AS docente,
    count(DISTINCT s.id)::int AS sesiones,
    count(a.id) FILTER (WHERE a.estado='presente')::int AS presentes,
    count(a.id) FILTER (WHERE a.estado='tardanza')::int AS tardanzas,
    count(a.id) FILTER (WHERE a.estado='falta')::int AS faltas,
    count(a.id) FILTER (WHERE a.estado='justificada')::int AS justificadas
    FROM curso c JOIN periodo_academico p ON p.id=c.periodo_id AND p.activo=TRUE
    JOIN usuario u ON u.id=c.docente_id
    LEFT JOIN sesion_clase s ON s.curso_id=c.id AND s.estado='cerrada'
      AND ($2::date IS NULL OR s.fecha >= $2) AND ($3::date IS NULL OR s.fecha <= $3)
    LEFT JOIN asistencia a ON a.sesion_id=s.id
    WHERE c.eliminado_en IS NULL AND ($1::uuid IS NULL OR c.id=$1)
    GROUP BY c.id,p.codigo,u.nombres,u.apellidos ORDER BY c.codigo,c.seccion LIMIT 501`, [cursoId || null,desde || null,hasta || null]);
  if (rows.length > 500) { const error = new Error('Hay más de 500 cursos. Selecciona un curso para exportar.'); error.status = 400; throw error; }
  return {
    general: true, curso: { periodo: [...new Set(rows.map((r) => r.periodo))].join(', ') },
    rango: { desde, hasta }, generado: new Date(), sesiones: { length: rows.reduce((n,r) => n+r.sesiones,0) },
    alumnos: rows.map((r) => ({ ...r, asistencia: (r.presentes+r.tardanzas) / (r.presentes+r.tardanzas+r.faltas+r.justificadas || 1) })),
  };
};

const descargarGeneral = async (req, res) => {
  if (req.user.rol !== 'admin') return res.status(403).json({ error: 'Solo administración puede descargar el reporte general.' });
  const { formato = 'xlsx', cursoId = '', desde = '', hasta = '' } = req.query;
  if (!['pdf','xlsx'].includes(formato)) return res.status(400).json({ error: 'Selecciona PDF o Excel.' });
  if ((desde && !fechaValida(desde)) || (hasta && !fechaValida(hasta)) || (desde && hasta && desde > hasta)) return res.status(400).json({ error: 'El rango de fechas no es válido.' });
  if (cursoId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cursoId)) return res.status(400).json({ error: 'Curso inválido.' });
  try {
    const datos = await construirGeneral({ cursoId,desde,hasta });
    const archivo = formato === 'pdf' ? generarPdf(datos) : generarXlsxGeneral(datos);
    res.set({
      'Content-Type': formato === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="asistencia_general_${new Date().toISOString().slice(0,10)}.${formato}"`,
      'Content-Length': archivo.length, 'Cache-Control': 'no-store',
    });
    res.end(archivo);
  } catch (error) {
    console.error('Reporte general:', error);
    res.status(error.status || 500).json({ error: error.status ? error.message : 'No se pudo generar el reporte general.' });
  }
};
module.exports = { construirGeneral, descargarGeneral };
