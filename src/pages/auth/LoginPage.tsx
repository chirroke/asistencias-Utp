import React, { useState } from 'react';
import { Eye, EyeOff, AlertCircle, Lock, Mail, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/Authcontext';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('r.quispe@utp.edu.pe');
  const [password, setPassword] = useState('Abc123456');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    setTimeout(() => {
      const ok = login(email);
      setLoading(false);
      if (!ok) {
        setError('Credenciales inválidas. Verifica tu correo institucional (@utp.edu.pe) y contraseña.');
      }
    }, 500);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row border border-slate-200">
        
        {/* Banner Institucional Izquierdo */}
        <div className="md:w-1/2 p-8 md:p-12 text-white flex flex-col justify-between bg-[#002B49]">
          <div>
            <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center mb-6 shadow-lg">
              <span className="font-black text-2xl text-[#C8102E]">UTP</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight mb-3">Asistencia UTP</h1>
            <p className="text-blue-200 text-sm leading-relaxed">
              Plataforma institucional de control de asistencia presencial mediante códigos QR dinámicos rotativos y validación biométrica facial.
            </p>
          </div>

          <div className="mt-8 pt-6 border-t border-white/10 text-xs text-blue-300 space-y-1">
            <p className="font-semibold text-white">Universidad Tecnológica del Perú · 2026</p>
            <p>● Control automático de inasistencias (Límite DPI 30%)</p>
            <p>● Autenticación única mediante credenciales institucionales</p>
          </div>
        </div>

        {/* Formulario de Login */}
        <div className="md:w-1/2 p-8 md:p-10 flex flex-col justify-center bg-white">
          <h2 className="text-2xl font-bold text-slate-800 mb-1">Iniciar Sesión</h2>
          <p className="text-xs text-slate-500 mb-6">Ingresa con tu cuenta institucional de la universidad</p>

          {error && (
            <div className="mb-4 p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-700">
              <AlertCircle size={16} className="flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Correo Institucional</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  required
                  placeholder="u22221422@utp.edu.pe o r.quispe@utp.edu.pe"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#C8102E] focus:ring-2 focus:ring-[#C8102E]/20"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Contraseña</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPass ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-11 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#C8102E] focus:ring-2 focus:ring-[#C8102E]/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl text-white font-bold text-sm bg-[#C8102E] hover:opacity-90 transition active:scale-95 shadow-md flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Validando credenciales...
                </>
              ) : (
                'Ingresar al Sistema'
              )}
            </button>
          </form>

          
        </div>

      </div>
    </div>
  );
};