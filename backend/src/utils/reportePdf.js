// Genera el reporte de asistencia en PDF (texto vectorial, sin dependencias externas).
// Usa las fuentes estándar Helvetica / Helvetica-Bold con codificación WinAnsi (acentos y ñ incluidos).

const ANCHO = 595.28, ALTO = 841.89, MARGEN = 40;
const AZUL = '0 0.169 0.286', ROJO = '0.784 0.063 0.18', AMBAR = '0.71 0.33 0.04';

// Texto → bytes WinAnsi dentro de un string PDF escapado.
const cadena = (texto) => {
  const seguro = String(texto ?? '')
    .replace(/[\u2013\u2014]/g, '-').replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"')
    .replace(/\u2026/g, '...').replace(/\u2265/g, '>=')
    .replace(/[^\u0020-\u00ff]/g, '?');
  return '(' + seguro.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)') + ')';
};

// Estimación del ancho en puntos (Helvetica ≈ 0.5 em por carácter) para recortar nombres largos.
const recortar = (texto, ancho, tamano) => {
  const maxCaracteres = Math.max(4, Math.floor(ancho / (tamano * 0.55)));
  const limpio = String(texto ?? '');
  return limpio.length > maxCaracteres ? `${limpio.slice(0, maxCaracteres - 3)}...` : limpio;
};

const formatearFecha = (iso) => { const [y, m, d] = String(iso).slice(0, 10).split('-'); return `${d}/${m}/${y}`; };

const COLUMNAS = [
  { titulo: 'Código', ancho: 62, alinear: 'izq', valor: (a) => a.codigo },
  { titulo: 'Alumno', ancho: 150, alinear: 'izq', valor: (a) => a.nombre },
  { titulo: 'Pres.', ancho: 38, alinear: 'centro', valor: (a) => a.presentes },
  { titulo: 'Tard.', ancho: 38, alinear: 'centro', valor: (a) => a.tardanzas },
  { titulo: 'Faltas', ancho: 42, alinear: 'centro', valor: (a) => a.faltas },
  { titulo: 'Just.', ancho: 38, alinear: 'centro', valor: (a) => a.justificadas },
  { titulo: '% Asist.', ancho: 50, alinear: 'centro', valor: (a) => `${(a.asistencia * 100).toFixed(1)}%` },
  { titulo: 'Riesgo', ancho: 57, alinear: 'centro', valor: (a) => (a.nivel === 'critico' ? 'Crítico' : a.nivel === 'advertencia' ? 'Alerta' : '-') },
];

