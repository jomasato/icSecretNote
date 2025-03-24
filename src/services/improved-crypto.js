// src/services/improved-crypto.js

import { v4 as uuidv4 } from 'uuid';
// secrets.js-grempeの代わりに使用する改良版シャミア秘密分散の実装
// このモジュールは外部ライブラリに依存せず、より安全な実装を提供します

/**
 * 暗号化用のランダムキーを生成
 * @returns {Promise<string>} 生成されたキー（Hex形式）
 */
export const generateEncryptionKey = async () => {
  // Web Crypto APIを使用して256ビット(32バイト)のランダムキーを生成
  const key = await window.crypto.getRandomValues(new Uint8Array(32));
  // 16進数文字列に変換
  return Array.from(key)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};

/**
 * 暗号化キーをインポート
 * @param {string} keyHex - 16進数形式のキー
 * @returns {Promise<CryptoKey>} Cryptoキーオブジェクト
 */
export const importKey = async (keyHex) => {
  // 16進数から配列バッファに変換
  const keyData = new Uint8Array(
    keyHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16))
  );
  
  // AES-GCMキーとしてインポート
  return await window.crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM', length: 256 },
    false, // extractable
    ['encrypt', 'decrypt'] // 使用目的
  );
};

/**
 * データをキーで暗号化
 * @param {any} data - 暗号化するデータ
 * @param {string} keyHex - 暗号化キー（16進数）
 * @returns {Promise<Object>} 暗号化されたデータ（iv含む）
 */
export const encryptWithKey = async (data, keyHex) => {
  // データをJSON文字列に変換
  const dataString = JSON.stringify(data);
  const dataBuffer = new TextEncoder().encode(dataString);
  
  // キーをインポート
  const key = await importKey(keyHex);
  
  // 初期化ベクトル（IV）を生成
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  
  // 暗号化を実行
  const encryptedBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    dataBuffer
  );
  
  // バイナリデータを16進数に変換
  const encryptedHex = Array.from(new Uint8Array(encryptedBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  const ivHex = Array.from(iv)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  // 暗号化データとIVを返す
  return {
    encryptedData: encryptedHex,
    iv: ivHex
  };
};

/**
 * 暗号化されたデータをキーで復号
 * @param {Object} encryptedObj - 暗号化されたデータオブジェクト（encryptedData, iv）
 * @param {string} keyHex - 復号キー（16進数）
 * @returns {Promise<any>} 復号されたデータ
 */
export const decryptWithKey = async (encryptedObj, keyHex) => {
  try {
    const { encryptedData, iv } = encryptedObj;
    
    // 16進数からバイナリデータに変換
    const encryptedBuffer = new Uint8Array(
      encryptedData.match(/.{1,2}/g).map(byte => parseInt(byte, 16))
    ).buffer;
    
    const ivBuffer = new Uint8Array(
      iv.match(/.{1,2}/g).map(byte => parseInt(byte, 16))
    );
    
    // キーをインポート
    const key = await importKey(keyHex);
    
    // 復号を実行
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ivBuffer },
      key,
      encryptedBuffer
    );
    
    // バッファをJSONに変換
    const decryptedText = new TextDecoder().decode(decryptedBuffer);
    return JSON.parse(decryptedText);
  } catch (error) {
    console.error('復号化に失敗しました:', error);
    throw new Error('復号化に失敗しました');
  }
};

/**
 * RSA鍵ペアを生成
 * @returns {Promise<Object>} キーペア（publicKey, privateKey）
 */
