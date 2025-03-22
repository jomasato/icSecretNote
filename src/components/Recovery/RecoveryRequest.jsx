import React, { useState } from 'react';
import { Principal } from '@dfinity/principal';
import { initiateRecovery } from '../../services/api';
import { useNavigate } from 'react-router-dom';

function RecoveryRequest() {
  const [userPrincipal, setUserPrincipal] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [step, setStep] = useState(1); // 1: プリンシパル入力, 2: 確認, 3: 処理中, 4: 完了
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    
    if (step === 1) {
      // プリンシパルの検証
      try {
        Principal.fromText(userPrincipal);
        setStep(2);
      } catch (err) {
        setError('Invalid principal ID. Please enter a valid Internet Identity principal.');
      }
    } else if (step === 2) {
      // リカバリーの開始
      setStep(3);
      setLoading(true);
      try {
        await initiateRecovery(userPrincipal);
        setStep(4);
      } catch (err) {
        console.error('Failed to initiate recovery:', err);
        setError(err.message || 'Failed to initiate recovery. Please try again.');
        setStep(2);
      } finally {
        setLoading(false);
      }
    }
  };

  const goToCollectShares = () => {
    navigate(`/recovery/collect/${userPrincipal}`);
  };

  return (
    <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg p-6 mt-10">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Account Recovery</h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
          <span className="block sm:inline">{error}</span>
        </div>
      )}
      
      {step === 1 && (
        <>
          <p className="text-gray-600 mb-6">
            If you've lost access to your devices, you can recover your account with the help of your guardians.
            Enter your principal ID to begin the recovery process.
          </p>
          
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label htmlFor="userPrincipal" className="block text-gray-700 text-sm font-bold mb-2">
                Your Principal ID
              </label>
              <input
                type="text"
                id="userPrincipal"
                value={userPrincipal}
                onChange={(e) => setUserPrincipal(e.target.value)}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                placeholder="e.g., w3gef-eqllq-zz..."
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                This is your Internet Identity principal that you used when creating your account.
              </p>
            </div>

            <div className="flex items-center justify-end">
              <button
                type="submit"
                className="bg-primary-600 hover:bg-primary-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
              >
                Next
              </button>
            </div>
          </form>
        </>
      )}
      
      {step === 2 && (
        <>
          <p className="text-gray-600 mb-6">
            You're about to initiate the recovery process for:
          </p>
          
          <div className="bg-gray-50 rounded-md p-4 mb-6">
            <p className="font-mono text-sm break-all">{userPrincipal}</p>
          </div>
          
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  <span className="font-medium">Important:</span> After initiating recovery, you will need to contact your guardians to help you recover your account.
                  You'll need enough guardians to provide their shares based on your recovery settings.
                </p>
              </div>
            </div>
          </div>
          
          <form onSubmit={handleSubmit}>
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
              >
                Back
              </button>
              <button
                type="submit"
                className="bg-primary-600 hover:bg-primary-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
              >
                Initiate Recovery
              </button>
            </div>
          </form>
        </>
      )}
      
      {step === 3 && (
        <div className="text-center py-8">
          <svg className="animate-spin h-12 w-12 text-primary-600 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-gray-600">Initiating recovery process...</p>
        </div>
      )}
      
      {step === 4 && (
        <>
          <div className="bg-green-50 border-l-4 border-green-400 p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-green-700">
                  <span className="font-medium">Recovery initiated successfully!</span>
                </p>
              </div>
            </div>
          </div>
          
          <p className="text-gray-600 mb-6">
            Your recovery request has been initiated. Now you need to:
          </p>
          
          <ol className="list-decimal list-inside space-y-2 mb-6 text-gray-600">
            <li>Contact your guardians and ask them to approve your recovery request</li>
            <li>Have them log into the Secure Notes app with their accounts</li>
            <li>They need to go to "Approvals" and approve your recovery request</li>
            <li>Collect the required number of shares to recover your account</li>
          </ol>
          
          <div className="flex items-center justify-center">
            <button
              onClick={goToCollectShares}
              className="bg-primary-600 hover:bg-primary-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            >
              Collect Recovery Shares
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default RecoveryRequest;