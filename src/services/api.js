//src/services/api.js

import { getActor,getCurrentPrincipal} from './auth';
import { 
  stringToBlob, 
  blobToString, 
  encryptWithKey, 
  decryptWithKey, 
  encryptWithPublicKey, 
  decryptWithPrivateKey,
  createShares,
  combineShares,
  generateKeyPair
} from './crypto';
import { 
  encryptWithKey as improvedEncrypt,
  decryptWithKey as improvedDecrypt,
  getUserMasterKey,
  saveUserMasterKey
 } from './improved-crypto';
 import { Principal } from '@dfinity/principal';

//------------------------------------------------
// ガーディアンの公開鍵管理
//------------------------------------------------
const GUARDIAN_REGISTRY_KEY = 'guardianRegistry';

/**
 * ガーディアンレジストリを初期化または取得
 * @returns {Object} ガーディアンの公開鍵レジストリ
 */
const getGuardianRegistry = () => {
  const registry = localStorage.getItem(GUARDIAN_REGISTRY_KEY);
  return registry ? JSON.parse(registry) : {};
};

/**
 * ガーディアンの公開鍵を保存
 * @param {string} guardianPrincipal - ガーディアンのプリンシパルID
 * @param {string} publicKey - ガーディアンの公開鍵
 */
export const saveGuardianPublicKey = (guardianPrincipal, publicKey) => {
  const registry = getGuardianRegistry();
  registry[guardianPrincipal] = publicKey;
  localStorage.setItem(GUARDIAN_REGISTRY_KEY, JSON.stringify(registry));
};

/**
 * ガーディアンの公開鍵を取得
 * @param {string} guardianPrincipal - ガーディアンのプリンシパルID
 * @returns {string|null} ガーディアンの公開鍵または null
 */
export const getGuardianPublicKey = (guardianPrincipal) => {
  const registry = getGuardianRegistry();
  return registry[guardianPrincipal] || null;
};

/**
 * リカバリーデータを生成
 * @param {string} encryptionKey - 暗号化キー
 * @param {number} totalGuardians - 総ガーディアン数
 * @param {number} requiredShares - リカバリーに必要なシェア数
 * @returns {Object} リカバリーデータ
 */
export const generateRecoveryData = (encryptionKey, totalGuardians, requiredShares) => {
  // シェアを作成
  const shares = createShares(encryptionKey, totalGuardians, requiredShares);
  
  // 公開リカバリーデータ（シェアを再結合するために必要な情報）
  const publicRecoveryData = {
    version: 1,
    createdAt: new Date().toISOString(),
    requiredShares,
    totalShares: totalGuardians
  };
  
  return {
    shares,
    publicRecoveryData: stringToBlob(JSON.stringify(publicRecoveryData))
  };
};

//------------------------------------------------
// Notes API
//------------------------------------------------

/**
 * すべてのノートを取得して復号
 * @returns {Array} 復号されたノートの配列
 */


// キャッシュつきgetNotes関数
// キャッシュを保持するオブジェクト
const cache = {
  notes: {
    data: null,
    timestamp: null,
    ttl: 30000 // 30秒間キャッシュを保持
  }
};

// 進行中のリクエストを追跡
const pendingRequests = {
  getNotes: null
};

/**
 * すべてのノートを取得して復号（キャッシュ付き）
 * @param {boolean} forceRefresh - キャッシュを無視して強制的に再取得するか
 * @returns {Promise<Array>} 復号されたノートの配列
 */
