//src/services/crypto.js

import CryptoJS from 'crypto-js';
import { v4 as uuidv4 } from 'uuid';
import md5 from 'blueimp-md5';
// improved-crypto.jsからの機能をすべてインポート
import * as improvedCrypto from './improved-crypto';

/**
 * 暗号化用のランダムキーを生成
 * @returns {string} 生成されたキー
 */
export const generateEncryptionKey = () => {
  // Web Crypto APIを使用するimproved-crypto実装に置き換え（ただし同期的APIを維持）
  try {
    // Window環境でのみ実行
    if (typeof window !== 'undefined' && window.crypto) {
      // ランダムキーを生成（256ビット = 32バイト）
      const randomArray = window.crypto.getRandomValues(new Uint8Array(32));
      // 16進数文字列に変換
      return Array.from(randomArray)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    }
  } catch (e) {
    console.warn('Web Crypto API利用できず、CryptoJSにフォールバック:', e);
  }
  
  // フォールバック: CryptoJSを使用
  return CryptoJS.lib.WordArray.random(32).toString();
};

/**
 * データをキーで暗号化
 * @param {any} data - 暗号化するデータ
 * @param {string} key - 暗号化キー
 * @returns {string} 暗号化されたデータ
 */
export const encryptWithKey = (data, key) => {
  // 既存のAPIを維持しながら、非同期APIをサポートするためのラッパー関数
  // CryptoJSでの暗号化の実装は維持（APIの互換性のため）
  const encrypted = CryptoJS.AES.encrypt(JSON.stringify(data), key).toString();
  return encrypted;
};

/**
 * 暗号化されたデータをキーで復号
 * @param {string} encryptedData - 暗号化されたデータ
 * @param {string} key - 復号キー
 * @returns {any} 復号されたデータ
 */
export const decryptWithKey = (encryptedData, key) => {
  try {
    // デバッグログ追加
    console.log('復号化試行:', { 
      encryptedDataLength: encryptedData?.length, 
      keyType: typeof key,
      keyLength: key?.length 
    });
    
    const decrypted = CryptoJS.AES.decrypt(encryptedData, key);
    const decryptedStr = decrypted.toString(CryptoJS.enc.Utf8);
    
    if (!decryptedStr) {
      console.error('復号結果が空です');
      return null;
    }
    
    console.log('復号化結果:', {
      length: decryptedStr.length,
      preview: decryptedStr.substring(0, 30) + '...'
    });
    
    try {
      return JSON.parse(decryptedStr);
    } catch (parseError) {
      console.error('JSON解析エラー:', parseError);
      
      // 厳密なJSON解析に失敗した場合、文字列として返す
      if (decryptedStr) {
        console.log('JSONではなく文字列として処理');
        return decryptedStr;
      }
      return null;
    }
  } catch (error) {
    console.error('復号化失敗:', error);
    console.error('エラー時の詳細:', { 
      encryptedDataSample: encryptedData?.substring(0, 20) + '...',
      keyPreview: key ? (key.substring(0, 5) + '...') : 'undefined'
    });
    return null;
  }
};

/**
 * 文字列をBlobに変換
 * @param {string} str - 変換する文字列
 * @returns {Uint8Array} 変換されたBlob
 */
export const stringToBlob = (str) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  return new Uint8Array(data);
};

/**
 * BlobをStringに変換
 * @param {Uint8Array} blob - 変換するBlob
 * @returns {string} 変換された文字列
 */
export const blobToString = (blob) => {
  // ログ追加
  console.log('blobToString called:', {
    type: typeof blob,
    isArray: Array.isArray(blob),
    isUint8Array: blob instanceof Uint8Array,
    length: blob?.length
  });

  // blobが文字列の場合はそのまま返す（後方互換性のため）
  if (typeof blob === 'string') {
    console.log('blobToString: 入力は既に文字列です');
    return blob;
  }
  
  // Uint8Array以外のオブジェクトの処理
  if (!blob || !(blob instanceof Uint8Array)) {
    console.error('Invalid blob passed to blobToString:', blob);
    
    // オブジェクトの場合はJSON文字列に変換（バグ防止）
    if (blob && typeof blob === 'object') {
      try {
        return JSON.stringify(blob);
      } catch (e) {
        console.error('JSON変換エラー:', e);
      }
    }
    
    return String(blob); // 例外的にString変換
  }
  
  try {
    const decoder = new TextDecoder('utf-8', {fatal: false});
    const result = decoder.decode(blob);
    console.log('blobToString 変換結果:', {length: result.length});
    return result;
  } catch (e) {
    console.error('TextDecoder変換エラー:', e);
    
    // フォールバック: 16進数文字列に変換して返す
    const hexString = Array.from(blob)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    console.log('Uint8ArrayをHEX文字列に変換:', {length: hexString.length});
    return hexString;
  }
};

