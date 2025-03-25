import React, { useState, useEffect } from 'react';
import { getGuardians, removeGuardian } from '../../services/api';
import Loading from '../common/Loading';
import AddGuardian from './AddGuardian';
import RecoverySetup from '../Recovery/RecoverySetup';
import GuardianInvitation from './GuardianInvitation.jsx';
import { useAuth } from '../../context/AuthContext';
import GuardianContactEditor from './GuardianContactEditor';
import {selectedGuardian, showEditor,handleSaveGuardian} from './GuardianContactEditor';


function GuardiansList() {
  const [guardians, setGuardians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddGuardian, setShowAddGuardian] = useState(false);
  const [showRecoverySetup, setShowRecoverySetup] = useState(false);
  const [showInvitation, setShowInvitation] = useState(false);
  const [recoveryEnabled, setRecoveryEnabled] = useState(false);
  const [recoveryShares, setRecoveryShares] = useState([]);
  const { user } = useAuth();
  const [selectedGuardian, setSelectedGuardian] = useState(null);
  const [showEditor, setShowEditor] = useState(false);

  useEffect(() => {
    fetchGuardians();
    checkRecoveryStatus();
  }, []);

  

  // リカバリー状態の確認
  const checkRecoveryStatus = () => {
    // シェア情報の取得
    const sharesJson = localStorage.getItem('recoveryShares');
    if (sharesJson) {
      try {
        const shares = JSON.parse(sharesJson);
        setRecoveryShares(shares);
        
        // リカバリーが有効かどうかを確認（シェアが存在するかどうか）
        setRecoveryEnabled(shares.length > 0);
      } catch (err) {
        console.error('Failed to parse recovery shares:', err);
      }
    }
  };

  const handleEditGuardian = (guardian) => {
    setSelectedGuardian(guardian);
    setShowEditor(true);
  };
  
  const handleSaveGuardian = (updatedGuardian) => {
    // 保存成功後の処理（例：リストの更新など）
    console.log('Updated guardian:', updatedGuardian);
    // ガーディアンリストを更新
    fetchGuardians();
    // エディタを閉じる
    setShowEditor(false);
  };

  const fetchGuardians = async () => {
    setLoading(true);
    try {
      const fetchedGuardians = await getGuardians();
      setGuardians(fetchedGuardians);
      setError(null);
      
      // ガーディアン数からもリカバリー状態を更新
      if (fetchedGuardians.length > 0) {
        setRecoveryEnabled(true);
      }
    } catch (err) {
      console.error('Failed to fetch guardians:', err);
      setError('Failed to load guardians. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveGuardian = async (principal) => {
    if (window.confirm('このガーディアンを削除してもよろしいですか？この操作は元に戻せません。')) {
      setLoading(true);
      try {
        await removeGuardian(principal);
        // ローカルステートを更新
        setGuardians(guardians.filter(g => g.principal !== principal));
      } catch (err) {
        console.error('Failed to remove guardian:', err);
        setError('ガーディアンの削除に失敗しました。もう一度お試しください。');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleAddGuardian = () => {
    // リカバリーがセットアップされていなければ、まずセットアップを行う
    if (!recoveryEnabled) {
      setShowRecoverySetup(true);
    } else {
      setShowAddGuardian(true);
    }
  };

  const handleShowInvitation = () => {
    // リカバリーがセットアップされていなければ、まずセットアップを行う
    if (!recoveryEnabled) {
      setShowRecoverySetup(true);
    } else {
      setShowInvitation(true);
    }
  };

  const handleRecoverySetupComplete = (shares) => {
    setRecoveryShares(shares);
    setRecoveryEnabled(true);
    setShowRecoverySetup(false);
    
    // ユーザーが選択したアクションへリダイレクト
    if (showInvitation) {
      setShowInvitation(true);
    } else {
      setShowAddGuardian(true);
    }
  };

  const handleCloseAddGuardian = () => {
    setShowAddGuardian(false);
    // ガーディアン追加後にリストを更新
    fetchGuardians();
    checkRecoveryStatus();
  };

  const handleCloseInvitation = () => {
    setShowInvitation(false);
    // リストを再取得
    fetchGuardians();
  };

  if (loading && guardians.length === 0) {
    return <Loading />;
  }

  // ガーディアンIDを表示用にフォーマット
  const formatPrincipal = (principal) => {
    if (!principal) return '';
    if (principal.length <= 10) return principal;
    return `${principal.substring(0, 5)}...${principal.substring(principal.length - 5)}`;
  };

  return (
    <div className="container mx-auto p-4">
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
          <span className="block sm:inline">{error}</span>
        </div>
      )}

<div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">ガーディアン管理</h1>
        <div className="flex flex-row items-center gap-4">
          <button
            onClick={handleShowInvitation}
            className="inline-block bg-primary-600 hover:bg-primary-700 text-white font-bold py-2 px-3 md:px-4 rounded focus:outline-none focus:shadow-outline transition duration-150 ease-in-out"
          >
            <div className="flex items-center">
              <svg className="h-5 w-5 mr-1 md:mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span>招待を送信</span>
            </div>
          </button>
          <button
            onClick={handleAddGuardian}
            className="inline-block bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-3 md:px-4 rounded focus:outline-none focus:shadow-outline transition duration-150 ease-in-out"
          >
            <div className="flex items-center">
              <svg className="h-5 w-5 mr-1 md:mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <span>手動で追加</span>
            </div>
          </button>
        </div>
      </div>

      <div className="bg-white shadow-md rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">ガーディアンについて</h2>
        <p className="text-gray-600 mb-4">
          ガーディアンは、デバイスやInternet Identityへのアクセスを失った場合に、あなたのアカウントへの回復を支援する信頼できる連絡先です。
        </p>
        <ul className="list-disc list-inside text-gray-600 mb-4">
          <li>各ガーディアンはあなたの回復キーの暗号化されたシェアを保持します</li>
          <li>回復リクエストを承認するには一定数のガーディアンが必要です</li>
          <li>ガーディアンはあなたの許可なくノートにアクセスできません</li>
          <li>ガーディアンはあなたが連絡しやすい信頼できる人物を選んでください</li>
        </ul>
        
        {recoveryEnabled && (
          <div className="bg-green-50 border border-green-200 rounded p-3 mt-4">
            <p className="text-sm text-green-800">
              <span className="font-medium">リカバリーステータス:</span> 有効
              {recoveryShares.length > 0 && ` (未使用シェア ${recoveryShares.length}個 利用可能)`}
            </p>
          </div>
        )}
      </div>

      {guardians.length === 0 ? (
        <div className="text-center py-12 bg-white shadow-md rounded-lg">
          <svg className="mx-auto h-16 w-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <h3 className="mt-2 text-lg font-medium text-gray-900">ガーディアンがいません</h3>
          <p className="mt-1 text-gray-500">
            {recoveryEnabled 
              ? 'リカバリーが設定されていますが、まだガーディアンが追加されていません。'
              : 'アカウント回復を有効にするには、信頼できるガーディアンを追加してください。'}
          </p>
          <div className="mt-6 flex justify-center space-x-4">
            <button
              onClick={handleShowInvitation}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              招待を送信
            </button>
            <button
              onClick={handleAddGuardian}
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
                  ガーディアンID
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ステータス
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {guardians.map((guardian) => (
                <tr key={guardian.principal}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {formatPrincipal(guardian.principal)}
                    </div>
                    <div className="text-xs text-gray-500">
                      <button 
                        className="text-primary-600 hover:text-primary-800"
                        onClick={() => {
                          navigator.clipboard.writeText(guardian.principal);
                          alert('ガーディアンIDをクリップボードにコピーしました');
                        }}
                      >
                        IDをコピー
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                      アクティブ
                    </span>
                    {guardian.approved && (
                      <span className="ml-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                        回復承認済み
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleRemoveGuardian(guardian.principal)}
                      className="text-red-600 hover:text-red-900 ml-3"
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

      {showRecoverySetup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md">
            <RecoverySetup onSetupComplete={handleRecoverySetupComplete} />
          </div>
        </div>
      )}

      {showAddGuardian && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md">
            <AddGuardian 
              onClose={handleCloseAddGuardian} 
              availableShares={recoveryShares}
            />
          </div>
        </div>
      )}

      {showInvitation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md">
            <GuardianInvitation 
              onClose={handleCloseInvitation}
              userPrincipal={user?.principal}
            />
          </div>
        </div>
      )}
      {showEditor && selectedGuardian && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-2xl">
            <GuardianContactEditor 
              guardian={selectedGuardian}
              onSave={handleSaveGuardian}
              onCancel={() => setShowEditor(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}



export default GuardiansList;