export const getNotes = async (masterKey, forceRefresh = false) => {
  // 既に進行中のリクエストがあれば、それを返す
  if (pendingRequests.getNotes) {
    return pendingRequests.getNotes;
  }
  
  // キャッシュが有効な場合はキャッシュから返す
  if (!forceRefresh && 
      cache.notes.data && 
      cache.notes.timestamp && 
      Date.now() - cache.notes.timestamp < cache.notes.ttl) {
    return cache.notes.data;
  }
  
  try {
    pendingRequests.getNotes = (async () => {
      const actor = await getActor();
      const result = await actor.getNotes();
      
      // まずノートが存在するかチェック
      if (!result || result.length === 0) {
        console.log("No notes found for this user");
        return []; // 空の配列を返す（エラーにしない）
      }
      
      // ノートがある場合のみマスターキーをチェック
      if (!masterKey) {
        const error = new Error('Master encryption key not found');
        error.code = 'NO_MASTER_KEY';
        throw error;
      }
      
      // 復号エラーカウンター
      let decryptionErrorCount = 0;
      
      // ノートを復号
      const decryptedNotes = await Promise.all(result.map(async note => {
        try {
          // Blobを文字列に変換
          const titleStr = blobToString(note.title);
          const contentStr = blobToString(note.content);
          
          // JSON形式に変換して解析
          const titleObj = JSON.parse(titleStr);
          const contentObj = JSON.parse(contentStr);
          
          // WebCrypto API (improved-crypto.js) を使用
          const title = await improvedDecrypt(titleObj, masterKey);
          const content = await improvedDecrypt(contentObj, masterKey);
          
          // 復号失敗チェック
          if (!title || !content) {
            decryptionErrorCount++;
            throw new Error('Decryption failed for note ' + note.id);
          }
          
          return {
            id: note.id,
            title,
            content,
            created: new Date(Number(note.created) / 1000000),
            updated: new Date(Number(note.updated) / 1000000)
          };
        } catch (error) {
          // エラーカウント
          decryptionErrorCount++;
          console.error(`Failed to decrypt note ${note.id}:`, error);
          return {
            id: note.id,
            title: 'Unable to decrypt',
            content: 'Unable to decrypt this note',
            created: new Date(Number(note.created) / 1000000),
            updated: new Date(Number(note.updated) / 1000000),
            _decryptionFailed: true
          };
        }
      }));
      
      // 復号エラーが一定数を超えた場合、カスタムイベントを発火
      if (decryptionErrorCount > 0) {
        const errorRate = decryptionErrorCount / result.length;
        console.warn(`Decryption errors: ${decryptionErrorCount}/${result.length} (${(errorRate * 100).toFixed(1)}%)`);
        
        // グローバル状態に記録
        if (window._cryptoState) {
          window._cryptoState.decryptionErrors += decryptionErrorCount;
          window._cryptoState.decryptionAttempts += result.length;
          // カスタムイベントを手動で発火
          if (errorRate >= 0.3) { // 30%以上のエラー率でイベント発火
            const event = new CustomEvent('decryption-error', {
              detail: {
                errorRate,
                attempts: result.length,
                errors: decryptionErrorCount,
                lastError: new Error('Multiple notes failed to decrypt')
              }
            });
            window.dispatchEvent(event);
          }
        }
      }
      
      return decryptedNotes;
    })();
    
    // リクエスト完了を待つ
    const result = await pendingRequests.getNotes;
    
    // リクエスト完了後、pendingRequestsをクリア
    pendingRequests.getNotes = null;
    
    // キャッシュに保存
    cache.notes.data = result;
    cache.notes.timestamp = Date.now();
    
    return result;
  } catch (error) {
    // エラー時にpendingRequestsをクリア
    pendingRequests.getNotes = null;
    console.error('Failed to get notes:', error);
    // 特別なエラーコードの処理
    if (error.code === 'NO_MASTER_KEY') {
      // マスターキーが見つからない場合の処理
      if (window._cryptoState) {
        // 復号エラーイベントを発火
        const event = new CustomEvent('decryption-error', {
          detail: {
            errorRate: 1, // 100% エラー
            attempts: 1,
            errors: 1,
            lastError: error
          }
        });
        window.dispatchEvent(event);
      }
    }
    
    throw error;
  }
};

/**
 * 特定のノートを取得して復号
 * @param {string} id - ノートID
 * @returns {Object} 復号されたノート
 */
export const getNote = async (id) => {
  try {
    const actor = await getActor();
    const result = await actor.getNote(id);
    
    if (result.err) {
      throw new Error(result.err);
    }
    
    const note = result.ok;
    
    // デバイスの秘密鍵を取得
    const devicePrivateKey = localStorage.getItem('devicePrivateKey');
    if (!devicePrivateKey) {
      throw new Error('Device private key not found');
    }
    
    // ノートを復号
    const title = decryptWithPrivateKey(note.title, devicePrivateKey);
    const content = decryptWithPrivateKey(note.content, devicePrivateKey);
    
    return {
      id: note.id,
      title,
      content,
      created: new Date(Number(note.created) / 1000000),
      updated: new Date(Number(note.updated) / 1000000)
    };
  } catch (error) {
    console.error(`Failed to get note ${id}:`, error);
    throw error;
  }
};

/**
 * ノートを作成して暗号化
 * @param {string} title - ノートのタイトル
 * @param {string} content - ノートの内容
 * @returns {string} 作成されたノートのID
 */
