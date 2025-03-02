import React, { createContext, useContext, useState, useEffect } from 'react';
import { isAuthenticated, login, logout, getCurrentPrincipal } from '../services/auth';
import { generateEncryptionKey } from '../services/crypto';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  async function checkAuthStatus() {
    setLoading(true);
    try {
      const authenticated = await isAuthenticated();
      if (authenticated) {
        const principal = await getCurrentPrincipal();
        setUser({
          principal: principal.toString(),
          isAuthenticated: true
        });
        
        // Check if we have a master encryption key, if not generate one
        if (!localStorage.getItem('masterEncryptionKey')) {
          const masterKey = generateEncryptionKey();
          localStorage.setItem('masterEncryptionKey', masterKey);
        }
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin() {
    setLoading(true);
    try {
      const { identity, deviceKeyPair } = await login();
      const principal = identity.getPrincipal();
      
      // Set up the encryption key for the user
      if (!localStorage.getItem('masterEncryptionKey')) {
        const masterKey = generateEncryptionKey();
        localStorage.setItem('masterEncryptionKey', masterKey);
      }
      
      setUser({
        principal: principal.toString(),
        isAuthenticated: true
      });
      
      return { success: true };
    } catch (error) {
      console.error('Login failed:', error);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    setLoading(true);
    try {
      await logout();
      setUser(null);
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setLoading(false);
    }
  }

  const value = {
    user,
    loading,
    login: handleLogin,
    logout: handleLogout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}