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
    const decrypted = CryptoJS.AES.decrypt(encryptedData, key);
    return JSON.parse(decrypted.toString(CryptoJS.enc.Utf8));
  } catch (error) {
    console.error('Decryption failed:', error);
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
  if (!blob || !(blob instanceof Uint8Array)) {
    console.error('Invalid blob passed to blobToString:', blob);
    return String(blob); // 例外的にString変換
  }
  const decoder = new TextDecoder();
  return decoder.decode(blob);
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
export const decryptWithPrivateKey = (encryptedBlob, privateKey) => {
  try {
    const dataStr = blobToString(encryptedBlob);
    const { encryptedData, encryptedKey } = JSON.parse(dataStr);
    
    // 秘密鍵を使ってキーを復号
    const decryptedKey = CryptoJS.AES.decrypt(encryptedKey, privateKey).toString(CryptoJS.enc.Utf8);
    
    // 復号したキーでデータを復号
    return decryptWithKey(encryptedData, decryptedKey);
  } catch (error) {
    console.error('Failed to decrypt with private key:', error);
    throw error;
  }
};

// ここからimproved-crypto.jsから置き換える関数 -----------------------

/**
 * 16進数文字列をバイト配列に変換
 * @param {string} hex - 16進数文字列
 * @returns {Uint8Array} バイト配列
 */
export const hexToBytes = (hex) => {
  if (!hex || typeof hex !== 'string' || hex.length % 2 !== 0) {
    console.error('Invalid hex string:', hex);
    return new Uint8Array(0);
  }
  
  try {
    return new Uint8Array(
      hex.match(/.{1,2}/g).map(byte => parseInt(byte, 16))
    );
  } catch (e) {
    console.error('Error converting hex to bytes:', e);
    return new Uint8Array(0);
  }
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
    // 入力検証
    if (threshold < 2) {
      throw new Error('しきい値は2以上である必要があります');
    }
    if (totalShares < threshold) {
      throw new Error('総シェア数はしきい値以上である必要があります');
    }
    
    // 秘密情報をバイト配列に変換
    const secretBytes = new TextEncoder().encode(secret);
    console.log('秘密のバイト配列:', Array.from(secretBytes));
    
    // エンコーディング情報の保存（復元時に必要）
    const encoding = 'utf-8';
    
    // シェアのリスト
    const shares = [];
    
    // バイトごとに処理
    for (let byteIndex = 0; byteIndex < secretBytes.length; byteIndex++) {
      // 各バイトに対して多項式を作成
      const coeffs = new Uint8Array(threshold);
      
      // a_0はシークレットのバイト値
      coeffs[0] = secretBytes[byteIndex];
      
      // a_1からa_{t-1}は乱数
      window.crypto.getRandomValues(coeffs.subarray(1));
      
      console.log(`バイトインデックス ${byteIndex}, 元の値: ${secretBytes[byteIndex]}, 係数:`, Array.from(coeffs));
      
      // 各参加者にシェアを生成
      for (let x = 1; x <= totalShares; x++) {
        // インデックスは1から始まる
        const y = evaluatePolynomial(coeffs, x);
        console.log(`参加者 ${x}, バイト ${byteIndex}, 多項式結果: ${y}`);
        
        if (shares[x - 1] === undefined) {
          shares[x - 1] = {
            x,
            y: [y]  // 通常の配列として保持
          };
        } else {
          shares[x - 1].y.push(y);
        }
      }
    }
    
    // シェアをエンコード - 復元側と互換性のある形式に
    const encodedShares = shares.map(share => {
      // xは16進数で2桁にエンコード
      const xHex = share.x.toString(16).padStart(2, '0');
      
      // yはUint8Arrayに変換してから16進数にエンコード
      const yHex = bytesToHex(new Uint8Array(share.y));
      console.log(`シェアID: share-${share.x}, X: ${xHex}, Y(Hex): ${yHex}`);
      
      // プレフィックス(80)を追加 - オリジナルライブラリとの互換性のため
      return {
        id: `share-${uuidv4()}`,
        value: `80${xHex}${yHex}`,
        encoding // エンコーディング情報を追加
      };
    });
    
    return encodedShares;
  } catch (error) {
    console.error('シェア作成に失敗しました:', error);
    throw new Error('シェア作成に失敗しました: ' + error.message);
  }
};

/**
 * シェアを結合して秘密を復元
 * @param {Array} shares - シェアの配列
 * @returns {string} 復元された秘密情報
 */