export const createNote = async (title, content, masterKey) => {
  try {
    const actor = await getActor();
    
    // マスターキーのチェック
    if (!masterKey) {
      throw new Error('Master encryption key not found');
    }
    
    // WebCrypto API (improved-crypto.js) を使用
    const encryptedTitle = await improvedEncrypt(title, masterKey);
    const encryptedContent = await improvedEncrypt(content, masterKey);
    
    // 暗号化データをBlobに変換
    const titleBlob = stringToBlob(JSON.stringify(encryptedTitle));
    const contentBlob = stringToBlob(JSON.stringify(encryptedContent));
    
    // ノート用のユニークIDを生成
    const noteId = `note-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    
    // 暗号化されたノートを保存
    const result = await actor.saveNote(noteId,titleBlob, contentBlob);
    
    if (result.err) {
      throw new Error(result.err);
    }
    
    return result.ok;
  } catch (error) {
    console.error('Failed to create note:', error);
    throw error;
  }
};

/**
 * ノートを更新して暗号化
 * @param {string} id - ノートID
 * @param {string} title - 新しいタイトル
 * @param {string} content - 新しい内容
 * @returns {boolean} 成功した場合はtrue
 */
export const updateNote = async (id, title, content, masterKey) => {
  try {
    const actor = await getActor();
    
    // マスターキーをチェック
    if (!masterKey) {
      throw new Error('Master encryption key not found');
    }
    
    // improved-crypto.jsの関数を使用して暗号化
    const encryptedTitle = await improvedEncrypt(title, masterKey);
    const encryptedContent = await improvedEncrypt(content, masterKey);
    
    // 暗号化データをBlobに変換
    const titleBlob = stringToBlob(JSON.stringify(encryptedTitle));
    const contentBlob = stringToBlob(JSON.stringify(encryptedContent));
    
    // 暗号化されたノートを更新
    const result = await actor.updateNote(id, titleBlob, contentBlob);
    
    if (result.err) {
      throw new Error(result.err);
    }
    
    return true;
  } catch (error) {
    console.error(`Failed to update note ${id}:`, error);
    throw error;
  }
};

/**
 * ノートを削除
 * @param {string} id - ノートID
 * @returns {boolean} 成功した場合はtrue
 */
export const deleteNote = async (id) => {
  try {
    const actor = await getActor();
    const result = await actor.deleteNote(id);
    
    if (result.err) {
      throw new Error(result.err);
    }
    
    return true;
  } catch (error) {
    console.error(`Failed to delete note ${id}:`, error);
    throw error;
  }
};

//------------------------------------------------
// Guardian API
//------------------------------------------------

/**
 * ガーディアンのリストを取得
 * @returns {Array} ガーディアンの配列
 */
export const getGuardians = async () => {
  try {
    const actor = await getActor();
    const result = await actor.getMyGuardians();
    
    return result.map(([principal, approved]) => ({
      principal: principal.toString(),
      approved
    }));
  } catch (error) {
    console.error('Failed to get guardians:', error);
    throw error;
  }
};

/**
 * ガーディアンを追加し、シェアを割り当て
 * @param {string} guardianPrincipal - ガーディアンのプリンシパルID
 * @param {string} guardianPublicKey - ガーディアンの公開鍵
 * @param {Object} share - ガーディアンに割り当てるシェア
 * @returns {boolean} 成功した場合はtrue
 */
/**
 * ガーディアンを追加し、シェアを割り当て
 * @param {string} guardianPrincipal - ガーディアンのプリンシパルID
 * @param {Object} share - ガーディアンに割り当てるシェア
 * @returns {Object} 成功した場合は {success: true}
 */

export const addGuardian = async (guardianPrincipal, share) => {
  try {
    // シェア情報のバリデーション
    if (!share) {
      return { success: false, error: 'シェア情報が不足しています' };
    }
    
    // シェアIDの確認
    if (!share.id) {
      return { success: false, error: 'シェアIDが不足しています' };
    }
    
    console.log('Adding guardian with share:', share);
    
    const actor = await getActor();
    
    // PrincipalオブジェクトへのIDの変換
    let principalObj;
    try {
      principalObj = Principal.fromText(guardianPrincipal.trim());
    } catch (principalError) {
      return { success: false, error: `ガーディアンIDの形式が無効です` };
    }
    
    // シェアIDを取得
    const shareId = share.id;
    
    // シェアの値を取得（存在しない場合はダミーデータ）
    const shareValue = share.value || "dummy-share-value";
    
    // ダミーのencryptedShareを作成（最小限のBlobデータ）
    const dummyEncryptedShare = new Uint8Array([1, 2, 3, 4]);
    
    console.log('manageGuardian呼び出し準備:', {
      principal: principalObj.toString(),
      action: 'Add',
      shareId,
      hasEncryptedShare: true
    });
    
    // 重要: encryptedShareに値を渡し、shareIdも配列でラップする
    const result = await actor.manageGuardian(
      principalObj,
      { Add: null },
      [dummyEncryptedShare],  // Some(Blob)として値を渡す
      [shareId]              // Some(Text)としてシェアIDを渡す
    );
    
    console.log('manageGuardian結果:', result);
    
    if (result.err) {
      return { success: false, error: result.err };
    }
    
    return { success: true };
  } catch (error) {
    console.error('Failed to add guardian:', error);
    return { success: false, error: error.message || 'ガーディアンの追加に失敗しました' };
  }
};

/**
 * ガーディアンを削除
 * @param {string} guardianPrincipal - ガーディアンのプリンシパルID
 * @returns {boolean} 成功した場合はtrue
 */
export const removeGuardian = async (guardianPrincipal) => {
  try {
    const actor = await getActor();
    
    const result = await actor.manageGuardian(
      guardianPrincipal,
      { Remove: null },
      [],
      []
    );
    
    if (result.err) {
      throw new Error(result.err);
    }
    
    return true;
  } catch (error) {
    console.error('Failed to remove guardian:', error);
    throw error;
  }
};

//------------------------------------------------
// Recovery API
//------------------------------------------------

/**
 * リカバリーセットアップを実行
 * @param {number} totalGuardians - 総ガーディアン数
 * @param {number} requiredShares - リカバリーに必要なシェア数
 * @param {string} masterKey - マスター暗号化キー
 * @returns {Object} セットアップ情報
 */
export const setupRecovery = async (totalGuardians, requiredShares, masterKey) => {
  try {
    const actor = await getActor();
    
    // シェアとリカバリーデータの生成
    const recoveryData = generateRecoveryData(masterKey, totalGuardians, requiredShares);
    
    // 公開リカバリーデータをキャニスターに保存
    const result = await actor.setPublicRecoveryData(recoveryData.publicRecoveryData);
    
    if (result.err) {
      throw new Error(result.err);
    }
    
    return {
      shares: recoveryData.shares,
      totalGuardians,
      requiredShares
    };
  } catch (error) {
    console.error('Failed to setup recovery:', error);
    throw error;
  }
};

const toPrincipal = (principalStr) => {
  try {
    return Principal.fromText(principalStr);
  } catch (error) {
    console.error('Invalid principal format:', error);
    throw new Error(`Invalid principal format: ${principalStr}`);
  }
};


/**
 * リカバリーを開始
 * @param {string} userPrincipal - ユーザーのプリンシパルID
 * @returns {boolean} 成功した場合はtrue
 */
export const initiateRecovery = async (userPrincipal) => {
  try {
    const actor = await getActor();
    const principal = toPrincipal(userPrincipal);
    
    const result = await actor.initiateRecovery(principal);
    
    if (result.err) {
      throw new Error(result.err);
    }
    
    return true;
  } catch (error) {
    console.error('Failed to initiate recovery:', error);
    throw error;
  }
};

/**
 * リカバリーを承認（ガーディアンとして）
 * @param {string} userPrincipal - 回復対象のユーザーのプリンシパルID
 * @returns {boolean} 成功した場合はtrue
 */
export const approveRecovery = async (userPrincipal) => {
  try {
    const actor = await getActor();
    const principal = toPrincipal(userPrincipal);
    
    const result = await actor.approveRecovery(principal);
    
    if (result.err) {
      throw new Error(result.err);
    }
    
    return true;
  } catch (error) {
    console.error('Failed to approve recovery:', error);
    throw error;
  }
};

/**
 * リカバリーシェアを提出
 * @param {string} userPrincipal - 回復対象のユーザーのプリンシパルID
 * @param {string} shareId - シェアID
 * @returns {boolean} 成功した場合はtrue
 */
export const submitRecoveryShare = async (userPrincipal, shareId) => {
  try {
    const actor = await getActor();
    const principal = toPrincipal(userPrincipal);
    
    const result = await actor.submitRecoveryShare(principal, shareId);
    return result; // { ok: null } または { err: string }
  } catch (error) {
    console.error('Failed to submit recovery share:', error);
    return { err: error.message };
  }
};

/**
 * リカバリー状態を取得
 * @param {string} userPrincipal - ユーザーのプリンシパルID
 * @returns {Object} リカバリーステータス情報
 */
export const getRecoveryStatus = async (userPrincipal) => {
  try {
    const actor = await getActor();
    const principal = toPrincipal(userPrincipal);
    
    const result = await actor.getRecoveryStatus(principal);
    
    if (result.err) {
      throw new Error(result.err);
    }
    
    const [session, profile] = result.ok;
    
    return {
      session: {
        userPrincipal: session.userPrincipal.toString(),
        requestTime: new Date(Number(session.requestTime) / 1000000),
        approvedGuardians: session.approvedGuardians.map(p => p.toString()),
        tempAccessPrincipal: session.tempAccessPrincipal ? session.tempAccessPrincipal[0].toString() : null,
        status: Object.keys(session.status)[0],
        collectedShares: session.collectedShares
      },
      profile: {
        principal: profile.principal.toString(),
        totalGuardians: profile.totalGuardians,
        requiredShares: profile.requiredShares,
        recoveryEnabled: profile.recoveryEnabled,
        publicRecoveryData: profile.publicRecoveryData ? JSON.parse(blobToString(profile.publicRecoveryData[0])) : null,
        devices: profile.devices.map(device => ({
          id: device.id,
          name: device.name,
          registrationTime: new Date(Number(device.registrationTime) / 1000000),
          lastAccessTime: new Date(Number(device.lastAccessTime) / 1000000)
        }))
      }
    };
  } catch (error) {
    console.error('Failed to get recovery status:', error);
    throw error;
  }
};

//------------------------------------------------
// Device API
//------------------------------------------------

/**
 * デバイス一覧を取得
 * @returns {Array} デバイスの配列
 */
export const getDevices = async () => {
  try {
    const actor = await getActor();
    const result = await actor.getDevices();
    
    if (result.err) {
      throw new Error(result.err);
    }
    
    return result.ok.map(device => ({
      id: device.id,
      name: device.name,
      registrationTime: new Date(Number(device.registrationTime) / 1000000),
      lastAccessTime: new Date(Number(device.lastAccessTime) / 1000000)
    }));
  } catch (error) {
    console.error('Failed to get devices:', error);
    throw error;
  }
};

/**
 * 新しいデバイスを追加
 * @param {string} deviceName - デバイス名
 * @returns {string} 新しいデバイスのID
 */
export const addDevice = async (deviceName) => {
  try {
    const actor = await getActor();
    const principal = await getCurrentPrincipal();
    
    if (!principal) {
      throw new Error('User principal not found');
    }
    
    // Get the user-specific master key
    const principalStr = principal.toString();
    const masterKey = getUserMasterKey(principalStr);
    
    if (!masterKey) {
      throw new Error('Master encryption key not found');
    }
    
    // Generate a new key pair for the device
    const deviceKeyPair = await generateKeyPair();
    
    // Use dummy data for now - in a real implementation we'd encrypt the master key
    // with the new device's public key
    const encryptedMasterKey = stringToBlob(JSON.stringify({dummy: true}));

    const result = await actor.addDevice(
      deviceName, 
      deviceKeyPair.publicKey,
      encryptedMasterKey
    );
    
    if (result.err) {
      throw new Error(result.err);
    }
    
    // Generate setup information for QR code
    const deviceSetupInfo = {
      deviceId: result.ok,
      privateKey: deviceKeyPair.privateKey,
      userPrincipal: principalStr, // Include user principal for proper key storage
      expiresAt: Date.now() + 1000 * 60 * 10 // 10 minutes validity
    };
    
    // Generate setup token (for QR code)
    const setupToken = btoa(JSON.stringify(deviceSetupInfo));
    
    return {
      deviceId: result.ok,
      setupToken
    };
  } catch (error) {
    console.error('Failed to add device:', error);
    throw error;
  }
};

/**
 * デバイスを削除
 * @param {string} deviceId - デバイスID
 * @returns {boolean} 成功した場合はtrue
 */
export const removeDevice = async (deviceId) => {
  try {
    const actor = await getActor();
    const result = await actor.removeDevice(deviceId);
    
    if (result.err) {
      throw new Error(result.err);
    }
    
    return true;
  } catch (error) {
    console.error('Failed to remove device:', error);
    throw error;
  }
};



export const setupNewDevice = async (setupToken) => {
  try {
    const setupData = JSON.parse(atob(setupToken));
    
    // 有効期限チェック
    if (Date.now() > setupData.expiresAt) {
      throw new Error('セットアップトークンの有効期限が切れています');
    }
    
    // デバイス秘密鍵を保存
    localStorage.setItem('devicePrivateKey', setupData.privateKey);
    
    // マスターキーを取得 - FIX: Use actor's getAccessKey method instead of importing it
    const actor = await getActor();
    const accessKeyResult = await actor.getAccessKey();
    
    if (accessKeyResult.err) {
      throw new Error(accessKeyResult.err);
    }
    
    // 秘密鍵でマスターキーを復号
    const encryptedMasterKey = accessKeyResult.ok;
    const masterKey = await decryptWithPrivateKey(
      encryptedMasterKey,
      setupData.privateKey
    );
    
    // マスターキーを保存
    localStorage.setItem('masterEncryptionKey', masterKey);
    
    return true;
  } catch (error) {
    console.error('デバイスセットアップエラー:', error);
    throw error;
  }
};

/**
 * リカバリー後のアカウントを有効化
 * @param {string} userPrincipal - ユーザーのプリンシパルID
 * @param {string} deviceName - 新しいデバイス名
 * @param {Array<number>} publicKey - 新しいデバイスの公開鍵
 * @returns {Promise<Object>} 結果（デバイスIDまたはエラー）
 */
export const activateRecoveredAccount = async (userPrincipal, deviceName, publicKey) => {
  try {
    const actor = await getActor();
    const result = await actor.activateRecoveredAccount(userPrincipal, deviceName, publicKey);
    return result; // { ok: deviceId } or { err: string }
  } catch (error) {
    console.error('アカウントリカバリーに失敗:', error);
    return { err: error.message };
  }
};

/**
 * リカバリーデータを収集する
 * @param {string} userPrincipal - 回復対象のユーザーのプリンシパルID
 * @returns {Promise<Object>} 収集したリカバリーデータ
 */
export const collectRecoveryData = async (userPrincipal) => {
  try {
    const actor = await getActor();
    
    // バックエンドのcollectRecoveryData関数を呼び出し
    const result = await actor.collectRecoveryData(userPrincipal);
    
    if (result.err) {
      throw new Error(result.err);
    }
    
    // IDLファイルから確認すると、結果はタプルで返ってくる
    // [RecoverySession, Vec<KeyShare>, Opt<Vec<Nat8>>]
    const [session, keyShares, optEncryptedMasterKey] = result.ok;
    
    // マスターキーの再構築はクライアント側で行う必要がある
    // キーシェアがあれば再構築を試みる
    let masterKey = null;
    
    if (keyShares && keyShares.length > 0) {
      // シェアを抽出
      const shares = keyShares.map(share => {
        // 秘密鍵で復号化（秘密鍵がない場合はパスする）
        try {
          const devicePrivateKey = localStorage.getItem('recoveryDevicePrivateKey');
          if (devicePrivateKey) {
            return {
              id: share.shareId,
              value: decryptWithPrivateKey(share.encryptedShare, devicePrivateKey)
            };
          }
        } catch (err) {
          console.error('Failed to decrypt share:', err);
        }
        return null;
      }).filter(Boolean);
      
      if (shares.length >= session.requiredShares) {
        // 十分なシェアが集まった場合、マスターキーを再構築
        masterKey = combineShares(shares);
      }
    }
    
    return {
      session: {
        status: Object.keys(session.status)[0],
        requestTime: new Date(Number(session.requestTime) / 1000000),
        approvedGuardians: session.approvedGuardians.map(p => p.toString()),
        collectedShares: session.collectedShares,
        tempAccessPrincipal: session.tempAccessPrincipal ? session.tempAccessPrincipal[0].toString() : null
      },
      keyShares,
      masterKey
    };
  } catch (error) {
    console.error('Failed to collect recovery data:', error);
    throw error;
  }
};


/**
 * ガーディアン招待トークンを生成
 * @param {string} userPrincipal - ユーザーのプリンシパルID
 * @returns {Promise<Object>} 生成された招待トークンと有効期限
 */
export const generateInvitationToken = async (userPrincipal) => {
  try {

    const token = btoa(JSON.stringify({
      inviterPrincipal: userPrincipal,
      createdAt: Date.now(),
      expiresAt: Date.now() + 3600000, // 1時間有効
      id: `invite-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    }));
    
    return {
      token,
      expiresIn: 3600, // 1時間（秒単位）
      createdAt: Date.now()
    };
  } catch (err) {
    console.error('Failed to generate invitation token:', err);
    throw new Error('招待トークンの生成に失敗しました');
  }
};

