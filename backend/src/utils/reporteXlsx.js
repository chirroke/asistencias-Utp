// Genera el reporte de asistencia en formato Excel (.xlsx) sin dependencias externas.
const { crearZip } = require('./zip');

const escapar = (valor) => String(valor ?? '')
  // eslint-disable-next-line no-control-regex
  .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const columna = (indice) => {           // 0 → A, 26 → AA
  let n = indice + 1, letras = '';
  while (n > 0) { const resto = (n - 1) % 26; letras = String.fromCharCode(65 + resto) + letras; n = Math.floor((n - 1) / 26); }
  return letras;
};

// Índices de estilo definidos en ESTILOS (cellXfs).
const E = { normal: 0, encabezado: 1, titulo: 2, porcentaje: 3, presente: 4, tardanza: 5, falta: 6, justificada: 7, centrado: 8, etiqueta: 9, riesgo: 10 };

const ESTILOS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="0.0%"/></numFmts>
<fonts count="5">
<font><sz val="11"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
<font><b/><sz val="15"/><color rgb="FF002B49"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><color rgb="FFB91C1C"/><name val="Calibri"/></font>
</fonts>
<fills count="7">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF002B49"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFD1FAE5"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFEF3C7"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFEE2E2"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFDBEAFE"/></patternFill></fill>
</fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>
<border><left style="thin"><color rgb="FFE2E8F0"/></left><right style="thin"><color rgb="FFE2E8F0"/></right><top style="thin"><color rgb="FFE2E8F0"/></top><bottom style="thin"><color rgb="FFE2E8F0"/></bottom><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="11">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf>
<xf numFmtId="0" fontId="3" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf>
<xf numFmtId="0" fontId="3" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf>
<xf numFmtId="0" fontId="3" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf>
<xf numFmtId="0" fontId="3" fillId="6" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="4" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

// Una celda: texto (inlineStr) o número, con estilo opcional.
const celda = (fila, col, valor, estilo = E.normal) => {
  const ref = `${columna(col)}${fila}`;
  if (valor === null || valor === undefined || valor === '') return estilo ? `<c r="${ref}" s="${estilo}"/>` : '';
  if (typeof valor === 'number' && Number.isFinite(valor)) return `<c r="${ref}" s="${estilo}"><v>${valor}</v></c>`;
  return `<c r="${ref}" s="${estilo}" t="inlineStr"><is><t xml:space="preserve">${escapar(valor)}</t></is></c>`;
};