export const combineShares = (shares) => {
  try {
    // シェアの値だけを抽出
    const shareValues = shares.map(share => share.value || share);
    console.log('シェア値:', shareValues);
    
    // エンコーディング情報を取得（最初のシェアから）
    const encoding = shares[0].encoding || 'utf-8';
    console.log('使用するエンコーディング:', encoding);
    
    // シェアをデコード
    const decodedShares = shareValues.map(shareValue => {
      // 形式チェック
      if (!shareValue.startsWith('80')) {
        throw new Error('不正なシェア形式です');
      }
      
      // xとyを抽出
      const x = parseInt(shareValue.substring(2, 4), 16);
      const yHex = shareValue.substring(4);
      const yBytes = hexToBytes(yHex);
      
      return {
        x,
        y: Array.from(yBytes) // 一貫性のためにArray.fromを使用
      };
    });
    
    console.log('デコードされたシェア:', JSON.stringify(decodedShares));
    
    // シェアの有効性チェック
    if (decodedShares.length === 0) {
      throw new Error('有効なシェアがありません');
    }
    
    // 全シェアのyの長さが同じか確認
    const yLengths = decodedShares.map(share => share.y.length);
    const allSameLength = yLengths.every(length => length === yLengths[0]);
    if (!allSameLength) {
      throw new Error('シェアのバイト長が一致しません');
    }
    
    // 秘密の長さは全てのシェアのy配列の長さと同じ
    const secretLength = decodedShares[0].y.length;
    
    // 結果のバイト配列
    const result = new Uint8Array(secretLength);
    console.log('初期化された結果バイト配列:', result);
    
    // バイトごとに復元
    for (let byteIndex = 0; byteIndex < secretLength; byteIndex++) {
      // 各シェアから対応するバイトのポイントを収集
      const points = decodedShares.map(share => [
        share.x,
        share.y[byteIndex]
      ]);
      
      // ポイントをログ
      console.log(`バイト ${byteIndex}, ポイント:`, JSON.stringify(points));
      
      // ラグランジュ補間法でf(0)を求める
      result[byteIndex] = lagrangeInterpolation(points);
      
      // 結果をログ
      console.log(`バイト ${byteIndex}, 補間結果: ${result[byteIndex]}`);
    }
    
    // 復元されたバイト配列をログ出力
    console.log('復元されたバイト配列:', Array.from(result).map(b => b.toString(16).padStart(2, '0')).join(' '));
    
    try {
      // バイト配列を文字列に変換
      const decoded = new TextDecoder(encoding).decode(result);
      console.log('デコード結果:', decoded);
      return decoded;
    } catch (decodeError) {
      console.error('TextDecoderでのデコードに失敗:', decodeError);
      
      // エラーとともに16進数表現も添えて再スロー
      const hexString = Array.from(result).map(b => b.toString(16).padStart(2, '0')).join('');
      throw new Error(`デコードに失敗しました: ${decodeError.message}。データ(16進数): ${hexString}`);
    }
  } catch (error) {
    console.error('シェア結合に失敗しました:', error);
    throw new Error('シェア結合に失敗しました: ' + error.message);
  }
};

/**
 * 安全なストレージに保存（IndexedDBプライマリ、バックアプオプション付き）
 * @param {string} key - 保存するキー名
 * @param {any} data - 保存するデータ
 * @returns {Promise<boolean>} 成功した場合はtrue
 */