/**
 * 招待トークンを検証
 * @param {string} token - 検証するトークン
 * @param {string} principalId - ユーザーのプリンシパルID
 * @returns {Promise<Object>} 検証結果
 */
export const verifyInvitationToken = async (token, principalId) => {
  try {
    console.log('verifyInvitationToken called with:', {
      tokenLength: token ? token.length : 0,
      principalId
    });
    
    if (!token) {
      return {
        valid: false,
        error: '招待トークンが見つかりません'
      };
    }
    
    // Try to sanitize the principal if needed
    let cleanPrincipalId = principalId;
    if (principalId.includes(' ') || principalId.includes('\n') || principalId.includes('\t')) {
      cleanPrincipalId = principalId.trim().replace(/\s+/g, '');
      console.log(`Sanitized principal for verification: "${cleanPrincipalId}"`);
    }
    
    // トークンのデコード
    try {
      const decoded = JSON.parse(atob(token));
      console.log('Decoded token:', decoded);
      
      // 有効期限の確認
      if (decoded.expiresAt < Date.now()) {
        console.log('Token expired:', {
          expiresAt: new Date(decoded.expiresAt).toISOString(),
          now: new Date().toISOString()
        });
        return {
          valid: false,
          error: '招待トークンの有効期限が切れています'
        };
      }
      
      // プリンシパルIDの確認 - Be more lenient in comparison
      if (decoded.inviterPrincipal !== cleanPrincipalId) {
        console.log('Principal mismatch:', {
          tokenPrincipal: decoded.inviterPrincipal,
          requestPrincipal: cleanPrincipalId
        });
        
        // Try case-insensitive comparison as fallback
        if (decoded.inviterPrincipal.toLowerCase() !== cleanPrincipalId.toLowerCase()) {
          return {
            valid: false,
            error: '招待トークンが無効です（プリンシパルIDが一致しません）'
          };
        } else {
          console.log('Principal matched case-insensitively');
        }
      }
      
      // 有効な場合、トークン情報を返す
      return {
        valid: true,
        inviterPrincipal: decoded.inviterPrincipal,
        createdAt: decoded.createdAt,
        expiresAt: decoded.expiresAt,
        id: decoded.id,
        inviterName: decoded.inviterName || null
      };
    } catch (decodeErr) {
      console.error('Token decode error:', decodeErr);
      return {
        valid: false,
        error: '招待トークンの形式が無効です'
      };
    }
  } catch (err) {
    console.error('Failed to verify invitation token:', err);
    console.error('Error stack:', err.stack);
    return {
      valid: false,
      error: '招待トークンの検証に失敗しました'
    };
  }
};