/**
 * デバイス認証用のキーペアを生成
 * @returns {Object} キーペア（publicKey, privateKey）
 */
export const generateKeyPair = () => {
  // 将来的にimproved-cryptoの非同期実装に置き換えることを検討
  // 現時点では互換性のためCryptoJS実装を維持
  const privateKey = CryptoJS.lib.WordArray.random(32).toString();
  // md5を使用して公開鍵をシミュレート
  const publicKey = stringToBlob(md5(privateKey));
  
  return {
    privateKey,
    publicKey,
  };
};

/**
 * 公開鍵でデータを暗号化
 * @param {any} data - 暗号化するデータ
 * @param {Uint8Array} publicKey - 公開鍵
 * @returns {Uint8Array} 暗号化されたデータ
 */
export const encryptWithPublicKey = (data, publicKey) => {
  // 公開鍵が文字列かBlobか確認
  const publicKeyStr = typeof publicKey === 'string' ? publicKey : blobToString(publicKey);
  
  // 既存実装を維持（将来的にimproved-cryptoの実装への移行を検討）
  const encryptionKey = generateEncryptionKey();
  const encryptedData = encryptWithKey(data, encryptionKey);
  const encryptedKey = CryptoJS.AES.encrypt(encryptionKey, publicKeyStr).toString();
  
  return stringToBlob(JSON.stringify({
    encryptedData,
    encryptedKey
  }));
};

/**
 * 秘密鍵でデータを復号
 * @param {Uint8Array} encryptedBlob - 暗号化されたデータ
 * @param {string} privateKey - 秘密鍵
 * @returns {any} 復号されたデータ
 */

/*
export const decryptWithPrivateKey = (encryptedBlob, privateKey) => {
  try {
    // デバッグ情報
    console.log('復号化開始:', {
      encryptedBlobType: typeof encryptedBlob,
      privateKeyLength: privateKey?.length,
      isUint8Array: encryptedBlob instanceof Uint8Array
    });

    const dataStr = blobToString(encryptedBlob);
    console.log('Blobを文字列に変換:', { 
      dataLength: dataStr?.length, 
      dataPreview: dataStr?.substring(0, 50) 
    });

    // 復号処理の前に厳密なバリデーション
    let encryptedData, encryptedKey;
    try {
      const parsed = JSON.parse(dataStr);
      encryptedData = parsed.encryptedData;
      encryptedKey = parsed.encryptedKey;
      
      if (!encryptedData || !encryptedKey) {
        throw new Error('必要な暗号化データが見つかりません');
      }
    } catch (parseError) {
      console.error('データ解析エラー:', parseError);
      throw new Error(`データ形式が無効です: ${parseError.message}`);
    }
    
    console.log('パース結果:', { 
      hasEncryptedData: !!encryptedData,
      hasEncryptedKey: !!encryptedKey,
      encryptedKeyLength: encryptedKey?.length
    });
    
    // 秘密鍵を使ってキーを復号
    let decryptedKey;
    try {
      decryptedKey = CryptoJS.AES.decrypt(encryptedKey, privateKey).toString(CryptoJS.enc.Utf8);
      if (!decryptedKey) {
        throw new Error('キーの復号に失敗しました');
      }
      console.log('キー復号成功:', { keyLength: decryptedKey.length });
    } catch (keyError) {
      console.error('キー復号エラー:', keyError);
      throw new Error(`キー復号に失敗: ${keyError.message}`);
    }
    
    // 復号したキーでデータを復号
    try {
      const result = decryptWithKey(encryptedData, decryptedKey);
      console.log('データ復号成功:', { resultType: typeof result });
      return result;
    } catch (dataError) {
      console.error('データ復号エラー:', dataError);
      throw new Error(`データ復号に失敗: ${dataError.message}`);
    }
  } catch (error) {
    console.error('復号処理全体のエラー:', error);
    throw error;
  }
};
*/