export const saveToSecureStorage = async (key, data) => {
  return new Promise(async (resolve, reject) => {
    try {
      // 最初にIndexedDBに保存を試みる
      const savedToIndexedDB = await saveToIndexedDB(key, data);
      
      if (savedToIndexedDB) {
        return resolve(true);
      }
      
      // IndexedDBが失敗した場合の代替手段（メモリ内の一時ストレージ）
      const secureBackupStorage = getSecureBackupStorage();
      secureBackupStorage[key] = data;
      
      resolve(true);
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * 安全なストレージからデータを取得
 * @param {string} key - 取得するキー名
 * @returns {Promise<any>} 取得したデータ
 */
export const getFromSecureStorage = async (key) => {
  try {
    // 最初にIndexedDBから取得を試みる
    const dataFromIndexedDB = await getFromIndexedDB(key);
    if (dataFromIndexedDB) {
      return dataFromIndexedDB;
    }
    
    // IndexedDBが失敗した場合、バックアップストレージから取得
    const secureBackupStorage = getSecureBackupStorage();
    if (secureBackupStorage[key]) {
      return secureBackupStorage[key];
    }
    
    return null;
  } catch (error) {
    console.error('ストレージからの取得に失敗しました:', error);
    throw new Error('ストレージからの取得に失敗しました');
  }
};

/**
 * パスワードから暗号化キーを派生（PBKDF2）
 * @param {string} password - ユーザーパスワード
 * @param {Uint8Array} salt - ソルト（新規の場合は省略可）
 * @returns {Promise<Object>} 派生キーとソルト
 */
export const deriveKeyFromPassword = async (password, salt = null) => {
  try {
    // ソルトがない場合は新しく生成
    if (!salt) {
      salt = window.crypto.getRandomValues(new Uint8Array(16));
    }
    
    // パスワードからキーマテリアルを作成
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);
    
    // Web Crypto API が利用可能かチェック
    if (window.crypto && window.crypto.subtle) {
      try {
        const keyMaterial = await window.crypto.subtle.importKey(
          'raw',
          passwordBuffer,
          { name: 'PBKDF2' },
          false,
          ['deriveBits', 'deriveKey']
        );
        
        // PBKDF2を使ってキーを派生
        const derivedKey = await window.crypto.subtle.deriveKey(
          {
            name: 'PBKDF2',
            salt,
            iterations: 100000, // 適切な反復回数
            hash: 'SHA-256'
          },
          keyMaterial,
          { name: 'AES-GCM', length: 256 },
          true, // エクスポート可能に設定
          ['encrypt', 'decrypt']
        );
        
        // 派生キーをエクスポート
        const exportedKey = await window.crypto.subtle.exportKey('raw', derivedKey);
        const keyHex = Array.from(new Uint8Array(exportedKey))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
        
        // ソルトを16進数に変換
        const saltHex = Array.from(salt)
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
        
        return {
          derivedKey,
          key: keyHex,
          salt: saltHex
        };
      } catch (cryptoError) {
        console.warn('Web Crypto APIでの鍵派生に失敗しました - フォールバック実装を使用します:', cryptoError);
        return fallbackDeriveKey(password, salt);
      }
    } else {
      console.warn('Web Crypto APIが利用できません - フォールバック実装を使用します');
      return fallbackDeriveKey(password, salt);
    }
  } catch (error) {
    console.error('鍵派生に失敗しました:', error);
    // 最終手段としてフォールバック
    return fallbackDeriveKey(password, salt);
  }
};

/**
 * 暗号化キーをIndexedDBに安全に保存
 * @param {string} masterKey - マスター暗号化キー
 * @param {string} password - パスワード
 * @returns {Promise<boolean>} 成功した場合はtrue
 */
export const storeEncryptionKeySecurely = async (masterKey, password) => {
  try {
    // パスワードからキーを派生
    const { derivedKey, salt, key, iterations, hash } = await deriveKeyFromPassword(password);
    
    console.debug('生成されたソルト:', bytesToHex(salt));
    // Web Crypto APIが利用可能かどうかで処理を分岐
    let encryptedKeyHex;
    let ivHex;
    
    if (derivedKey && window.crypto.subtle) {
      // 初期化ベクトル（IV）を生成
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      
      // マスターキーをバッファに変換（文字列の場合）
      let masterKeyBuffer;
      if (typeof masterKey === 'string') {
        masterKeyBuffer = new TextEncoder().encode(masterKey);
      } else {
        // すでにバイナリ形式の場合
        masterKeyBuffer = masterKey;
      }
      
      // Web Crypto APIでマスターキーを暗号化
      const encryptedKeyBuffer = await window.crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv
        },
        derivedKey,
        masterKeyBuffer
      );
      
      // バイナリデータを16進数に変換
      encryptedKeyHex = Array.from(new Uint8Array(encryptedKeyBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      
      ivHex = Array.from(iv)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    } else {
    // フォールバック: 簡易暗号化（本番環境では使用しないでください）
    console.warn('フォールバック暗号化を使用しています - 本番環境では推奨されません');
    
      // 簡易IV生成
      const iv = new Uint8Array(12);
      window.crypto.getRandomValues(iv); // より安全なランダム値生成

      // マスターキーをバッファに変換
      const masterKeyBytes = new TextEncoder().encode(masterKey);
      const keyBytes = hexToBytes(key);

      // 統一されたフォールバック関数を使用
      const encryptedBytes = fallbackEncryptDecrypt(masterKeyBytes, keyBytes, iv);

      encryptedKeyHex = bytesToHex(encryptedBytes);
      ivHex = bytesToHex(iv);
  }
  
  // 暗号化データを保存形式に変換
  const secureData = {
      encryptedKey: encryptedKeyHex,
      iv: ivHex,
      salt: salt,
      version: 2,
      algorithm: derivedKey ? 'AES-GCM' : 'XOR-FALLBACK',
      iterations: iterations,
      hash: hash,
      createdAt: new Date().toISOString(),
      keyEncoding: 'utf8',
      keyFormat: typeof masterKey === 'string' ? 'string' : 'binary'
    };
  
    console.debug('保存するセキュアデータ:', secureData);

      return await saveToSecureStorage('masterKey', secureData);
      } catch (error) {
      console.error('暗号化キーの保存に失敗しました:', error);
      throw new Error('暗号化キーの保存に失敗しました');
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