//src/services/crypto.js

import CryptoJS from 'crypto-js';
import { v4 as uuidv4 } from 'uuid';
import md5 from 'blueimp-md5';
import * as improvedCrypto from './improved-crypto';
// 以下を追加
const { createShares: shamirCreateShares, combineShares: shamirCombineShares } = require('./shamir');

// secrets.js-grempeの代わりに使用する簡易実装
// 注: これは本番環境での使用には適していません
const simpleShamir = {
  // シェアを生成する関数
  share: (secret, numShares, threshold) => {
    // とても簡易的な実装 - 実際のシャミア秘密分散法ではない
    const shares = [];
    // シェアの識別子として使用するプレフィックス（80はオリジナルライブラリと同様）
    const prefix = '80';
    
    // 秘密情報をシェアに分割する代わりに、各シェアに秘密情報全体を埋め込む
    for (let i = 0; i < numShares; i++) {
      // シェアIDと乱数で秘密情報をラップする
      const randomPadding = CryptoJS.lib.WordArray.random(8).toString();
      const shareId = (i + 1).toString().padStart(2, '0');
      shares.push(`${prefix}${shareId}${secret}${randomPadding}`);
    }
    return shares;
  },
  
  // シェアを結合して秘密情報を復元する関数
  combine: (shares) => {
    // シェアが十分にあることを確認
    if (!shares || shares.length === 0) {
      throw new Error('No shares provided');
    }
    
    // どのシェアからでも秘密情報を抽出できる
    // オリジナルのフォーマットに従い、プレフィックス(2文字)とID(2文字)の後に秘密情報がある
    const share = shares[0];
    if (share.length < 8) { // 最低限の長さチェック
      throw new Error('Invalid share format');
    }
    
    // 最初のシェアからプレフィックスとIDを除いた秘密情報部分を抽出
    // 注: 実際には、ランダムパディング部分も含まれているかもしれないが、
    // オリジナルの実装でもそのような制約がある
    return share.substring(4, share.length - 16); // パディング長を想定して調整
  },
  
  // ヘルパー関数 - hexからの変換（互換性のため）
  fromHex: (hexStr) => {
    return hexStr;
  },
  
  // ヘルパー関数 - hexへの変換（互換性のため）
  toHex: (str) => {
    return str;
  }
};

/**
 * 暗号化用のランダムキーを生成
 * @returns {string} 生成されたキー
 */
export const generateEncryptionKey = () => {
  // 256ビット(32バイト)のランダムキーを生成
  return CryptoJS.lib.WordArray.random(32).toString();
};

/**
 * データをキーで暗号化
 * @param {any} data - 暗号化するデータ
 * @param {string} key - 暗号化キー
 * @returns {string} 暗号化されたデータ
 */