export const generateKeyPair = async () => {
  try {
    // RSA-OAEPキーペアを生成
    const keyPair = await window.crypto.subtle.generateKey(
      {
        name: 'RSA-OAEP',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256'
      },
      true, // キーをエクスポート可能に設定
      ['encrypt', 'decrypt']
    );
    
    // 秘密鍵をエクスポート（PKCS#8形式）
    const privateKeyBuffer = await window.crypto.subtle.exportKey(
      'pkcs8',
      keyPair.privateKey
    );
    
    // 公開鍵をエクスポート（SPKI形式）
    const publicKeyBuffer = await window.crypto.subtle.exportKey(
      'spki',
      keyPair.publicKey
    );
    
    // バイナリデータを16進数に変換
    const privateKeyHex = Array.from(new Uint8Array(privateKeyBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    const publicKeyHex = Array.from(new Uint8Array(publicKeyBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    return {
      privateKey: privateKeyHex,
      publicKey: publicKeyHex
    };
  } catch (error) {
    console.error('キーペア生成に失敗しました:', error);
    throw new Error('キーペア生成に失敗しました');
  }
};

/**
 * 16進数の公開鍵をインポート
 * @param {string} publicKeyHex - 16進数形式の公開鍵
 * @returns {Promise<CryptoKey>} インポートされた公開鍵
 */
export const importPublicKey = async (publicKeyHex) => {
  try {
    // 16進数から配列バッファに変換
    const keyData = new Uint8Array(
      publicKeyHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16))
    ).buffer;
    
    // SPKI形式からRSA-OAEP公開鍵をインポート
    return await window.crypto.subtle.importKey(
      'spki',
      keyData,
      {
        name: 'RSA-OAEP',
        hash: 'SHA-256'
      },
      false, // extractable
      ['encrypt'] // 使用目的
    );
  } catch (error) {
    console.error('公開鍵のインポートに失敗しました:', error);
    throw new Error('公開鍵のインポートに失敗しました');
  }
};

/**
 * 16進数の秘密鍵をインポート
 * @param {string} privateKeyHex - 16進数形式の秘密鍵
 * @returns {Promise<CryptoKey>} インポートされた秘密鍵
 */
export const importPrivateKey = async (privateKeyHex) => {
  try {
    // 16進数から配列バッファに変換
    const keyData = new Uint8Array(
      privateKeyHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16))
    ).buffer;
    
    // PKCS#8形式からRSA-OAEP秘密鍵をインポート
    return await window.crypto.subtle.importKey(
      'pkcs8',
      keyData,
      {
        name: 'RSA-OAEP',
        hash: 'SHA-256'
      },
      false, // extractable
      ['decrypt'] // 使用目的
    );
  } catch (error) {
    console.error('秘密鍵のインポートに失敗しました:', error);
    throw new Error('秘密鍵のインポートに失敗しました');
  }
};

/**
 * 公開鍵でデータを暗号化
 * @param {any} data - 暗号化するデータ
 * @param {string} publicKeyHex - 16進数形式の公開鍵
 * @returns {Promise<string>} 暗号化されたデータ（16進数）
 */
export const encryptWithPublicKey = async (data, publicKeyHex) => {
  try {
    // 公開鍵をインポート
    const publicKey = await importPublicKey(publicKeyHex);
    
    // データをJSON文字列に変換
    const dataString = JSON.stringify(data);
    const dataBuffer = new TextEncoder().encode(dataString);
    
    // RSA-OAEPで暗号化
    const encryptedBuffer = await window.crypto.subtle.encrypt(
      { name: 'RSA-OAEP' },
      publicKey,
      dataBuffer
    );
    
    // バイナリデータを16進数に変換
    return Array.from(new Uint8Array(encryptedBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  } catch (error) {
    console.error('公開鍵暗号化に失敗しました:', error);
    throw new Error('公開鍵暗号化に失敗しました');
  }
};

/**
 * 秘密鍵でデータを復号
 * @param {string} encryptedHex - 暗号化されたデータ（16進数）
 * @param {string} privateKeyHex - 16進数形式の秘密鍵
 * @returns {Promise<any>} 復号されたデータ
 */
export const decryptWithPrivateKey = async (encryptedHex, privateKeyHex) => {
  try {
    // 秘密鍵をインポート
    const privateKey = await importPrivateKey(privateKeyHex);
    
    // 16進数からバイナリデータに変換
    const encryptedBuffer = new Uint8Array(
      encryptedHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16))
    ).buffer;
    
    // RSA-OAEPで復号
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: 'RSA-OAEP' },
      privateKey,
      encryptedBuffer
    );
    
    // バッファをJSONに変換
    const decryptedText = new TextDecoder().decode(decryptedBuffer);
    return JSON.parse(decryptedText);
  } catch (error) {
    console.error('秘密鍵復号に失敗しました:', error);
    throw new Error('秘密鍵復号に失敗しました');
  }
};

