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