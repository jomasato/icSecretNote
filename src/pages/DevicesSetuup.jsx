import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { setupNewDevice, isAuthenticated, login } from '../../services/api';
import QrReader from 'react-qr-reader';
import Loading from '../common/Loading';

function DeviceSetup() {
  const [step, setStep] = useState(1); // 1: 開始画面, 2: QRスキャン, 3: トークン入力, 4: 処理中, 5: 完了
  const [setupToken, setSetupToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [scanError, setScanError] = useState(null);
  const [isAuth, setIsAuth] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // 認証状態を確認
    const checkAuth = async () => {
      try {
        const authed = await isAuthenticated();
        setIsAuth(authed);
      } catch (err) {
        console.error('認証確認エラー:', err);
        setIsAuth(false);
      }
    };

    checkAuth();
  }, []);

  const handleScan = (data) => {
    if (data) {
      setSetupToken(data);
      setStep(4); // スキャン成功後、すぐに処理ステップへ
      processSetupToken(data);
    }
  };

  const handleScanError = (err) => {
    console.error('QRスキャンエラー:', err);
    setScanError('QRコードのスキャンに失敗しました。トークンを手動で入力するか、もう一度お試しください。');
  };

  const handleTokenSubmit = (e) => {
    e.preventDefault();
    if (!setupToken.trim()) {
      setError('セットアップトークンを入力してください');
      return;
    }
    
    setStep(4); // 処理ステップへ
    processSetupToken(setupToken);
  };

  const handleLogin = async () => {
    try {
      setLoading(true);
      await login();
      setIsAuth(true);
      
      // ログイン後、最初のステップに戻る
      setStep(1);
    } catch (err) {
      console.error('ログインエラー:', err);
      setError('ログインに失敗しました。もう一度お試しください。');
    } finally {
      setLoading(false);
    }
  };

  const processSetupToken = async (token) => {
    try {
      setLoading(true);
      setError(null);
      
      // 新しいデバイスをセットアップ
      await setupNewDevice(token);
      
      // 成功したら完了ステップへ
      setStep(5);
    } catch (err) {
      console.error('デバイスセットアップエラー:', err);
      setError('デバイスセットアップに失敗しました: ' + err.message);
      setStep(3); // エラー発生時はトークン入力画面に戻る
    } finally {
      setLoading(false);
    }
  };

  // 認証が必要でまだ認証されていない場合、ログイン画面を表示
  if (!isAuth) {
    return (
      <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-lg shadow-lg">
        <div className="text-center mb-6">
          <svg className="mx-auto h-12 w-12 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <h2 className="mt-2 text-lg font-medium text-gray-900">新しいデバイスをセットアップ</h2>
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

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
            <span className="block sm:inline">{error}</span>
          </div>
        )}

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
    );
  }

  return (
    <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-lg shadow-lg">
      {step === 1 && (
        <div>
          <div className="text-center mb-6">
            <svg className="mx-auto h-12 w-12 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <h2 className="mt-2 text-lg font-medium text-gray-900">デバイスをセットアップ</h2>
          </div>

          <p className="text-gray-600 mb-6">
            既存のアカウントを新しいデバイスに追加するには、元のデバイスでQRコードを生成し、このデバイスでスキャンするか、セットアップトークンを入力します。
          </p>

          <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-blue-700">
                  元のデバイスで「デバイス管理」→「デバイスを追加」からセットアップ情報を取得してください。
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <button
              onClick={() => setStep(2)}
              className="w-full flex items-center justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none"
            >
              <svg className="mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              </svg>
              QRコードをスキャン
            </button>
            <button
              onClick={() => setStep(3)}
              className="w-full flex items-center justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
            >
              <svg className="mr-2 h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              トークンを手動で入力
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          <div className="text-center mb-6">
            <h2 className="text-lg font-medium text-gray-900">QRコードをスキャン</h2>
            <p className="mt-1 text-sm text-gray-500">
              元のデバイスに表示されているQRコードをスキャンしてください。
            </p>
          </div>

          {scanError && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
              <span className="block sm:inline">{scanError}</span>
            </div>
          )}

          <div className="mb-6">
            <QrReader
              delay={300}
              onError={handleScanError}
              onScan={handleScan}
              style={{ width: '100%' }}
              className="rounded-lg overflow-hidden"
            />
          </div>

          <div className="flex justify-between">
            <button
              onClick={() => setStep(1)}
              className="py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
            >
              戻る
            </button>
            <button
              onClick={() => setStep(3)}
              className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none"
            >
              トークンを手動で入力
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div>
          <div className="text-center mb-6">
            <h2 className="text-lg font-medium text-gray-900">セットアップトークンを入力</h2>
            <p className="mt-1 text-sm text-gray-500">
              元のデバイスに表示されているセットアップトークンを入力してください。
            </p>
          </div>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
              <span className="block sm:inline">{error}</span>
            </div>
          )}

          <form onSubmit={handleTokenSubmit}>
            <div className="mb-4">
              <label htmlFor="setupToken" className="block text-sm font-medium text-gray-700 mb-1">
                セットアップトークン
              </label>
              <textarea
                id="setupToken"
                value={setupToken}
                onChange={(e) => setSetupToken(e.target.value)}
                className="shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border-gray-300 rounded-md h-24"
                placeholder="ここにトークンを貼り付けてください"
                required
              />
            </div>

            <div className="flex justify-between">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
              >
                戻る
              </button>
              <button
                type="submit"
                disabled={loading}
                className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none"
              >
                セットアップ
              </button>
            </div>
          </form>
        </div>
      )}

      {step === 4 && (
        <div className="text-center py-8">
          <Loading message="デバイスをセットアップ中..." />
          <p className="mt-4 text-sm text-gray-500">
            暗号化キーを設定しています。このプロセスには数秒かかる場合があります。
          </p>
        </div>
      )}

      {step === 5 && (
        <div className="text-center py-6">
          <svg className="mx-auto h-16 w-16 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="mt-4 text-lg font-medium text-gray-900">セットアップ完了！</h2>
          <p className="mt-2 text-gray-600">
            デバイスが正常にセットアップされました。これで暗号化されたノートにアクセスできます。
          </p>
          <div className="mt-6">
            <button
              onClick={() => navigate('/notes')}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none"
            >
              マイノートへ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default DeviceSetup;