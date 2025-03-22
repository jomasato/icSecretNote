import React, { useState, useEffect } from 'react';
import { 
  getPendingRecoveryRequests, 
  approveRecovery, 
  submitRecoveryShare 
} from '../../services/api';
import Loading from '../common/Loading';

function RecoveryApproval() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null);

  // 承認リクエストの取得
  useEffect(() => {
    fetchRecoveryRequests();
  }, []);

  const fetchRecoveryRequests = async () => {
    setLoading(true);
    try {
      const result = await getPendingRecoveryRequests();
      setRequests(result);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch recovery requests:', err);
      setError('回復リクエストの取得に失敗しました。もう一度お試しください。');
    } finally {
      setLoading(false);
    }
  };

  // リカバリーの承認
  const handleApproveRecovery = async (request) => {
    setApproving(true);
    setError(null);
    setSuccess(null);
    setSelectedRequest(request);
    
    try {
      // リカバリーの承認
      const approveResult = await approveRecovery(request.principal);
      
      if (!approveResult.success) {
        throw new Error(approveResult.error || 'リカバリーの承認に失敗しました');
      }
      
      // リカバリーシェアの提出
      if (request.shareId) {
        const shareResult = await submitRecoveryShare(request.principal, request.shareId);
        
        if (!shareResult.success) {
          throw new Error(shareResult.error || 'リカバリーシェアの提出に失敗しました');
        }
      }
      
      // 成功メッセージを設定
      setSuccess(`${formatPrincipal(request.principal)}のリカバリーリクエストを承認しました`);
      
      // リクエストリストを更新（承認済みのものを削除）
      setRequests(prev => prev.filter(r => r.id !== request.id));
    } catch (err) {
      console.error('Recovery approval failed:', err);
      setError(err.message || 'リカバリーの承認に失敗しました');
    } finally {
      setApproving(false);
    }
  };

  // プリンシパルIDの表示用フォーマット
  const formatPrincipal = (principal) => {
    if (!principal) return '';
    if (principal.length <= 10) return principal;
    return `${principal.substring(0, 5)}...${principal.substring(principal.length - 5)}`;
  };

  // 日時のフォーマット
  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleString();
  };

  // リクエスト経過時間の計算
  const getElapsedTime = (timestamp) => {
    if (!timestamp) return '';
    
    const now = new Date();
    const requestTime = new Date(timestamp);
    const diff = now - requestTime;
    
    // ミリ秒を時間、分、秒に変換
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}時間${minutes}分前`;
    } else {
      return `${minutes}分前`;
    }
  };

  if (loading && requests.length === 0) {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">ガーディアンリクエスト</h1>
        <div className="bg-white shadow-md rounded-lg p-6">
          <Loading />
          <p className="text-center mt-4 text-gray-600">リカバリーリクエストを確認中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">ガーディアンリクエスト</h1>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-6">
          <span className="block sm:inline">{error}</span>
          <button 
            onClick={fetchRecoveryRequests}
            className="absolute top-0 bottom-0 right-0 px-4 py-3"
          >
            <svg className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      )}

      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-6">
          <span className="block sm:inline">{success}</span>
        </div>
      )}

      {requests.length === 0 ? (
        <div className="bg-white shadow-md rounded-lg p-6 text-center">
          <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900">保留中のリクエストはありません</h3>
          <p className="mt-2 text-gray-500">
            現在、承認を待っているアカウント回復リクエストはありません。
          </p>
          <div className="mt-6">
            <button 
              onClick={fetchRecoveryRequests}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              更新
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {approving && selectedRequest && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full">
                <div className="text-center">
                  <Loading />
                  <h3 className="mt-4 text-lg font-medium text-gray-900">リカバリーリクエストを承認中</h3>
                  <p className="mt-2 text-gray-500">
                    {formatPrincipal(selectedRequest.principal)}のリカバリーを承認しています...
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ガーディアンとは何かの説明 */}
          <div className="bg-white shadow-md rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">ガーディアンの役割</h2>
            <p className="text-gray-600 mb-4">
              あなたはセキュアノートアプリのガーディアンです。ユーザーがアカウントへのアクセスを失った場合、リカバリーを支援する重要な役割を担います。
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
                    リクエストを承認する前に、直接ユーザーに連絡を取り、リクエストが本人からのものであることを確認してください。
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* リクエスト一覧 */}
          <h2 className="text-xl font-semibold mb-4">保留中のリカバリーリクエスト</h2>
          <div className="space-y-4">
            {requests.map((request) => (
              <div key={request.id} className="bg-white shadow-md rounded-lg overflow-hidden border border-gray-200">
                <div className="p-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-1">
                        {request.userName || 'ユーザー'}のリカバリーリクエスト
                      </h3>
                      <p className="text-sm text-gray-500">
                        プリンシパルID: {formatPrincipal(request.principal)}
                      </p>
                      <p className="text-sm text-gray-500">
                        リクエスト時間: {formatDate(request.requestTime)}（{getElapsedTime(request.requestTime)}）
                      </p>

                      {request.deviceLost && (
                        <div className="mt-2 inline-flex items-center px-2.5 py-0.5 rounded-md text-sm font-medium bg-yellow-100 text-yellow-800">
                          <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          デバイス紛失によるリカバリー
                        </div>
                      )}
                    </div>
                    
                    <div className="ml-4">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                        承認待ち
                      </span>
                    </div>
                  </div>
                  
                  <div className="mt-6 bg-gray-50 -mx-6 px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div className="text-sm">
                        <p className="text-gray-700">
                          このユーザーはあなたをガーディアンとして指定しています。リクエストを承認してアカウント回復を支援しますか？
                        </p>
                      </div>
                      
                      <div className="ml-4 flex-shrink-0 flex">
                        <button
                          onClick={() => handleApproveRecovery(request)}
                          disabled={approving}
                          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                        >
                          {approving && selectedRequest?.id === request.id ? (
                            <span className="flex items-center">
                              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              承認中...
                            </span>
                          ) : (
                            <span className="flex items-center">
                              <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              承認する
                            </span>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default RecoveryApproval;