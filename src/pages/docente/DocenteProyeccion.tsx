import React, { useState, useEffect, useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { 
  ArrowLeft, 
  RefreshCw, 
  Download, 
  Edit3, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';

interface AlumnoPresente {
  id: string;
  codigo: string;
  nombre: string;
  iniciales: string;
  hora: string;
  similitud: string;
  orden: number;
}

export const DocenteProyeccion: React.FC<{ onCloseSession: () => void }> = ({ onCloseSession }) => {
  const [seconds, setSeconds] = useState(20);
  const [token, setToken] = useState('HMAC-INIT-8941');
  const [tokenTimestamp, setTokenTimestamp] = useState<number>(Date.now());

  const [alumnos, setAlumnos] = useState<AlumnoPresente[]>([
    { id: '1', codigo: 'U22221422', nombre: 'Gabriel Conislla', iniciales: 'GC', hora: '08:04:12', similitud: '98.4%', orden: 1 },
    { id: '2', codigo: 'U20193821', nombre: 'María Flores', iniciales: 'MF', hora: '08:04:35', similitud: '96.1%', orden: 2 },
    { id: '3', codigo: 'U21874523', nombre: 'Carlos López', iniciales: 'CL', hora: '08:05:02', similitud: '97.8%', orden: 3 },
    { id: '4', codigo: 'U22993014', nombre: 'Ana Torres', iniciales: 'AT', hora: '08:05:19', similitud: '95.3%', orden: 4 },
    { id: '5', codigo: 'U21334521', nombre: 'Jorge Vásquez', iniciales: 'JV', hora: '08:05:41', similitud: '99.1%', orden: 5 },
    { id: '6', codigo: 'U22112834', nombre: 'Lucía Mendoza', iniciales: 'LM', hora: '08:06:03', similitud: '94.7%', orden: 6 },
    { id: '7', codigo: 'U20876543', nombre: 'Pedro Ramírez', iniciales: 'PR', hora: '08:06:28', similitud: '97.2%', orden: 7 },
    { id: '8', codigo: 'U22445678', nombre: 'Sofia Gutierrez', iniciales: 'SG', hora: '08:07:01', similitud: '96.8%', orden: 8 },
    { id: '9', codigo: 'U21998012', nombre: 'Diego Paredes', iniciales: 'DP', hora: '08:07:33', similitud: '98.0%', orden: 9 },
    { id: '10', codigo: 'U22001234', nombre: 'Valeria Cruz', iniciales: 'VC', hora: '08:08:00', similitud: '95.9%', orden: 10 },
  ]);

  // Rotación del token estrictamente cada 20 segundos
  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds((prev) => {
        if (prev <= 1) {
          const nuevoToken = `HMAC-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
          setToken(nuevoToken);
          setTokenTimestamp(Date.now());
          return 20;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // El payload solo se recalcula cuando cambia el token, no cada segundo
  const qrPayload = useMemo(() => {
    return JSON.stringify({
      sesionId: 'ses-14',
      curso: 'Curso Integrador II',
      seccion: '32847',
      token: token,
      timestamp: tokenTimestamp,
    });
  }, [token, tokenTimestamp]);

  const totalAlumnos = 40;
  const presentes = 39;
  const porcentaje = ((presentes / totalAlumnos) * 100).toFixed(1);

  return (
    <div className="min-h-screen bg-[#071118] text-slate-100 p-6 flex flex-col justify-between font-sans selection:bg-emerald-500/30">
      
      {/* Encabezado Superior */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
        <div>
          <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
            UNIVERSIDAD TECNOLÓGICA DEL PERÚ
          </span>
          <h1 className="text-base md:text-lg font-bold text-white tracking-wide">
            Curso Integrador II: Software · Sección 32847 · Aula A-304 · Dr. R. Quispe
          </h1>
        </div>
        <button
          onClick={onCloseSession}
          className="p-2.5 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition"
          title="Regresar"
        >
          <ArrowLeft size={18} />
        </button>
      </div>

      {/* Banner de Notificación en Vivo */}
      <div className="mt-3">
        <div className="flex items-center gap-3 bg-[#03231d] border border-emerald-500/40 px-4 py-2.5 rounded-xl text-xs md:text-sm text-emerald-300 shadow-lg">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
          <p className="truncate">
            <span className="font-bold text-white">¡Marcación Exitosa!</span> · Gabriel Conislla (U22221422) · Rostro 98.4% · GPS: Aula A-304 · 08:04:12 a.m. <span className="text-emerald-400 font-semibold">[Presente]</span>
          </p>
        </div>
      </div>

      {/* Contenedor Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 my-auto py-6 items-center">
        
        {/* Zona Izquierda: Código QR y Controles */}
        <div className="lg:col-span-8 flex flex-col items-center justify-center space-y-6">
          
          {/* Tarjeta del QR */}
          <div className="p-7 bg-white rounded-[2.5rem] shadow-2xl flex items-center justify-center">
            <QRCodeSVG
              value={qrPayload}
              size={240}
              level="M"
              includeMargin={false}
            />
          </div>

          {/* Temporizador y Token */}
          <div className="text-center space-y-1">
            <div className="flex items-center justify-center gap-2 text-sm font-semibold text-emerald-400">
              <RefreshCw size={15} className="animate-spin" />
              <span>Refresco automático en {seconds}s</span>
            </div>
            <p className="text-xs text-slate-400 font-mono">
              Token HMAC seguro · Sesión #14
            </p>
          </div>

          {/* Barra de Acciones */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              onClick={onCloseSession}
              className="px-5 py-2.5 rounded-xl bg-[#c51c36] hover:bg-red-700 text-white text-xs font-bold transition shadow-lg shadow-red-950/40"
            >
              Cerrar Sesión de Clase
            </button>
            <button className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/70 text-slate-200 text-xs font-semibold flex items-center gap-2 transition">
              <Download size={14} />
              Exportar Excel
            </button>
            <button className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-amber-500/60 text-amber-400 text-xs font-semibold flex items-center gap-2 transition">
              <Edit3 size={14} />
              Excepción Manual
            </button>
          </div>
        </div>

        {/* Zona Derecha: Panel de Asistencia en Vivo */}
        <div className="lg:col-span-4 bg-[#0d1b24] rounded-2xl border border-slate-800/90 p-4 flex flex-col h-[520px] shadow-2xl">
          
          {/* Header del Panel */}
          <div className="pb-3 border-b border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white">Asistencia en Vivo</h2>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            </div>
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-emerald-400 font-bold">{presentes} <span className="text-slate-400 font-normal">/ {totalAlumnos} Alumnos</span></span>
              <span className="text-emerald-400">{porcentaje}%</span>
            </div>
            {/* Barra de progreso */}
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-emerald-400 h-full rounded-full transition-all duration-500" 
                style={{ width: `${porcentaje}%` }} 
              />
            </div>
          </div>

          {/* Lista scrolleable de alumnos */}
          <div className="flex-1 overflow-y-auto space-y-2 py-3 pr-1 scrollbar-thin scrollbar-thumb-slate-700">
            {alumnos.map((a, idx) => (
              <div
                key={a.id}
                className={`p-2.5 rounded-xl flex items-center justify-between text-xs transition border ${
                  idx === 0 
                    ? 'bg-emerald-950/20 border-emerald-500/40 text-white' 
                    : 'bg-slate-900/60 border-slate-800/80 text-slate-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-xs flex-shrink-0">
                    {a.iniciales}
                  </div>
                  <div>
                    <p className="font-semibold text-white leading-tight">{a.nombre}</p>
                    <p className="text-[10px] text-slate-400">{a.codigo} · {a.hora}</p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[11px] font-bold text-emerald-400 block">{a.similitud}</span>
                  <span className="text-[9px] text-slate-500">#{a.orden}</span>
                </div>
              </div>
            ))}

            {/* Estado pendiente / sin registrar */}
            <div className="p-2.5 rounded-xl bg-red-950/20 border border-red-900/40 flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-red-500/20 text-red-400 font-bold flex items-center justify-center text-xs flex-shrink-0">
                  ?
                </div>
                <div>
                  <p className="font-semibold text-red-400 leading-tight">1 alumno sin registrar</p>
                  <p className="text-[10px] text-slate-500">Pendiente</p>
                </div>
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};