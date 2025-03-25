import { AuthClient } from '@dfinity/auth-client';
import { Actor, HttpAgent } from '@dfinity/agent';
import { idlFactory as secureNotesIDL } from '../declarations/secure_notes.js';
import { 
  generateKeyPair, 
  encryptWithPublicKey,
  generateEncryptionKey,
  decryptWithPrivateKey
} from './crypto';
import { saveUserMasterKey,getUserMasterKey } from './improved-crypto';
import { Principal } from '@dfinity/principal';


// 定数
const NOTES_CANISTER_ID = process.env.REACT_APP_NOTES_CANISTER_ID || 'ppqm6-zyaaa-aaaah-arcpq-cai';
const HOST = process.env.REACT_APP_IC_HOST || 'https://ic0.app';
// 認証クライアントの初期化
let authClient;
let secureNotesActor;

/**
 * 認証クライアントを初期化
 * @returns {Promise<AuthClient>} 初期化された認証クライアント
 */
export const initAuth = async () => {
  if (!authClient) {
    try {
      authClient = await AuthClient.create();
    } catch (error) {
      console.error('Error creating AuthClient:', error);
      throw error;
    }
  }
  return authClient;
};

/**
 * 認証状態を確認
 * @returns {Promise<boolean>} 認証されている場合はtrue
 */
export const isAuthenticated = async () => {
  const client = await initAuth();
  return await client.isAuthenticated();
};

export const initializeNewDevice = async (devicePrivateKey) => {
  try {
    const actor = await getActor();
    const principal = await getCurrentPrincipal();
    
    if (!principal) {
      throw new Error('User principal not found');
    }
    
    // 修正: getProfileではなくcheckInheritanceStatusを使用
    const status = await actor.checkInheritanceStatus(principal);
    
    if (!status.exists) {
      throw new Error('アカウントが見つかりません');
    }
    
    const accessKeyResult = await actor.getAccessKey();
    if (accessKeyResult.err) {
      throw new Error(accessKeyResult.err);
    }
    
    // 秘密鍵で復号
    const masterKey = decryptWithPrivateKey(
      accessKeyResult.ok,
      devicePrivateKey
    );
    
    // マスターキーをローカルに保存
    localStorage.setItem('masterEncryptionKey', masterKey);
    
    return true;
  } catch (error) {
    console.error('Failed to initialize device:', error);
    throw error;
  }
};


/**
 * ユーザーのプロファイルが存在するかチェック
 * @returns {Promise<boolean>} プロファイルが存在する場合はtrue
 */
export const checkProfileExists = async () => {
  try {
    const actor = await getActor();
    if (!actor) return false;
    
    // プリンシパルの取得
    const principal = await getCurrentPrincipal();
    if (!principal) return false;
    
    try {
      // まず直接プロファイルを取得
      const profileResult = await actor.getProfile();
      // エラーがなければプロファイルは存在する
      return !profileResult.err;
    } catch (profileError) {
      // getProfile が失敗した場合、ノート取得を試みる
      try {
        // getNotes がエラーを返さなければプロファイルは存在する
        await actor.getNotes();
        return true;
      } catch (notesError) {
        // エラーメッセージを確認
        if (notesError.message && notesError.message.includes("プロファイルが見つかりません")) {
          return false;
        }
        // その他のエラーはログに記録して偽を返す
        console.error("Error checking profile existence:", notesError);
        return false;
      }
    }
  } catch (error) {
    console.error('Error checking profile:', error);
    return false;
  }
};

export const createProfile = async (deviceName) => {
  try {
    const actor = await getActor();
    const principal = await getCurrentPrincipal();
    
    if (!principal) {
      throw new Error('User principal not found. Please login first.');
    }
    
    // デバイスの公開鍵を生成
    const deviceKeyPair = generateKeyPair();
    const devicePublicKey = deviceKeyPair.publicKey;
    
    // デフォルトのガーディアン数とシェア数
    const totalGuardians = 3;
    const requiredShares = 2;
    
    console.log("Calling createProfileWithDevice with params:", {
      totalGuardians,
      requiredShares,
      deviceName,
      devicePublicKeyLength: devicePublicKey ? devicePublicKey.length : 0
    });
    
    // 新しいインターフェースを使用する
    const result = await actor.createProfileWithDevice(
      totalGuardians,
      requiredShares,
      deviceName,
      devicePublicKey
    );
    
    if (result.err) {
      throw new Error(`Failed to create profile: ${result.err}`);
    }
    
    // デバイスIDを保存
    const deviceId = result.ok;
    localStorage.setItem('deviceId', deviceId);
    localStorage.setItem('devicePrivateKey', deviceKeyPair.privateKey);
    
    // ユーザー固有のマスターキーを生成・保存
    const masterKey = generateEncryptionKey();
    saveUserMasterKey(principal.toString(), masterKey);
    console.log('Created profile with new master key for:', principal.toString().substring(0, 8) + '...');
    
    return true;
  } catch (error) {
    console.error('Error creating profile:', error);
    throw error;
  }
};


/**
 * ログイン処理
 * @returns {Promise<Object>} ログイン結果と初期情報
 */