const generarPdf = (datos) => {
  const { curso, rango, generado, sesiones, alumnos, advertenciaPct, criticoPct } = datos;
  const columnas = datos.general ? [
    { titulo: 'Código / Sec.', ancho: 88, valor: (c) => `${c.codigo} / ${c.seccion}` },
    { titulo: 'Curso', ancho: 155, valor: (c) => c.nombre },
    { titulo: 'Ses.', ancho: 35, valor: (c) => c.sesiones },
    ...COLUMNAS.slice(2, 7).map((c) => ({ ...c, ancho: c.titulo === '% Asist.' ? 62 : 43 })),
  ] : COLUMNAS;
  const paginas = [];
  let ops = [];
  let y = 0;

  const texto = (x, yy, contenido, { tamano = 9, negrita = false, color = '0 g', ancho = 0, alinear = 'izq' } = {}) => {
    const t = ancho ? recortar(contenido, ancho, tamano) : String(contenido ?? '');
    let xx = x;
    if (ancho && alinear === 'centro') xx = x + Math.max(0, (ancho - t.length * tamano * 0.5) / 2);
    const colorOp = /\b(r?g)$/.test(color) ? color : `${color} rg`; // acepta "0 g", "1 g" o "r g b"
    ops.push(`BT ${colorOp} /${negrita ? 'F2' : 'F1'} ${tamano} Tf ${xx.toFixed(2)} ${yy.toFixed(2)} Td ${cadena(t)} Tj ET`);
  };
  const rect = (x, yy, w, h, relleno) => ops.push(`${relleno} rg ${x.toFixed(2)} ${yy.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`);

  const encabezadoTabla = () => {
    const anchoTotal = columnas.reduce((s, c) => s + c.ancho, 0);
    rect(MARGEN, y - 4, anchoTotal, 18, AZUL);
    let x = MARGEN;
    for (const c of columnas) { texto(x + 3, y + 1, c.titulo, { tamano: 8.5, negrita: true, color: '1 g', ancho: c.ancho - 6, alinear: c.alinear }); x += c.ancho; }
    y -= 20;
  };

  const nuevaPagina = (primera) => {
    if (ops.length) paginas.push(ops);
    ops = [];
    y = ALTO - MARGEN;
    if (primera) {
      rect(0, ALTO - 12, ANCHO, 12, ROJO);
      texto(MARGEN, y - 8, datos.general ? 'Reporte general de asistencia' : 'Reporte de asistencia', { tamano: 18, negrita: true, color: AZUL });
      y -= 28;
      const meta = [
        [datos.general ? 'Ámbito' : 'Curso', datos.general ? 'Cursos del periodo académico activo' : `${curso.codigo} - ${curso.nombre} (Sección ${curso.seccion})`],
        [datos.general ? 'Criterio' : 'Docente', datos.general ? '% = (presentes + tardanzas) / registros; sin datos: 0%' : curso.docente || '-'],
        ['Periodo', curso.periodo || '-'],
        ['Rango', `${rango.desde ? formatearFecha(rango.desde) : 'Inicio'} a ${rango.hasta ? formatearFecha(rango.hasta) : 'hoy'} · ${sesiones.length} sesiones cerradas`],
        ['Generado', generado.toLocaleString('es-PE', { timeZone: 'America/Lima' })],
      ];
      for (const [etiqueta, valor] of meta) { texto(MARGEN, y, `${etiqueta}:`, { negrita: true, tamano: 9.5 }); texto(MARGEN + 58, y, valor, { tamano: 9.5, ancho: ANCHO - 2 * MARGEN - 58 }); y -= 14; }
      const enRiesgo = alumnos.filter((a) => a.nivel).length;
      y -= 4;
      texto(MARGEN, y, datos.general ? `${alumnos.length} cursos · incluye registros de alumnos retirados` : `${alumnos.length} alumnos · ${enRiesgo} en riesgo (alerta: faltas ≥ ${advertenciaPct}% · crítico: ≥ ${criticoPct}%)`, { tamano: 9.5, negrita: true, color: enRiesgo ? ROJO : '0.02 0.37 0.27' });
      y -= 22;
    }
    encabezadoTabla();
  };

  nuevaPagina(true);
  alumnos.forEach((a, i) => {
    if (y < MARGEN + 30) nuevaPagina(false);
    if (i % 2 === 0) rect(MARGEN, y - 4, columnas.reduce((s, c) => s + c.ancho, 0), 15, '0.965 0.973 0.98');
    let x = MARGEN;
    for (const c of columnas) {
      const esRiesgo = c.titulo === 'Riesgo' && a.nivel;
      const color = !esRiesgo ? '0 g' : a.nivel === 'critico' ? ROJO : AMBAR;
      texto(x + 3, y, c.valor(a), { tamano: 8.5, ancho: c.ancho - 6, alinear: c.alinear, color, negrita: Boolean(esRiesgo) });
      x += c.ancho;
    }
    y -= 15;
  });
  if (!alumnos.length) texto(MARGEN, y, datos.general ? 'No hay cursos para los filtros seleccionados.' : 'No hay alumnos matriculados en este curso.', { tamano: 10 });
  paginas.push(ops);

  // Pie con número de página.
  const total = paginas.length;
  paginas.forEach((contenido, i) => {
    contenido.push(`BT 0.4 g /F1 8 Tf ${MARGEN} 24 Td ${cadena('Asistencia UTP · Sistema de Asistencia QR')} Tj ET`);
    contenido.push(`BT 0.4 g /F1 8 Tf ${ANCHO - MARGEN - 60} 24 Td ${cadena(`Página ${i + 1} de ${total}`)} Tj ET`);
  });

  // --- Ensamblado del archivo PDF
  const objetos = [];
  const agregar = (cuerpo) => { objetos.push(cuerpo); return objetos.length; };
  agregar('<< /Type /Catalog /Pages 2 0 R >>');                                   // 1
  agregar(null);                                                                   // 2 (Pages, se completa después)
  agregar('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');       // 3
  agregar('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');  // 4
  const idsPagina = [];
  for (const contenido of paginas) {
    const flujo = Buffer.from(contenido.join('\n'), 'latin1');
    const idContenido = objetos.length + 2;
    idsPagina.push(agregar(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${ANCHO} ${ALTO}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${idContenido} 0 R >>`));
    agregar({ flujo });
  }
  objetos[1] = `<< /Type /Pages /Count ${idsPagina.length} /Kids [${idsPagina.map((id) => `${id} 0 R`).join(' ')}] >>`;

  const partes = [Buffer.from('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n', 'latin1')];
  const posiciones = [];
  let largo = partes[0].length;
  objetos.forEach((obj, i) => {
    posiciones.push(largo);
    const cuerpo = typeof obj === 'string'
      ? Buffer.from(`${i + 1} 0 obj\n${obj}\nendobj\n`, 'latin1')
      : Buffer.concat([Buffer.from(`${i + 1} 0 obj\n<< /Length ${obj.flujo.length} >>\nstream\n`, 'latin1'), obj.flujo, Buffer.from('\nendstream\nendobj\n', 'latin1')]);
    partes.push(cuerpo);
    largo += cuerpo.length;
  });
  const xref = [`xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`, ...posiciones.map((p) => `${String(p).padStart(10, '0')} 00000 n \n`)].join('');
  partes.push(Buffer.from(`${xref}trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${largo}\n%%EOF\n`, 'latin1'));
  return Buffer.concat(partes);
};

module.exports = { generarPdf };