const hoja = ({ filas, anchos, congelarFilas = 0, congelarColumnas = 0 }) => {
  const cols = anchos.map((ancho, i) => `<col min="${i + 1}" max="${i + 1}" width="${ancho}" customWidth="1"/>`).join('');
  const panel = congelarFilas || congelarColumnas
    ? `<sheetViews><sheetView workbookViewId="0"><pane ${congelarColumnas ? `xSplit="${congelarColumnas}" ` : ''}${congelarFilas ? `ySplit="${congelarFilas}" ` : ''}topLeftCell="${columna(congelarColumnas)}${congelarFilas + 1}" activePane="${congelarFilas && congelarColumnas ? 'bottomRight' : congelarFilas ? 'bottomLeft' : 'topRight'}" state="frozen"/></sheetView></sheetViews>`
    : '';
  const cuerpo = filas.map((celdas, i) => `<row r="${i + 1}"${celdas.alto ? ` ht="${celdas.alto}" customHeight="1"` : ''}>${celdas.join('')}</row>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${panel}<cols>${cols}</cols><sheetData>${cuerpo}</sheetData></worksheet>`;
};

const SIGLA = { presente: 'P', tardanza: 'T', falta: 'F', justificada: 'J' };
const ESTILO_ESTADO = { presente: E.presente, tardanza: E.tardanza, falta: E.falta, justificada: E.justificada };

const formatearFecha = (iso) => { const [y, m, d] = String(iso).slice(0, 10).split('-'); return `${d}/${m}/${y}`; };

/** @returns {Buffer} contenido del .xlsx */
const generarXlsx = (datos) => {
  const { curso, rango, generado, sesiones, alumnos, advertenciaPct, criticoPct } = datos;

  // --- Hoja 1: Resumen
  const filasResumen = [];
  const fila = (...celdas) => { const arr = celdas.filter(Boolean); filasResumen.push(arr); return arr; };
  let r = 1;
  fila(celda(r++, 0, 'Reporte de asistencia', E.titulo)).alto = 24;
  fila(celda(r, 0, 'Curso', E.etiqueta), celda(r++, 1, `${curso.codigo} · ${curso.nombre} (Sección ${curso.seccion})`));
  fila(celda(r, 0, 'Docente', E.etiqueta), celda(r++, 1, curso.docente || '—'));
  fila(celda(r, 0, 'Periodo', E.etiqueta), celda(r++, 1, curso.periodo || '—'));
  fila(celda(r, 0, 'Rango', E.etiqueta), celda(r++, 1, `${rango.desde ? formatearFecha(rango.desde) : 'Inicio'} a ${rango.hasta ? formatearFecha(rango.hasta) : 'hoy'} · ${sesiones.length} sesiones cerradas`));
  fila(celda(r, 0, 'Criterio', E.etiqueta), celda(r++, 1, `Advertencia: faltas ≥ ${advertenciaPct}% · Crítico: faltas ≥ ${criticoPct}%`));
  fila(celda(r, 0, 'Generado', E.etiqueta), celda(r++, 1, generado.toLocaleString('es-PE', { timeZone: 'America/Lima' })));
  fila(); r++;
  const encabezados = ['Código', 'Alumno', 'Presentes', 'Tardanzas', 'Faltas', 'Justificadas', '% Asistencia', 'Riesgo'];
  const filaEnc = fila(...encabezados.map((t, i) => celda(r, i, t, E.encabezado))); filaEnc.alto = 32; r++;
  for (const a of alumnos) {
    fila(
      celda(r, 0, a.codigo, E.centrado), celda(r, 1, a.nombre, E.normal),
      celda(r, 2, a.presentes, E.centrado), celda(r, 3, a.tardanzas, E.centrado), celda(r, 4, a.faltas, E.centrado), celda(r, 5, a.justificadas, E.centrado),
      celda(r, 6, a.asistencia, E.porcentaje), celda(r, 7, a.nivel === 'critico' ? 'Crítico' : a.nivel === 'advertencia' ? 'Advertencia' : 'Normal', a.nivel === 'critico' ? E.riesgo : a.nivel === 'advertencia' ? E.tardanza : E.centrado)
    );
    r++;
  }
  const resumen = hoja({ filas: filasResumen, anchos: [13, 38, 11, 11, 9, 13, 14, 22], congelarFilas: 0 });

  // --- Hoja 2: Detalle por sesión (alumno × fecha)
  const filasDetalle = [];
  const encDetalle = [celda(1, 0, 'Código', E.encabezado), celda(1, 1, 'Alumno', E.encabezado), ...sesiones.map((s, i) => celda(1, i + 2, formatearFecha(s.fecha).slice(0, 5), E.encabezado))];
  encDetalle.alto = 22; filasDetalle.push(encDetalle);
  alumnos.forEach((a, i) => {
    const n = i + 2;
    filasDetalle.push([
      celda(n, 0, a.codigo, E.centrado), celda(n, 1, a.nombre, E.normal),
      ...a.estados.map((estado, j) => celda(n, j + 2, estado ? SIGLA[estado] : '–', estado ? ESTILO_ESTADO[estado] : E.centrado)),
    ]);
  });
  const leyenda = alumnos.length + 3;
  filasDetalle.push([]);
  filasDetalle.push([celda(leyenda, 0, 'P = Presente · T = Tardanza · F = Falta · J = Justificada · – = sin registro', E.normal)]);
  const detalle = hoja({ filas: filasDetalle, anchos: [13, 38, ...sesiones.map(() => 7)], congelarFilas: 1, congelarColumnas: 2 });

  return empaquetar(resumen, detalle, generado);
};

const empaquetar = (resumen, detalle, generado) => {
  const archivos = [
    { nombre: '[Content_Types].xml', contenido: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>` },
    { nombre: '_rels/.rels', contenido: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { nombre: 'xl/workbook.xml', contenido: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Resumen" sheetId="1" r:id="rId1"/><sheet name="Detalle por sesión" sheetId="2" r:id="rId2"/></sheets></workbook>` },
    { nombre: 'xl/_rels/workbook.xml.rels', contenido: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    { nombre: 'xl/styles.xml', contenido: ESTILOS },
    { nombre: 'xl/worksheets/sheet1.xml', contenido: resumen },
    { nombre: 'xl/worksheets/sheet2.xml', contenido: detalle },
  ];
  return crearZip(archivos, generado);
};

const generarXlsxGeneral = (datos) => {
  const headers = ['Código', 'Curso', 'Sección', 'Periodo', 'Docente', 'Sesiones cerradas', 'Presentes', 'Tardanzas', 'Faltas', 'Justificadas', '% asistencia'];
  const filas = [[celda(1, 0, 'Reporte general de asistencia', E.titulo)],
    [celda(2, 0, `Periodo activo · ${datos.rango.desde || 'Inicio'} a ${datos.rango.hasta || 'hoy'} · generado ${datos.generado.toLocaleString('es-PE', { timeZone: 'America/Lima' })}`)],
    headers.map((h, i) => celda(3, i, h, E.encabezado))];
  datos.alumnos.forEach((c, i) => filas.push([c.codigo, c.nombre, c.seccion, c.periodo, c.docente, c.sesiones, c.presentes, c.tardanzas, c.faltas, c.justificadas, c.asistencia].map((v, j) => celda(i + 4, j, v, j === 10 ? E.porcentaje : E.normal))));
  const resumen = hoja({ filas, anchos: [18, 45, 14, 15, 40, 20, 15, 15, 15, 15, 18], congelarFilas: 3 });
  const detalle = hoja({ filas: [
    [celda(1, 0, 'Criterio del reporte', E.titulo)],
    [celda(2, 0, 'Incluye los cursos no eliminados del periodo activo y sus sesiones cerradas en el rango seleccionado.')],
    [celda(3, 0, 'Cada marcación se cuenta una vez; incluye las asistencias históricas de alumnos retirados.')],
    [celda(4, 0, 'Porcentaje = (presentes + tardanzas) / total de registros. Sin registros se muestra 0%.')],
    [celda(5, 0, 'Las sesiones sin marcaciones se cuentan como sesiones; no se inventan faltas.')],
  ], anchos: [115] });
  return empaquetar(resumen, detalle, datos.generado);
};
module.exports = { generarXlsx, generarXlsxGeneral };
