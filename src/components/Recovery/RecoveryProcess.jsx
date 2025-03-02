import React, { useState, useEffect } from 'react';
import { Principal } from '@dfinity/principal';
import { initiateRecovery, getRecoveryStatus } from '../../services/api';
import { generateKeyPair } from '../../services/crypto';
import Loading from '../common/Loading';

function RecoveryProcess() {
  const [userToRecover, setUserToRecover] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [recoveryInitiated, setRecoveryInitiated] = useState(false);

  useEffect(() => {
    // Check recovery status periodically if recovery has been initiated
    if (recoveryInitiated) {
      const interval = setInterval(() => {
        checkRecoveryStatus();
      }, 5000); // Check every 5 seconds
      
      return () => clearInterval(interval);
    }
  }, [recoveryInitiated, userToRecover]);

  const checkRecoveryStatus = async () => {
    try {
      if (!userToRecover) return;
      
      const result = await getRecoveryStatus(userToRecover);
      setStatus(result);
      
      // If recovery is complete, generate new device keys
      if (result.session.status === 'Completed') {
        const keyPair = generateKeyPair();
        localStorage.setItem('recoveryDeviceKeys', JSON.stringify({
          privateKey: keyPair.privateKey,
          publicKey: Array.from(keyPair.publicKey)
        }));
      }
    } catch (err) {
      console.error('Failed to check recovery status:', err);
      // Don't show error for status checks
    }
  };

  const handleInitiateRecovery = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    
    try {
      // Validate principal ID
      try {
        Principal.fromText(userToRecover);
      } catch (err) {
        throw new Error('Invalid principal ID. Please enter a valid Internet Identity principal.');
      }
      
      await initiateRecovery(userToRecover);
      setRecoveryInitiated(true);
      await checkRecoveryStatus();
    } catch (err) {
      console.error('Failed to initiate recovery:', err);
      setError(err.message || 'Failed to initiate recovery. Please try again.');
    } finally {
      setLoading(false);
    }
  };

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

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Account Recovery</h1>

      <div className="bg-white shadow-md rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Recover Your Account</h2>
        <p className="text-gray-600 mb-4">
          If you've lost access to your device or Internet Identity, you can recover your account with the help of your guardians.
        </p>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        {!recoveryInitiated ? (
          <form onSubmit={handleInitiateRecovery}>
            <div className="mb-4">
              <label htmlFor="userToRecover" className="block text-gray-700 text-sm font-bold mb-2">
                Your Principal ID
              </label>
              <input
                type="text"
                id="userToRecover"
                value={userToRecover}
                onChange={(e) => setUserToRecover(e.target.value)}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                placeholder="e.g., w3gef-eqllq-zz..."
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                This is the principal ID of the account you want to recover.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || !userToRecover}
              className="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Initiating Recovery...
                </span>
              ) : (
                'Initiate Recovery'
              )}
            </button>
          </form>
        ) : (
          <div>
            {loading && <Loading />}
            
            {status ? (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium">Recovery Status</h3>
                  {renderStatusBadge(status.session.status)}
                </div>
                
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-500">
                      Request Time: {new Date(status.session.requestTime).toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-500">
                      Required Shares: {status.profile.requiredShares} of {status.profile.totalGuardians}
                    </p>
                  </div>
                  
                  <div className="border-t border-gray-200 pt-4">
                    <h4 className="font-medium mb-2">Guardians' Approval</h4>
                    <p className="text-sm mb-2">
                      {status.session.approvedGuardians.length} of {status.profile.requiredShares} guardians have approved
                    </p>
                    
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div
                        className="bg-primary-600 h-2.5 rounded-full"
                        style={{ width: `${(status.session.approvedGuardians.length / status.profile.requiredShares) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                  
                  <div className="border-t border-gray-200 pt-4">
                    <h4 className="font-medium mb-2">Shares Collected</h4>
                    <p className="text-sm mb-2">
                      {status.session.collectedShares.length} of {status.profile.requiredShares} shares collected
                    </p>
                    
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div
                        className="bg-green-600 h-2.5 rounded-full"
                        style={{ width: `${(status.session.collectedShares.length / status.profile.requiredShares) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                  
                  {status.session.status === 'Completed' && status.session.tempAccessPrincipal && (
                    <div className="border-t border-gray-200 pt-4">
                      <h4 className="font-medium mb-2 text-green-600">Recovery Complete!</h4>
                      <p className="text-sm text-gray-600 mb-2">
                        Your account has been recovered. You can now log in with your new temporary principal.
                      </p>
                      <div className="bg-green-50 border border-green-200 rounded p-3">
                        <p className="text-xs font-medium text-green-800">Temporary Access Principal:</p>
                        <p className="text-xs font-mono mt-1 break-all">
                          {status.session.tempAccessPrincipal}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(status.session.tempAccessPrincipal);
                          alert('Principal ID copied to clipboard');
                        }}
                        className="mt-2 text-sm text-primary-600 hover:text-primary-800"
                      >
                        Copy to clipboard
                      </button>
                    </div>
                  )}
                  
                  {status.session.status === 'SharesCollected' && (
                    <div className="border-t border-gray-200 pt-4">
                      <h4 className="font-medium mb-2">All shares collected!</h4>
                      <p className="text-sm text-gray-600 mb-2">
                        Your guardians have provided all necessary shares. The final step is being processed.
                      </p>
                    </div>
                  )}
                  
                  {(status.session.status === 'Requested' || status.session.status === 'InProgress' || status.session.status === 'ApprovalComplete') && (
                    <div className="border-t border-gray-200 pt-4">
                      <h4 className="font-medium mb-2">Next Steps</h4>
                      <p className="text-sm text-gray-600 mb-2">
                        Contact your guardians and ask them to approve your recovery request. They'll need to:
                      </p>
                      <ol className="list-decimal list-inside text-sm text-gray-600 space-y-1">
                        <li>Log in to their Secure Notes account</li>
                        <li>Go to "Guardian Requests" section</li>
                        <li>Approve your recovery request</li>
                        <li>Submit their recovery share</li>
                      </ol>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-gray-600">Checking recovery status...</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default RecoveryProcess;