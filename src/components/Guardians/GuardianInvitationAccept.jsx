import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { acceptGuardianInvitation, verifyInvitationToken } from '../../services/api';
import { storeShareInIndexedDB } from '../../services/guardianStorage';
import Loading from '../common/Loading';
import { acceptInvitation } from '../../services/inviteTracking';


function GuardianInvitationAccept() {
  const [token, setToken] = useState('');
  const [principalId, setPrincipalId] = useState('');
  const [shareData, setShareData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [error, setError] = useState(null);
  const [tokenInfo, setTokenInfo] = useState(null);
  const [success, setSuccess] = useState(false);
  const [debugInfo, setDebugInfo] = useState('初期状態');
  
  const navigate = useNavigate();
  const location = useLocation();
  const { user, login, loading: authLoading } = useAuth();
  const [shareStorageSuccess, setShareStorageSuccess] = useState(false);

  // URLパラメータの取得とパース
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const urlToken = searchParams.get('token');
    const urlPrincipal = searchParams.get('principal');
    const urlShareData = searchParams.get('shareData');
    
    console.log('URL パラメータ:', { urlToken, urlPrincipal, shareDataExists: !!urlShareData });
    setDebugInfo(prev => prev + `\nURL解析: token=${!!urlToken}, principal=${!!urlPrincipal}`);
    
    if (urlToken) {
      setToken(urlToken);
    }
    
    if (urlPrincipal) {
      setPrincipalId(urlPrincipal);
    }
    
    // シェアデータがURLに含まれている場合は解析
    if (urlShareData) {
      try {
        const decodedData = atob(decodeURIComponent(urlShareData));
        const parsedData = JSON.parse(decodedData);
        console.log('URL から取得したシェアデータ:', parsedData);
        setShareData(parsedData);
        setDebugInfo(prev => prev + '\nシェアデータ解析成功');
      } catch (err) {
        console.error('シェアデータの解析に失敗:', err);
        setDebugInfo(prev => prev + `\nシェアデータ解析失敗: ${err.message}`);
      }
    }
    
    // トークンとプリンシパルが揃っていれば自動検証開始
    if (urlToken && urlPrincipal) {
      console.log('トークン検証を開始します');
      setDebugInfo(prev => prev + '\nトークン検証開始');
      verifyToken(urlToken, urlPrincipal);
    } else {
      setVerifying(false);
      setDebugInfo(prev => prev + '\n検証スキップ: パラメータ不足');
    }
  }, [location.search]);

  // ユーザーがログイン済みで、トークンが検証済みなら自動的に承認処理
  useEffect(() => {
    // すでに処理中または成功した場合は何もしない
    if (loading || success) return;
    
    console.log('認証状態変更: ', { 
      authLoading, 
      userExists: !!user, 
      tokenInfoExists: !!tokenInfo
    });
    
    // ユーザーとトークン情報があり、認証読み込み中でない場合のみ処理
    if (!authLoading && user && tokenInfo) {
      console.log('ユーザーログイン済み、自動承認を開始します');
      setDebugInfo(prev => prev + '\n自動承認プロセス開始');
      // 現在のフラグを保存してから処理を開始
      setLoading(true);
      handleAcceptInvitation().catch(err => {
        console.error('自動承認中にエラーが発生:', err);
        setLoading(false);
      });
    }
  }, [user, tokenInfo, authLoading, success, loading]);

  const isValidPrincipalFormat = (principalStr) => {
    // Basic validation - this is a simple check and can be improved
    return /^[a-z0-9\-]{10,63}$/.test(principalStr);
  };

  // トークンの検証
  const verifyToken = async (tokenToVerify, principal) => {
    setVerifying(true);
    setError(null);
    
    try {
      console.log(`トークン検証: ${tokenToVerify.substring(0, 10)}..., プリンシパル: ${principal}`);
      setDebugInfo(prev => prev + '\nverifyInvitationToken API呼び出し開始');
      
      const result = await verifyInvitationToken(tokenToVerify, principal);
      
      console.log('トークン検証結果:', result);
      setDebugInfo(prev => prev + `\n検証結果: ${result?.valid ? '有効' : '無効'}`);
      
      if (!result || !result.valid) {
        throw new Error(result.error || '招待トークンが無効です');
      }
      
      setTokenInfo(result);
      setDebugInfo(prev => prev + '\nトークン情報セット完了');
      
      // 検証成功後、ユーザーがログインしていなければログインを促す
      if (!user && !authLoading) {
        console.log('トークン検証成功、ログインを促します');
        setDebugInfo(prev => prev + '\nログイン促進状態');
      }
    } catch (err) {
      console.error('トークン検証エラー:', err);
      setError(err.message || '招待トークンの検証に失敗しました');
      setDebugInfo(prev => prev + `\n検証エラー: ${err.message}`);
    } finally {
      setVerifying(false);
    }
  };

  // ログイン処理
  const handleLogin = async () => {
    try {
      setLoading(true);
      setDebugInfo(prev => prev + '\nログイン処理開始');
      console.log('ログイン処理を開始します');
      
      const result = await login();
      console.log('ログイン結果:', result);
      
      if (!result || !result.success) {
        throw new Error((result && result.error) || 'ログインに失敗しました');
      }
      
      setDebugInfo(prev => prev + '\nログイン成功');
      // ログイン成功後は自動的に承認処理が行われる（useEffectによる）
    } catch (err) {
      console.error('ログインエラー:', err);
      setError(err.message || 'ログインに失敗しました');
      setDebugInfo(prev => prev + `\nログインエラー: ${err.message}`);
      setLoading(false);
    }
  };

  // 招待の受け入れ
  const handleAcceptInvitation = async () => {
    console.log('招待承認プロセスを開始します');
    setLoading(true);
    setError(null);
    setDebugInfo(prev => prev + '\n招待承認処理開始');
    
    try {
      // Log the state before proceeding
      console.log('Current state:', {
        token,
        principalId,
        shareData: shareData ? 'exists' : 'missing',
        tokenInfo: tokenInfo ? 'exists' : 'missing'
      });
      
      // Validate principal format before proceeding
      if (!principalId || !isValidPrincipalFormat(principalId)) {
        throw new Error(`無効なプリンシパルID形式です: ${principalId}`);
      }
      
      // 1. Accept invitation API call
      console.log('acceptGuardianInvitation API呼び出し');
      setDebugInfo(prev => prev + '\nacceptGuardianInvitation API呼び出し');
      
      const result = await acceptGuardianInvitation(token, principalId);
      console.log('承認API結果:', result);
      setDebugInfo(prev => prev + `\n承認結果: success=${result?.success}`);
      
      if (!result || !result.success) {
        throw new Error((result && result.error) || 'ガーディアンの招待受け入れに失敗しました');
      }
      
      // Rest of the function remains the same
      // ...
      
    } catch (err) {
      console.error('招待受け入れエラー:', err);
      
      // Provide more specific error message for principal format issues
      if (err.message.includes('プリンシパルID') || err.message.includes('Invalid principal')) {
        setError('プリンシパルIDの形式が無効です。正しい招待リンクを使用してください。');
      } else {
        setError(err.message || 'ガーディアンの招待受け入れに失敗しました');
      }
      
      setDebugInfo(prev => prev + `\n招待受け入れエラー: ${err.message}`);
    } finally {
      console.log('承認処理完了、ローディング状態解除');
      setDebugInfo(prev => prev + '\nローディング状態解除');
      setLoading(false);
    }
  };
  
  // Add success UI enhancement to show warning if share storage failed but API acceptance succeeded
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
          <p className="text-gray-600 mb-4">ガーディアンとして正常に登録されました。これで、アカウント所有者がアクセスを失った場合に回復を支援できます。</p>
          
          {/* Show warning if share storage failed */}
          {shareData && !shareStorageSuccess && (
            <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 p-3 rounded mb-4">
              <p className="text-sm">
                <strong>注意:</strong> 回復シェアの保存に問題が発生しました。アプリを再起動し、「保有シェア」タブを確認してください。
              </p>
            </div>
          )}
          
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
        ) : authLoading ? (
          <div className="text-center py-6">
            <Loading />
            <p className="mt-4 text-gray-600">認証状態を確認中...</p>
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
                  {shareData && (
                    <div className="grid grid-cols-3 gap-4">
                      <dt className="text-sm font-medium text-gray-500">回復シェア</dt>
                      <dd className="text-sm text-gray-900 col-span-2">
                        検出済み {shareData.shareInfo ? '✓' : '✗'}
                      </dd>
                    </div>
                  )}
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
              {user ? (
                // ログイン済みの場合は承認ボタンを表示
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
              ) : (
                // 未ログインの場合はログインボタンを表示
                <button
                  onClick={handleLogin}
                  disabled={loading}
                  className="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-3 px-4 rounded focus:outline-none focus:shadow-outline"
                >
                  {loading ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      ログイン中...
                    </span>
                  ) : (
                    'Internet Identityでログイン'
                  )}
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-6">
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6 text-left">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-yellow-700">
                    有効な招待リンクが見つかりません。メールに記載されたリンクをクリックするか、招待コード全体をコピーしてください。
                  </p>
                </div>
              </div>
            </div>
            
            <p className="text-gray-600 mb-4">
              招待リンクが機能しない場合は、メールの内容をすべてコピーしてください。
            </p>
            
            <button onClick={() => window.location.href = '/'} className="text-primary-600 hover:text-primary-800 font-medium">
              ホームに戻る
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default GuardianInvitationAccept;