const GF256 = {
    // 加算と減算はXOR
    add: (a, b) => a ^ b,
    sub: (a, b) => a ^ b,
    
    // 乗算（シンプルで信頼性の高い実装）
    mul: function(a, b) {
      a = a & 0xff; // 8ビットに制限
      b = b & 0xff;
      
      if (a === 0 || b === 0) return 0;
      
      let result = 0;
      let temp_a = a;
      
      // シフトと加算による乗算
      for (let i = 0; i < 8; i++) {
        if (b & 1) {
          result ^= temp_a; // 現在のaをXOR
        }
        
        // aを2倍（シフト）し、必要ならGF(256)の既約多項式でXOR
        const highBit = temp_a & 0x80;
        temp_a = (temp_a << 1) & 0xff;
        if (highBit) {
          temp_a ^= 0x1b; // x^8 + x^4 + x^3 + x + 1
        }
        
        b >>= 1; // bを右シフト
      }
      
      return result;
    },
    
    // 除算（逆元を使用）
    div: function(a, b) {
      a = a & 0xff;
      b = b & 0xff;
      
      if (b === 0) throw new Error('0による除算はできません');
      if (a === 0) return 0;
      
      // b の逆元を計算
      const b_inv = this.inverse(b);
      
      // a / b = a * (b^-1)
      return this.mul(a, b_inv);
    },
    
    // 逆元計算（拡張ユークリッドアルゴリズム）
    inverse: function(a) {
      if (a === 0) throw new Error('0の逆元は存在しません');
      
      // 拡張ユークリッドアルゴリズムによるGF(256)での逆元計算
      let t = 0, newt = 1;
      let r = 0x11b, newr = a; // 0x11b = x^8 + x^4 + x^3 + x + 1
      
      while (newr !== 0) {
        const quotient = this.polyDiv(r, newr);
        
        [t, newt] = [newt, t ^ this.polyMul(quotient, newt)];
        [r, newr] = [newr, r ^ this.polyMul(quotient, newr)];
      }
      
      if (r > 1) {
        throw new Error('多項式は可逆ではありません');
      }
      
      return t;
    },
    
    // 多項式除算（GF(2)上）- 逆元計算用
    polyDiv: function(a, b) {
      if (b === 0) throw new Error('0による多項式除算はできません');
      
      let result = 0;
      let degree_diff = this.degree(a) - this.degree(b);
      
      if (degree_diff < 0) return 0;
      
      for (let i = degree_diff; i >= 0; i--) {
        if (a & (1 << (i + this.degree(b)))) {
          result |= 1 << i;
          a ^= b << i;
        }
      }
      
      return result;
    },
    
    // 多項式乗算（GF(2)上）- 逆元計算用
    polyMul: function(a, b) {
      let result = 0;
      
      while (a > 0) {
        if (a & 1) {
          result ^= b;
        }
        b <<= 1;
        a >>= 1;
      }
      
      return result;
    },
    
    // 多項式の次数
    degree: function(a) {
      let degree = -1;
      
      for (let i = 0; i < 32; i++) {
        if (a & (1 << i)) {
          degree = i;
        }
      }
      
      return degree;
    }
  };
  
  
  

    /**
     * 多項式を評価する関数（修正版）
     * @param {Uint8Array|Array} coeffs - 多項式の係数（低次から高次）
     * @param {number} x - 評価するx値
     * @returns {number} 評価結果
     */
    function evaluatePolynomial(coeffs, x) {
        if (x === 0) return coeffs[0];
        
        let result = 0;
        // 係数を高次から低次の順に処理
        for (let i = coeffs.length - 1; i >= 0; i--) {
          result = GF256.add(GF256.mul(result, x), coeffs[i]);
        }
        return result;
      }
    


/**
 * ラグランジュ補間法で多項式を復元（修正版）
 * @param {Array} points - (x, y)座標の配列
 * @returns {number} f(0)の値
 */
const lagrangeInterpolation = (points) => {
    console.log('ラグランジュ補間開始 - ポイント:', JSON.stringify(points));
    
    if (points.length === 0) {
      throw new Error('ポイントが必要です');
    }
    
    // f(0)を求める
    let result = 0;
    
    for (let i = 0; i < points.length; i++) {
      const [xi, yi] = points[i];
      console.log(`ポイント[${i}]: (${xi}, ${yi})`);
      
      // このポイントのラグランジュ基底多項式の値を計算
      let basis = 1;
      
      for (let j = 0; j < points.length; j++) {
        if (i === j) continue;
        
        const [xj] = points[j];
        
        // 分子: (0 - xj) = xj (GF(256)では -xj = xj)
        const num = xj;
        
        // 分母: (xi - xj)
        const denom = GF256.sub(xi, xj);
        
        if (denom === 0) {
          throw new Error(`重複するx座標: xi=${xi}, xj=${xj}`);
        }
        
        // 除算
        const term = GF256.div(num, denom);
        console.log(`  j=${j}: xj=${xj}, 分子=${num}, 分母=${denom}, 項=${term}`);
        
        // 基底多項式に掛ける
        basis = GF256.mul(basis, term);
      }
      
      console.log(`  基底多項式 L_${i}(0) = ${basis}`);
      
      // yi * Li(0)
      const term = GF256.mul(yi, basis);
      console.log(`  項の寄与: ${yi} * ${basis} = ${term}`);
      
      // 累積結果に加算
      result = GF256.add(result, term);
      console.log(`  現在の結果: ${result}`);
    }
    
    console.log(`最終結果: ${result}`);
    return result;
  };
  

