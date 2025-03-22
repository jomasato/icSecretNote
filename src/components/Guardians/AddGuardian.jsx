import React, { useState, useEffect } from 'react';
import { Principal } from '@dfinity/principal';
import { addGuardian, getGuardianPublicKey, saveGuardianPublicKey } from '../../services/api';

function AddGuardian({ onClose, availableShares }) {
  const [guardianId, setGuardianId] = useState('');
  const [guardianPublicKey, setGuardianPublicKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [step, setStep] = useState(1);
  const [recoveryShares, setRecoveryShares] = useState([]);
  const [selectedShare, setSelectedShare] = useState(null);

  useEffect(() => {
    // 利用可能なシェアをpropsから取得、またはlocalStorageから取得
    if (availableShares && availableShares.length > 0) {
      setRecoveryShares(availableShares);
    } else {
      // localStorageからシェアを取得
      const sharesJson = localStorage.getItem('recoveryShares');
      if (sharesJson) {
        try {
          const shares = JSON.parse(sharesJson);
          setRecoveryShares(shares);
        } catch (err) {
          console.error('Failed to parse recovery shares:', err);
          setError('Failed to load recovery shares. Please set up recovery first.');
        }
      } else {
        setError('No recovery shares available. Please set up recovery first.');
      }
    }
  }, [availableShares]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    
    if (step === 1) {
      // ガーディアンIDの検証
      try {
        Principal.fromText(guardianId);
        
        // 次のステップ（公開鍵入力）へ
        setStep(2);
      } catch (err) {
        setError('Invalid guardian ID. Please enter a valid Internet Identity principal.');
      }
    } else if (step === 2) {
      // 公開鍵の検証
      if (!guardianPublicKey.trim()) {
        setError('Guardian public key is required');
        return;
      }
      
      // シェア選択ステップへ
      setStep(3);
    } else {
      // シェア割り当てとガーディアン追加
      setLoading(true);
      try {
        if (!selectedShare) {
          throw new Error('Please select a share to assign to this guardian');
        }
        
        // ガーディアン追加とシェア割り当て
        await addGuardian(guardianId, guardianPublicKey, selectedShare);
        
        // 利用可能なシェアを更新
        const updatedShares = recoveryShares.filter(share => share.id !== selectedShare.id);
        localStorage.setItem('recoveryShares', JSON.stringify(updatedShares));
        
        // モーダルを閉じる
        onClose();
      } catch (err) {
        console.error('Failed to add guardian:', err);
        setError(err.message || 'Failed to add guardian. Please try again.');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">
          {step === 1 ? 'Add Guardian' : 
           step === 2 ? 'Guardian Public Key' :
           'Assign Recovery Share'}
        </h2>
        <button
          onClick={onClose}
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

      {step === 1 && (
        <>
          <p className="text-gray-600 mb-4">
            Enter the Internet Identity principal of the person you want to add as a guardian.
            You can get this from them directly.
          </p>
          
          <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="guardianId" className="block text-gray-700 text-sm font-bold mb-2">
              Guardian's Principal ID
            </label>
            <input
              type="text"
              id="guardianId"
              value={guardianId}
              onChange={(e) => setGuardianId(e.target.value)}
              className="bg-gray-50 border border-gray-300 text-gray-900 shadow appearance-none rounded w-full py-2 px-3 leading-tight focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="e.g., w3gef-eqllq-zz..."
              required
            />
          </div>

  <div className="flex items-center justify-end">
    <button
      type="button"
      onClick={onClose}
      className="mr-2 bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
    >
      Cancel
    </button>
    <button
      type="submit"
      disabled={!guardianId}
      className="bg-primary-600 hover:bg-primary-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:bg-primary-400 disabled:cursor-not-allowed"
    >
      Next
    </button>
  </div>
</form>
        </>
      )}

      {step === 2 && (
        <>
          <p className="text-gray-600 mb-4">
            Enter the public key of the guardian. The guardian can share this with you securely.
          </p>
          
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label htmlFor="guardianPublicKey" className="block text-gray-700 text-sm font-bold mb-2">
                Guardian's Public Key
              </label>
              <textarea
                id="guardianPublicKey"
                value={guardianPublicKey}
                onChange={(e) => setGuardianPublicKey(e.target.value)}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                placeholder="Paste the guardian's public key here"
                rows={4}
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                The public key is used to encrypt their share securely.
              </p>
            </div>

            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="mr-2 bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={!guardianPublicKey}
                className="bg-primary-600 hover:bg-primary-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
              >
                Next
              </button>
            </div>
          </form>
        </>
      )}

      {step === 3 && (
        <>
          <p className="text-gray-600 mb-4">
            Select a recovery share to assign to this guardian. Each share is a unique piece of your recovery key.
            You'll need a certain number of shares to recover your account.
          </p>
          
          {recoveryShares.length === 0 ? (
            <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded relative mb-4">
              <span className="block sm:inline">
                No more shares available. You have assigned all possible shares to guardians.
              </span>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  Available Shares
                </label>
                <div className="space-y-2">
                  {recoveryShares.map((share) => (
                    <div
                      key={share.id}
                      className={`border rounded p-3 cursor-pointer transition-colors ${
                        selectedShare && selectedShare.id === share.id
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-gray-300 hover:border-primary-400'
                      }`}
                      onClick={() => setSelectedShare(share)}
                    >
                      <div className="flex items-center">
                        <input
                          type="radio"
                          checked={selectedShare && selectedShare.id === share.id}
                          onChange={() => setSelectedShare(share)}
                          className="h-4 w-4 text-primary-600 focus:ring-primary-500"
                        />
                        <label className="ml-2 block text-sm text-gray-900">
                          Share {share.id.substring(share.id.lastIndexOf('-') + 1)}
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="mr-2 bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading || !selectedShare}
                  className="bg-primary-600 hover:bg-primary-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                >
                  {loading ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Assigning...
                    </span>
                  ) : (
                    'Assign Share & Add Guardian'
                  )}
                </button>
              </div>
            </form>
          )}
        </>
      )}
    </div>
  );
}

export default AddGuardian;