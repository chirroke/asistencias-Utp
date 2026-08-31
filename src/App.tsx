import React from 'react';
import { AuthProvider, useAuth } from './context/Authcontext';
import { LoginPage } from './pages/auth/LoginPage';
import { DocenteProyeccion } from './pages/docente/DocenteProyeccion';

const AppContent: React.FC = () => {
  const { user, logout } = useAuth();

  // 1. Si no ha iniciado sesión -> Muestra el Login
  if (!user) {
    return <LoginPage />;
  }

  // 2. Al iniciar sesión -> Abre directo la Proyección de Aula con el QR
  return (
    <div className="w-full min-h-screen bg-[#071118]">
      <DocenteProyeccion onCloseSession={logout} />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}