/**
 * ガーディアン招待を受け入れる
 * @param {string} token - 招待トークン
 * @param {string} inviterPrincipal - 招待者のプリンシパルID
 * @returns {Promise<Object>} 処理結果
 */
export const acceptGuardianInvitation = async (token, inviterPrincipal) => {
  try {
    console.log('API: acceptGuardianInvitation called with:', {
      tokenLength: token ? token.length : 0,
      inviterPrincipal
    });
    
    // トークン検証（既存コード）
    const verification = await verifyInvitationToken(token, inviterPrincipal);
    console.log('Token verification result:', verification);
    
    if (!verification.valid) {
      console.error('Token verification failed:', verification.error);
      return { success: false, error: verification.error };
    }
    
    // キャニスター呼び出しを追加 - manageGuardian API を呼び出す
    const actor = await getActor();
    console.log('Got actor, calling manageGuardian');
    
    // Convert string principal to Principal object
    let principalObj;
    try {
      // Log the exact principal string before conversion
      console.log(`Converting principal string: "${inviterPrincipal}"`);
      
      // Try to determine if we need to sanitize the principal
      if (inviterPrincipal.includes(' ') || inviterPrincipal.includes('\n') || inviterPrincipal.includes('\t')) {
        const cleaned = inviterPrincipal.trim().replace(/\s+/g, '');
        console.log(`Sanitized principal: "${cleaned}"`);
        principalObj = Principal.fromText(cleaned);
      } else {
        principalObj = Principal.fromText(inviterPrincipal);
      }
      
      console.log('Principal successfully converted to object');
    } catch (principalError) {
      console.error('Invalid principal format:', principalError);
      console.error('Error stack:', principalError.stack);
      return { 
        success: false, 
        error: `プリンシパルIDの形式が無効です: ${inviterPrincipal}`,
        details: principalError.message
      };
    }
    
    // Get current principal for metadata
    const currentPrincipal = await getCurrentPrincipal();
    const currentPrincipalText = currentPrincipal ? currentPrincipal.toString() : '';
    console.log('Current principal:', currentPrincipalText);
    
    // Prepare metadata
    const metadata = JSON.stringify({
      acceptedAt: Date.now(),
      acceptedBy: currentPrincipalText
    });
    
    console.log('Calling manageGuardian with:', {
      principalObj: principalObj.toString(),
      action: 'Add',
      metadata: metadata
    });
    
    // キャニスターにガーディアン登録する
    const result = await actor.manageGuardian(
      principalObj,        // Principal object, not string
      { Add: null },       // Add アクション
      [],                // 暗号化データ (不要)
      [metadata]             // メタデータとして連絡先情報を保存
    );
    
    console.log('manageGuardian result:', result);
    
    if (result.err) {
      console.error('manageGuardian error:', result.err);
      return { success: false, error: result.err };
    }
    
    return { success: true };
  } catch (err) {
    console.error('Failed to accept guardian invitation:', err);
    console.error('Error stack:', err.stack);
    return { 
      success: false, 
      error: err.message,
      stack: err.stack 
    };
  }
};


