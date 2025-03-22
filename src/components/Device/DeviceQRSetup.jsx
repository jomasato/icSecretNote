import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { addDevice } from '../../services/api';
import { generateKeyPair } from '../../services/crypto';
import { setupDeviceLink } from '../../services/api';

function DeviceQRSetup({ onClose, onComplete }) {
  const [deviceName, setDeviceName] = useState('');
  const [setupToken, setSetupToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [step, setStep] = useState(1);
  const [countdown, setCountdown] = useState(600); // 10分のカウントダウン

  // カウントダウンタイマーの設定
  useEffect(() => {
    let timer;
    if (setupToken && countdown > 0) {
      timer = setInterval(() => {
        setCountdown(prev => prev - 1);
      }, 1000);
    } else if (countdown === 0 && setupToken) {
      // タイムアウト時の処理
      setError('セットアップトークンの有効期限が切れました。新しいトークンを生成してください。');
      setSetupToken(null);
    }
    
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [setupToken, countdown]);

// QRコード生成部分の修正
const handleGenerateQR = async (e) => {
  e.preventDefault();
  setLoading(true);
  setError(null);
  
  try {
    // 新しいsetupDeviceLink関数を呼び出し
    const result = await setupDeviceLink();
    
    if (!result || !result.token) {
      throw new Error('デバイスの追加に失敗しました');
    }
    
    // QRコード用のセットアップトークンを設定
    setSetupToken(result.token);
    setStep(2);
    setCountdown(600); // タイマーをリセット
  } catch (err) {
    console.error('QRコード生成エラー:', err);
    setError(err.message || 'デバイスのセットアップに失敗しました');
  } finally {
    setLoading(false);
  }
};

  // 新しいQRコードを生成
  const handleRegenerateQR = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // 同じデバイス名で新しいセットアップを実行
      const result = await addDevice(deviceName);
      
      if (!result || !result.setupToken) {
        throw new Error('QRコードの再生成に失敗しました');
      }
      
      setSetupToken(result.setupToken);
      setCountdown(600); // タイマーをリセット
    } catch (err) {
      console.error('QRコード再生成エラー:', err);
      setError(err.message || 'QRコードの再生成に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // セットアップ完了
  const handleSetupComplete = () => {
    onComplete && onComplete();
    onClose();
  };

  // カウントダウン表示用のフォーマット
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">
          {step === 1 ? '新規デバイスの追加' : 'デバイスをセットアップ'}
        </h2>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700"
          aria-label="Close"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      {step === 1 && (
        <form onSubmit={handleGenerateQR}>
          <div className="mb-4">
            <label htmlFor="deviceName" className="block text-gray-700 text-sm font-bold mb-2">
              デバイス名
            </label>
            <input
              type="text"
              id="deviceName"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              className="bg-gray-50 border border-gray-300 text-gray-900 shadow appearance-none rounded w-full py-2 px-3 leading-tight focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="例: マイノートPC、iPhone13"
              required
            />
          </div>

          <div className="mb-6">
            <p className="text-sm text-gray-600">
              新しいデバイスを追加すると、そのデバイスから暗号化されたノートにアクセスできるようになります。
              QRコードを使って新しいデバイスに安全にアクセス権を付与します。
            </p>
          </div>

          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={onClose}
              className="mr-2 bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={loading || !deviceName.trim()}
              className="bg-primary-600 hover:bg-primary-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:bg-primary-400 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  処理中...
                </span>
              ) : (
                'QRコードを生成'
              )}
            </button>
          </div>
        </form>
      )}

      {step === 2 && setupToken && (
        <div className="text-center">
          <div className="mb-4">
            <p className="text-green-600 font-semibold mb-2">新しいデバイスのセットアップ</p>
            <p className="text-sm text-gray-600 mb-4">
              以下のQRコードを新しいデバイスでスキャンして、セットアップを完了してください。
              このQRコードは <span className="font-bold">{formatTime(countdown)}</span> 後に無効になります。
            </p>
          </div>

          <div className="bg-white p-4 inline-block rounded-lg shadow-md mb-6">
            <QRCodeSVG
              value={setupToken}
              size={200}
              level="H"
              includeMargin={true}
            />
          </div>

          <div className="mb-6">
            <p className="text-sm text-gray-600 mb-2">
              または、以下のセットアップコードを新しいデバイスで入力してください：
            </p>
            <div className="bg-gray-100 p-2 rounded overflow-x-auto">
              <pre className="text-sm break-all text-gray-800">
                {setupToken}
              </pre>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(setupToken);
                alert('セットアップコードをクリップボードにコピーしました');
              }}
              className="mt-2 text-primary-600 hover:text-primary-800 text-sm flex items-center mx-auto"
            >
              <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
              コピー
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center space-y-2 sm:space-y-0 sm:space-x-4">
            <button
              onClick={handleRegenerateQR}
              disabled={loading}
              className="w-full sm:w-auto bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? '再生成中...' : 'QRコードを再生成'}
            </button>
            <button
              onClick={handleSetupComplete}
              className="w-full sm:w-auto bg-primary-600 hover:bg-primary-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            >
              完了
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default DeviceQRSetup;