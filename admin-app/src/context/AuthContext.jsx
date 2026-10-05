import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('admin_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check existing session via /api/auth/me with credentials
  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me', {
        method: 'GET',
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
        localStorage.setItem('admin_user', JSON.stringify(data));
      } else {
        setUser(null);
        localStorage.removeItem('admin_user');
      }
    } catch {
      // If network fails or offline, fall back to stored user or clear
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const login = async (email, password) => {
    setError(null);
    const res = await fetch('/api/auth/signin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Stores the returned access_token cookie
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!res.ok || data.success === false) {
      const msg = data.message || 'Authentication failed. Please check credentials.';
      setError(msg);
      throw new Error(msg);
    }

    setUser(data);
    localStorage.setItem('admin_user', JSON.stringify(data));
    return data;
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/signout', {
        method: 'GET',
        credentials: 'include',
      });
    } catch {
      // Ignore network errors on signout
    } finally {
      setUser(null);
      localStorage.removeItem('admin_user');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        loading,
        error,
        setError,
        login,
        logout,
        checkAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