/**
 * 保留中のリカバリーリクエストを取得
 * @returns {Promise<Array>} リカバリーリクエストの配列
 */
export const getPendingRecoveryRequests = async () => {
  try {
    const actor = await getActor();
    
    // Use the getMyGuardians function to get guardians and filter those pending approvals
    // This function is in your interface and should be available
    const guardians = await actor.getMyGuardians();
    
    // Since we can't directly get pending recovery sessions from the backend,
    // we'll use a workaround to check which users have pending recovery requests
    const pendingRequests = [];
    
    for (const [guardianPrincipal, approved] of guardians) {
      if (!approved) {
        try {
          // For each unapproved guardian relationship, try to get recovery status
          const statusResult = await actor.getRecoveryStatus(guardianPrincipal.toString());
          
          if (!statusResult.err && statusResult.ok) {
            const [session, profile] = statusResult.ok;
            
            // Check if there's an active recovery session that needs approval
            if (session.status.Requested || session.status.InProgress) {
              pendingRequests.push({
                id: `request-${guardianPrincipal.toString()}`,
                principal: guardianPrincipal.toString(),
                userName: '', // No direct way to get this
                requestTime: Number(session.requestTime),
                deviceLost: true, // Assume true as default
                requestedBy: guardianPrincipal.toString(), // No way to know who requested
                reason: ''
              });
            }
          }
        } catch (err) {
          console.warn(`Could not get recovery status for ${guardianPrincipal}`, err);
        }
      }
    }
    
    return pendingRequests;
  } catch (error) {
    console.error('Failed to get recovery requests:', error);
    
    // Return empty array instead of throwing to prevent UI errors
    return [];
  }
}

