import { useEffect, useState } from 'react';
import { obtenerCursosAdmin } from '../services/api';
import { ExportarReporte } from './ExportarReporte';

export function ReporteGeneral() {
  const [cursos, setCursos] = useState<Array<{ id: string; codigo: string; nombre: string; seccion: string }>>([]);
  const [cursoId, setCursoId] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [error, setError] = useState('');
  const [abierto, setAbierto] = useState(false);
  useEffect(() => {
    let vigente = true;
    obtenerCursosAdmin().then((data) => { if (vigente) setCursos(data.cursos || []); })
      .catch(() => { if (vigente) setError('No se pudieron cargar los cursos. Puedes exportar el consolidado de todos.'); });
    return () => { vigente = false; };
  }, []);
  return <section className="rounded-2xl border border-slate-200 bg-white p-4">
    <h2 className="font-bold">Reporte general de asistencia</h2>
    <p className="mt-1 text-xs text-slate-600">Exporta las sesiones cerradas del periodo activo. Estos filtros se aplican al archivo descargado.</p>
    <form className="mt-3 flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); if (desde && hasta && desde > hasta) { setError('Desde debe ser anterior o igual a Hasta.'); return; } setError(''); setAbierto(true); }}>
      <label className="min-w-0 flex-1 text-sm">Curso<select value={cursoId} onChange={(e) => setCursoId(e.target.value)} className="mt-1 block w-full min-w-48 rounded-xl border p-2.5"><option value="">Todos los cursos</option>{cursos.map((c) => <option key={c.id} value={c.id}>{c.codigo} · {c.nombre} · {c.seccion}</option>)}</select></label>
      <label className="text-sm">Desde<input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="mt-1 block rounded-xl border p-2.5"/></label>
      <label className="text-sm">Hasta<input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="mt-1 block rounded-xl border p-2.5"/></label>
      <button className="rounded-xl bg-[#c8102e] px-4 py-3 text-sm font-semibold text-white">Exportar PDF / Excel</button>
    </form>
    {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    {abierto && <ExportarReporte general cursoId={cursoId} cursoNombre={cursos.find((c) => c.id === cursoId)?.nombre || 'Todos los cursos'} desde={desde} hasta={hasta} onClose={() => setAbierto(false)}/>}
  </section>;
}
