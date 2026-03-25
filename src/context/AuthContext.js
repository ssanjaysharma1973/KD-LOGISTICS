/**
 * Authentication context for managing user login state
 */
import React, { createContext, useState, useEffect, useCallback } from 'react';

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);

  // Check if user is logged in on mount
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const isLogged = localStorage.getItem('isLoggedIn') === 'true';

    if (storedUser && isLogged) {
      try {
        setUser(JSON.parse(storedUser));
        setIsLoggedIn(true);
      } catch (err) {
        console.error('Error parsing stored user:', err);
        localStorage.removeItem('user');
        localStorage.removeItem('isLoggedIn');
      }
    }

    setLoading(false);
  }, []);

  const login = useCallback((email, password) => {
    return new Promise((resolve, reject) => {
      try {
        // Validate credentials
        if (!email || !password) {
          reject(new Error('Email and password are required'));
          return;
        }

        if (!/\S+@\S+\.\S+/.test(email)) {
          reject(new Error('Invalid email format'));
          return;
        }

        // Create user object
        const newUser = {
          id: Math.random().toString(36).substr(2, 9),
          email,
          name: email.split('@')[0],
          createdAt: new Date().toISOString(),
        };

        // Store in localStorage
        localStorage.setItem('user', JSON.stringify(newUser));
        localStorage.setItem('isLoggedIn', 'true');

        setUser(newUser);
        setIsLoggedIn(true);

        resolve(newUser);
      } catch (error) {
        reject(error);
      }
    });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('user');
    localStorage.removeItem('isLoggedIn');
    setUser(null);
    setIsLoggedIn(false);
  }, []);

  const value = {
    user,
    isLoggedIn,
    loading,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
