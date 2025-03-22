import React, { useState, useEffect } from 'react';
import { approveRecovery, submitRecoveryShare, getRecoveryStatus } from '../../services/api';
import { getGuardianPublicKey } from '../../services/api';
import Loading from '../common/Loading';

function GuardianApprovals() {
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingAction, setLoadingAction] = useState(false);
  const [error, setError] = useState(null);
  const [currentAction, setCurrentAction] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  useEffect(() => {
    fetchPendingRequests();

    // ポーリングを設定して定期的に更新
    const pollingInterval = setInterval(fetchPendingRequests, 30000); // 30秒ごと

    return () => {
      clearInterval(pollingInterval);
    };
  }, []);

  // 保留中のリカバリーリクエストを取得
  const fetchPendingRequests = async () => {
    try {
      setLoading(true);
      
      // ここで実際のリクエスト取得処理を行う
      // 実際の実装ではバックエンドからデータを取得
      
      // サンプルデータ（実際の実装では置き換える）
      const mockData = [
        {
          userPrincipal: 'w3gef-eqllq-zz',
          requestTime: new Date(Date.now() - 1000 * 60 * 30), // 30分前
          status: 'Requested',
          approved: false,
          shareSubmitted: false
        },
        {
          userPrincipal: 'h7aef-mvqrt-pp',
          requestTime: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2時間前
          status: 'InProgress',
          approved: true,
          shareSubmitted: false
        }
      ];
      
      setPendingRequests(mockData);
      setError(null);
    } catch (err) {
      console.error('リカバリーリクエストの取得に失敗しました:', err);
      setError('リカバリーリクエストの取得に失敗しました。後でもう一度お試しください。');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (userPrincipal) => {
    try {
      setLoadingAction(true);
      setCurrentAction(userPrincipal);
      
      // リカバリーを承認
      await approveRecovery(userPrincipal);
      
      // 成功メッセージを表示
      setSuccessMessage(`${formatPrincipal(userPrincipal)}のリカバリーを承認しました`);
      
      // リクエスト一覧を更新
      setPendingRequests(prevRequests => 
        prevRequests.map(req => 
          req.userPrincipal === userPrincipal 
            ? {...req, approved: true} 
            : req
        )
      );
      
      // 数秒後に成功メッセージを消す
      setTimeout(() => {
        setSuccessMessage(null);
      }, 5000);
    } catch (err) {
      console.error('リカバリー承認に失敗しました:', err);
      setError(`リカバリー承認に失敗しました: ${err.message}`);
    } finally {
      setLoadingAction(false);
      setCurrentAction(null);
    }
  };

  const handleSubmitShare = async (userPrincipal) => {
    try {
      setLoadingAction(true);
      setCurrentAction(userPrincipal);
      
      // ガーディアンのキーシェアを取得
      const myShareResult = await getMyKeyShare(userPrincipal);
      if (myShareResult.err) {
        throw new Error(myShareResult.err);
      }
      
      const shareId = myShareResult.ok.shareId;
      
      // リカバリーシェアを提出
      await submitRecoveryShare(userPrincipal, shareId);
      
      // 成功メッセージを表示
      setSuccessMessage(`${formatPrincipal(userPrincipal)}のリカバリーシェアを提出しました`);
      
      // リクエスト一覧を更新
      setPendingRequests(prevRequests => 
        prevRequests.map(req => 
          req.userPrincipal === userPrincipal 
            ? {...req, shareSubmitted: true} 
            : req
        )
      );
      
      // 数秒後に成功メッセージを消す
      setTimeout(() => {
        setSuccessMessage(null);
      }, 5000);
    } catch (err) {
      console.error('シェア提出に失敗しました:', err);
      setError(`シェア提出に失敗しました: ${err.message}`);
    } finally {
      setLoadingAction(false);
      setCurrentAction(null);
    }
  };

  // プリンシパルIDを短縮表示
  const formatPrincipal = (principal) => {
    if (!principal) return '';
    if (principal.length <= 10) return principal;
    return `${principal.substring(0, 5)}...${principal.substring(principal.length - 5)}`;
  };

  // 時間を相対的に表示
  const formatTime = (date) => {
    const now = new Date();
    const diffMs = now - date;
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 60) {
      return `${diffMinutes}分前`;
    } else if (diffHours < 24) {
      return `${diffHours}時間前`;
    } else {
      return `${diffDays}日前`;
    }
  };

  if (loading && pendingRequests.length === 0) {
    return <Loading message="リカバリーリクエストを読み込み中..." />;
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">ガーディアン承認リクエスト</h1>
      
      {successMessage && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4 transition-opacity duration-500">
          <span className="block sm:inline">{successMessage}</span>
        </div>
      )}
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
          <span className="block sm:inline">{error}</span>
          <button 
            className="absolute top-0 bottom-0 right-0 px-4 py-3"
            onClick={() => setError(null)}
          >
            <svg className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
      
      <div className="bg-white shadow-md rounded-lg p-6 mb-6">
        <p className="text-gray-600 mb-4">
          あなたはガーディアンとして、ノートへのアクセスを失った友人がアカウントを回復するのを手伝うことができます。リカバリーリクエストを承認すると、共有キーの一部が提供され、必要な数のガーディアンが承認すると、友人のアカウントが回復されます。
        </p>
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                <span className="font-medium">重要:</span> 実際に知っている人からのリクエストのみを承認してください。不明なリクエストは承認しないでください。
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {pendingRequests.length === 0 ? (
        <div className="bg-white shadow-md rounded-lg p-6 text-center">
          <svg className="mx-auto h-16 w-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="mt-2 text-lg font-medium text-gray-900">保留中のリクエストはありません</h3>
          <p className="mt-1 text-gray-500">
            現在、承認を待っているリカバリーリクエストはありません。
          </p>
        </div>
      ) : (
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          <ul className="divide-y divide-gray-200">
            {pendingRequests.map((request) => (
              <li key={request.userPrincipal} className="p-4 hover:bg-gray-50">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                  <div className="mb-4 md:mb-0">
                    <div className="flex items-center">
                      <div className="rounded-full bg-blue-100 p-2 mr-3">
                        <svg className="h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{formatPrincipal(request.userPrincipal)}</p>
                        <p className="text-xs text-gray-500">
                          リクエスト時間: {formatTime(request.requestTime)}
                        </p>
                      </div>
                    </div>
                    
                    <div className="mt-2 flex items-center">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        request.status === 'Requested' 
                          ? 'bg-yellow-100 text-yellow-800' 
                          : request.status === 'InProgress' 
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-green-100 text-green-800'
                      }`}>
                        {request.status === 'Requested' 
                          ? '承認待ち' 
                          : request.status === 'InProgress' 
                            ? '処理中'
                            : '完了'}
                      </span>
                      
                      {request.approved && (
                        <span className="ml-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                          承認済み
                        </span>
                      )}
                      
                      {request.shareSubmitted && (
                        <span className="ml-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                          シェア提出済み
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex space-x-2">
                    {!request.approved && (
                      <button
                        onClick={() => handleApprove(request.userPrincipal)}
                        disabled={loadingAction && currentAction === request.userPrincipal}
                        className="bg-primary-600 hover:bg-primary-700 text-white py-2 px-4 rounded focus:outline-none focus:shadow-outline text-sm"
                      >
                        {loadingAction && currentAction === request.userPrincipal ? (
                          <span className="flex items-center">
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            処理中...
                          </span>
                        ) : '承認する'}
                      </button>
                    )}
                    
                    {request.approved && !request.shareSubmitted && (
                      <button
                        onClick={() => handleSubmitShare(request.userPrincipal)}
                        disabled={loadingAction && currentAction === request.userPrincipal}
                        className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded focus:outline-none focus:shadow-outline text-sm"
                      >
                        {loadingAction && currentAction === request.userPrincipal ? (
                          <span className="flex items-center">
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            処理中...
                          </span>
                        ) : 'シェアを提出'}
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      
      <div className="mt-4 flex justify-end">
        <button
          onClick={fetchPendingRequests}
          disabled={loading}
          className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
        >
          {loading ? (
            <span className="flex items-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-800" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              更新中...
            </span>
          ) : '最新の情報に更新'}
        </button>
      </div>
    </div>
  );
}

export default GuardianApprovals;