import { useState } from 'react';
import { Download, FileSpreadsheet, FileText, Loader2, X } from 'lucide-react';
import { descargarReporteCurso } from '../services/api';

type Formato = 'xlsx' | 'pdf';
type Props = {
  cursoId: string;
  cursoNombre: string;
  desde: string;
  hasta: string;
  onClose: () => void;
};

export function ExportarReporte({ cursoId, cursoNombre, desde, hasta, onClose }: Props) {
  const [formato, setFormato] = useState<Formato>('xlsx');
  const [descargando, setDescargando] = useState(false);
  const [error, setError] = useState('');

  const descargar = async () => {
    setDescargando(true);
    setError('');
    try {
      const { blob, nombre } = await descargarReporteCurso(cursoId, formato, desde, hasta);
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = nombre;
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar el reporte.');
    } finally {
      setDescargando(false);
    }
  };

  const rango = desde || hasta
    ? `${desde || 'Inicio'} a ${hasta || 'hoy'}`
    : 'Todas las sesiones cerradas';

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    onMouseDown={(event) => { if (event.target === event.currentTarget && !descargando) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="exportar-reporte-titulo"
      className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="exportar-reporte-titulo" className="text-sm font-bold text-slate-800">Exportar reporte de asistencia</h2>
          <p className="mt-1 text-xs text-slate-500">{cursoNombre} · {rango}</p>
        </div>
        <button type="button" onClick={onClose} disabled={descargando} aria-label="Cerrar"
          className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-50"><X size={17}/></button>
      </div>

      <fieldset className="mt-4 grid gap-2">
        <legend className="mb-2 text-xs font-semibold text-slate-600">Formato del archivo</legend>
        {([
          { id: 'xlsx', label: 'Excel (.xlsx)', detail: 'Resumen y detalle por sesión', Icon: FileSpreadsheet },
          { id: 'pdf', label: 'PDF', detail: 'Resumen paginado para imprimir', Icon: FileText },
        ] as const).map(({ id, label, detail, Icon }) => <label key={id}
          className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 ${formato === id ? 'border-[#c8102e] bg-red-50' : 'border-slate-200'}`}>
          <input type="radio" name="formato-reporte" value={id} checked={formato === id}
            onChange={() => setFormato(id)} className="accent-[#c8102e]"/>
          <Icon size={18} className={formato === id ? 'text-[#c8102e]' : 'text-slate-500'}/>
          <span><span className="block text-xs font-bold text-slate-800">{label}</span><span className="text-[11px] text-slate-500">{detail}</span></span>
        </label>)}
      </fieldset>

      <p className="mt-3 text-[11px] text-slate-500">Incluye sesiones cerradas y respeta el rango de fechas seleccionado.</p>
      {error && <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">{error}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} disabled={descargando}
          className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">Cancelar</button>
        <button type="button" onClick={() => void descargar()} disabled={descargando}
          className="flex items-center gap-2 rounded-xl bg-[#c8102e] px-4 py-2 text-xs font-bold text-white hover:bg-[#a60d26] disabled:opacity-50">
          {descargando ? <><Loader2 size={14} className="animate-spin"/> Generando…</> : <><Download size={14}/> Descargar</>}
        </button>
      </div>
    </section>
  </div>;
}