export const login = async () => {
  const client = await initAuth();
  
  return new Promise((resolve, reject) => {
    client.login({
      identityProvider: 'https://identity.ic0.app',
      onSuccess: async () => {
        try {
          const identity = client.getIdentity();
          const principal = identity.getPrincipal();
          const principalStr = principal.toString();
          const agent = new HttpAgent({ identity, host: HOST });
          
          if (HOST.includes('localhost') || HOST.includes('127.0.0.1')) {
            await agent.fetchRootKey();
          }
          
          // アクターの作成
          secureNotesActor = Actor.createActor(secureNotesIDL, {
            agent,
            canisterId: NOTES_CANISTER_ID,
          });
          
          // デバイスキーペアの生成
          const deviceKeyPair = generateKeyPair();
          
          // プロファイルが存在するかチェック
          let isNewUser = false;
          
          const profileExists = await checkProfileExists();
          
          if (!profileExists) {
            // 新規ユーザー: プロファイル作成
            isNewUser = true;
            
            try {
              // createProfile関数を正しく呼び出す
              await createProfile('Initial Device');
            } catch (createError) {
              console.warn('Failed to auto-create profile:', createError);
              // プロファイル作成失敗はユーザーに通知するが、ログインは続行
            }
          } else {
            
            // 既存ユーザー: デバイスキーを保存
            localStorage.setItem('devicePrivateKey', deviceKeyPair.privateKey);
            const legacyMasterKey = localStorage.getItem('masterEncryptionKey');
            if (legacyMasterKey && !getUserMasterKey(principalStr)) {
              // 古い形式のマスターキーを新しい形式に移行
              saveUserMasterKey(principalStr, legacyMasterKey);
              console.log('Migrated legacy master key to user-specific format');
            }
            
            // マスターキーがなければ生成
            if (!localStorage.getItem('masterEncryptionKey')) {
              const masterKey = generateEncryptionKey();
              localStorage.setItem('masterEncryptionKey', masterKey);
            }
          }
          
          // 解決時にはプリンシパル文字列を返す
          resolve({ 
            actor: secureNotesActor, 
            identity,
            principal: principalStr, // 文字列として返す
            deviceKeyPair,
            isNewUser
          });
          
        } catch (error) {
          console.error('Error during login process:', error);
          reject(error);
        }
      },
      onError: (error) => {
        console.error('Login error:', error);
        reject(new Error(`Login failed: ${error.message}`));
      },
    });
  });
};

/**
 * ログアウト処理
 */
export const logout = async () => {
  const client = await initAuth();
  await client.logout();
  secureNotesActor = null;

};

/**
 * アクターを取得
 * @returns {Promise<Actor>} 初期化されたアクター
 */
export const getActor = async () => {
  if (!secureNotesActor) {
    const client = await initAuth();
    if (await client.isAuthenticated()) {
      const identity = client.getIdentity();
      const agent = new HttpAgent({ identity, host: HOST });
      
      if (HOST.includes('localhost') || HOST.includes('127.0.0.1')) {
        await agent.fetchRootKey();
      }
      
      secureNotesActor = Actor.createActor(secureNotesIDL, {
        agent,
        canisterId: NOTES_CANISTER_ID,
      });
    } else {
      return null; // 認証されていない場合はnullを返す
    }
  }
  return secureNotesActor;
};

/**
 * 現在のプリンシパルを取得
 * @returns {Promise<Principal|null>} プリンシパルまたはnull
 */
export const getCurrentPrincipal = async () => {
  const client = await initAuth();
  if (await client.isAuthenticated()) {
    const identity = client.getIdentity();
    return identity.getPrincipal();
  }
  return null;
};

/**
 * ユーザープロファイルを取得
 * @returns {Promise<Object>} プロファイル情報またはエラー
 */
export const getProfile = async () => {
  try {
    const actor = await getActor();
    if (!actor) {
      return { err: 'アクターが初期化されていません' };
    }
    
    // 現在のプリンシパルを取得
    const principal = await getCurrentPrincipal();
    if (!principal) {
      return { err: 'プリンシパルが取得できません' };
    }
    
    // プロファイルの存在確認
    try {
      // 直接プロファイルを取得
      const profileResult = await actor.getProfile();
      
      if (profileResult.err) {
        return { err: profileResult.err };
      }
      
      // デバイス情報も取得（オプション）
      let devices = [];
      try {
        const devicesResult = await actor.getDevices();
        if (!devicesResult.err) {
          devices = devicesResult.ok || [];
        }
      } catch (deviceErr) {
        console.warn('デバイス情報取得エラー:', deviceErr);
      }
      
      const profile = profileResult.ok;
      
      return {
        ok: {
          principal: principal.toString(),
          totalGuardians: profile.totalGuardians,
          requiredShares: profile.requiredShares,
          recoveryEnabled: profile.recoveryEnabled,
          devices: devices
        }
      };
    } catch (error) {
      // ノート取得を試みる - プロファイルは存在するがエラーになる場合
      try {
        await actor.getNotes();
        // ノートが取得できればプロファイルは存在する
        return {
          ok: {
            principal: principal.toString(),
            exists: true,
            devices: []
          }
        };
      } catch (notesError) {
        if (notesError.message && notesError.message.includes("プロファイルが見つかりません")) {
          return { err: 'プロファイルが見つかりません' };
        }
        throw notesError;
      }
    }
  } catch (error) {
    console.error('プロファイル取得エラー:', error);
    return { err: error.message || 'プロファイル取得に失敗しました' };
  }
};
