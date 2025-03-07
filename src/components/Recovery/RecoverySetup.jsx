import React, { useState, useEffect } from 'react';
import { setupRecovery } from '../../services/api';
import { retrieveEncryptionKeySecurely } from '../../services/crypto';
import Loading from '../common/Loading';

function RecoverySetup({ onSetupComplete }) {
  const [totalGuardians, setTotalGuardians] = useState(5);
  const [requiredShares, setRequiredShares] = useState(3);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [step, setStep] = useState(1);
  const [shares, setShares] = useState([]);

  // リカバリー設定の初期化
  const initializeRecovery = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    
    try {
      // 入力値の検証
      if (requiredShares > totalGuardians) {
        throw new Error('Required shares cannot exceed total guardians');
      }
      
      if (requiredShares < 2) {
        throw new Error('At least 2 shares are required for security');
      }
      
      // マスターキーの取得（実際のアプリでは認証済みユーザーのパスワードハッシュを使用）
      const masterKey = await retrieveMasterKey();
      
      // リカバリー設定のセットアップ
      const setupResult = await setupRecovery(totalGuardians, requiredShares, masterKey);
      
      // シェアを保存
      localStorage.setItem('recoveryShares', JSON.stringify(setupResult.shares));
      setShares(setupResult.shares);
      
      // ステップ2へ進む（シェア表示）
      setStep(2);
    } catch (err) {
      console.error('Failed to initialize recovery:', err);
      setError(err.message || 'Failed to set up recovery. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // 簡易的なマスターキー取得関数（実際のアプリではより安全な実装が必要）
  const retrieveMasterKey = async () => {
    // ここでは仮にlocalStorageから取得する形に
    const masterKey = localStorage.getItem('masterEncryptionKey');
    if (!masterKey) {
      throw new Error('Master encryption key not found');
    }
    return masterKey;
  };

  // 次のステップへ進む
  const handleNext = () => {
    if (step === 2) {
      onSetupComplete && onSetupComplete(shares);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-bold mb-4">Set Up Account Recovery</h2>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
          <span className="block sm:inline">{error}</span>
        </div>
      )}
      
      {step === 1 && (
        <form onSubmit={initializeRecovery}>
          <div className="mb-4">
            <p className="text-gray-600 mb-4">
              Recovery setup allows you to regain access to your notes if you lose access to your device or Internet Identity.
              You'll need to designate trusted guardians who will help you recover your account.
            </p>
            
            <div className="mb-4">
              <label htmlFor="totalGuardians" className="block text-gray-700 text-sm font-bold mb-2">
                Total Number of Guardians
              </label>
              <select
                id="totalGuardians"
                value={totalGuardians}
                onChange={(e) => setTotalGuardians(parseInt(e.target.value))}
                className="shadow border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              >
                <option value="3">3 Guardians</option>
                <option value="4">4 Guardians</option>
                <option value="5">5 Guardians</option>
                <option value="7">7 Guardians</option>
              </select>
            </div>
            
            <div className="mb-4">
              <label htmlFor="requiredShares" className="block text-gray-700 text-sm font-bold mb-2">
                Required Guardians for Recovery
              </label>
              <select
                id="requiredShares"
                value={requiredShares}
                onChange={(e) => setRequiredShares(parseInt(e.target.value))}
                className="shadow border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              >
                <option value="2">2 Guardians</option>
                <option value="3">3 Guardians</option>
                <option value="4">4 Guardians</option>
                <option value="5">5 Guardians</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                This is the minimum number of guardians needed to recover your account.
              </p>
            </div>
            
            <div className="mb-6">
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-yellow-700">
                      Choose your settings carefully. You will need to add at least {requiredShares} guardians to enable recovery.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex items-center justify-end">
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
      )}
      
      {step === 2 && (
        <div>
          <p className="text-gray-600 mb-4">
            Recovery setup is complete! You have generated {shares.length} recovery shares.
            You need to assign these shares to your guardians.
          </p>
          
          <div className="bg-green-50 border border-green-200 rounded p-4 mb-6">
            <h3 className="text-green-800 font-medium mb-2">Recovery Configuration</h3>
            <ul className="text-sm text-green-700 space-y-1">
              <li>Total guardians: {totalGuardians}</li>
              <li>Required for recovery: {requiredShares}</li>
              <li>Available shares: {shares.length}</li>
            </ul>
          </div>
          
          <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-blue-700">
                  Next step: Add guardians and assign shares to them. You need to add at least {requiredShares} guardians for recovery to be enabled.
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center justify-end">
            <button
              onClick={handleNext}
              className="bg-primary-600 hover:bg-primary-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            >
              Continue to Add Guardians
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default RecoverySetup;