export const encryptWithKey = (data, key) => {
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
  // 実際のアプリではRSAなどの非対称暗号を使用
  // このデモでは簡易的な実装
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
  
  // 実際のアプリでは非対称暗号を使用
  // このデモではシミュレート
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

/**
 * 秘密を複数のシェアに分割
 * @param {string} secret - 分割する秘密情報
 * @param {number} totalShares - 総シェア数
 * @param {number} threshold - 必要なシェア数
 * @returns {Array} シェアの配列
 */
export const createShares = (secret, totalShares, threshold) => {
  try {
    // 新しいShamir実装を使用
    return shamirCreateShares(secret, totalShares, threshold);
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
    // 新しいShamir実装を使用
    return shamirCombineShares(shares);
  } catch (error) {
    console.error('Failed to combine shares:', error);
    return null;
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
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const keyMaterial = await window.crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(password),
      { name: "PBKDF2" },
      false,
      ["deriveBits", "deriveKey"]
    );
    
    const derivedKey = await window.crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt,
        iterations: 100000,
        hash: "SHA-256",
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt"]
    );
    
    // マスターキーを暗号化
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encryptedData = await window.crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv,
      },
      derivedKey,
      new TextEncoder().encode(masterKey)
    );
    
    // 暗号化データを保存形式に変換
    const secureData = {
      encryptedKey: Array.from(new Uint8Array(encryptedData)),
      salt: Array.from(salt),
      iv: Array.from(iv),
      version: 1
    };
    
    // IndexedDBに保存
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('SecureNotesStorage', 1);
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('keys')) {
          db.createObjectStore('keys', { keyPath: 'id' });
        }
      };
      
      request.onsuccess = (event) => {
        const db = event.target.result;
        const transaction = db.transaction(['keys'], 'readwrite');
        const objectStore = transaction.objectStore('keys');
        
        const storeRequest = objectStore.put({
          id: 'masterKey',
          data: secureData
        });
        
        storeRequest.onsuccess = () => resolve(true);
        storeRequest.onerror = () => {
          console.error('Failed to store encrypted key in IndexedDB');
          
          // IndexedDBが使用できない場合、一時的な代替策としてlocalStorageに保存
          // 注: 本番環境ではより安全な方法を検討する必要あり
          localStorage.setItem('masterEncryptionKey', masterKey);
          
          resolve(false);
        };
      };
      
      request.onerror = () => {
        console.error('Failed to open IndexedDB');
        
        // IndexedDBが使用できない場合、一時的な代替策としてlocalStorageに保存
        localStorage.setItem('masterEncryptionKey', masterKey);
        
        resolve(false);
      };
    });
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
    // IndexedDBからキーを取得
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('SecureNotesStorage', 1);
      
      request.onsuccess = async (event) => {
        try {
          const db = event.target.result;
          const transaction = db.transaction(['keys'], 'readonly');
          const objectStore = transaction.objectStore('keys');
          
          const getRequest = objectStore.get('masterKey');
          
          getRequest.onsuccess = async () => {
            if (!getRequest.result) {
              // キーが見つからない場合、localStorageを確認
              const masterKey = localStorage.getItem('masterEncryptionKey');
              if (masterKey) {
                resolve(masterKey);
                return;
              }
              
              reject(new Error('No encryption key found'));
              return;
            }
            
            const secureData = getRequest.result.data;
            
            // 復号に必要な値を準備
            const encryptedKey = new Uint8Array(secureData.encryptedKey);
            const salt = new Uint8Array(secureData.salt);
            const iv = new Uint8Array(secureData.iv);
            
            // パスワードからキーを派生
            const keyMaterial = await window.crypto.subtle.importKey(
              "raw",
              new TextEncoder().encode(password),
              { name: "PBKDF2" },
              false,
              ["deriveBits", "deriveKey"]
            );
            
            const derivedKey = await window.crypto.subtle.deriveKey(
              {
                name: "PBKDF2",
                salt,
                iterations: 100000,
                hash: "SHA-256",
              },
              keyMaterial,
              { name: "AES-GCM", length: 256 },
              false,
              ["decrypt"]
            );
            
            // マスターキーを復号
            const decryptedData = await window.crypto.subtle.decrypt(
              {
                name: "AES-GCM",
                iv,
              },
              derivedKey,
              encryptedKey
            );
            
            resolve(new TextDecoder().decode(decryptedData));
          };
          
          getRequest.onerror = () => {
            console.error('Failed to retrieve key from IndexedDB');
            
            // IndexedDBでエラーが発生した場合、localStorageを確認
            const masterKey = localStorage.getItem('masterEncryptionKey');
            if (masterKey) {
              resolve(masterKey);
              return;
            }
            
            reject(new Error('Failed to retrieve encryption key'));
          };
        } catch (error) {
          console.error('Error in IndexedDB transaction:', error);
          
          // エラー時はlocalStorageを確認
          const masterKey = localStorage.getItem('masterEncryptionKey');
          if (masterKey) {
            resolve(masterKey);
            return;
          }
          
          reject(error);
        }
      };
      
      request.onerror = () => {
        console.error('Failed to open IndexedDB');
        
        // IndexedDBが開けない場合、localStorageを確認
        const masterKey = localStorage.getItem('masterEncryptionKey');
        if (masterKey) {
          resolve(masterKey);
          return;
        }
        
        reject(new Error('Failed to open database'));
      };
    });
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
  // シェアを作成
  const shares = createShares(encryptionKey, totalGuardians, requiredShares);
  
const publicRecoveryData = {
  version: 2,  // バージョンを2に更新
  createdAt: new Date().toISOString(),
  requiredShares,
  totalShares: totalGuardians,
  algorithm: 'shamir-secret-sharing',
  library: 'custom-implementation'
};
  
  return {
    shares,
    publicRecoveryData: stringToBlob(JSON.stringify(publicRecoveryData))
  };
};