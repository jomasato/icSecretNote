import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getRecoveryStatus, collectRecoveryData } from '../../services/api';
import Loading from '../common/Loading';

function ShareCollection() {
  const { userPrincipal } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [collecting, setCollecting] = useState(false);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null);
  const [recoveryData, setRecoveryData] = useState(null);
  const [pollingTimer, setPollingTimer] = useState(null);

  // 初期ロード
  useEffect(() => {
    fetchRecoveryStatus();
    
    // ポーリングを開始
    const timer = setInterval(fetchRecoveryStatus, 5000);
    setPollingTimer(timer);
    
    // クリーンアップ
    return () => {
      if (pollingTimer) {
        clearInterval(pollingTimer);
      }
    };
  }, [userPrincipal]);

  const fetchRecoveryStatus = async () => {
    try {
      setLoading(true);
      const result = await getRecoveryStatus(userPrincipal);
      setStatus(result);
      
      // リカバリーステータスを確認
      if (result.session.status === 'Completed') {
        // すでに完了している場合はデータを取得
        collectShares();
      }
    } catch (err) {
      console.error('Failed to get recovery status:', err);
      setError('Failed to get recovery status. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const collectShares = async () => {
    try {
      setCollecting(true);
      const result = await collectRecoveryData(userPrincipal);
      setRecoveryData(result);
      
      // 十分なシェアが集まり、マスターキーが再構築できる場合
      // ローカルストレージに一時的に保存
      if (result && result.masterKey) {
        localStorage.setItem('tempMasterKey', result.masterKey);
        localStorage.setItem('tempUserPrincipal', userPrincipal);
        
        // 次のステップへ
        navigate('/recovery/restore');
      }
    } catch (err) {
      console.error('Failed to collect recovery data:', err);
      setError('Failed to collect recovery shares. Please try again later.');
    } finally {
      setCollecting(false);
    }
  };

  if (loading && !status) {
    return <Loading />;
  }

  // ステータスに応じた表示を整理
  const renderStatusMessage = () => {
    if (!status) return null;
    
    const { session, profile } = status;
    
    switch (session.status) {
      case 'Requested':
        return (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
            <p className="text-yellow-700">
              Your recovery request has been submitted. Waiting for guardians to approve.
            </p>
          </div>
        );
      case 'InProgress':
        return (
          <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
            <p className="text-blue-700">
              Recovery in progress. {session.approvedGuardians.length} of {profile.totalGuardians} guardians have approved.
            </p>
          </div>
        );
      case 'SharesCollected':
        return (
          <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
            <p className="text-blue-700">
              All required shares have been collected. Finalizing recovery...
            </p>
          </div>
        );
      case 'Completed':
        return (
          <div className="bg-green-50 border-l-4 border-green-400 p-4">
            <p className="text-green-700">
              Recovery is complete! You can now restore your account.
            </p>
          </div>
        );
      case 'Failed':
        return (
          <div className="bg-red-50 border-l-4 border-red-400 p-4">
            <p className="text-red-700">
              Recovery has failed. Please try initiating recovery again.
            </p>
          </div>
        );
      default:
        return (
          <div className="bg-gray-50 border-l-4 border-gray-400 p-4">
            <p className="text-gray-700">
              Unknown status: {session.status}
            </p>
          </div>
        );
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg p-6 mt-10">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Recovery Status</h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
          <span className="block sm:inline">{error}</span>
        </div>
      )}
      
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Account Information</h2>
        <div className="bg-gray-50 rounded-md p-3">
          <p className="text-sm">
            <span className="font-medium">Principal ID:</span> 
            <span className="font-mono ml-1 text-gray-600 break-all">{userPrincipal}</span>
          </p>
          
          {status && status.profile && (
            <>
              <p className="text-sm mt-2">
                <span className="font-medium">Recovery Setup:</span> 
                <span className="ml-1 text-gray-600">
                  Requires {status.profile.requiredShares} of {status.profile.totalGuardians} guardians
                </span>
              </p>
              <p className="text-sm mt-2">
                <span className="font-medium">Recovery Enabled:</span> 
                <span className="ml-1 text-gray-600">
                  {status.profile.recoveryEnabled ? 'Yes' : 'No'}
                </span>
              </p>
            </>
          )}
        </div>
      </div>
      
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Recovery Status</h2>
        {renderStatusMessage()}
        
        {status && status.session && (
          <div className="mt-4 bg-gray-50 rounded-md p-4">
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium">Guardian Approvals:</span>
              <span className="text-sm font-medium">
                {status.session.approvedGuardians.length} / {status.profile.totalGuardians}
              </span>
            </div>
            
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div 
                className="bg-primary-600 h-2.5 rounded-full" 
                style={{ width: `${(status.session.approvedGuardians.length / status.profile.totalGuardians) * 100}%` }}
              ></div>
            </div>
            
            <div className="flex justify-between mb-2 mt-4">
              <span className="text-sm font-medium">Shares Collected:</span>
              <span className="text-sm font-medium">
                {status.session.collectedShares.length} / {status.profile.requiredShares}
              </span>
            </div>
            
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div 
                className="bg-primary-600 h-2.5 rounded-full" 
                style={{ width: `${(status.session.collectedShares.length / status.profile.requiredShares) * 100}%` }}
              ></div>
            </div>
          </div>
        )}
      </div>
      
      <div className="border-t border-gray-200 pt-4 mb-4">
        <h2 className="text-lg font-semibold mb-2">What to do next</h2>
        
        {status && status.session && (
          <>
            {status.session.status === 'Requested' && (
              <div className="space-y-2 text-gray-600">
                <p>Contact your guardians and ask them to:</p>
                <ol className="list-decimal list-inside space-y-1 pl-2">
                  <li>Log in to the Secure Notes app</li>
                  <li>Go to the "Guardian Requests" section</li>
                  <li>Approve your recovery request</li>
                </ol>
              </div>
            )}
            
            {status.session.status === 'InProgress' && (
              <div className="space-y-2 text-gray-600">
                <p>Continue waiting for more guardians to approve your request.</p>
                <p>Make sure you've contacted all your guardians.</p>
              </div>
            )}
            
            {status.session.status === 'SharesCollected' && (
              <div className="space-y-2 text-gray-600">
                <p>All required shares have been collected!</p>
                <p>Click "Collect Shares" to proceed with your account recovery.</p>
              </div>
            )}
            
            {status.session.status === 'Completed' && (
              <div className="space-y-2 text-gray-600">
                <p>Your recovery is complete! Click "Restore Account" to set up your device and access your notes.</p>
              </div>
            )}
            
            {status.session.status === 'Failed' && (
              <div className="space-y-2 text-gray-600">
                <p>Your recovery has failed. You may need to start the process again.</p>
                <p>Make sure you have enough guardians available to approve your request.</p>
              </div>
            )}
          </>
        )}
      </div>
      
      <div className="flex justify-center">
        {status && status.session && status.session.status === 'Completed' ? (
          <button
            onClick={() => navigate('/recovery/restore')}
            className="bg-primary-600 hover:bg-primary-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            disabled={collecting}
          >
            {collecting ? 'Processing...' : 'Restore Account'}
          </button>
        ) : (
          <button
            onClick={fetchRecoveryStatus}
            className="bg-primary-600 hover:bg-primary-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            disabled={loading}
          >
            {loading ? 'Refreshing...' : 'Refresh Status'}
          </button>
        )}
      </div>
    </div>
  );
}

export default ShareCollection;