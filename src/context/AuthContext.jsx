import React, { createContext, useContext, useState, useEffect } from 'react';
import { isAuthenticated, login, logout, getCurrentPrincipal } from '../services/auth';
import { getUserMasterKey, saveUserMasterKey, generateEncryptionKey } from '../services/improved-crypto';

// 認証コンテキストの作成
const AuthContext = createContext();

// 認証コンテキストを使用するためのカスタムフック
export function useAuth() {
  return useContext(AuthContext);
}

// 認証プロバイダーコンポーネント
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  // 初期化時に認証状態をチェック
  useEffect(() => {
    if (!initialized) {
      checkAuthStatus();
      setInitialized(true);
    }
  }, [initialized]);

  // 認証状態確認
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

  // ログイン処理
  async function handleLogin() {
    setLoading(true);
    try {
      // Internet Identity認証を実行
      const result = await login();
      const principal = result.principal;
      
      if (!principal) {
        throw new Error('Authentication failed: No principal ID returned');
      }
      
      // ユーザー固有のマスターキーをチェック
      if (!getUserMasterKey(principal)) {
        // マスターキーがない場合は新規作成
        const masterKey = generateEncryptionKey();
        saveUserMasterKey(principal, masterKey);
        console.log('Generated new master key for user:', principal.substring(0, 8) + '...');
      } else {
        console.log('Using existing master key for user:', principal.substring(0, 8) + '...');
      }
      
      setUser({
        principal: principal,
        isAuthenticated: true
      });
      
      return { success: true };
    } catch (error) {
      console.error('Internet Identity login failed:', error);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  }

  // ログアウト処理
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

  // コンテキスト値の作成
  const value = {
    user,
    loading,
    login: handleLogin,
    logout: handleLogout,
  };

  // プロバイダーでラップして値を提供
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}