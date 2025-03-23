// src/services/inviteTracking.js
// ガーディアン招待の追跡管理サービス

/**
 * IndexedDBを開く
 * @param {string} dbName - データベース名
 * @param {number} version - バージョン
 * @returns {Promise<IDBDatabase>} データベースオブジェクト
 */
const openDatabase = (dbName = 'InviteTrackingDB', version = 1) => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, version);
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        // 招待を保存するオブジェクトストアを作成
        if (!db.objectStoreNames.contains('pendingInvites')) {
          const store = db.createObjectStore('pendingInvites', { keyPath: 'inviteId' });
          // インデックスを作成
          store.createIndex('shareId', 'shareId', { unique: false });
          store.createIndex('status', 'status', { unique: false });
          store.createIndex('expiresAt', 'expiresAt', { unique: false });
        }
      };
      
      request.onsuccess = (event) => {
        resolve(event.target.result);
      };
      
      request.onerror = (event) => {
        console.error('IndexedDB error:', event.target.error);
        reject(event.target.error);
      };
    });
  };
  
  /**
   * 招待を記録
   * @param {Object} inviteData - 招待データ
   * @returns {Promise<string>} 招待ID
   */
  export const trackInvite = async (inviteData) => {
    try {
      const db = await openDatabase();
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(['pendingInvites'], 'readwrite');
        const store = transaction.objectStore('pendingInvites');
        
        // 招待ID生成
        const inviteId = inviteData.inviteId || `invite-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        
        // 招待データ構築
        const invitation = {
          inviteId,
          shareId: inviteData.shareId,
          recipientEmail: inviteData.recipientEmail,
          token: inviteData.token,
          userPrincipal: inviteData.userPrincipal,
          status: 'pending', // pending, accepted, expired
          createdAt: Date.now(),
          expiresAt: inviteData.expiresAt || (Date.now() + 24 * 60 * 60 * 1000), // デフォルト24時間
          shareData: inviteData.shareData
        };
        
        const request = store.put(invitation);
        
        request.onsuccess = () => {
          resolve(inviteId);
        };
        
        request.onerror = (event) => {
          console.error('Error tracking invite:', event.target.error);
          reject(event.target.error);
        };
        
        transaction.oncomplete = () => {
          db.close();
        };
      });
    } catch (error) {
      console.error('Failed to track invite:', error);
      return null;
    }
  };
  
  /**
   * 招待状態を更新
   * @param {string} inviteId - 招待ID
   * @param {string} status - 新しい状態
   * @returns {Promise<boolean>} 成功した場合はtrue
   */
  export const updateInviteStatus = async (inviteId, status) => {
    try {
      const db = await openDatabase();
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(['pendingInvites'], 'readwrite');
        const store = transaction.objectStore('pendingInvites');
        
        // 招待を取得
        const getRequest = store.get(inviteId);
        
        getRequest.onsuccess = () => {
          const invitation = getRequest.result;
          if (!invitation) {
            resolve(false);
            return;
          }
          
          // 状態を更新
          invitation.status = status;
          invitation.updatedAt = Date.now();
          
          // 保存
          const updateRequest = store.put(invitation);
          
          updateRequest.onsuccess = () => {
            resolve(true);
          };
          
          updateRequest.onerror = (event) => {
            console.error('Error updating invite status:', event.target.error);
            reject(event.target.error);
          };
        };
        
        getRequest.onerror = (event) => {
          console.error('Error getting invite:', event.target.error);
          reject(event.target.error);
        };
        
        transaction.oncomplete = () => {
          db.close();
        };
      });
    } catch (error) {
      console.error('Failed to update invite status:', error);
      return false;
    }
  };
  
  /**
   * トークンで招待を検索
   * @param {string} token - 招待トークン
   * @returns {Promise<Object|null>} 招待データまたはnull
   */
  export const findInviteByToken = async (token) => {
    try {
      const db = await openDatabase();
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(['pendingInvites'], 'readonly');
        const store = transaction.objectStore('pendingInvites');
        
        // すべての招待を取得して検索
        const request = store.getAll();
        
        request.onsuccess = () => {
          const invites = request.result;
          const found = invites.find(invite => invite.token === token);
          resolve(found || null);
        };
        
        request.onerror = (event) => {
          console.error('Error finding invite:', event.target.error);
          reject(event.target.error);
        };
        
        transaction.oncomplete = () => {
          db.close();
        };
      });
    } catch (error) {
      console.error('Failed to find invite:', error);
      return null;
    }
  };
  
  /**
   * シェアIDで招待を検索
   * @param {string} shareId - シェアID
   * @returns {Promise<Array>} 招待データの配列
   */
  export const findInvitesByShareId = async (shareId) => {
    try {
      const db = await openDatabase();
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(['pendingInvites'], 'readonly');
        const store = transaction.objectStore('pendingInvites');
        const index = store.index('shareId');
        
        const request = index.getAll(shareId);
        
        request.onsuccess = () => {
          resolve(request.result);
        };
        
        request.onerror = (event) => {
          console.error('Error finding invites by shareId:', event.target.error);
          reject(event.target.error);
        };
        
        transaction.oncomplete = () => {
          db.close();
        };
      });
    } catch (error) {
      console.error('Failed to find invites by shareId:', error);
      return [];
    }
  };
  
  /**
   * 期限切れの招待を全て取得
   * @returns {Promise<Array>} 期限切れ招待の配列
   */
  export const getExpiredInvites = async () => {
    try {
      const db = await openDatabase();
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(['pendingInvites'], 'readonly');
        const store = transaction.objectStore('pendingInvites');
        const index = store.index('status');
        
        // statusが'pending'のものを取得
        const request = index.getAll('pending');
        
        request.onsuccess = () => {
          const pendingInvites = request.result;
          const now = Date.now();
          // 期限切れのものをフィルタリング
          const expiredInvites = pendingInvites.filter(invite => invite.expiresAt < now);
          resolve(expiredInvites);
        };
        
        request.onerror = (event) => {
          console.error('Error getting expired invites:', event.target.error);
          reject(event.target.error);
        };
        
        transaction.oncomplete = () => {
          db.close();
        };
      });
    } catch (error) {
      console.error('Failed to get expired invites:', error);
      return [];
    }
  };
  
  /**
   * 招待の確認と期限切れ処理
   * @returns {Promise<Array>} 解放されたシェアIDの配列
   */
  export const processExpiredInvites = async () => {
    try {
      // 期限切れの招待を取得
      const expiredInvites = await getExpiredInvites();
      if (expiredInvites.length === 0) {
        return [];
      }
      
      const db = await openDatabase();
      const releasedShareIds = [];
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(['pendingInvites'], 'readwrite');
        const store = transaction.objectStore('pendingInvites');
        
        let completed = 0;
        
        // 各招待を期限切れとしてマーク
        expiredInvites.forEach(invite => {
          invite.status = 'expired';
          invite.updatedAt = Date.now();
          
          const request = store.put(invite);
          
          request.onsuccess = () => {
            // 解放されたシェアIDを記録
            if (invite.shareId) {
              releasedShareIds.push(invite.shareId);
              
              // shareData があれば、それを localStorage の recoveryShares に戻す
              if (invite.shareData && invite.shareData.shareInfo) {
                try {
                  const sharesJson = localStorage.getItem('recoveryShares');
                  const shares = sharesJson ? JSON.parse(sharesJson) : [];
                  
                  // シェアが重複していないか確認
                  const shareExists = shares.some(share => share.id === invite.shareData.shareInfo.id);
                  
                  if (!shareExists) {
                    // シェアを追加して localStorage を更新
                    shares.push(invite.shareData.shareInfo);
                    console.log('期限切れシェアを復元:', {
                      シェアID: invite.shareData.shareInfo.id,
                      新しいシェア総数: shares.length
                    });
                    localStorage.setItem('recoveryShares', JSON.stringify(shares));
                  }
                } catch (err) {
                  console.error('シェア復元エラー:', err);
                }
              }
            }
            
            completed++;
            if (completed === expiredInvites.length) {
              resolve(releasedShareIds);
            }
          };
          
          request.onerror = (event) => {
            console.error('Error updating expired invite:', event.target.error);
            
            completed++;
            if (completed === expiredInvites.length) {
              resolve(releasedShareIds);
            }
          };
        });
        
        transaction.oncomplete = () => {
          db.close();
        };
      });
    } catch (error) {
      console.error('Failed to process expired invites:', error);
      return [];
    }
  };
  
  /**
   * シェアが使用可能かどうかチェック
   * @param {string} shareId - シェアID
   * @returns {Promise<boolean>} 使用可能な場合はtrue
   */
  export const isShareAvailable = async (shareId) => {
    try {
      // シェアに関連する保留中の招待を検索
      const pendingInvites = await findInvitesByShareId(shareId);
      
      // 有効な招待がなければシェアは利用可能
      return pendingInvites.filter(invite => invite.status === 'pending').length === 0;
    } catch (error) {
      console.error('Failed to check share availability:', error);
      // エラーの場合は安全策として利用不可として扱う
      return false;
    }
  };
  
  /**
   * 招待を承認して関連するシェアを使用済みにマーク
   * @param {string} token - 招待トークン
   * @returns {Promise<Object>} 結果オブジェクト
   */
  export const acceptInvitation = async (token) => {
    try {
      // トークンで招待を検索
      const invite = await findInviteByToken(token);
      
      if (!invite) {
        return { success: false, error: '招待が見つかりません' };
      }
      
      // 招待が期限切れでないか確認
      if (invite.expiresAt < Date.now()) {
        await updateInviteStatus(invite.inviteId, 'expired');
        return { success: false, error: '招待の有効期限が切れています' };
      }
      
      // 招待を承認済みとしてマーク
      await updateInviteStatus(invite.inviteId, 'accepted');
      
      return { 
        success: true, 
        shareData: invite.shareData,
        shareId: invite.shareId,
        userPrincipal: invite.userPrincipal
      };
    } catch (error) {
      console.error('Failed to accept invitation:', error);
      return { success: false, error: '招待の承認に失敗しました' };
    }
  };
  
  // 定期的に期限切れの招待をチェックするタイマーを設定（アプリ起動時）
  let expirationCheckTimer = null;
 /**
 * 招待期限チェックを開始
 * @param {Function} onShareReleased - シェア解放時のコールバック
 * @returns {Function} クリーンアップ関数
 */
export const startExpirationCheck = (onShareReleased) => {
    // 既存のタイマーをクリア
    stopExpirationCheck();
    
    // 1時間ごとにチェック
    expirationCheckTimer = setInterval(async () => {
      try {
        // 期限切れの招待を処理し、解放されたシェアIDを取得
        const releasedShareIds = await processExpiredInvites();
        
        // コールバックが指定されていれば呼び出し
        if (releasedShareIds.length > 0 && typeof onShareReleased === 'function') {
          onShareReleased(releasedShareIds);
        }
      } catch (err) {
        console.error('Error in expired invites check:', err);
      }
    }, 60 * 60 * 1000); // 1時間
    
    // アプリ起動時に初回チェック
    processExpiredInvites().then(releasedShareIds => {
      if (releasedShareIds.length > 0 && typeof onShareReleased === 'function') {
        onShareReleased(releasedShareIds);
      }
    });
    
    // クリーンアップ関数を返す
    return stopExpirationCheck;
  };
  
  /**
   * 招待期限チェックを停止
   */
  export const stopExpirationCheck = () => {
    if (expirationCheckTimer) {
      clearInterval(expirationCheckTimer);
      expirationCheckTimer = null;
    }
  };