/**
 * リカバリーの最終処理を実行
 * @param {string} userPrincipal - ユーザーのプリンシパルID
 * @param {string} tempAccessPrincipal - 一時アクセスプリンシパル
 * @param {Uint8Array} publicKey - 新しいデバイスの公開鍵
 * @returns {Promise<Object>} 処理結果
 */
export const finalizeRecovery = async (userPrincipal, tempAccessPrincipal, publicKey) => {
  try {
    const actor = await getActor();
    const result = await actor.finalizeRecovery(userPrincipal, tempAccessPrincipal, publicKey);
    return result; // { ok: null } または { err: string }
  } catch (error) {
    console.error('最終リカバリーに失敗:', error);
    return { err: error.message };
  }
};

export const setupDeviceLink = async () => {
  try {
    const principal = await getCurrentPrincipal();
    
    if (!principal) {
      throw new Error('User principal not found');
    }
    
    const principalStr = principal.toString();
    const masterKey = getUserMasterKey(principalStr);
    
    if (!masterKey) {
      throw new Error('マスターキーが見つかりません');
    }
    
    const actor = await getActor();
    
    // Generate new device key pair
    const deviceKeyPair = await generateKeyPair();
    
    // Use dummy data for encrypted master key
    const encryptedMasterKey = stringToBlob(JSON.stringify({dummy: true}));
    
    const result = await actor.addDevice(
      "新しいデバイス (QR連携)", 
      deviceKeyPair.publicKey,
      encryptedMasterKey
    );
    
    if (result.err) {
      throw new Error(result.err || "デバイス追加に失敗しました");
    }
    
    // Include user principal in the link data
    const linkData = {
      deviceId: result.ok,
      masterKey: masterKey,
      userPrincipal: principalStr,
      expiresAt: Date.now() + 10 * 60 * 1000 // 10 minutes validity
    };
    
    // Convert to Base64
    const linkToken = btoa(JSON.stringify(linkData));
    
    return { 
      token: linkToken,
      deviceId: result.ok
    };
  } catch (error) {
    console.error("デバイス連携準備エラー:", error);
    throw error;
  }
};


// 新デバイス側のprocessDeviceLinkResult関数 - シンプル版
export const processDeviceLinkResult = async (scanResult) => {
  try {
    const linkData = JSON.parse(atob(scanResult));
    
    if (Date.now() > linkData.expiresAt) {
      throw new Error("QRコードの有効期限が切れています");
    }
    
    // Save device ID
    localStorage.setItem('deviceId', linkData.deviceId);
    
    // Ensure we have the user principal
    if (!linkData.userPrincipal) {
      throw new Error("ユーザー情報が不足しています");
    }
    
    // Save the master key using the new user-specific approach
    saveUserMasterKey(linkData.userPrincipal, linkData.masterKey);
    
    // For backward compatibility, also save to localStorage
    localStorage.setItem('masterEncryptionKey', linkData.masterKey);
    
    // Save to IndexedDB for persistence
    try {
      const db = await openIndexedDB();
      await saveKeyToIndexedDB(db, 'masterEncryptionKey', linkData.masterKey);
      // Also save the principal for future use
      await saveKeyToIndexedDB(db, 'userPrincipal', linkData.userPrincipal);
    } catch (dbError) {
      console.warn('IndexedDBへの保存に失敗しましたが、暗号化キーは保存されています:', dbError);
    }
    
    console.log("デバイス連携が完了しました");
    return true;
  } catch (error) {
    console.error("QRコード処理エラー:", error);
    throw error;
  }
};

