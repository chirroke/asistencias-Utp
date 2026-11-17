import { useEffect, useState, type FormEvent } from 'react';
import { Modal } from './Modal';
import { guardarProgramacion, listarProgramaciones, type ClaseProgramada } from '../services/api';

export function ProgramacionClase({ curso, onClose, onSaved }: {
  curso: { id: string; nombre: string; seccion: string }; onClose: () => void; onSaved: (mensaje: string) => void;
}) {
  const [sesiones, setSesiones] = useState<ClaseProgramada[]>([]);
  const [cargando, setCargando] = useState(true);
  const [form, setForm] = useState({ sesionId: '', fecha: '', horaInicio: '', horaFin: '', motivo: '' });
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  useEffect(() => {
    let vigente = true;
    listarProgramaciones(curso.id).then((data) => { if (vigente) setSesiones(data.sesiones); })
      .catch((err: unknown) => { if (vigente) setError(err instanceof Error ? err.message : 'No se pudieron cargar las clases.'); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [curso.id]);
  const seleccionar = (id: string) => {
    const sesion = sesiones.find((s) => s.id === id);
    setForm({ sesionId: id, fecha: sesion?.fecha || '', horaInicio: sesion?.horaInicio || '', horaFin: sesion?.horaFin || '', motivo: '' });
  };
  const guardar = async (event: FormEvent) => {
    event.preventDefault(); setGuardando(true); setError('');
    try {
      const data = await guardarProgramacion(curso.id, { ...form, sesionId: form.sesionId || undefined });
      onSaved(data.mensaje);
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo guardar el horario.'); }
    finally { setGuardando(false); }
  };
  return <Modal titleId="programacion-titulo" onClose={onClose} busy={guardando} className="max-w-lg p-6">
    <form onSubmit={(event) => void guardar(event)} className="space-y-4">
      <h2 id="programacion-titulo" className="text-lg font-bold">Programar o reprogramar clase</h2>
      <p className="text-sm text-slate-600">{curso.nombre} · Sección {curso.seccion}. Todos los horarios son de Lima.</p>
      <label className="block text-sm font-semibold">Clase
        <select disabled={cargando || guardando} value={form.sesionId} onChange={(e) => seleccionar(e.target.value)} className="mt-1 w-full rounded-xl border p-3">
          <option value="">Programar una nueva clase</option>
          {sesiones.map((s) => <option key={s.id} value={s.id}>Reprogramar: {s.fecha} · {s.horaInicio}–{s.horaFin}</option>)}
        </select>
      </label>
      {cargando && <p role="status">Cargando clases pendientes…</p>}
      <p className="text-xs text-slate-600">Solo se pueden mover clases pendientes. Las asistencias de clases activas o cerradas se conservan.</p>
      <label className="block text-sm font-semibold">Nueva fecha<input required type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} className="mt-1 w-full rounded-xl border p-3"/></label>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm font-semibold">Inicio<input required type="time" value={form.horaInicio} onChange={(e) => setForm({ ...form, horaInicio: e.target.value })} className="mt-1 w-full rounded-xl border p-3"/></label>
        <label className="text-sm font-semibold">Fin<input required type="time" value={form.horaFin} onChange={(e) => setForm({ ...form, horaFin: e.target.value })} className="mt-1 w-full rounded-xl border p-3"/></label>
      </div>
      <label className="block text-sm font-semibold">Motivo<textarea required minLength={8} maxLength={1000} rows={3} value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })} className="mt-1 w-full rounded-xl border p-3"/></label>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div className="flex justify-end gap-3">
        <button type="button" disabled={guardando} onClick={onClose} className="rounded-xl border px-4 py-3">Cancelar</button>
        <button disabled={guardando || cargando} className="rounded-xl bg-[#c8102e] px-4 py-3 font-semibold text-white disabled:opacity-50">{guardando ? 'Guardando…' : form.sesionId ? 'Reprogramar clase' : 'Programar clase'}</button>
      </div>
    </form>
  </Modal>;
}
