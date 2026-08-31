import React, { createContext, useContext, useState } from 'react';
import type { Usuario, UserRole } from '../types';
import { MOCK_USERS } from '../data/mockData';

interface AuthContextType {
  user: Usuario | null;
  login: (email: string, role?: UserRole) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<Usuario | null>(() => {
    try {
      const saved = localStorage.getItem('asistencia_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      localStorage.removeItem('asistencia_user');
      return null;
    }
  });

  const login = (email: string, role?: UserRole): boolean => {
    let foundUser = MOCK_USERS.find(
      (u) => u.correo.toLowerCase() === email.trim().toLowerCase()
    );

    if (!foundUser && role) {
      foundUser = MOCK_USERS.find((u) => u.rol === role);
    }

    if (foundUser) {
      setUser(foundUser);
      localStorage.setItem('asistencia_user', JSON.stringify(foundUser));
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('asistencia_user');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe ser usado dentro de AuthProvider');
  return context;
};