/**
 * バイト配列を16進数文字列に変換
 * @param {Uint8Array} bytes - バイト配列
 * @returns {string} 16進数文字列
 */
const bytesToHex = (bytes) => {
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  };


/**
 * シャミア秘密分散法で秘密を複数のシェアに分割（修正版）
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
 * シェアを結合して秘密を復元（修正版）
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
 * パスワードから暗号化キーを派生（PBKDF2）- バックアップ実装付き
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
 * パスワードからキーを派生するフォールバック実装
 * 注: これは暗号学的に安全なPBKDF2ではありませんが、Web Crypto APIが使用できない場合の代替です
 * @param {string} password - パスワード
 * @param {Uint8Array} salt - ソルト
 * @returns {Promise<Object>} 派生キーと関連情報
 */
const fallbackDeriveKey = (password, salt) => {
  return new Promise(resolve => {
    // 簡易的なキー派生（本番環境では使用しないでください）
    const encoder = new TextEncoder();
    const saltHex = Array.from(salt)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    // パスワードとソルトを結合して繰り返しハッシュ化する簡易実装
    let key = password + saltHex;
    
    // 単純なハッシュ反復（これは例示目的です - 本番環境では使用しないでください）
    for (let i = 0; i < 1000; i++) {
      // 単純な文字列ハッシュ
      let hash = 0;
      for (let j = 0; j < key.length; j++) {
        hash = ((hash << 5) - hash) + key.charCodeAt(j);
        hash |= 0; // 32ビット整数に変換
      }
      key = hash.toString(16);
    }
    
    // 256ビット（32バイト）のキーを生成
    let derivedKeyArray = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      derivedKeyArray[i] = parseInt(key.substr((i * 2) % key.length, 2) || '0', 16);
    }
    
    const keyHex = Array.from(derivedKeyArray)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    resolve({
      derivedKey: null, // Web Crypto APIのオブジェクトはありません
      key: keyHex,
      salt: saltHex,
      isWebCrypto: false
    });
  });
};

/**
 * フォールバック用のXORベース暗号化/復号関数
 * 暗号化と復号で同一のロジックを使用するため、統一関数として実装
 * @param {Uint8Array} data - 処理するデータ
 * @param {Uint8Array} key - 鍵データ
 * @param {Uint8Array} iv - 初期化ベクトル
 * @returns {Uint8Array} 処理結果
 */
const fallbackEncryptDecrypt = (data, key, iv) => {
    const result = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i++) {
      result[i] = data[i] ^ key[i % key.length] ^ iv[i % iv.length];
    }
    return result;
  };

/**
 * 暗号化キーを安全にストレージに保存
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
 * 安全なストレージに保存（IndexedDBプライマリ、バックアプオプション付き）
 * @param {string} key - 保存するキー名
 * @param {any} data - 保存するデータ
 * @returns {Promise<boolean>} 成功した場合はtrue
 */
export const saveToSecureStorage = (key, data) => {
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
 * IndexedDBにデータを保存
 * @param {string} key - 保存するキー名
 * @param {any} data - 保存するデータ
 * @returns {Promise<boolean>} 成功した場合はtrue
 */
const saveToIndexedDB = (key, data) => {
  return new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open('SecureStorage', 2);
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('secureData')) {
          db.createObjectStore('secureData', { keyPath: 'id' });
        }
      };
      
      request.onsuccess = (event) => {
        try {
          const db = event.target.result;
          const transaction = db.transaction(['secureData'], 'readwrite');
          const objectStore = transaction.objectStore('secureData');
          
          const storeRequest = objectStore.put({
            id: key,
            data,
            updatedAt: new Date().toISOString()
          });
          
          storeRequest.onsuccess = () => resolve(true);
          storeRequest.onerror = () => {
            console.warn('IndexedDBへの保存に失敗しました - バックアップストレージを使用します');
            resolve(false);
          };
        } catch (txError) {
          console.warn('IndexedDB transaction error:', txError);
          resolve(false);
        }
      };
      
      request.onerror = () => {
        console.warn('IndexedDBを開くことができませんでした - バックアップストレージを使用します');
        resolve(false);
      };
    } catch (error) {
      console.warn('IndexedDB操作エラー:', error);
      resolve(false);
    }
  });
};

