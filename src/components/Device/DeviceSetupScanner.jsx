import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { setupNewDevice } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import Loading from '../common/Loading';
import { login } from '../../services/auth';
import { processDeviceLinkResult } from '../../services/api';

function DeviceSetupScanner() {
  const [setupToken, setSetupToken] = useState('');
  const [scanning, setScanning] = useState(false);
  const [manualInput, setManualInput] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();  // user情報を取得
  const scannerRef = useRef(null);
  const qrContainerRef = useRef(null);

  // ログイン状態のチェック
  useEffect(() => {
    if (!user) {
      // ログインしていなければログインページにリダイレクト
      navigate('/login', { state: { returnTo: '/link-device' } });
    }
  }, [user, navigate]);


  useEffect(() => {
    // コンポーネントのアンマウント時にスキャナーをクリーンアップ
    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear();
      }
    };
  }, []);

  // QRスキャナーの初期化
  useEffect(() => {
    if (scanning && qrContainerRef.current) {
      // 既存のスキャナーがあればクリーンアップ
      if (scannerRef.current) {
        scannerRef.current.clear();
      }

      // 新しいスキャナーを作成
      const scanner = new Html5QrcodeScanner(
        'qr-reader',
        { 
          fps: 10, 
          qrbox: { width: 250, height: 250 },
          // カメラの選択肢を設定
          videoConstraints: {
            facingMode: { ideal: "environment" }
          }
        },
        /* verbose= */ false
      );

      // スキャン成功ハンドラー
      const onScanSuccess = (decodedText) => {
        // スキャナーを停止
        scanner.clear();
        setScanning(false);
        
        // 結果を処理
        setSetupToken(decodedText);
        handleSetup(decodedText);
      };

      // スキャン失敗ハンドラー（エラーが多発するためコメントアウト）
      const onScanFailure = (error) => {
        // ここでは何もしない（エラーが頻繁にログに出力されるため）
        // console.warn(`QR scan error: ${error}`);
      };

      // スキャナーを開始
      scanner.render(onScanSuccess, onScanFailure);
      
      // 参照を保存
      scannerRef.current = scanner;
    }
  }, [scanning]);

  // デバイスセットアップ処理
  const handleSetup = async (token) => {
    setLoading(true);
    setError(null);
    
    try {
      // Process the scanned QR code result
      const result = await processDeviceLinkResult(token);
      
      if (!result) {
        throw new Error('デバイスのセットアップに失敗しました。もう一度試してください。');
      }
      
      setSuccess(true);
    
      // 3秒後にリダイレクト
      setTimeout(() => {
        navigate('/notes');
      }, 3000);
      
    } catch (err) {
      console.error('デバイスセットアップエラー:', err);
      setError(err.message || 'デバイスのセットアップに失敗しました');
    } finally {
      setLoading(false);
    }
  };


  // 手動入力フォーム送信
  const handleSubmit = (e) => {
    e.preventDefault();
    if (setupToken) {
      handleSetup(setupToken);
    } else {
      setError('セットアップコードを入力してください');
    }
  };

  // スキャン開始
  const startScanning = () => {
    setScanning(true);
    setError(null);
  };

  // スキャン停止
  const stopScanning = () => {
    if (scannerRef.current) {
      scannerRef.current.clear();
    }
    setScanning(false);
  };

  // 成功画面の表示
  if (success) {
    return (
      <div className="container mx-auto p-4 max-w-md">
        <div className="bg-white shadow-md rounded-lg p-6 text-center">
          <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-4">
            <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">セットアップ完了!</h2>
          <p className="text-gray-600 mb-6">このデバイスで暗号化されたノートにアクセスできるようになりました。(3秒待ってもリダイレクトしない場合は画面をリロードし、再度ログインしてください)</p>
          <div className="flex justify-center">
            <div className="bg-gray-100 text-gray-700 px-4 py-2 rounded">
              <Loading />
              <p className="mt-2">自動ログイン中...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-md">
      <div className="bg-white shadow-md rounded-lg p-6">
        <h2 className="text-xl font-bold text-center mb-6">デバイスをセットアップ</h2>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
            <span className="block sm:inline">{error}</span>
          </div>
        )}
        
        {loading ? (
          <div className="text-center py-6">
            <Loading />
            <p className="mt-4 text-gray-600">デバイスをセットアップ中...</p>
          </div>
        ) : (
          <>
            {scanning ? (
              <div className="mb-6">
                <div className="mb-4">
                  <p className="text-gray-600 text-center mb-2">QRコードを枠内に配置してスキャンしてください</p>
                  <div className="relative rounded overflow-hidden">
                    {/* QRスキャナーのコンテナ */}
                    <div id="qr-reader" ref={qrContainerRef} style={{ width: '100%' }}></div>
                  </div>
                </div>
                <div className="text-center mt-4">
                  <button
                    onClick={stopScanning}
                    className="text-primary-600 hover:text-primary-800 font-medium"
                  >
                    スキャンをキャンセル
                  </button>
                </div>
              </div>
            ) : manualInput ? (
              <form onSubmit={handleSubmit} className="mb-6">
                <div className="mb-4">
                  <label htmlFor="setupToken" className="block text-gray-700 text-sm font-bold mb-2">
                  QRコードが読み取れない場合は、セットアップコードを貼り付けてください。
                  </label>
                  <textarea
                    id="setupToken"
                    value={setupToken}
                    onChange={(e) => setSetupToken(e.target.value)}
                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    placeholder="セットアップコードを貼り付けてください"
                    rows={4}
                    required
                  />
                </div>
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      setManualInput(false);
                      setSetupToken('');
                    }}
                    className="text-gray-600 hover:text-gray-800"
                  >
                    戻る
                  </button>
                  <button
                    type="submit"
                    disabled={!setupToken.trim()}
                    className="bg-primary-600 hover:bg-primary-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                  >
                    セットアップ
                  </button>
                </div>
              </form>
            ) : (
              <div className="text-center py-6">
                <div className="mb-6">
                  <div className="w-24 h-24 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <svg className="h-12 w-12 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="text-gray-600 mb-6">
                    このデバイスをアカウントに接続するには、他のデバイスで生成したQRコードをスキャンするか、セットアップコードを入力してください。
                  </p>
                </div>
                <div className="flex flex-col space-y-3">
                  <button
                    onClick={startScanning}
                    className="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-3 px-4 rounded focus:outline-none focus:shadow-outline"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 inline mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    QRコードをスキャン
                  </button>
                  <button
                    onClick={() => setManualInput(true)}
                    className="w-full bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-3 px-4 rounded focus:outline-none focus:shadow-outline"
                  >
                    コードを手動入力
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default DeviceSetupScanner;