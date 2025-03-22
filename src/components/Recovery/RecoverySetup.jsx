import React, { useState } from 'react';
import { setupRecovery } from '../../services/api';

function RecoverySetup({ onSetupComplete }) {
  const [totalGuardians, setTotalGuardians] = useState(3);
  const [requiredShares, setRequiredShares] = useState(2);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    
    // バリデーション
    if (requiredShares > totalGuardians) {
      setError('Required shares cannot be greater than total guardians');
      return;
    }
    
    if (requiredShares < 2) {
      setError('Required shares must be at least 2 for security');
      return;
    }
    
    setLoading(true);
    try {
      // マスターキーを取得
      const masterKey = localStorage.getItem('masterEncryptionKey');
      if (!masterKey) {
        throw new Error('Master encryption key not found');
      }
      
      // リカバリーセットアップを実行
      const result = await setupRecovery(totalGuardians, requiredShares, masterKey);
      
      // 未割り当てのシェアをローカルストレージに保存
      localStorage.setItem('recoveryShares', JSON.stringify(result.shares));
      
      // 親コンポーネントに通知
      onSetupComplete(result.shares);
    } catch (err) {
      console.error('Failed to setup recovery:', err);
      setError(err.message || 'Failed to setup recovery. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Set Up Account Recovery</h2>
        <button
          onClick={() => onSetupComplete([])} // キャンセル時は空の配列を返す
          className="text-gray-500 hover:text-gray-700"
          aria-label="Close"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      <p className="text-gray-600 mb-4">
        Recovery allows you to regain access to your encrypted notes if you lose access to all your devices. 
        You'll distribute recovery key shares to trusted guardians, and they can help you recover your account.
      </p>

      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-yellow-700">
              <span className="font-medium">Important:</span> You will need at least the number of required shares from your guardians to recover your account. Choose carefully!
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="mb-6">
          <label className="block text-gray-700 text-sm font-bold mb-2">
            Total Number of Guardians
          </label>
          <div className="flex items-center">
            <input
              type="range"
              min="2"
              max="5"
              value={totalGuardians}
              onChange={(e) => {
                const value = parseInt(e.target.value);
                setTotalGuardians(value);
                // requiredSharesが多すぎる場合は調整
                if (requiredShares > value) {
                  setRequiredShares(value);
                }
              }}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <span className="ml-3 w-8 text-center font-bold">{totalGuardians}</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            The total number of trusted people you want to assign as guardians.
          </p>
        </div>

        <div className="mb-6">
          <label className="block text-gray-700 text-sm font-bold mb-2">
            Required Shares for Recovery
          </label>
          <div className="flex items-center">
            <input
              type="range"
              min="2"
              max={totalGuardians}
              value={requiredShares}
              onChange={(e) => setRequiredShares(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <span className="ml-3 w-8 text-center font-bold">{requiredShares}</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            The minimum number of guardians needed to recover your account.
          </p>
        </div>

        <div className="rounded-md bg-blue-50 p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3 flex-1 md:flex md:justify-between">
              <p className="text-sm text-blue-700">
                With these settings, you need at least <strong>{requiredShares}</strong> of your <strong>{totalGuardians}</strong> guardians to help you recover.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 p-4 rounded-md mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Recommendation</h3>
          <p className="text-sm text-gray-600">
            For a good balance of security and convenience, we recommend:
          </p>
          <ul className="list-disc list-inside text-sm text-gray-600 ml-2 mt-1">
            <li>3 total guardians with 2 required for recovery</li>
            <li>5 total guardians with 3 required for recovery (more secure)</li>
          </ul>
        </div>

        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={() => onSetupComplete([])} // キャンセル時は空の配列を返す
            className="mr-2 bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="bg-primary-600 hover:bg-primary-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
          >
            {loading ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Setting Up...
              </span>
            ) : (
              'Set Up Recovery'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

export default RecoverySetup;