/**
 * セキュアなバックアップストレージを取得（メモリ内）
 * @returns {Object} バックアップストレージオブジェクト
 */
const getSecureBackupStorage = () => {
  // メモリ内のストレージ（ページリロード時に消去されます）
  if (!window._secureBackupStorage) {
    window._secureBackupStorage = {};
  }
  return window._secureBackupStorage;
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
 * IndexedDBからデータを取得
 * @param {string} key - 取得するキー名
 * @returns {Promise<any>} 取得したデータ
 */
const getFromIndexedDB = (key) => {
  return new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open('SecureStorage', 2);
      
      request.onsuccess = (event) => {
        try {
          const db = event.target.result;
          const transaction = db.transaction(['secureData'], 'readonly');
          const objectStore = transaction.objectStore('secureData');
          
          const getRequest = objectStore.get(key);
          
          getRequest.onsuccess = () => {
            if (getRequest.result) {
              resolve(getRequest.result.data);
            } else {
              resolve(null);
            }
          };
          
          getRequest.onerror = () => resolve(null);
        } catch (txError) {
          console.warn('IndexedDB transaction error:', txError);
          resolve(null);
        }
      };
      
      request.onerror = () => resolve(null);
    } catch (error) {
      console.warn('IndexedDB操作エラー:', error);
      resolve(null);
    }
  });
};

/**
 * 暗号化されたマスターキーを取得して復号
 * @param {string} password - パスワード
 * @returns {Promise<string>} 復号されたマスターキー
 */