// ここからimproved-crypto.jsから置き換える関数 -----------------------

/**
 * 16進数文字列をバイト配列に変換
 * @param {string} hex - 16進数文字列
 * @returns {Uint8Array} バイト配列
 */
export const hexToBytes = (hex) => {
  // improved-crypto.jsの実装をそのまま使用
  return improvedCrypto.hexToBytes(hex);
};

/**
 * バイト配列を16進数文字列に変換（improved-crypto.jsから追加）
 * @param {Uint8Array} bytes - バイト配列
 * @returns {string} 16進数文字列
 */
export const bytesToHex = (bytes) => {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};

/**
 * 秘密を複数のシェアに分割
 * @param {string} secret - 分割する秘密情報
 * @param {number} totalShares - 総シェア数
 * @param {number} threshold - 必要なシェア数
 * @returns {Array} シェアの配列
 */
export const createShares = (secret, totalShares, threshold) => {
  try {
    // improved-crypto.jsの実装を使用
    return improvedCrypto.createShares(secret, totalShares, threshold);
  } catch (error) {
    console.error('Failed to create shares:', error);
    return [];
  }
};

/**
 * シェアを結合して秘密を復元
 * @param {Array} shares - シェアの配列
 * @returns {string} 復元された秘密情報
 */
export const combineShares = (shares) => {
  try {
    // improved-crypto.jsの実装を使用
    return improvedCrypto.combineShares(shares);
  } catch (error) {
    console.error('Failed to combine shares:', error);
    return null;
  }
};

/**
 * 安全なストレージに保存（IndexedDBプライマリ、バックアプオプション付き）
 * @param {string} key - 保存するキー名
 * @param {any} data - 保存するデータ
 * @returns {Promise<boolean>} 成功した場合はtrue
 */
export const saveToSecureStorage = async (key, data) => {
  // improved-crypto.jsの実装を使用
  return improvedCrypto.saveToSecureStorage(key, data);
};

/**
 * 安全なストレージからデータを取得
 * @param {string} key - 取得するキー名
 * @returns {Promise<any>} 取得したデータ
 */
export const getFromSecureStorage = async (key) => {
  // improved-crypto.jsの実装を使用
  return improvedCrypto.getFromSecureStorage(key);
};

/**
 * パスワードから暗号化キーを派生（PBKDF2）
 * @param {string} password - ユーザーパスワード
 * @param {Uint8Array} salt - ソルト（新規の場合は省略可）
 * @returns {Promise<Object>} 派生キーとソルト
 */
export const deriveKeyFromPassword = async (password, salt = null) => {
  // improved-crypto.jsの実装を使用
  return improvedCrypto.deriveKeyFromPassword(password, salt);
};

/**
 * 暗号化キーをIndexedDBに安全に保存
 * @param {string} masterKey - マスター暗号化キー
 * @param {string} password - パスワード
 * @returns {Promise<boolean>} 成功した場合はtrue
 */
export const storeEncryptionKeySecurely = async (masterKey, password) => {
  try {
    // improved-crypto.jsの実装を使用
    return improvedCrypto.storeEncryptionKeySecurely(masterKey, password);
  } catch (error) {
    console.error('Error storing encryption key:', error);
    
    // エラー発生時、一時的な代替策としてlocalStorageに保存
    localStorage.setItem('masterEncryptionKey', masterKey);
    
    return false;
  }
};

/**
 * IndexedDBから暗号化キーを安全に取得
 * @param {string} password - パスワード
 * @returns {Promise<string>} 復号されたマスターキー
 */
export const retrieveEncryptionKeySecurely = async (password) => {
  try {
    // improved-crypto.jsの実装を使用
    const key = await improvedCrypto.retrieveEncryptionKeySecurely(password);
    
    // キーが見つからない場合、localStorageを確認（後方互換性のため）
    if (!key) {
      const masterKey = localStorage.getItem('masterEncryptionKey');
      if (masterKey) {
        return masterKey;
      }
    }
    
    return key;
  } catch (error) {
    console.error('Error retrieving encryption key:', error);
    
    // エラー時の最終手段としてlocalStorageを確認
    const masterKey = localStorage.getItem('masterEncryptionKey');
    if (masterKey) {
      return masterKey;
    }
    
    throw error;
  }
};

