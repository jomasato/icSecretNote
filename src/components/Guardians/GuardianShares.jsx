import React, { useState, useEffect } from 'react';
import { getAllShares, deleteShare, searchShares,updateShareUserName } from '../../services/guardianStorage';
import Loading from '../common/Loading';

function GuardianShares() {
  const [shares, setShares] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedShare, setSelectedShare] = useState(null);
  const [showShareDetails, setShowShareDetails] = useState(false);
  const [editingShareId, setEditingShareId] = useState(null);
  const [editingName, setEditingName] = useState('');

  // シェアを取得
  useEffect(() => {
    fetchShares();
  }, []);
  const fetchShares = async () => {
    setLoading(true);
    try {
      // 検索語句がある場合は検索、なければ全件取得
      const result = searchTerm 
        ? await searchShares(searchTerm)
        : await getAllShares();
      
      setShares(result);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch shares:', err);
      setError('シェアの取得に失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  // 検索処理
  const handleSearch = (e) => {
    e.preventDefault();
    fetchShares();
  };

  // シェアを削除
  const handleDeleteShare = async (shareId) => {
    if (window.confirm('このシェアを削除してもよろしいですか？この操作は元に戻せません。')) {
      try {
        await deleteShare(shareId);
        // 削除後にリスト更新
        fetchShares();
      } catch (err) {
        console.error('Failed to delete share:', err);
        setError('シェアの削除に失敗しました。');
      }
    }
  };

  // シェア詳細を表示
  const handleViewShareDetails = (share) => {
    setSelectedShare(share);
    setShowShareDetails(true);
  };

  // シェア詳細モーダルを閉じる
  const handleCloseShareDetails = () => {
    setShowShareDetails(false);
    setSelectedShare(null);
  };

  // 編集モードを開始
  const handleStartEdit = (share) => {
    setEditingShareId(share.id);
    setEditingName(share.userName || '');
  };

  // 編集をキャンセル
  const handleCancelEdit = () => {
    setEditingShareId(null);
    setEditingName('');
  };

  // ユーザー名を保存
  const handleSaveUserName = async (shareId) => {
    if (!editingName.trim()) {
      setEditingName('');
      return;
    }
    
    try {
      await updateShareUserName(shareId, editingName.trim());
      // 更新後にリストを再取得
      fetchShares();
      // 編集モードを終了
      setEditingShareId(null);
    } catch (err) {
      console.error('Failed to update user name:', err);
      setError('ユーザー名の更新に失敗しました。');
    }
  };

  // キーボードイベント処理
  const handleKeyDown = (e, shareId) => {
    if (e.key === 'Enter') {
      handleSaveUserName(shareId);
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  // プリンシパルIDを表示用にフォーマット
  const formatPrincipal = (principal) => {
    if (!principal) return '';
    if (principal.length <= 10) return principal;
    return `${principal.substring(0, 5)}...${principal.substring(principal.length - 5)}`;
  };

  if (loading && shares.length === 0) {
    return (
      <div className="container mx-auto p-4">
        <h2 className="text-xl font-bold mb-4">保有シェア一覧</h2>
        <Loading />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <h2 className="text-xl font-bold mb-4">保有シェア一覧</h2>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
          <span className="block sm:inline">{error}</span>
        </div>
      )}
      
      {/* 検索フォーム */}
      <div className="mb-6">
        <form onSubmit={handleSearch} className="flex">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ユーザーIDまたは名前で検索..."
            className="shadow appearance-none border rounded-l w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          />
          <button
            type="submit"
            className="bg-primary-600 hover:bg-primary-700 text-white font-bold py-2 px-4 rounded-r focus:outline-none focus:shadow-outline"
          >
            検索
          </button>
        </form>
      </div>
      
      {shares.length === 0 ? (
        <div className="bg-gray-100 p-4 rounded text-center">
          <p className="text-gray-600">保有しているシェアはありません。</p>
          {searchTerm && (
            <p className="text-gray-500 mt-2">検索条件: "{searchTerm}" に一致するシェアが見つかりませんでした。</p>
          )}
        </div>
      ) : (
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ユーザー
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  シェアID
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  保存日時
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {shares.map((share) => (
                <tr key={share.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    {editingShareId === share.id ? (
                      <div className="flex items-center space-x-2">
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, share.id)}
                          className="shadow appearance-none border rounded w-full py-1 px-2 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                          placeholder="ユーザー名を入力"
                          autoFocus
                        />
                        <button
                          onClick={() => handleSaveUserName(share.id)}
                          className="text-green-600 hover:text-green-800"
                          title="保存"
                        >
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="text-red-600 hover:text-red-800"
                          title="キャンセル"
                        >
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium text-gray-900">
                          {share.userName || 'ユーザー名なし'}
                        </div>
                        <button
                          onClick={() => handleStartEdit(share)}
                          className="text-blue-600 hover:text-blue-800 ml-2"
                          title="ユーザー名を編集"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                      </div>
                    )}
                    <div className="text-xs text-gray-500 mt-1">
                      {formatPrincipal(share.userPrincipal)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">
                      {share.id.substring(0, 10)}...
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(share.storedAt).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleViewShareDetails(share)}
                      className="text-primary-600 hover:text-primary-900 mr-4"
                      disabled={editingShareId === share.id}
                    >
                      詳細
                    </button>
                    <button
                      onClick={() => handleDeleteShare(share.id)}
                      className="text-red-600 hover:text-red-900"
                      disabled={editingShareId === share.id}
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
      
      <div className="mt-4 text-center">
        <button
          onClick={fetchShares}
          className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
        >
          <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          更新
        </button>
      </div>
      
      {/* シェア詳細モーダル */}
      {showShareDetails && selectedShare && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-lg w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">シェア詳細</h3>
              <button
                onClick={handleCloseShareDetails}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg mb-4">
              <h4 className="font-medium mb-2">ユーザー情報</h4>
              <p className="text-sm mb-1">
                <span className="font-medium">名前:</span> {selectedShare.userName || '名前なし'}
              </p>
              <p className="text-sm">
                <span className="font-medium">プリンシパルID:</span> {selectedShare.userPrincipal}
              </p>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg mb-4">
              <h4 className="font-medium mb-2">シェア情報</h4>
              <p className="text-sm mb-1">
                <span className="font-medium">シェアID:</span> {selectedShare.id}
              </p>
              <p className="text-sm mb-1">
                <span className="font-medium">保存日時:</span> {new Date(selectedShare.storedAt).toLocaleString()}
              </p>
              <p className="text-sm">
                <span className="font-medium">シェア値:</span>
              </p>
              <div className="bg-gray-100 p-2 rounded mt-1 overflow-x-auto">
                <code className="text-xs break-all">{selectedShare.value}</code>
              </div>
            </div>
            
            <div className="flex justify-end">
              <button
                onClick={handleCloseShareDetails}
                className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded mr-2"
              >
                閉じる
              </button>
              <button
                onClick={() => {
                  handleDeleteShare(selectedShare.id);
                  handleCloseShareDetails();
                }}
                className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
              >
                削除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default GuardianShares;