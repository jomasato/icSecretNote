// src/services/guardianStorage.js
// ガーディアンのシェア管理用ストレージサービス

const DB_NAME = 'GuardianSharesDB';

/**
 * IndexedDBを開く
 * @param {string} dbName - データベース名
 * @param {number} version - バージョン
 * @returns {Promise<IDBDatabase>} データベースオブジェクト
 */
const openDatabase = (dbName = DB_NAME, version = 1) => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, version);
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        // シェアを保存するオブジェクトストアを作成
        if (!db.objectStoreNames.contains('shares')) {
          const store = db.createObjectStore('shares', { keyPath: 'id' });
          // インデックスを作成してユーザーのプリンシパルIDで検索できるようにする
          store.createIndex('userPrincipal', 'userPrincipal', { unique: false });
          // 追加日時でソートできるようにインデックスを追加
          store.createIndex('storedAt', 'storedAt', { unique: false });
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
   * シェアをIndexedDBに保存
   * @param {Object} share - シェア情報
   * @param {string} userPrincipal - ユーザーのプリンシパルID
   * @param {string} userName - ユーザー名（オプション）
   * @returns {Promise<boolean>} 保存が成功した場合はtrue
   */
  export const storeShareInIndexedDB = async (shareInfo, userPrincipal, userName = '') => {
      // 入力データのログ出力を追加
      console.log('Storing share - input validation:', { 
        shareInfo: shareInfo ? {
          hasId: !!shareInfo.id,
          hasValue: !!shareInfo.value,
          id: shareInfo?.id?.substring(0, 10),
          fields: shareInfo ? Object.keys(shareInfo) : []
        } : null,
        userPrincipal: userPrincipal?.substring(0, 10),
        hasUserName: !!userName
      });
    
      if (!shareInfo || !shareInfo.id || !userPrincipal) {
        console.error('Invalid share data for storage:', { 
          shareInfo: shareInfo ? {
            hasId: !!shareInfo.id,
            hasValue: !!shareInfo.value,
            fields: shareInfo ? Object.keys(shareInfo) : []
          } : null,
          userPrincipal: !!userPrincipal
        });
        throw new Error('Invalid share data: required fields missing');
      }
  
    console.log('Storing share in IndexedDB:', { 
      shareId: shareInfo.id, 
      principalLength: userPrincipal.length,
      hasUserName: !!userName
    });
    
    // Open the database
    const db = await openGuardianSharesDB();
    
    return new Promise((resolve, reject) => {
      try {
        // Start a transaction
        const transaction = db.transaction(['shares'], 'readwrite');
        const store = transaction.objectStore('shares');
        
        // Check if this share already exists
        const getRequest = store.get(shareInfo.id);
        
        getRequest.onsuccess = (event) => {
          const existingShare = event.target.result;
          
          if (existingShare) {
            console.log('Share already exists, updating it');
            // Update existing share
            existingShare.value = shareInfo.value || existingShare.value;
            existingShare.updatedAt = Date.now();
            
            const updateRequest = store.put(existingShare);
            
            updateRequest.onsuccess = () => {
              console.log('Successfully updated existing share');
              resolve(true);
            };
            
            updateRequest.onerror = (error) => {
              console.error('Error updating share in IndexedDB:', error);
              reject(error);
            };
          } else {
            // Create new share entry
            const shareEntry = {
              id: shareInfo.id,
              value: shareInfo.value,
              userPrincipal: userPrincipal,
              userName: userName || '',
              storedAt: Date.now(),
              updatedAt: Date.now(),
              metadata: shareInfo.metadata || {}
            };
            
            console.log('Creating new share entry');
            const addRequest = store.add(shareEntry);
            
            addRequest.onsuccess = () => {
              console.log('Successfully stored share in IndexedDB');
              resolve(true);
            };
            
            addRequest.onerror = (error) => {
              console.error('Error storing share in IndexedDB:', error);
              reject(error);
            };
          }
        };
        
        getRequest.onerror = (error) => {
          console.error('Error checking for existing share:', error);
          reject(error);
        };
        
        // Handle transaction errors
        transaction.onerror = (error) => {
          console.error('Transaction error when storing share:', error);
          reject(error);
        };
        
        // Close the database when done
        transaction.oncomplete = () => {
          db.close();
        };
      } catch (error) {
        console.error('Unexpected error in storeShareInIndexedDB:', error);
        reject(error);
      }
    });
  };

  const openGuardianSharesDB = () => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('GuardianSharesDB', 1);
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Create the shares object store if it doesn't exist
        if (!db.objectStoreNames.contains('shares')) {
          const store = db.createObjectStore('shares', { keyPath: 'id' });
          store.createIndex('userPrincipal', 'userPrincipal', { unique: false });
          store.createIndex('storedAt', 'storedAt', { unique: false });
        }
      };
      
      request.onsuccess = (event) => {
        resolve(event.target.result);
      };
      
      request.onerror = (event) => {
        console.error('Error opening IndexedDB:', event.target.error);
        reject(event.target.error);
      };
    });
  };
  
  /**
   * 特定のユーザーのシェアを全て取得
   * @param {string} userPrincipal - ユーザーのプリンシパルID
   * @returns {Promise<Array>} シェアの配列
   */
  export const getSharesByUserPrincipal = async (userPrincipal) => {
    if (!userPrincipal) {
      console.error('Invalid principal ID for share lookup');
      return [];
    }
    
    console.log('Fetching shares for principal:', userPrincipal);
    
    try {
      // Open the database
      const db = await openGuardianSharesDB();
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(['shares'], 'readonly');
        const store = transaction.objectStore('shares');
        const index = store.index('userPrincipal');
        
        const request = index.getAll(userPrincipal);
        
        request.onsuccess = (event) => {
          const shares = event.target.result;
          console.log(`Found ${shares.length} shares for principal ${userPrincipal}`);
          resolve(shares);
        };
        
        request.onerror = (event) => {
          console.error('Error fetching shares by principal:', event.target.error);
          reject(event.target.error);
        };
        
        transaction.oncomplete = () => {
          db.close();
        };
      });
    } catch (error) {
      console.error('Unexpected error in getSharesByUserPrincipal:', error);
      return [];
    }
  };

  
  /**
   * 全てのシェアを取得
   * @returns {Promise<Array>} シェアの配列
   */
  export const getAllShares = async () => {
    try {
      const db = await openGuardianSharesDB();
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(['shares'], 'readonly');
        const store = transaction.objectStore('shares');
        
        const request = store.getAll();
        
        request.onsuccess = () => {
          resolve(request.result);
        };
        
        request.onerror = (event) => {
          console.error('Error retrieving all shares from IndexedDB:', event.target.error);
          reject(event.target.error);
        };
        
        transaction.oncomplete = () => {
          db.close();
        };
      });
    } catch (error) {
      console.error('Failed to get all shares from IndexedDB:', error);
      return [];
    }
  };
  
  /**
   * シェアを削除
   * @param {string} shareId - シェアID
   * @returns {Promise<boolean>} 削除が成功した場合はtrue
   */
  export const deleteShare = async (shareId) => {
    try {
      const db = await openDatabase();
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(['shares'], 'readwrite');
        const store = transaction.objectStore('shares');
        
        const request = store.delete(shareId);
        
        request.onsuccess = () => {
          resolve(true);
        };
        
        request.onerror = (event) => {
          console.error('Error deleting share from IndexedDB:', event.target.error);
          reject(event.target.error);
        };
        
        transaction.oncomplete = () => {
          db.close();
        };
      });
    } catch (error) {
      console.error('Failed to delete share from IndexedDB:', error);
      return false;
    }
  };
  
  /**
   * シェアを検索
   * @param {string} searchTerm - 検索語句
   * @returns {Promise<Array>} 検索結果の配列
   */
  export const searchShares = async (searchTerm) => {
    try {
      const allShares = await getAllShares();
      if (!searchTerm) return allShares;
      
      const lowerSearchTerm = searchTerm.toLowerCase();
      
      return allShares.filter(share => 
        share.userPrincipal?.toLowerCase().includes(lowerSearchTerm) ||
        share.userName?.toLowerCase().includes(lowerSearchTerm) ||
        share.id?.toLowerCase().includes(lowerSearchTerm)
      );
    } catch (error) {
      console.error('Failed to search shares:', error);
      return [];
    }
  };

  /**
 * シェアのユーザー名を更新
 * @param {string} shareId - シェアID
 * @param {string} userName - 新しいユーザー名
 * @returns {Promise<boolean>} 更新が成功した場合はtrue
 */
export const updateShareUserName = async (shareId, userName) => {
  try {
    const db = await openDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['shares'], 'readwrite');
      const store = transaction.objectStore('shares');
      
      // まず既存のシェアを取得
      const getRequest = store.get(shareId);
      
      getRequest.onsuccess = (event) => {
        const share = event.target.result;
        if (!share) {
          reject(new Error('シェアが見つかりません'));
          return;
        }
        
        // ユーザー名を更新
        share.userName = userName;
        share.updatedAt = Date.now();
        
        console.log('ユーザー名更新:', {
          シェアID: shareId.substring(0, 10) + '...',
          旧名前: share.userName || '(名前なし)',
          新名前: userName
        });
        
        // 更新を保存
        const updateRequest = store.put(share);
        
        updateRequest.onsuccess = () => {
          resolve(true);
        };
        
        updateRequest.onerror = (event) => {
          console.error('シェア更新エラー:', event.target.error);
          reject(event.target.error);
        };
      };
      
      getRequest.onerror = (event) => {
        console.error('シェア取得エラー:', event.target.error);
        reject(event.target.error);
      };
      
      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error('ユーザー名更新エラー:', error);
    return false;
  }
};