// IndexedDBを開く補助関数
const openIndexedDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('AppStorage', 1);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('keyStore')) {
        db.createObjectStore('keyStore', { keyPath: 'id' });
      }
    };
    
    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(event.target.error);
  });
};

// IndexedDBにキーを保存する補助関数
const saveKeyToIndexedDB = (db, keyName, value) => {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['keyStore'], 'readwrite');
    const store = transaction.objectStore('keyStore');
    
    const request = store.put({
      id: keyName,
      value: value,
      updated: new Date().toISOString()
    });
    
    request.onsuccess = () => resolve();
    request.onerror = (event) => reject(event.target.error);
  });
};

// 新機能: 相続プロセス開始のAPI
export const requestInheritanceTransfer = async (accountId, reason) => {
  try {
    const actor = await getActor();
    // バックエンド関数を呼び出し
    const result = await actor.initiateRecovery(accountId);
    
    if (result.err) {
      throw new Error(result.err);
    }
    
    // ローカルに理由を記録（オプション）
    localStorage.setItem(`inheritance_reason_${accountId}`, reason);
    
    return { success: true };
  } catch (error) {
    console.error('相続リクエスト失敗:', error);
    return { success: false, error: error.message };
  }
};

/**
 * ガーディアン情報を更新
 * @param {string} guardianPrincipal - ガーディアンのプリンシパルID
 * @param {Object} info - 更新するガーディアン情報
 * @returns {Promise<Object>} 更新結果
 */
export const updateGuardianInfo = async (guardianPrincipal, info) => {
  try {
    const actor = await getActor();
    
    // 連絡先情報をJSON形式で保存
    const contactInfo = JSON.stringify({
      email: info.email || '',
      phone: info.phone || '',
      relationship: info.relationship || '',
      isEmergency: info.isEmergency || false,
      notes: info.notes || ''
    });
    
    // キャニスター側の関数を呼び出し
    const result = await actor.manageGuardian(
      guardianPrincipal,
      { Replace: null },  // 更新アクション
      [],               // 暗号化シェアデータ (不要)
      [contactInfo]         // 連絡先情報
    );
    
    if (result.err) {
      throw new Error(result.err);
    }
    
    return { success: true };
  } catch (error) {
    console.error('Failed to update guardian info:', error);
    return { success: false, error: error.message };
  }
};

/**
 * ガーディアン情報を取得
 * @param {string} guardianPrincipal - ガーディアンのプリンシパルID
 * @returns {Promise<Object>} ガーディアン情報
 */
export const getGuardianInfo = async (guardianPrincipal) => {
  try {
    const actor = await getActor();
    
    // ガーディアンリストから該当するガーディアンを検索
    const guardians = await getGuardians();
    const guardian = guardians.find(g => g.principal === guardianPrincipal);
    
    if (!guardian) {
      return { success: false, error: 'ガーディアン情報が見つかりません' };
    }
    
    // 保存された連絡先情報を取得
    const myKeyShare = await actor.getMyKeyShare(guardianPrincipal);
    
    // 連絡先情報をパース
    let contactInfo = {};
    if (myKeyShare.ok && myKeyShare.ok.metadata) {
      try {
        contactInfo = JSON.parse(myKeyShare.ok.metadata);
      } catch (e) {
        console.warn('Failed to parse contact info:', e);
      }
    }
    
    return {
      success: true,
      data: {
        principal: guardianPrincipal,
        name: contactInfo.name || '',
        email: contactInfo.email || '',
        phone: contactInfo.phone || '',
        relationship: contactInfo.relationship || '',
        isEmergency: contactInfo.isEmergency || false,
        notes: contactInfo.notes || '',
        approved: guardian.approved || false
      }
    };
  } catch (error) {
    console.error('Failed to get guardian info:', error);
    return { success: false, error: error.message };
  }
};

/**
 * 相続状態の確認
 * @param {string} accountId - ユーザーのプリンシパルID
 * @returns {Promise<Object>} 相続状態情報
 */
export const getInheritanceStatus = async (accountId) => {
  try {
    const actor = await getActor();
    
    try {
      // まずプロファイルの取得を試みる
      const profileResult = await actor.getProfile();
      if (!profileResult.err) {
        // プロファイルが存在する場合
        return {
          success: true,
          data: {
            exists: true,
            configured: false, // デフォルト値
            transferred: false,
            currentApprovals: 0,
            requiredApprovals: 0
          }
        };
      }
    } catch (profileErr) {
      console.warn("getProfile failed, falling back to manual check", profileErr);
    }
    
    // プロファイルが存在するか確認するシンプルな方法
    try {
      // getNotes がエラーを返さなければプロファイルは存在する
      const notes = await actor.getNotes();
      return {
        success: true,
        data: {
          exists: true,
          configured: false,
          transferred: false,
          currentApprovals: 0,
          requiredApprovals: 0
        }
      };
    } catch (err) {
      if (err.message && err.message.includes("プロファイルが見つかりません")) {
        return {
          success: true,
          data: {
            exists: false,
            configured: false,
            transferred: false,
            currentApprovals: 0,
            requiredApprovals: 0
          }
        };
      }
      throw err;
    }
  } catch (error) {
    console.error('Failed to get inheritance status:', error);
    return { 
      success: false, 
      error: error.message,
      data: {
        exists: false
      }
    };
  }
};