import React, { useState, useEffect } from 'react';
import { generateInvitationToken } from '../../services/api';
import { trackInvite } from '../../services/inviteTracking';

function GuardianInvitation({ onClose, userPrincipal }) {
  const [invitationToken, setInvitationToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [countdown, setCountdown] = useState(0);
  const [emailInvite, setEmailInvite] = useState('');
  const [invitationLink, setInvitationLink] = useState(''); // 招待リンクを保存する状態を追加

  // 初期化時に招待トークンを生成
  useEffect(() => {
    generateToken();
  }, []);

  // カウントダウンタイマーの設定
  useEffect(() => {
    let timer;
    if (invitationToken && countdown > 0) {
      timer = setInterval(() => {
        setCountdown(prev => prev - 1);
      }, 1000);
    } else if (countdown === 0 && invitationToken) {
      // タイムアウト時の処理
      setInvitationToken(null);
      setInvitationLink(''); // リンクもクリア
    }
    
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [invitationToken, countdown]);

  // トークンが更新されたらリンクも更新
  useEffect(() => {
    if (invitationToken) {
      updateInvitationLink();
    }
  }, [invitationToken, userPrincipal]);

  // 招待トークンの生成
  const generateToken = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await generateInvitationToken(userPrincipal);
      
      if (!result || !result.token) {
        throw new Error('招待トークンの生成に失敗しました');
      }
      
      setInvitationToken(result.token);
      setCountdown(result.expiresIn || 3600); // デフォルトで1時間
    } catch (err) {
      console.error('招待トークン生成エラー:', err);
      setError(err.message || '招待トークンの生成に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // カウントダウン表示用のフォーマット
  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}時間${minutes}分${secs}秒`;
    } else if (minutes > 0) {
      return `${minutes}分${secs}秒`;
    } else {
      return `${secs}秒`;
    }
  };

  const getAvailableShare = async (userPrincipal) => {
    try {
      // Get available shares from localStorage
      const sharesJson = localStorage.getItem('recoveryShares');
      if (!sharesJson) {
        console.error('No recovery shares available');
        return null;
      }
      
      const shares = JSON.parse(sharesJson);
      if (!shares || shares.length === 0) {
        console.error('Recovery shares is empty');
        return null;
      }
      
      // Choose the first available share
      const shareToAssign = shares[0];
      
      // Create share data structure
      return {
        shareInfo: shareToAssign,
        inviterPrincipal: userPrincipal
      };
    } catch (err) {
      console.error('Failed to get available share:', err);
      return null;
    }
  };
  
  // 招待リンク生成関数 - 状態を更新するように変更
  const updateInvitationLink = async () => {
    if (!invitationToken || !userPrincipal) return;
    
    const baseUrl = window.location.origin;
    
    try {
      // Get share data to include in the URL
      const shareData = await getAvailableShare(userPrincipal);
      
      let generatedLink;
      if (!shareData) {
        generatedLink = `${baseUrl}/guardian-invite?token=${invitationToken}&principal=${userPrincipal}`;
      } else {
        // Encode share data to include in URL
        const encodedShareData = encodeURIComponent(btoa(JSON.stringify(shareData)));
        
        // Track which share is being used in this invitation
        if (shareData.shareInfo && shareData.shareInfo.id) {
          try {
            await trackInvite({
              token: invitationToken,
              userPrincipal,
              shareId: shareData.shareInfo.id,
              expiresAt: Date.now() + (countdown * 1000),
              shareData: shareData
            });
            
            // シェアを予約したら localStorage からも削除
            const sharesJson = localStorage.getItem('recoveryShares');
            if (sharesJson) {
              const shares = JSON.parse(sharesJson);
              const updatedShares = shares.filter(share => share.id !== shareData.shareInfo.id);
              console.log('招待用シェア予約:', {
                元のシェア数: shares.length,
                残りシェア数: updatedShares.length,
                使用シェアID: shareData.shareInfo.id
              });
              localStorage.setItem('recoveryShares', JSON.stringify(updatedShares));
            }
          } catch (trackErr) {
            console.error('Failed to track invitation share:', trackErr);
          }
        }
        
        generatedLink = `${baseUrl}/guardian-invite?token=${invitationToken}&principal=${userPrincipal}&shareData=${encodedShareData}`;
      }
      
      // 状態を更新
      setInvitationLink(generatedLink);
    } catch (err) {
      console.error('Error generating invitation link:', err);
      // Fallback to link without share data
      const fallbackLink = `${baseUrl}/guardian-invite?token=${invitationToken}&principal=${userPrincipal}`;
      setInvitationLink(fallbackLink);
    }
  };

  // Eメール招待の送信
  const handleSendEmailInvite = (e) => {
    e.preventDefault();
    
    if (!emailInvite || !emailInvite.includes('@')) {
      setError('有効なメールアドレスを入力してください');
      return;
    }
    
    if (!invitationLink) {
      setError('招待リンクがまだ生成されていません');
      return;
    }
    
    try {
      // Open mail app with the already generated invitation link
      const subject = encodeURIComponent('セキュアノートのガーディアン招待');
      const body = encodeURIComponent(`
あなたがセキュアノートアプリのガーディアンとして招待されました。
以下の招待リンクをクリックして、アカウント回復のガーディアンになってください。

招待リンク: ${invitationLink}

または以下の招待コードを使用してください:
招待コード: ${invitationToken}

この招待は ${formatTime(countdown)} 後に無効になります。
      `);
      
      window.open(`mailto:${emailInvite}?subject=${subject}&body=${body}`);
    } catch (err) {
      console.error('Failed to generate invitation email:', err);
      setError('招待メールの生成に失敗しました');
    }
  };

  // リンクをクリップボードにコピー
  const copyInvitationLink = () => {
    if (invitationLink) {
      navigator.clipboard.writeText(invitationLink);
      alert('招待リンクをクリップボードにコピーしました');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">ガーディアン招待</h2>
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

      <div className="mb-6">
        <h3 className="text-lg font-medium text-gray-900 mb-2">ガーディアンとは？</h3>
        <p className="text-gray-600 mb-4">
          ガーディアンは、アカウントを回復するのを助けてくれる信頼できる人です。あなたがアクセスを失った場合、設定された数のガーディアンの承認があれば、アカウントを回復できます。
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
                ガーディアンは信頼できる人物を選んでください。ガーディアンはあなたのノートの内容を閲覧することはできませんが、アカウント回復プロセスを承認する重要な役割を担います。
              </p>
            </div>
          </div>
        </div>
      </div>

      {invitationToken ? (
        <div className="mb-6">
          <div className="mb-4 text-center">
            <h3 className="text-lg font-medium text-gray-900 mb-2">招待の詳細</h3>
            <p className="text-sm text-gray-500 mb-1">
              この招待は <span className="font-bold">{formatTime(countdown)}</span> 後に無効になります
            </p>
          </div>

          <div className="mb-6">
            <h4 className="text-md font-medium text-gray-800 mb-2">招待リンク</h4>
            <div className="bg-gray-100 p-2 rounded overflow-x-auto mb-2">
              <pre className="text-xs break-all">
                {invitationLink || '招待リンクを生成中...'}
              </pre>
            </div>
            <div className="flex justify-end">
              <button
                onClick={copyInvitationLink}
                disabled={!invitationLink}
                className="text-primary-600 hover:text-primary-800 text-sm disabled:text-gray-400"
              >
                コピー
              </button>
            </div>
          </div>

          <div className="mb-6">
            <h4 className="text-md font-medium text-gray-800 mb-2">招待コード</h4>
            <div className="bg-gray-100 p-2 rounded overflow-x-auto mb-2">
              <pre className="text-xs break-all">
                {invitationToken}
              </pre>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(invitationToken);
                  alert('招待コードをクリップボードにコピーしました');
                }}
                className="text-primary-600 hover:text-primary-800 text-sm"
              >
                コピー
              </button>
            </div>
          </div>

          <div className="mb-6">
            <h4 className="text-md font-medium text-gray-800 mb-2">メールで招待</h4>
            <form onSubmit={handleSendEmailInvite} className="flex items-center space-x-2">
              <input
                type="email"
                value={emailInvite}
                onChange={(e) => setEmailInvite(e.target.value)}
                placeholder="ガーディアンのメールアドレス"
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                required
              />
              <button
                type="submit"
                disabled={!invitationLink}
                className="bg-primary-600 hover:bg-primary-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:bg-primary-400"
              >
                送信
              </button>
            </form>
          </div>

          <div className="flex justify-center">
            <button
              onClick={generateToken}
              disabled={loading}
              className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            >
              {loading ? '生成中...' : '新しい招待を生成'}
            </button>
          </div>
        </div>
      ) : (
        <div className="text-center py-6">
          {loading ? (
            <div className="flex flex-col items-center">
              <svg className="animate-spin h-10 w-10 text-primary-600 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p className="text-gray-600">招待トークンを生成しています...</p>
            </div>
          ) : (
            <div>
              <p className="text-gray-600 mb-4">
                ガーディアンを招待するための招待トークンが必要です。
              </p>
              <button
                onClick={generateToken}
                className="bg-primary-600 hover:bg-primary-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
              >
                招待トークンを生成
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default GuardianInvitation;