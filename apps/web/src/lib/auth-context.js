'use client';
import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem('user') || 'null');
      const t = localStorage.getItem('token') || null;
      setUser(u);
      setToken(t);
    } catch {}
    setLoading(false);
  }, []);

  function loginUser(userData, tokenStr) {
    setUser(userData);
    setToken(tokenStr || null);
    localStorage.setItem('user', JSON.stringify(userData));
    if (tokenStr) localStorage.setItem('token', tokenStr);
  }

  function logout() {
    setUser(null);
    setToken(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, loginUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
