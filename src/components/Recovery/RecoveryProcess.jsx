import React, { useState, useEffect,useCallback } from 'react';
import { Principal } from '@dfinity/principal';
import { 
  initiateRecovery, 
  getRecoveryStatus,
  finalizeRecovery,
  activateRecoveredAccount
} from '../../services/api';
import { combineShares,generateKeyPair } from '../../services/crypto';
import { saveUserMasterKey } from '../../services/improved-crypto';
import Loading from '../common/Loading';

function RecoveryProcess() {
  const [userToRecover, setUserToRecover] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [recoveryInitiated, setRecoveryInitiated] = useState(false);
  const [step, setStep] = useState(1); // 1: 入力, 2: 処理中, 3: 完了
  const [devicesAvailable, setDevicesAvailable] = useState([]);
  const [newDeviceName, setNewDeviceName] = useState('');
  const [processingFinal, setProcessingFinal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  
  // ステータスポーリング用インターバル
  useEffect(() => {
    let statusInterval;
    
    if (recoveryInitiated && userToRecover) {
      // ポーリング開始
      statusInterval = setInterval(() => {
        checkRecoveryStatus();
      }, 5000); // 5秒ごとにチェック
    }
    
    return () => {
      if (statusInterval) {
        clearInterval(statusInterval);
      }
    };
  }, [recoveryInitiated, userToRecover]);
  
  // リカバリー状態確認
  const checkRecoveryStatus = useCallback(async () => {
    try {
      if (!userToRecover) return;
      
      const result = await getRecoveryStatus(userToRecover);
      setStatus(result);
      
      // リカバリー完了ステップ
      if (result.session.status === 'Completed') {
        setStep(3);
        
        // 最低限1つのデバイスを設定
        if (devicesAvailable.length === 0) {
          // 新しいデバイスキーを生成
          const deviceKeyPair = await generateKeyPair();
          
          // 復元されたアカウント用のデバイス情報を保存
          setDevicesAvailable([
            { name: 'Recovered Device', keyPair: deviceKeyPair, id: Date.now().toString() }
          ]);
        }
      } else if (result.session.status === 'SharesCollected') {
        // シェアが収集されたステップ
        setStep(2.5);
      }
    } catch (err) {
      console.error('Failed to check recovery status:', err);
      // ポーリングの場合はエラー表示しない（UX改善のため）
    }
  }, [userToRecover, devicesAvailable]);
  
  // リカバリー開始処理
  const handleInitiateRecovery = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    
    try {
      // プリンシパルIDの検証
      try {
        Principal.fromText(userToRecover);
      } catch (err) {
        throw new Error('プリンシパルIDの形式が正しくありません。有効なInternet Identityプリンシパルを入力してください。');
      }
      
      // リカバリー開始APIコール
      const result = await initiateRecovery(userToRecover);
      
      if (!result.success) {
        throw new Error(result.error || 'リカバリーの開始に失敗しました。もう一度お試しください。');
      }
      
      setRecoveryInitiated(true);
      setStep(2);
      await checkRecoveryStatus();
    } catch (err) {
      console.error('Failed to initiate recovery:', err);
      setError(err.message || 'リカバリーの開始に失敗しました');
    } finally {
      setLoading(false);
    }
  };
  
  // リカバリー完了処理
  const handleFinalizeRecovery = async () => {
    if (!newDeviceName.trim()) {
      setError('新しいデバイス名を入力してください');
      return;
    }
    
    setProcessingFinal(true);
    setError(null);
    
    try {
      if (!status || !status.session.tempAccessPrincipal) {
        throw new Error('仮アクセスプリンシパルが見つかりません');
      }
      
      const newDevice = devicesAvailable[0];
      
      if (!newDevice || !newDevice.keyPair) {
        throw new Error('デバイスキーペアが見つかりません');
      }
      
      // リカバリーの最終処理
      const finalizeResult = await finalizeRecovery(
        userToRecover,
        status.session.tempAccessPrincipal,
        newDevice.keyPair.publicKey
      );
      
      if (!finalizeResult.success) {
        throw new Error(finalizeResult.error || 'リカバリー処理の最終化に失敗しました');
      }
      
      // デバイスの有効化
      const activateResult = await activateRecoveredAccount(
        userToRecover, 
        newDeviceName, 
        newDevice.keyPair.publicKey
      );
      
      if (!activateResult.success) {
        throw new Error(activateResult.error || 'リカバリーされたアカウントの有効化に失敗しました');
      }
      
      // 成功処理
      setSuccessMessage(`アカウントのリカバリーが完了しました。デバイス "${newDeviceName}" が正常に設定されました。`);
      
      // マスターキーと秘密鍵をローカルに保存
      localStorage.setItem('devicePrivateKey', newDevice.keyPair.privateKey);
      
      // 仮のマスターキー - 実際にはバックエンドから取得または再構築
      if (status.masterKey) {
        saveUserMasterKey(userToRecover, status.masterKey);
      }
      
      // 3秒後にログインページにリダイレクト
      setTimeout(() => {
        window.location.href = '/login';
      }, 3000);
      
    } catch (err) {
      console.error('Recovery finalization failed:', err);
      setError(err.message || 'リカバリー処理の完了に失敗しました');
    } finally {
      setProcessingFinal(false);
    }
  };
  
  // ステータスバッジ
  const renderStatusBadge = (currentStatus) => {
    let color;
    switch (currentStatus) {
      case 'Requested':
        color = 'bg-yellow-100 text-yellow-800';
        break;
      case 'InProgress':
        color = 'bg-blue-100 text-blue-800';
        break;
      case 'ApprovalComplete':
        color = 'bg-indigo-100 text-indigo-800';
        break;
      case 'SharesCollected':
        color = 'bg-purple-100 text-purple-800';
        break;
      case 'Completed':
        color = 'bg-green-100 text-green-800';
        break;
      case 'Failed':
        color = 'bg-red-100 text-red-800';
        break;
      default:
        color = 'bg-gray-100 text-gray-800';
    }

    return (
      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${color}`}>
        {currentStatus}
      </span>
    );
  };
  
  // リカバリー完了ステップ
  if (step === 3) {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">アカウントリカバリー</h1>
        
        <div className="bg-white shadow-md rounded-lg p-6 mb-6">
          <div className="flex items-center mb-4">
            <div className="flex-shrink-0 bg-green-100 rounded-full p-2">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="ml-3 text-xl font-semibold text-gray-900">リカバリー完了</h2>
          </div>
          
          {successMessage ? (
            <div className="mb-6">
              <div className="bg-green-50 border border-green-200 rounded p-4 mb-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-green-700">
                      {successMessage}
                    </p>
                    <p className="text-sm text-green-700 mt-2">
                      ログインページにリダイレクトしています...
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="text-center">
                <Loading />
              </div>
            </div>
          ) : (
            <>
              <p className="text-gray-600 mb-4">
                アカウントのリカバリーが完了しました！このデバイスで新しいセッションを設定するには、以下の情報を入力してください。
              </p>
              
              {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
                  <span className="block sm:inline">{error}</span>
                </div>
              )}
              
              <div className="mb-6">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <dl className="space-y-2">
                    <div className="grid grid-cols-3 gap-4">
                      <dt className="text-sm font-medium text-gray-500">仮アクセスプリンシパル:</dt>
                      <dd className="text-sm text-gray-900 col-span-2 break-all">
                        {status?.session?.tempAccessPrincipal}
                      </dd>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <dt className="text-sm font-medium text-gray-500">回復されたユーザー:</dt>
                      <dd className="text-sm text-gray-900 col-span-2">
                        {userToRecover}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
              
              <div className="mb-6">
                <label htmlFor="newDeviceName" className="block text-sm font-medium text-gray-700 mb-2">
                  新しいデバイス名
                </label>
                <input
                  type="text"
                  id="newDeviceName"
                  value={newDeviceName}
                  onChange={(e) => setNewDeviceName(e.target.value)}
                  className="shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border-gray-300 rounded-md"
                  placeholder="例: リカバリーPC"
                  required
                />
              </div>
              
              <div className="flex justify-center">
                <button
                  onClick={handleFinalizeRecovery}
                  disabled={processingFinal || !newDeviceName.trim()}
                  className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  {processingFinal ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      処理中...
                    </span>
                  ) : (
                    'リカバリーを完了する'
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }
  
  // シェア収集完了ステップ
  if (step === 2.5) {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">アカウントリカバリー</h1>
        
        <div className="bg-white shadow-md rounded-lg p-6 mb-6">
          <div className="flex items-center mb-4">
            <div className="flex-shrink-0 bg-blue-100 rounded-full p-2">
              <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h2 className="ml-3 text-xl font-semibold text-gray-900">
              最終処理中
              {status && renderStatusBadge(status.session.status)}
            </h2>
          </div>
          
          <div className="text-center py-8">
            <Loading />
            <p className="mt-4 text-gray-600">
              必要なシェアが全て集まりました。マスターキーを再構築中です...
            </p>
            <p className="mt-2 text-sm text-gray-500">
              この処理には数分かかることがあります。このページを開いたままお待ちください。
            </p>
          </div>
        </div>
      </div>
    );
  }
  
  // リカバリー進行中のステップ
  if (step === 2) {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">アカウントリカバリー</h1>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
            <span className="block sm:inline">{error}</span>
          </div>
        )}
        
        <div className="bg-white shadow-md rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">リカバリーステータス</h2>
            {status && renderStatusBadge(status.session.status)}
          </div>
          
          {status ? (
            <div className="space-y-6">
              <div>
                <p className="text-sm text-gray-500">
                  リクエスト時間: {new Date(status.session.requestTime).toLocaleString()}
                </p>
                <p className="text-sm text-gray-500">
                  必要シェア数: {status.profile.requiredShares} / {status.profile.totalGuardians}
                </p>
              </div>
              
              <div className="border-t border-gray-200 pt-4">
                <h4 className="font-medium mb-2">ガーディアンの承認</h4>
                <p className="text-sm mb-2">
                  {status.session.approvedGuardians.length} / {status.profile.requiredShares} ガーディアンが承認済み
                </p>
                
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className="bg-primary-600 h-2.5 rounded-full transition-all duration-500 ease-in-out"
                    style={{ width: `${(status.session.approvedGuardians.length / status.profile.requiredShares) * 100}%` }}
                  ></div>
                </div>
              </div>
              
              <div className="border-t border-gray-200 pt-4">
                <h4 className="font-medium mb-2">シェア収集</h4>
                <p className="text-sm mb-2">
                  {status.session.collectedShares.length} / {status.profile.requiredShares} シェアが収集済み
                </p>
                
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className="bg-green-600 h-2.5 rounded-full transition-all duration-500 ease-in-out"
                    style={{ width: `${(status.session.collectedShares.length / status.profile.requiredShares) * 100}%` }}
                  ></div>
                </div>
              </div>
              
              <div className="border-t border-gray-200 pt-4">
                <h4 className="font-medium mb-2">次のステップ</h4>
                <p className="text-sm text-gray-600 mb-2">
                  ガーディアンに連絡して、リカバリーリクエストを承認してもらってください：
                </p>
                <ol className="list-decimal list-inside text-sm text-gray-600 space-y-1 pl-4">
                  <li>ガーディアンにあなたのリカバリーリクエストを伝えてください</li>
                  <li>ガーディアンはセキュアノートアプリにログインし、「ガーディアンリクエスト」セクションで承認します</li>
                  <li>必要な数のガーディアンが承認すると、リカバリーが完了します</li>
                </ol>
              </div>
              
              <div className="text-center text-sm text-gray-500">
                <p>このページはリカバリーが完了するまで自動的に更新されます</p>
                <p>ガーディアンが承認するたびに進行状況が更新されます</p>
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <Loading />
              <p className="mt-4 text-gray-600">リカバリーステータスを確認中...</p>
            </div>
          )}
        </div>
      </div>
    );
  }
  
  // 初期入力ステップ
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">アカウントリカバリー</h1>

      <div className="bg-white shadow-md rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">アカウントを回復</h2>
        <p className="text-gray-600 mb-4">
          デバイスまたはInternet Identityへのアクセスを失った場合、ガーディアンの助けを借りてアカウントを回復できます。
        </p>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
            <span className="block sm:inline">{error}</span>
          </div>
        )}

      <form onSubmit={handleInitiateRecovery}>
        <div className="mb-4">
          <label htmlFor="userToRecover" className="block text-gray-700 text-sm font-bold mb-2">
            あなたのプリンシパルID
          </label>
          <input
            type="text"
            id="userToRecover"
            value={userToRecover}
            onChange={(e) => setUserToRecover(e.target.value)}
            className="bg-gray-50 border border-gray-300 text-gray-900 shadow appearance-none rounded w-full py-2 px-3 leading-tight focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            placeholder="例: w3gef-eqllq-zz..."
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            これはあなたのInternet Identityプリンシパルです。IDが分からない場合は、ガーディアンに確認してください。
          </p>
        </div>

        <div className="mb-6 bg-yellow-50 border-l-4 border-yellow-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                リカバリーを開始すると、設定された数のガーディアンの承認が必要です。あらかじめガーディアンに連絡を取っておくことをお勧めします。
              </p>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !userToRecover}
          className="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:bg-primary-400 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              リカバリーを開始中...
            </span>
          ) : (
            'リカバリーを開始'
          )}
        </button>
      </form>
      </div>
      
      <div className="bg-white shadow-md rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-3">リカバリープロセスについて</h3>
        <div className="space-y-4">
          <div className="flex items-start">
            <div className="flex-shrink-0 bg-blue-100 rounded-full p-1">
              <span className="text-blue-600 font-semibold text-sm">1</span>
            </div>
            <div className="ml-3">
              <p className="text-sm text-gray-600">リカバリーリクエストを開始します</p>
            </div>
          </div>
          <div className="flex items-start">
            <div className="flex-shrink-0 bg-blue-100 rounded-full p-1">
              <span className="text-blue-600 font-semibold text-sm">2</span>
            </div>
            <div className="ml-3">
              <p className="text-sm text-gray-600">ガーディアンに通知が送信され、リクエストの承認を求められます</p>
            </div>
          </div>
          <div className="flex items-start">
            <div className="flex-shrink-0 bg-blue-100 rounded-full p-1">
              <span className="text-blue-600 font-semibold text-sm">3</span>
            </div>
            <div className="ml-3">
              <p className="text-sm text-gray-600">必要な数のガーディアンが承認すると、リカバリーが完了します</p>
            </div>
          </div>
          <div className="flex items-start">
            <div className="flex-shrink-0 bg-blue-100 rounded-full p-1">
              <span className="text-blue-600 font-semibold text-sm">4</span>
            </div>
            <div className="ml-3">
              <p className="text-sm text-gray-600">新しいデバイスでアカウントにアクセスできるようになります</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RecoveryProcess;