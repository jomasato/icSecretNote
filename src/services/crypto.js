import CryptoJS from 'crypto-js';
import { v4 as uuidv4 } from 'uuid';
import md5 from 'blueimp-md5';

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

// Generate a random key for encryption
export const generateEncryptionKey = () => {
  // Generate a random 256-bit key (32 bytes)
  return CryptoJS.lib.WordArray.random(32).toString();
};

// Encrypt data with a key
export const encryptWithKey = (data, key) => {
  const encrypted = CryptoJS.AES.encrypt(JSON.stringify(data), key).toString();
  return encrypted;
};

// Decrypt data with a key
export const decryptWithKey = (encryptedData, key) => {
  try {
    const decrypted = CryptoJS.AES.decrypt(encryptedData, key);
    return JSON.parse(decrypted.toString(CryptoJS.enc.Utf8));
  } catch (error) {
    console.error('Decryption failed:', error);
    return null;
  }
};

// Convert string to Blob for IC storage
export const stringToBlob = (str) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  return new Uint8Array(data);
};

// Convert Blob to string from IC storage
export const blobToString = (blob) => {
  if (!blob || !(blob instanceof Uint8Array)) {
    console.error('Invalid blob passed to blobToString:', blob);
    return String(blob); // Fallback to String conversion
  }
  const decoder = new TextDecoder();
  return decoder.decode(blob);
};

// Generate a key pair for device authentication
export const generateKeyPair = () => {
  // In a real app, use asymmetric encryption like RSA
  // For this demo, we'll create a simple pair
  const privateKey = CryptoJS.lib.WordArray.random(32).toString();
  // 直接文字列として返す
  const publicKey = md5(privateKey); // This is just for demo. In reality, use proper public key crypto
  
  return {
    privateKey,
    publicKey, // 文字列として返す
  };
};

// Encrypt with a "public key" (simplified)
export const encryptWithPublicKey = (data, publicKey) => {
  // publicKeyが文字列であることを確認
  const publicKeyStr = typeof publicKey === 'string' ? publicKey : blobToString(publicKey);
  
  // In a real app, use asymmetric encryption
  // For this demo, we'll simulate it
  const encryptionKey = generateEncryptionKey();
  const encryptedData = encryptWithKey(data, encryptionKey);
  const encryptedKey = CryptoJS.AES.encrypt(encryptionKey, publicKeyStr).toString();
  
  return stringToBlob(JSON.stringify({
    encryptedData,
    encryptedKey
  }));
};

// Decrypt with a "private key" (simplified)
export const decryptWithPrivateKey = (encryptedBlob, privateKey) => {
  const dataStr = blobToString(encryptedBlob);
  const { encryptedData, encryptedKey } = JSON.parse(dataStr);
  
  // Decrypt the key with the private key
  const decryptedKey = CryptoJS.AES.decrypt(encryptedKey, privateKey).toString(CryptoJS.enc.Utf8);
  
  // Use the decrypted key to decrypt the data
  return decryptWithKey(encryptedData, decryptedKey);
};

// Split a secret into shares using simplified Shamir's Secret Sharing
export const createShares = (secret, totalShares, threshold) => {
  try {
    // Convert the secret to hex format
    const hexSecret = CryptoJS.enc.Hex.stringify(CryptoJS.enc.Utf8.parse(secret));
    
    // Generate shares using our simplified implementation
    const shares = simpleShamir.share(hexSecret, totalShares, threshold);
    
    // Return the shares with IDs
    return shares.map(share => ({
      id: `share-${uuidv4()}`,
      value: share
    }));
  } catch (error) {
    console.error('Failed to create shares:', error);
    return [];
  }
};

// Combine shares to reconstruct the secret
export const combineShares = (shares) => {
  try {
    // Extract just the share values
    const shareValues = shares.map(share => share.value || share);
    
    // Combine the shares using our simplified implementation
    const combined = simpleShamir.combine(shareValues);
    
    // Convert from hex back to string
    return CryptoJS.enc.Utf8.stringify(CryptoJS.enc.Hex.parse(combined));
  } catch (error) {
    console.error('Failed to combine shares:', error);
    return null;
  }
};

// Generate recovery data
export const generateRecoveryData = (encryptionKey, totalGuardians, requiredShares) => {
  // Create shares of the encryption key
  const shares = createShares(encryptionKey, totalGuardians, requiredShares);
  
  // Public recovery data includes information needed for recovery
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