export const retrieveEncryptionKeySecurely = async (password) => {
    try {
      // 暗号化されたキーデータを取得
      const secureData = await getFromSecureStorage('masterKey');
      
      if (!secureData) {
        return null;
      }
      
      console.log('取得したセキュアデータ:', secureData);
      
      // secureData.saltが存在するか確認
      if (!secureData.salt) {
        throw new Error('暗号化キーのソルトデータが見つかりません');
      }
      
      // 16進数からバイナリデータに変換
      const encryptedKeyBytes = hexToBytes(secureData.encryptedKey);
      const ivBytes = hexToBytes(secureData.iv);
      const saltBytes = hexToBytes(secureData.salt);
      
      // デバッグ情報を追加
      console.debug('暗号化キー(Hex):', secureData.encryptedKey);
      console.debug('IV(Hex):', secureData.iv);
      console.debug('ソルト(Hex):', secureData.salt);
      console.debug('変換後のソルト長:', saltBytes.length);
      
      // アルゴリズムとエンコーディングを確認
    // メタデータを確認
        const algorithm = secureData.algorithm || 'AES-GCM';
        const keyEncoding = secureData.keyEncoding || 'utf8';
        const iterations = secureData.iterations || 100000;
        const hash = secureData.hash || 'SHA-256';
      
      // Web Crypto APIが利用可能であれば使用
      if (algorithm === 'AES-GCM' && window.crypto && window.crypto.subtle) {
        try {
          // パスワードからキーを派生
          const { derivedKey } = await deriveKeyFromPassword(password, saltBytes);
          
          // マスターキーを復号化
          const decryptedBuffer = await window.crypto.subtle.decrypt(
            {
              name: 'AES-GCM',
              iv: ivBytes
            },
            derivedKey,
            encryptedKeyBytes
          );
          
          // バッファを文字列に変換 (エンコーディングを指定)
          return new TextDecoder(keyEncoding).decode(decryptedBuffer);
        } catch (cryptoError) {
          console.warn('Web Crypto APIでの復号に失敗しました:', cryptoError);
          // デバッグ情報
          console.debug('暗号化データ長:', encryptedKeyBytes.length);
          console.debug('IV長:', ivBytes.length);
          console.debug('ソルト長:', saltBytes.length);
        }
      }
      
      // ここにfallbackEncryptDecrypt関数を追加
      const fallbackEncryptDecrypt = (data, key, iv) => {
        const result = new Uint8Array(data.length);
        for (let i = 0; i < data.length; i++) {
          result[i] = data[i] ^ key[i % key.length] ^ iv[i % iv.length];
        }
        return result;
      };
      
      // フォールバック復号（失敗した場合）
      console.warn('フォールバック復号を使用しています');
      
      // パスワードからキーを派生
      const { key } = await deriveKeyFromPassword(password, saltBytes);
      const keyBytes = hexToBytes(key);
      
      console.debug('派生キー(Hex):', key);
      console.debug('派生キーバイト長:', keyBytes.length);
      
      // 統一されたフォールバック関数を使用
      const decryptedBytes = fallbackEncryptDecrypt(encryptedKeyBytes, keyBytes, ivBytes);
      
      // エンコーディングを指定して文字列に変換
      return new TextDecoder(keyEncoding).decode(decryptedBytes);
    } catch (error) {
      console.error('暗号化キーの取得に失敗しました:', error);
      return null;
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
  console.log('生成されたシェア数:', shares.length);
  console.log('生成されたシェアのサンプル:', shares[0]); // 最初のシェアの内容を表示
  
  // 公開リカバリーデータ
  const publicRecoveryData = {
    version: 2,
    createdAt: new Date().toISOString(),
    requiredShares,
    totalShares: totalGuardians,
    algorithm: 'shamir-secret-sharing',
    library: 'custom-implementation'
  };
  console.log('公開リカバリーデータ:', publicRecoveryData);
  
  // バイト配列に変換
  const publicDataBytes = new TextEncoder().encode(
    JSON.stringify(publicRecoveryData)
  );
  
  return {
    shares,
    publicRecoveryData: publicDataBytes
  };
};

// テスト関数
function testSimple() {
    // 基本演算のテスト
    console.log("--- GF(256)基本演算テスト ---");
    console.log("加算: 3 + 7 =", GF256.add(3, 7));
    console.log("乗算: 3 * 7 =", GF256.mul(3, 7));
    console.log("除算: 21 / 7 =", GF256.div(21, 7));
    
    // 逆元テスト
    console.log("\n--- 逆元テスト ---");
    for (let i = 1; i <= 5; i++) {
      const inv = GF256.inverse(i);
      console.log(`${i}の逆元 = ${inv}, 検証: ${i} * ${inv} = ${GF256.mul(i, inv)}`);
    }
    
    // シャミア分散法テスト
    console.log("\n--- シャミア秘密分散テスト ---");
    // シンプルな秘密（'A'のASCIIコード = 65）
    const secret = "A";
    // シェアを作成
    const shares = createShares(secret, 5, 3);
    console.log("作成されたシェア:", shares);
    
    // シェアから秘密を復元
    const recovered = combineShares(shares.slice(0, 3));
    console.log("復元された秘密:", recovered);
    
    return recovered === secret;
  }

  console.log("テスト結果:", testSimple() ? "成功" : "失敗");

  /**
 * ユーザー固有のマスターキーを保存
 * @param {string} principal - ユーザーのプリンシパルID
 * @param {string} masterKey - 保存するマスターキー
 * @returns {boolean} 成功した場合はtrue
 */
export const saveUserMasterKey = (principal, masterKey) => {
  if (!principal) {
    console.error('Cannot save master key: Principal ID is missing');
    return false;
  }
  const keyName = `${principal}_masterEncryptionKey`;
  localStorage.setItem(keyName, masterKey);
  console.log(`Saved master key for user: ${principal.substring(0, 8)}...`);
  return true;
};

/**
 * ユーザー固有のマスターキーを取得
 * @param {string} principal - ユーザーのプリンシパルID
 * @returns {string|null} マスターキーまたはnull
 */
export const getUserMasterKey = (principal) => {
  if (!principal) {
    console.error('Cannot get master key: Principal ID is missing');
    return null;
  }
  const keyName = `${principal}_masterEncryptionKey`;
  const key = localStorage.getItem(keyName);
  
  // 後方互換性: 古い形式のキーを確認
  if (!key && principal) {
    const legacyKey = localStorage.getItem('masterEncryptionKey');
    if (legacyKey) {
      console.log('Found legacy master key, migrating to user-specific format');
      saveUserMasterKey(principal, legacyKey);
      return legacyKey;
    }
  }
  
  return key;
};

/**
 * 特定のユーザーのマスターキーが存在するか確認
 * @param {string} principal - ユーザーのプリンシパルID
 * @returns {boolean} キーが存在する場合はtrue
 */
export const hasUserMasterKey = (principal) => {
  return !!getUserMasterKey(principal);
};