/**
 * リカバリーデータを生成
 * @param {string} encryptionKey - マスター暗号化キー
 * @param {number} totalGuardians - 総ガーディアン数
 * @param {number} requiredShares - リカバリーに必要なシェア数
 * @returns {Object} 生成されたリカバリーデータ
 */
export const generateRecoveryData = (encryptionKey, totalGuardians, requiredShares) => {
  // improved-crypto.jsの実装を使用
  return improvedCrypto.generateRecoveryData(encryptionKey, totalGuardians, requiredShares);
};

// crypto.js の追加部分 - レガシーシステムとの互換性

/**
 * 秘密鍵でデータを復号（レガシー互換性を持つ拡張版）
 * @param {Uint8Array} encryptedBlob - 暗号化されたデータ
 * @param {string} privateKey - 秘密鍵
 * @returns {any} 復号されたデータ
 */
export const decryptWithPrivateKey = (encryptedBlob, privateKey) => {
  try {
    // デバッグ情報
    console.log('復号化開始:', {
      encryptedBlobType: typeof encryptedBlob,
      privateKeyType: typeof privateKey,
      privateKeyLength: privateKey?.length,
      isUint8Array: encryptedBlob instanceof Uint8Array
    });

    // ---- 形式検出と前処理 ----
    let dataStr;
    if (encryptedBlob instanceof Uint8Array) {
      // 通常の変換プロセス
      dataStr = blobToString(encryptedBlob);
    } else if (typeof encryptedBlob === 'string') {
      // すでに文字列の場合（レガシーケース）
      dataStr = encryptedBlob;
    } else if (encryptedBlob && typeof encryptedBlob === 'object') {
      // オブジェクトの場合（別のレガシーケース）
      try {
        dataStr = JSON.stringify(encryptedBlob);
      } catch (e) {
        console.error('オブジェクトのJSON変換に失敗:', e);
        dataStr = String(encryptedBlob);
      }
    } else {
      // その他の不明な形式
      console.error('未知の暗号化データ形式:', encryptedBlob);
      dataStr = String(encryptedBlob);
    }

    console.log('処理用データ文字列:', { 
      length: dataStr?.length, 
      preview: dataStr?.substring(0, 30) + '...'
    });

    // ---- データ構造の検出と解析 ----
    let encryptedData, encryptedKey;
    
    // 既知の形式をすべて試す
    const dataParsed = tryParseJSON(dataStr);
    
    if (dataParsed && dataParsed.encryptedData && dataParsed.encryptedKey) {
      // 標準形式 - JSON {encryptedData, encryptedKey}
      console.log('標準JSON形式を検出');
      encryptedData = dataParsed.encryptedData;
      encryptedKey = dataParsed.encryptedKey;
    } else {
      // 他の形式を試す...
      console.log('標準形式ではありません、代替形式を試行');
      
      // レガシー形式1: encryptedData部分がまた別のJSONかも
      if (dataParsed && typeof dataParsed === 'string') {
        console.log('潜在的な入れ子JSON文字列を検出');
        const nestedParsed = tryParseJSON(dataParsed);
        
        if (nestedParsed && nestedParsed.encryptedData && nestedParsed.encryptedKey) {
          console.log('入れ子JSON形式として処理');
          encryptedData = nestedParsed.encryptedData;
          encryptedKey = nestedParsed.encryptedKey;
        }
      }
      
      // それでも見つからない場合、直接暗号化テキストとして試行
      if (!encryptedData || !encryptedKey) {
        console.log('直接暗号化テキストとして試行');
        
        // 最後の手段: 直接暗号化文字列として扱う
        try {
          console.log('privateKeyを直接使用して復号を試行');
          const result = decryptWithKey(dataStr, privateKey);
          if (result) {
            console.log('直接復号が成功');
            return result;
          }
        } catch (directError) {
          console.error('直接復号に失敗:', directError);
        }
        
        throw new Error('有効な暗号化データ構造を認識できません');
      }
    }
    
    console.log('復号パラメータ:', { 
      hasEncryptedData: !!encryptedData,
      hasEncryptedKey: !!encryptedKey,
      encryptedDataLength: encryptedData?.length,
      encryptedKeyLength: encryptedKey?.length
    });

    // ---- キー復号プロセス ----
    let decryptedKey;
    try {
      // まず秘密鍵がhexフォーマットなのか通常の文字列なのかを検出
      const isHexKey = /^[0-9a-f]+$/i.test(privateKey) && privateKey.length >= 32;
      console.log('秘密鍵フォーマット:', { isHex: isHexKey });
      
      // 標準の復号処理
      decryptedKey = CryptoJS.AES.decrypt(encryptedKey, privateKey).toString(CryptoJS.enc.Utf8);
      
      if (!decryptedKey && isHexKey) {
        // Hex形式の鍵で再試行
        console.log('Hex形式の鍵で再試行');
        const hexWords = CryptoJS.enc.Hex.parse(privateKey);
        decryptedKey = CryptoJS.AES.decrypt(encryptedKey, hexWords).toString(CryptoJS.enc.Utf8);
      }
      
      if (!decryptedKey) {
        throw new Error('キーの復号に失敗しました');
      }
      
      console.log('キー復号成功:', { 
        keyLength: decryptedKey.length,
        keyPreview: decryptedKey.substring(0, 5) + '...'
      });
    } catch (keyError) {
      console.error('キー復号エラー:', keyError);
      throw new Error(`キー復号に失敗: ${keyError.message}`);
    }
    
    // ---- データ復号プロセス ----
    try {
      console.log('復号キーでデータ復号を試行');
      const result = decryptWithKey(encryptedData, decryptedKey);
      if (result) {
        console.log('データ復号成功:', { 
          resultType: typeof result,
          preview: JSON.stringify(result).substring(0, 30) + '...'
        });
        return result;
      } else {
        throw new Error('データの復号結果が空です');
      }
    } catch (dataError) {
      console.error('データ復号エラー:', dataError);
      
      // 別のフォーマットで再試行
      console.log('代替形式でデータ復号を試行');
      try {
        const alternativeDecrypted = tryAlternativeDecryption(encryptedData, decryptedKey);
        if (alternativeDecrypted) {
          console.log('代替復号が成功');
          return alternativeDecrypted;
        }
      } catch (altError) {
        console.error('代替復号も失敗:', altError);
      }
      
      throw new Error(`データ復号に失敗: ${dataError.message}`);
    }
  } catch (error) {
    console.error('復号処理全体のエラー:', error);
    throw error;
  }
};

