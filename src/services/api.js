//src/services/api.js

import { getActor } from './auth';
import { 
  stringToBlob, 
  blobToString, 
  encryptWithKey, 
  decryptWithKey, 
  encryptWithPublicKey, 
  decryptWithPrivateKey,
  createShares,
  combineShares
} from './crypto';

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
export const getNotes = async (forceRefresh = false) => {
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
    // 新しいリクエストのPromiseを生成して保存
    pendingRequests.getNotes = (async () => {
      const actor = await getActor();
      const result = await actor.getNotes();
      
      // デバイスの秘密鍵を取得
      const devicePrivateKey = localStorage.getItem('devicePrivateKey');
      
      // デバッグ情報を追加
      console.log('デバイス秘密鍵:', {
        exists: !!devicePrivateKey,
        length: devicePrivateKey?.length,
        preview: devicePrivateKey ? `${devicePrivateKey.substring(0, 10)}...` : 'なし'
      });
      
      if (!devicePrivateKey) {
        throw new Error('Device private key not found');
      }
      
      // ノートを秘密鍵で復号
      return result.map(note => {
        try {
          console.log(`ノート ${note.id} の復号を試行:`, {
            titleLength: note.title?.length,
            contentLength: note.content?.length
          });
          
          const title = decryptWithPrivateKey(note.title, devicePrivateKey);
          const content = decryptWithPrivateKey(note.content, devicePrivateKey);
          // api.jsのgetNotes関数内
          console.log('Canisterから返されたノート:', {
            noteCount: result.length,
            sampleTitle: result[0]?.title ? {
              type: typeof result[0].title,
              constructor: result[0].title.constructor.name,
              isArray: Array.isArray(result[0].title),
              isUint8Array: result[0].title instanceof Uint8Array,
              isArrayBuffer: result[0].title instanceof ArrayBuffer,
              byteLength: result[0].title.byteLength
            } : 'なし'
          });
          return {
            id: note.id,
            title,
            content,
            created: new Date(Number(note.created) / 1000000),
            updated: new Date(Number(note.updated) / 1000000)
          };
        } catch (error) {
          console.error(`Failed to decrypt note ${note.id}:`, error);
          return {
            id: note.id,
            title: 'Unable to decrypt',
            content: 'Unable to decrypt this note',
            created: new Date(Number(note.created) / 1000000),
            updated: new Date(Number(note.updated) / 1000000)
          };
        }
      });
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
export const createNote = async (title, content) => {
  try {
    const actor = await getActor();
    
    // デバイスの秘密鍵を取得
    const devicePrivateKey = localStorage.getItem('devicePrivateKey');
    if (!devicePrivateKey) {
      throw new Error('Device private key not found');
    }
    
    // ユーザープロファイルからデバイスの公開鍵を取得
    const profileResult = await actor.getProfile();
    if (profileResult.err) {
      throw new Error(profileResult.err);
    }
    
    const profile = profileResult.ok;
    const deviceInfo = profile.devices[0]; // 最初のデバイスを使用
    
    // ノートをデバイスの公開鍵で暗号化
    const encryptedTitle = encryptWithPublicKey(title, deviceInfo.publicKey);
    const encryptedContent = encryptWithPublicKey(content, deviceInfo.publicKey);
    
    // ノート用のユニークIDを生成
    const noteId = `note-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    
    // 暗号化されたノートを保存
    const result = await actor.saveNote(noteId, encryptedTitle, encryptedContent);
    
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
export const updateNote = async (id, title, content) => {
  try {
    const actor = await getActor();
    
    // デバイスの秘密鍵を取得
    const devicePrivateKey = localStorage.getItem('devicePrivateKey');
    if (!devicePrivateKey) {
      throw new Error('Device private key not found');
    }
    
    // ユーザープロファイルからデバイスの公開鍵を取得
    const profileResult = await actor.getProfile();
    if (profileResult.err) {
      throw new Error(profileResult.err);
    }
    
    const profile = profileResult.ok;
    const deviceInfo = profile.devices[0]; // 最初のデバイスを使用
    
    // ノートをデバイスの公開鍵で暗号化
    const encryptedTitle = encryptWithPublicKey(title, deviceInfo.publicKey);
    const encryptedContent = encryptWithPublicKey(content, deviceInfo.publicKey);
    
    // 暗号化されたノートを更新
    const result = await actor.updateNote(id, encryptedTitle, encryptedContent);
    
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
export const addGuardian = async (guardianPrincipal, guardianPublicKey, share) => {
  try {
    const actor = await getActor();
    
    // ガーディアンの公開鍵をローカルに保存
    saveGuardianPublicKey(guardianPrincipal, guardianPublicKey);
    
    // シェアをガーディアンの公開鍵で暗号化
    const encryptedShare = await encryptWithPublicKey(
      {
        share: share.value,
        encryptedAt: new Date().toISOString()
      },
      stringToBlob(guardianPublicKey)
    );
    
    // ガーディアンを追加
    const result = await actor.manageGuardian(
      guardianPrincipal,
      { Add: null },
      encryptedShare,
      share.id
    );
    
    if (result.err) {
      throw new Error(result.err);
    }
    
    return true;
  } catch (error) {
    console.error('Failed to add guardian:', error);
    throw error;
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
    
    if (result.err) {
      throw new Error(result.err);
    }
    
    return true;
  } catch (error) {
    console.error('Failed to submit recovery share:', error);
    throw error;
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
    const deviceKeyPair = {
      privateKey: localStorage.getItem('devicePrivateKey'),
      publicKey: stringToBlob('dummyPublicKey') // 実際のアプリでは適切な公開鍵を使用
    };
    
    // 新しいデバイス用にマスターキーを暗号化
    const masterKey = localStorage.getItem('masterEncryptionKey');
    const encryptedDeviceData = encryptWithPublicKey(masterKey, deviceKeyPair.publicKey);
    
    const result = await actor.addDevice(deviceName, deviceKeyPair.publicKey, encryptedDeviceData);
    
    if (result.err) {
      throw new Error(result.err);
    }
    
    return result.ok;
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