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
  getUserMasterKey
 } from './improved-crypto';

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
    const result = await actor.saveNote(noteId, titleBlob, contentBlob);
    
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
export const addGuardian = async (guardianPrincipal, share) => {
  try {
    const actor = await getActor();
    
    // シェア情報をそのまま保存
    console.log(`Adding guardian ${guardianPrincipal} with share ID: ${share.id}`);
    
    // manageGuardian関数を呼び出し（暗号化なし）
    const result = await actor.manageGuardian(
      guardianPrincipal,
      { Add: null },
      null, // 暗号化データはnull
      share.id  // シェアIDを引き渡す
    );
    
    if (result.err) {
      throw new Error(result.err);
    }
    
    return { success: true };
  } catch (error) {
    console.error('Failed to add guardian:', error);
    return { success: false, error: error.message };
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
      null,
      null
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

/**
 * リカバリーを開始
 * @param {string} userPrincipal - ユーザーのプリンシパルID
 * @returns {boolean} 成功した場合はtrue
 */
export const initiateRecovery = async (userPrincipal) => {
  try {
    const actor = await getActor();
    const result = await actor.initiateRecovery(userPrincipal);
    
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
    const result = await actor.approveRecovery(userPrincipal);
    
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
    const result = await actor.submitRecoveryShare(userPrincipal, shareId);
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
    const result = await actor.getRecoveryStatus(userPrincipal);
    
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
    
    // デバイス用の新しいキーペアを生成
    const deviceKeyPair = await generateKeyPair(); // 非同期関数に注意
    
    // マスターキーを取得
    const masterKey = localStorage.getItem('masterEncryptionKey');
    if (!masterKey) {
      throw new Error('Master encryption key not found');
    }
    
    // マスターキーを新デバイスの公開鍵で暗号化
    // マスターキーをダミーデータで暗号化するか、空のバイト配列を渡す
    const encryptedMasterKey = stringToBlob(JSON.stringify({dummy: true}));

    const result = await actor.addDevice(
      deviceName, 
      deviceKeyPair.publicKey,
      encryptedMasterKey // ダミーデータを渡す
    );
    
    if (result.err) {
      throw new Error(result.err);
    }
    
    // QRコードなどで新デバイスに秘密鍵を提供する情報を生成
    const deviceSetupInfo = {
      deviceId: result.ok,
      privateKey: deviceKeyPair.privateKey,
      expiresAt: Date.now() + 1000 * 60 * 10 // 10分有効
    };
    
    // セットアップトークンを生成（QRコードに使用）
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
    return result; // { ok: deviceId } または { err: string }
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
    // この実装はモックバージョンです。実際のアプリでは、バックエンドでトークンを生成します。
    // ここでは、フロントエンドでのトークン生成をシミュレートします。
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
    // トークンのデコード
    const decoded = JSON.parse(atob(token));
    
    // 有効期限の確認
    if (decoded.expiresAt < Date.now()) {
      return {
        valid: false,
        error: '招待トークンの有効期限が切れています'
      };
    }
    
    // プリンシパルIDの確認
    if (decoded.inviterPrincipal !== principalId) {
      return {
        valid: false,
        error: '招待トークンが無効です（プリンシパルIDが一致しません）'
      };
    }
    
    // 有効な場合、トークン情報を返す
    return {
      valid: true,
      inviterPrincipal: decoded.inviterPrincipal,
      createdAt: decoded.createdAt,
      expiresAt: decoded.expiresAt,
      id: decoded.id
    };
  } catch (err) {
    console.error('Failed to verify invitation token:', err);
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
    // トークンの検証
    const verification = await verifyInvitationToken(token, inviterPrincipal);
    if (!verification.valid) {
      throw new Error(verification.error);
    }
    
    // ここでバックエンドAPIを呼び出して、ガーディアンとして登録する処理を行います
    // このモック実装では、成功を返します
    
    return {
      success: true
    };
  } catch (err) {
    console.error('Failed to accept guardian invitation:', err);
    return {
      success: false,
      error: err.message || '招待の受け入れに失敗しました'
    };
  }
};

/**
 * 保留中のリカバリーリクエストを取得
 * @returns {Promise<Array>} リカバリーリクエストの配列
 */
export const getPendingRecoveryRequests = async () => {
  try {
    // この実装はモックバージョンです。実際のアプリでは、バックエンドからデータを取得します。
    // ガーディアンとしての保留中のリクエストを取得する
    
    // モックデータの作成 (開発用)
    const mockRequests = [
      {
        id: `request-${Date.now()}-1`,
        principal: 'w3gef-eqllq-abcde-12345-xyz',
        userName: 'ユーザー1',
        requestTime: Date.now() - 3600000, // 1時間前
        deviceLost: true,
        shareId: 'share-123'
      },
      {
        id: `request-${Date.now()}-2`,
        principal: 'a2b3c-dq4rs-vw7yz-98765-abc',
        userName: 'ユーザー2',
        requestTime: Date.now() - 7200000, // 2時間前
        deviceLost: false,
        shareId: 'share-456'
      }
    ];
    
    return mockRequests;
  } catch (err) {
    console.error('Failed to get pending recovery requests:', err);
    throw new Error('リカバリーリクエストの取得に失敗しました');
  }
};

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

export const setupDeviceLink = async (masterKey) => {
  try {
    // マスターキーを確認
    if (!masterKey) {
      const userPrincipal = await getCurrentPrincipal();
      masterKey = getUserMasterKey(userPrincipal.toString());
      if (!masterKey) {
        throw new Error('マスターキーが見つかりません');
      }
    }
    
    const actor = await getActor();
    
    // デバイス用の新しいキーペアを生成
    const deviceKeyPair = await generateKeyPair();
    
    // この部分が重要：マスターキーを何らかの形でバックエンドに渡す
    // 方法1: ダミーデータを渡す場合
    const encryptedMasterKey = stringToBlob(JSON.stringify({dummy: true}));
    
    const result = await actor.addDevice(
      "新しいデバイス (QR連携)", 
      deviceKeyPair.publicKey,
      encryptedMasterKey
    );
    
    if (result.err) {
      throw new Error(result.err || "デバイス追加に失敗しました");
    }
    
    // 連携データにマスターキーを直接含める
    const linkData = {
      deviceId: result.ok,
      masterKey: masterKey, // マスターキーを直接送信
      userPrincipal: await getCurrentPrincipal(),
      expiresAt: Date.now() + 10 * 60 * 1000 // 10分間有効
    };
    
    // JSON化してBase64エンコード
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
    
    // デバイスIDを保存
    localStorage.setItem('deviceId', linkData.deviceId);
    
    // マスターキーをLocalStorageに保存
    localStorage.setItem('masterEncryptionKey', linkData.masterKey);
    
    // さらにIndexedDBにも保存（永続性のため）
    try {
      const db = await openIndexedDB();
      await saveKeyToIndexedDB(db, 'masterEncryptionKey', linkData.masterKey);
    } catch (dbError) {
      console.warn('IndexedDBへの保存に失敗しましたが、LocalStorageには保存されています:', dbError);
    }
    
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