import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { generateKeyPair } from '../../services/crypto';
import { activateRecoveredAccount } from '../../services/api';

function AccountRestore() {
  const navigate = useNavigate();
  const [deviceName, setDeviceName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [step, setStep] = useState(1); // 1: 情報確認, 2: 処理中, 3: 完了
  const [tempData, setTempData] = useState({
    masterKey: null,
    userPrincipal: null
  });

  // 初期ロード
  useEffect(() => {
    // リカバリー情報の確認
    const tempMasterKey = localStorage.getItem('tempMasterKey');
    const tempUserPrincipal = localStorage.getItem('tempUserPrincipal');
    
    if (!tempMasterKey || !tempUserPrincipal) {
      setError('Recovery information not found. Please complete the recovery process first.');
      return;
    }
    
    setTempData({
      masterKey: tempMasterKey,
      userPrincipal: tempUserPrincipal
    });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    
    if (step === 1) {
      if (!deviceName.trim()) {
        setError('Device name is required');
        return;
      }
      
      setStep(2);
      setLoading(true);
      try {
        // 新しいデバイスキーペアを生成
        const deviceKeyPair = await generateKeyPair();
        
        // アカウントの有効化
        const result = await activateRecoveredAccount(
          tempData.userPrincipal,
          deviceName,
          deviceKeyPair.publicKey
        );
        
        if (result.err) {
          throw new Error(result.err);
        }
        
        // 新しいデバイスIDを取得
        const newDeviceId = result.ok;
        
        // ローカルストレージに情報を保存
        localStorage.setItem('devicePrivateKey', deviceKeyPair.privateKey);
        localStorage.setItem('masterEncryptionKey', tempData.masterKey);
        localStorage.setItem('currentDeviceId', newDeviceId);
        localStorage.setItem('userPrincipal', tempData.userPrincipal);
        
        // 一時データの削除
        localStorage.removeItem('tempMasterKey');
        localStorage.removeItem('tempUserPrincipal');
        
        setStep(3);
      } catch (err) {
        console.error('Failed to restore account:', err);
        setError(err.message || 'Failed to restore account. Please try again.');
        setStep(1);
      } finally {
        setLoading(false);
      }
    }
  };

  const goToNotes = () => {
    navigate('/notes');
  };

  // リカバリー情報がない場合のエラー表示
  if (error && !tempData.masterKey) {
    return (
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg p-6 mt-10">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Account Restoration</h1>
        
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
          <span className="block sm:inline">{error}</span>
        </div>
        
        <div className="flex justify-center mt-6">
          <button
            onClick={() => navigate('/recovery')}
            className="bg-primary-600 hover:bg-primary-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
          >
            Start Recovery Process
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg p-6 mt-10">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Account Restoration</h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
          <span className="block sm:inline">{error}</span>
        </div>
      )}
      
      {step === 1 && (
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
                  <span className="font-medium">Recovery successful!</span> Your master key has been recovered.
                </p>
              </div>
            </div>
          </div>
          
          <p className="text-gray-600 mb-6">
            You're almost there! To complete the restoration process, we need to register this device to your account.
          </p>
          
          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label htmlFor="deviceName" className="block text-gray-700 text-sm font-bold mb-2">
                Device Name
              </label>
              <input
                type="text"
                id="deviceName"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                placeholder="e.g., My Laptop, New Phone"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Enter a name to help you identify this device later.
              </p>
            </div>
            
            <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-blue-700">
                    After registration, this device will have full access to your notes. Your notes will be automatically decrypted and available.
                  </p>
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
                    Registering...
                  </span>
                ) : (
                  'Register This Device'
                )}
              </button>
            </div>
          </form>
        </>
      )}
      
      {step === 2 && (
        <div className="text-center py-8">
          <svg className="animate-spin h-16 w-16 text-primary-600 mx-auto mb-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-lg text-gray-600 mb-2">Registering your device...</p>
          <p className="text-gray-500">This may take a moment as we set up your encryption keys.</p>
        </div>
      )}
      
      {step === 3 && (
        <>
          <div className="text-center py-6">
            <svg className="h-16 w-16 text-green-500 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Restoration Complete!</h2>
            <p className="text-gray-600 mb-6">
              Your account has been successfully restored and this device is now registered.
              You can now access all your encrypted notes.
            </p>
            
            <div className="bg-gray-50 border border-gray-200 rounded-md p-4 mb-6 text-left">
              <h3 className="font-medium text-gray-800 mb-2">Next Steps:</h3>
              <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                <li>Consider adding more devices for backup access</li>
                <li>Review your guardians and recovery settings</li>
                <li>Make sure your important notes are synced</li>
              </ul>
            </div>
            
            <button
              onClick={goToNotes}
              className="bg-primary-600 hover:bg-primary-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            >
              Go to My Notes
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default AccountRestore;