/**
 * 安全にJSONをパースする
 * @param {string} jsonString - パースする文字列
 * @returns {any} パース結果またはnull
 */
function tryParseJSON(jsonString) {
  try {
    if (typeof jsonString !== 'string') return null;
    return JSON.parse(jsonString);
  } catch (e) {
    console.log('JSON解析エラー:', e.message);
    return null;
  }
}

/**
 * 代替復号方法を試行
 * @param {string} encryptedData - 暗号化データ
 * @param {string} decryptedKey - 復号キー
 * @returns {any} 復号結果または null
 */
function tryAlternativeDecryption(encryptedData, decryptedKey) {
  // 1. Base64デコードを試す
  try {
    const wordArray = CryptoJS.enc.Base64.parse(encryptedData);
    const decrypted = CryptoJS.AES.decrypt(
      { ciphertext: wordArray },
      CryptoJS.enc.Utf8.parse(decryptedKey)
    );
    const result = decrypted.toString(CryptoJS.enc.Utf8);
    if (result) {
      try {
        return JSON.parse(result);
      } catch {
        return result;
      }
    }
  } catch (e) {
    console.log('Base64変換復号の失敗:', e);
  }
  
  // 2. Hex形式を試す
  try {
    const hexKey = CryptoJS.enc.Hex.parse(decryptedKey);
    const decrypted = CryptoJS.AES.decrypt(encryptedData, hexKey);
    const result = decrypted.toString(CryptoJS.enc.Utf8);
    if (result) {
      try {
        return JSON.parse(result);
      } catch {
        return result;
      }
    }
  } catch (e) {
    console.log('Hex形式での復号の失敗:', e);
  }
  
  // 3. 直接復号を試す（不明形式）
  try {
    const decrypted = CryptoJS.AES.decrypt(
      encryptedData.toString(),
      decryptedKey.toString()
    );
    const result = decrypted.toString(CryptoJS.enc.Utf8);
    if (result) {
      try {
        return JSON.parse(result);
      } catch {
        return result;
      }
    }
  } catch (e) {
    console.log('直接文字列復号の失敗:', e);
  }
  
  return null;
}