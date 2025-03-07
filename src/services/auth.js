//src/services/auth.js

import { AuthClient } from '@dfinity/auth-client';
import { Actor, HttpAgent } from '@dfinity/agent';
import { idlFactory as secureNotesIDL } from '../declarations/secure_notes.js';
import { 
  generateKeyPair, 
  encryptWithPublicKey,
  generateEncryptionKey
} from './crypto';

// 定数
const II_CANISTER_ID = process.env.REACT_APP_II_CANISTER_ID || 'rdmx6-jaaaa-aaaaa-aaadq-cai';
const NOTES_CANISTER_ID = process.env.REACT_APP_NOTES_CANISTER_ID || 'l6ye3-oqaaa-aaaao-qj52a-cai';
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

/**
 * ユーザーのプロファイルが存在するかチェック
 * @returns {Promise<boolean>} プロファイルが存在する場合はtrue
 */
export const checkProfileExists = async () => {
  try {
    const actor = await getActor();
    if (!actor) return false;
    
    const result = await actor.getProfile();
    return !!result.ok;
  } catch (error) {
    // "プロファイルが見つかりません" エラーの場合は存在しない
    if (error.message === "プロファイルが見つかりません") {
      return false;
    }
    // その他のエラーはコンソールに出力し、念のため存在しないとする
    console.error('Error checking profile:', error);
    return false;
  }
};

/**
 * プロファイルを作成
 * @param {string} deviceName - デバイス名
 * @param {Object} deviceKeyPair - デバイスのキーペア
 * @returns {Promise<boolean>} 成功した場合はtrue
 */
export const createProfile = async (deviceName, deviceKeyPair) => {
  try {
    const actor = await getActor();
    
    // デフォルト値で新しいプロファイルを作成
    const result = await actor.createProfileWithDevice(
      5, // totalGuardians
      3, // requiredShares
      deviceName || 'Initial Device',
      deviceKeyPair.publicKey
    );
    
    if (result.err) {
      throw new Error(`Failed to create profile: ${result.err}`);
    }
    
    // デバイスのプライベートキーをローカルに保存
    localStorage.setItem('devicePrivateKey', deviceKeyPair.privateKey);
    
    // マスターキーを生成して保存
    const masterKey = generateEncryptionKey();
    localStorage.setItem('masterEncryptionKey', masterKey);
    
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
          const principal = identity.getPrincipal().toString();
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
          const deviceKeyPair = await generateKeyPair();
          
          // プロファイルが存在するかチェック
          let isNewUser = false;
          
          try {
            // プロファイルの確認
            const profileResult = await secureNotesActor.getProfile();
            
            if (profileResult.err) {
              throw new Error(profileResult.err);
            }
            
            // 既存ユーザー: デバイスキーを保存
            localStorage.setItem('devicePrivateKey', deviceKeyPair.privateKey);
            console.log('Existing user, profile found');
            
            // マスターキーがなければ生成（通常はあるはず）
            if (!localStorage.getItem('masterEncryptionKey')) {
              const masterKey = generateEncryptionKey();
              localStorage.setItem('masterEncryptionKey', masterKey);
            }
            
          } catch (profileError) {
            // エラーメッセージを確認
            if (profileError.message === "プロファイルが見つかりません") {
              // 新規ユーザー: プロファイル作成
              console.log('Profile not found, creating new profile');
              isNewUser = true;
              
              // プロファイル作成
              await createProfile('Initial Device', deviceKeyPair);
            } else {
              // その他のエラー
              console.error('Error retrieving profile:', profileError);
              reject(new Error(`Error retrieving profile: ${profileError.message}`));
              return;
            }
          }
          
          resolve({ 
            actor: secureNotesActor, 
            identity,
            principal,
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
  // ローカルストレージをクリア
  localStorage.removeItem('devicePrivateKey');
  localStorage.removeItem('masterEncryptionKey');
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