import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { acceptGuardianInvitation, verifyInvitationToken } from '../../services/api';
import Loading from '../common/Loading';

function GuardianInvitationAccept() {
  const [token, setToken] = useState('');
  const [principalId, setPrincipalId] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [error, setError] = useState(null);
  const [tokenInfo, setTokenInfo] = useState(null);
  const [success, setSuccess] = useState(false);
  
  const navigate = useNavigate();
  const location = useLocation();
  const { user, login } = useAuth();

  // URLからトークンとプリンシパルIDを取得
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const urlToken = searchParams.get('token');
    const urlPrincipal = searchParams.get('principal');
    
    if (urlToken) {
      setToken(urlToken);
    }
    
    if (urlPrincipal) {
      setPrincipalId(urlPrincipal);
    }
    
    // トークンとプリンシパルがURLにある場合は検証
    if (urlToken && urlPrincipal) {
      verifyToken(urlToken, urlPrincipal);
    } else {
      setVerifying(false);
    }
  }, [location.search]);

  // トークンの検証
  const verifyToken = async (tokenToVerify, principal) => {
    setVerifying(true);
    setError(null);
    
    try {
      const result = await verifyInvitationToken(tokenToVerify, principal);
      
      if (!result || !result.valid) {
        throw new Error(result.error || '招待トークンが無効です');
      }
      
      setTokenInfo(result);
    } catch (err) {
      console.error('トークン検証エラー:', err);
      setError(err.message || '招待トークンの検証に失敗しました');
    } finally {
      setVerifying(false);
    }
  };

  // 招待の受け入れ
  const handleAcceptInvitation = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // ユーザーがログインしていない場合はログイン
      if (!user) {
        await login();
      }
      
      // 招待の受け入れ
      const result = await acceptGuardianInvitation(token, principalId);
      
      if (!result.success) {
        throw new Error(result.error || 'ガーディアンの招待受け入れに失敗しました');
      }
      
      setSuccess(true);
      
      // 3秒後にリダイレクト
      setTimeout(() => {
        navigate('/approve-recovery');
      }, 3000);
      
    } catch (err) {
      console.error('招待受け入れエラー:', err);
      setError(err.message || 'ガーディアンの招待受け入れに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // 手動入力の検証
  const handleManualVerify = (e) => {
    e.preventDefault();
    if (token && principalId) {
      verifyToken(token, principalId);
    } else {
      setError('招待トークンとプリンシパルIDの両方が必要です');
    }
  };

  // 成功メッセージ
  if (success) {
    return (
      <div className="container mx-auto p-4 max-w-md">
        <div className="bg-white shadow-md rounded-lg p-6 text-center">
          <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-4">
            <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">ガーディアン設定が完了しました</h2>
          <p className="text-gray-600 mb-6">ガーディアンとして正常に登録されました。これで、アカウント所有者がアクセスを失った場合に回復を支援できます。</p>
          <div className="flex justify-center">
            <div className="bg-gray-100 text-gray-700 px-4 py-2 rounded">
              <Loading />
              <p className="mt-2">リダイレクト中...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-md">
      <div className="bg-white shadow-md rounded-lg p-6">
        <h2 className="text-xl font-bold text-center mb-6">ガーディアン招待</h2>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
            <span className="block sm:inline">{error}</span>
          </div>
        )}
        
        {verifying ? (
          <div className="text-center py-6">
            <Loading />
            <p className="mt-4 text-gray-600">招待を検証中...</p>
          </div>
        ) : tokenInfo ? (
          <div className="mb-6">
            <div className="bg-green-50 border-l-4 border-green-400 p-4 mb-6">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-green-700">
                    有効な招待が見つかりました！以下の情報を確認してください。
                  </p>
                </div>
              </div>
            </div>
            
            <div className="mb-6">
              <h3 className="text-lg font-medium text-gray-900 mb-2">招待詳細</h3>
              <div className="bg-gray-50 p-4 rounded-lg">
                <dl className="space-y-2">
                  <div className="grid grid-cols-3 gap-4">
                    <dt className="text-sm font-medium text-gray-500">招待元</dt>
                    <dd className="text-sm text-gray-900 col-span-2">{tokenInfo.inviterName || tokenInfo.inviterPrincipal.substring(0, 8) + '...'}</dd>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <dt className="text-sm font-medium text-gray-500">招待日時</dt>
                    <dd className="text-sm text-gray-900 col-span-2">{new Date(tokenInfo.createdAt).toLocaleString()}</dd>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <dt className="text-sm font-medium text-gray-500">有効期限</dt>
                    <dd className="text-sm text-gray-900 col-span-2">{new Date(tokenInfo.expiresAt).toLocaleString()}</dd>
                  </div>
                </dl>
              </div>
            </div>
            
            <div className="mb-6">
              <h3 className="text-lg font-medium text-gray-900 mb-2">ガーディアンとは？</h3>
              <p className="text-gray-600 mb-4">
                ガーディアンはアカウント回復を支援する信頼できる人物です。ユーザーがアカウントアクセスを失った場合、指定された数のガーディアンが承認すれば、アカウントを回復できます。
              </p>
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-yellow-700">
                      ガーディアンとなると、アカウント回復時にその確認を求められます。この責任を引き受ける場合のみ、招待を受け入れてください。
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex justify-center">
              <button
                onClick={handleAcceptInvitation}
                disabled={loading}
                className="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-3 px-4 rounded focus:outline-none focus:shadow-outline"
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    処理中...
                  </span>
                ) : (
                  'ガーディアンになる'
                )}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleManualVerify} className="mb-6">
            <div className="mb-4">
              <label htmlFor="token" className="block text-gray-700 text-sm font-bold mb-2">
                招待トークン
              </label>
              <textarea
                id="token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                placeholder="招待トークンを貼り付けてください"
                rows={4}
                required
              />
            </div>
            
            <div className="mb-6">
              <label htmlFor="principalId" className="block text-gray-700 text-sm font-bold mb-2">
                ユーザープリンシパルID
              </label>
              <input
                type="text"
                id="principalId"
                value={principalId}
                onChange={(e) => setPrincipalId(e.target.value)}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                placeholder="例: w3gef-eqllq-zz..."
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                これは招待者のInternet Identityプリンシパルです
              </p>
            </div>
            
            <div className="flex justify-center">
              <button
                type="submit"
                disabled={!token || !principalId || loading}
                className="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-3 px-4 rounded focus:outline-none focus:shadow-outline"
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    検証中...
                  </span>
                ) : (
                  '招待を検証'
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default GuardianInvitationAccept;