import React, { useState, useEffect } from 'react';
import { getDevices, removeDevice } from '../../services/api';
import { getActor } from '../../services/auth';
import Loading from '../common/Loading';
import AddDevice from './AddDevice';
import DeviceQRSetup from './DeviceQRSetup.jsx';

function DevicesList() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddDevice, setShowAddDevice] = useState(false);
  const [showQRSetup, setShowQRSetup] = useState(false);
  const [noProfile, setNoProfile] = useState(false);  // プロファイルが存在しないかどうか

  useEffect(() => {
    fetchDevices();
  }, []);

  const checkAndCreateProfile = async () => {
    try {
      setLoading(true);
      const actor = await getActor();
      
      // プロファイルの作成を試みる（初期値はデフォルト）
      const deviceName = 'Initial Device';
      const publicKey = new Uint8Array([0, 0, 0, 0]); // ダミー値
      
      const result = await actor.createProfileWithDevice(
        5, // totalGuardians
        3, // requiredShares
        deviceName,
        publicKey
      );
      
      if (result.err) {
        throw new Error(result.err);
      }
      
      // プロファイル作成成功
      setNoProfile(false);
      // 作成後にデバイスを再取得
      fetchDevices();
      
    } catch (err) {
      console.error('Failed to create profile:', err);
      setError('プロファイルの作成に失敗しました。もう一度ログインしてお試しください。');
    } finally {
      setLoading(false);
    }
  };

  const fetchDevices = async () => {
    setLoading(true);
    try {
      const fetchedDevices = await getDevices();
      setDevices(fetchedDevices);
      setNoProfile(false);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch devices:', err);
      
      // プロファイルが存在しない場合の特別処理
      if (err.message === "プロファイルが見つかりません") {
        setNoProfile(true);
        setError('プロファイルが見つかりません。新しいプロファイルを作成してください。');
      } else {
        setError('デバイス情報の取得に失敗しました: ' + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveDevice = async (deviceId) => {
    if (devices.length <= 1) {
      alert('最後のデバイスは削除できません。少なくとも1つのデバイスが必要です。');
      return;
    }
    
    if (window.confirm('このデバイスを削除してもよろしいですか？この操作は元に戻せません。')) {
      setLoading(true);
      try {
        await removeDevice(deviceId);
        // ローカル状態を更新
        setDevices(devices.filter(d => d.id !== deviceId));
      } catch (err) {
        console.error('Failed to remove device:', err);
        setError('デバイスの削除に失敗しました。もう一度お試しください。');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleAddDevice = () => {
    setShowAddDevice(true);
    setShowQRSetup(false);
  };

  const handleShowQRSetup = () => {
    setShowQRSetup(true);
    setShowAddDevice(false);
  };

  const handleCloseAddDevice = () => {
    setShowAddDevice(false);
    // デバイス追加後にリストを更新
    fetchDevices();
  };

  const handleCloseQRSetup = () => {
    setShowQRSetup(false);
    // QRセットアップ後にリストを更新
    fetchDevices();
  };

  const formatDate = (date) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading && devices.length === 0 && !noProfile) {
    return <Loading />;
  }

  return (
    <div className="container mx-auto p-4">
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">マイデバイス</h1>
        <div className="space-x-2">
                <button
                  onClick={handleShowQRSetup}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                  </svg>
                  QRコードで追加
                </button>
                <button
                  onClick={handleAddDevice}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  手動で追加
                </button>
        </div>
      </div>

      {/* プロファイルが存在しない場合の表示 */}
      {noProfile && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">プロファイルが見つかりません</h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>
                  アプリを使用するには、まずユーザープロファイルを作成する必要があります。
                </p>
              </div>
              <div className="mt-4">
                <button
                  onClick={checkAndCreateProfile}
                  disabled={loading}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  {loading ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      作成中...
                    </span>
                  ) : (
                    'プロファイルを作成'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {!noProfile && (
        <>
          <div className="bg-white shadow-md rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">デバイス管理について</h2>
            <p className="text-gray-600 mb-4">
              デバイスは、セキュアノートにアクセスするために使用する物理的なハードウェアです。各デバイスには独自の暗号化キーがあります。
            </p>
            <ul className="list-disc list-inside text-gray-600 mb-4">
              <li>各デバイスは独立してノートを復号できます</li>
              <li>デバイスを紛失した場合は、アカウントから削除できます</li>
              <li>新しいデバイスを追加して、複数の場所からノートにアクセスできます</li>
              <li>常に少なくとも1つのデバイスを登録しておく必要があります</li>
            </ul>
          </div>

          {devices.length === 0 ? (
            <div className="text-center py-12 bg-white shadow-md rounded-lg">
              <svg className="mx-auto h-16 w-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <h3 className="mt-2 text-lg font-medium text-gray-900">デバイスが見つかりません</h3>
              <p className="mt-1 text-gray-500">
                通常、少なくとも1つのデバイスが必要です。
              </p>
              <div className="mt-6 flex justify-center space-x-4">
                <button
                  onClick={handleShowQRSetup}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                  </svg>
                  QRコードで追加
                </button>
                <button
                  onClick={handleAddDevice}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  手動で追加
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white shadow-md rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      デバイス名
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      登録日時
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      最終アクセス
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {devices.map((device) => (
                    <tr key={device.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center bg-gray-100 rounded-full">
                            <svg className="h-6 w-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {device.name}
                            </div>
                            <div className="text-xs text-gray-500">
                              ID: {device.id.substring(0, 8)}...
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(device.registrationTime)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(device.lastAccessTime)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleRemoveDevice(device.id)}
                          className="text-red-600 hover:text-red-900"
                          disabled={devices.length <= 1}
                        >
                          削除
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {showAddDevice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md">
            <AddDevice onClose={handleCloseAddDevice} />
          </div>
        </div>
      )}

      {showQRSetup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md">
            <DeviceQRSetup onClose={handleCloseQRSetup} />
          </div>
        </div>
      )}
    </div>
  );
}

export default DevicesList;