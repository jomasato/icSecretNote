import React, { useState } from 'react';
import QRCode from 'qrcode.react';
import { generateKeyPair } from '../../services/crypto';

function GuardianInvitation({ onClose }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [invitationData, setInvitationData] = useState(null);
  const [showQR, setShowQR] = useState(true);

  // コンポーネントのマウント時に招待データを生成
  React.useEffect(() => {
    generateInvitationData();
  }, []);

  const generateInvitationData = async () => {
    setLoading(true);
    try {
      // アプリの公開URLを取得（実際の環境に応じて変更）
      const appUrl = window.location.origin;
      
      // ユーザーのプリンシパルIDを取得
      const userPrincipal = localStorage.getItem('userPrincipal');
      
      // 一時的な暗号化キーペアを生成
      const tempKeyPair = await generateKeyPair();
      
      // 招待データを作成
      const invitation = {
        type: 'guardian-invitation',
        userPrincipal,
        appUrl,
        publicKey: tempKeyPair.publicKey,
        expiresAt: Date.now() + 1000 * 60 * 60 * 24 // 24時間有効
      };
      
      // 招待トークンを生成
      const invitationToken = btoa(JSON.stringify(invitation));
      
      // ユーザーフレンドリーな表示用にURLを生成
      const invitationUrl = `${appUrl}/accept-guardian?token=${invitationToken}`;
      
      setInvitationData({
        token: invitationToken,
        url: invitationUrl,
        privateKey: tempKeyPair.privateKey
      });
      
      // 秘密鍵をローカルストレージに一時保存
      localStorage.setItem('guardianInvitationKey', tempKeyPair.privateKey);
      
    } catch (err) {
      console.error('Failed to create invitation:', err);
      setError('Failed to generate invitation. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    const textToCopy = showQR ? invitationData.url : invitationData.token;
    
    navigator.clipboard.writeText(textToCopy)
      .then(() => {
        alert('Invitation copied to clipboard!');
      })
      .catch(err => {
        console.error('Failed to copy text: ', err);
        setError('Could not copy to clipboard. Please select and copy the text manually.');
      });
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Creating Invitation</h2>
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
        <div className="flex justify-center items-center py-8">
          <svg className="animate-spin h-10 w-10 text-primary-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Guardian Invitation</h2>
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

      {invitationData && (
        <>
          <p className="text-gray-600 mb-4">
            Share this invitation with the person you want to add as your guardian. They will need to accept it to become your guardian.
          </p>
          
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Show as:</span>
              <div className="flex space-x-2">
                <button
                  onClick={() => setShowQR(true)}
                  className={`px-3 py-1 text-sm rounded ${
                    showQR ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  QR Code
                </button>
                <button
                  onClick={() => setShowQR(false)}
                  className={`px-3 py-1 text-sm rounded ${
                    !showQR ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  Link
                </button>
              </div>
            </div>
            
            {showQR ? (
              <div className="flex flex-col items-center justify-center p-4 bg-gray-50 rounded-lg">
                <QRCode 
                  value={invitationData.url}
                  size={200}
                  level="H"
                  includeMargin={true}
                  className="mb-2"
                />
                <p className="text-sm text-gray-600 text-center mt-2">
                  Have your guardian scan this QR code
                </p>
              </div>
            ) : (
              <div className="p-4 bg-gray-50 rounded-lg">
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  Invitation Link
                </label>
                <div className="relative">
                  <input
                    readOnly
                    value={invitationData.url}
                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline pr-16"
                  />
                  <button
                    type="button"
                    onClick={copyToClipboard}
                    className="absolute right-2 top-2 bg-primary-100 text-primary-800 px-2 py-1 rounded text-xs font-medium"
                  >
                    Copy
                  </button>
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  Share this link with your guardian
                </p>
              </div>
            )}
          </div>
          
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  This invitation will expire in 24 hours. Make sure your guardian accepts it before it expires.
                </p>
              </div>
            </div>
          </div>
          
          <div className="text-sm text-gray-600 mb-4">
            <h3 className="font-bold mb-1">Instructions for your Guardian:</h3>
            <ol className="list-decimal list-inside pl-2 space-y-1">
              <li>Your guardian should click the link or scan the QR code</li>
              <li>They need to sign in with their Internet Identity</li>
              <li>They will see your invitation and can accept it</li>
              <li>Once accepted, they will become your guardian</li>
            </ol>
          </div>
          
          <div className="flex items-center justify-end">
            <button
              onClick={onClose}
              className="bg-primary-600 hover:bg-primary-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            >
              Done
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default GuardianInvitation;