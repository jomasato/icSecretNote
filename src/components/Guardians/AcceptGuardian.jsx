import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { isAuthenticated, login, getCurrentPrincipal } from '../../services/auth';
import { generateKeyPair } from '../../services/crypto';
import Loading from '../common/Loading';

function AcceptGuardian() {
  const [invitationData, setInvitationData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [step, setStep] = useState(1); // 1: 検証, 2: 認証, 3: 承認, 4: 完了
  const [userPrincipal, setUserPrincipal] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // URLからトークンを解析
    const parseInvitation = async () => {
      try {
        setLoading(true);
        
        // URLからクエリパラメータを取得
        const params = new URLSearchParams(location.search);
        const token = params.get('token');
        
        if (!token) {
          throw new Error('招待トークンが見つかりません');
        }
        
        // トークンをデコード
        const decodedData = JSON.parse(atob(token));
        
        // 有効性チェック
        if (!decodedData.type || decodedData.type !== 'guardian-invitation') {
          throw new Error('無効な招待形式です');
        }
        
        // 有効期限チェック
        if (decodedData.expiresAt && Date.now() > decodedData.expiresAt) {
          throw new Error('招待の有効期限が切れています');
        }
        
        setInvitationData(decodedData);
        
        // 認証状態を確認
        const authenticated = await isAuthenticated();
        if (authenticated) {
          const principal = await getCurrentPrincipal();
          setUserPrincipal(principal.toString());
          setStep(3); // 承認ステップへ
        } else {
          setStep(2); // 認証ステップへ
        }
      } catch (err) {
        console.error('招待の解析に失敗しました:', err);
        setError(err.message || '招待の解析に失敗しました');
      } finally {
        setLoading(false);
      }
    };
    
    parseInvitation();
  }, [location]);

  const handleLogin = async () => {
    try {
      setLoading(true);
      
      // ログイン処理
      const result = await login();
      
      // プリンシパルを設定
      setUserPrincipal(result.principal);
      
      // 承認ステップへ
      setStep(3);
    } catch (err) {
      console.error('ログインに失敗しました:', err);
      setError('ログインに失敗しました。もう一度お試しください。');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    try {
      setLoading(true);
      
      // 公開鍵/秘密鍵ペアを生成
      const keyPair = await generateKeyPair();
      
      // ガーディアンとしての承認リクエストを送信
      // オーナーのプリンシパルIDと公開鍵を含む
      
      // ここでAPI呼び出しなどを行う
      // (実際の実装はこちらで追加)
      
      // 成功したら次のステップへ
      setStep(4);
    } catch (err) {
      console.error('ガーディアン承認に失敗しました:', err);
      setError('ガーディアン承認に失敗しました。もう一度お試しください。');
    } finally {
      setLoading(false);
    }
  };

  if (loading && step === 1) {
    return <Loading message="招待情報を読み込み中..." />;
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-lg shadow-lg">
        <div className="text-center">
          <svg className="mx-auto h-12 w-12 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h2 className="mt-2 text-lg font-medium text-gray-900">エラーが発生しました</h2>
          <p className="mt-1 text-sm text-gray-500">{error}</p>
          <div className="mt-6">
            <button
              onClick={() => navigate('/')}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none"
            >
              ホームに戻る
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-lg shadow-lg">
      {step === 2 && (
        <div>
          <div className="text-center mb-6">
            <svg className="mx-auto h-12 w-12 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
            </svg>
            <h2 className="mt-2 text-lg font-medium text-gray-900">ガーディアン招待</h2>
          </div>

          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  続行するには Internet Identity でログインする必要があります。
                </p>
              </div>
            </div>
          </div>

          <p className="text-gray-600 mb-6">
            <strong>{invitationData?.userPrincipal}</strong> があなたを Secure Notes アプリのガーディアンとして招待しています。ガーディアンは、ユーザーがデバイスアクセスを失った場合にアカウント回復を支援します。
          </p>

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none"
          >
            {loading ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                ログイン中...
              </span>
            ) : (
              'Internet Identity でログイン'
            )}
          </button>
        </div>
      )}

      {step === 3 && (
        <div>
          <div className="text-center mb-6">
            <svg className="mx-auto h-12 w-12 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <h2 className="mt-2 text-lg font-medium text-gray-900">ガーディアンになる</h2>
          </div>

          <div className="bg-gray-50 rounded-md p-4 mb-6">
            <h3 className="text-sm font-medium text-gray-900 mb-2">招待詳細</h3>
            <p className="text-sm text-gray-600">
              <span className="font-medium">招待元:</span> {invitationData?.userPrincipal}
            </p>
            {invitationData?.expiresAt && (
              <p className="text-sm text-gray-600 mt-1">
                <span className="font-medium">有効期限:</span> {new Date(invitationData.expiresAt).toLocaleString()}
              </p>
            )}
          </div>

          <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-blue-700">
                  <span className="font-medium">ガーディアンの役割:</span> ガーディアンとして、あなたはリカバリープロセスを承認し、リカバリーキーのシェアを安全に保管します。友人があなたに連絡した場合にのみ、リカバリーリクエストを承認してください。
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end">
            <button
              onClick={() => navigate('/')}
              className="mr-2 bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            >
              拒否
            </button>
            <button
              onClick={handleAccept}
              disabled={loading}
              className="bg-primary-600 hover:bg-primary-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            >
              {loading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
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
      )}

      {step === 4 && (
        <div className="text-center py-6">
          <svg className="mx-auto h-16 w-16 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="mt-4 text-lg font-medium text-gray-900">ガーディアン登録完了</h2>
          <p className="mt-2 text-gray-600">
            あなたは正常にガーディアンとして登録されました。ユーザーがアカウント回復を必要とする場合、承認リクエストが表示されます。
          </p>
          <div className="mt-6">
            <button
              onClick={() => navigate('/')}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none"
            >
              ホームに移動
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default AcceptGuardian;