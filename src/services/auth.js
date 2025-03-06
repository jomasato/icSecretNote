import { AuthClient } from '@dfinity/auth-client';
import { Actor, HttpAgent } from '@dfinity/agent';
import { idlFactory as secureNotesIDL } from '../declarations/secure_notes.js';
import { generateKeyPair, encryptWithPublicKey } from './crypto';

// Constants
const II_CANISTER_ID = process.env.REACT_APP_II_CANISTER_ID || 'rdmx6-jaaaa-aaaaa-aaadq-cai';
const NOTES_CANISTER_ID = process.env.REACT_APP_NOTES_CANISTER_ID || 'l6ye3-oqaaa-aaaao-qj52a-cai';
const HOST = process.env.REACT_APP_IC_HOST || 'https://ic0.app';  // 本番環境のデフォルトを修正

// Initialize the Auth Client
let authClient;
let secureNotesActor;

// crypto.jsからinitCryptoが削除されたため、この関数も調整する
export const ensureCryptoInit = async () => {
  try {
    // 直接trueを返す（crypto.jsで自動テストが行われるようになった）
    return true;
  } catch (error) {
    console.error('Error in crypto module:', error);
    return false;
  }
};

export const initAuth = async () => {
  // クリプト初期化チェック - 念のため残しておく
  await ensureCryptoInit();
  
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

export const isAuthenticated = async () => {
  const client = await initAuth();
  return await client.isAuthenticated();
};

export const login = async () => {
  const client = await initAuth();
  
  // クリプトモジュールの初期化チェック - 機能的には不要になったが、ログのために残す
  if (!await ensureCryptoInit()) {
    console.warn('Crypto module initialization check failed, but continuing anyway');
  }
  
  // Generate device key pair for secure communication
  let deviceKeyPair;
  try {
    deviceKeyPair = generateKeyPair();
    localStorage.setItem('devicePrivateKey', deviceKeyPair.privateKey);
  } catch (error) {
    console.error('Error generating key pair:', error);
    throw new Error(`Key pair generation failed: ${error.message}`);
  }
  
  return new Promise((resolve, reject) => {
    client.login({
      // 本番環境用のII認証URLに修正
      identityProvider: 'https://identity.ic0.app',
      onSuccess: async () => {
        const identity = client.getIdentity();
        const agent = new HttpAgent({ identity, host: HOST });
        
        // 本番環境ではfetchRootKeyは必要ない（メインネットではルートキーは信頼される）
        if (HOST.includes('localhost') || HOST.includes('127.0.0.1')) {
          await agent.fetchRootKey();
        }
        
        try {
          secureNotesActor = Actor.createActor(secureNotesIDL, {
            agent,
            canisterId: NOTES_CANISTER_ID,
          });
        } catch (error) {
          console.error('Error creating actor:', error);
          reject(new Error(`Actor creation failed: ${error.message}`));
          return;
        }
        
        // Check if user has a profile, if not create one
        try {
          const profile = await secureNotesActor.getProfile();
          
          // If we get here, the user has a profile
          resolve({ actor: secureNotesActor, identity, deviceKeyPair });
        } catch (error) {
          console.log('Profile not found, creating new profile');
          // New user, create profile with device
          try {
            // Assume default 3 of 5 for guardians and required shares
            const deviceName = 'Initial Device';
            
            // publicKeyは既に文字列なので変換不要
            const result = await secureNotesActor.createProfileWithDevice(
              5, // totalGuardians
              3, // requiredShares
              deviceName,
              deviceKeyPair.publicKey
            );
            
            if (result.ok) {
              resolve({ actor: secureNotesActor, identity, deviceKeyPair });
            } else {
              reject(new Error(`Failed to create profile: ${result.err}`));
            }
          } catch (createError) {
            console.error('Error creating profile:', createError);
            reject(new Error(`Error creating profile: ${createError.message}`));
          }
        }
      },
      onError: (error) => {
        console.error('Login error:', error);
        reject(new Error(`Login failed: ${error.message}`));
      },
    });
  });
};

export const logout = async () => {
  const client = await initAuth();
  await client.logout();
  secureNotesActor = null;
  // Clear session storage
  localStorage.removeItem('devicePrivateKey');
};

export const getActor = async () => {
  if (!secureNotesActor) {
    const client = await initAuth();
    if (await client.isAuthenticated()) {
      const identity = client.getIdentity();
      const agent = new HttpAgent({ identity, host: HOST });
      
      // 本番環境ではfetchRootKeyは必要ない
      if (HOST.includes('localhost') || HOST.includes('127.0.0.1')) {
        await agent.fetchRootKey();
      }
      
      secureNotesActor = Actor.createActor(secureNotesIDL, {
        agent,
        canisterId: NOTES_CANISTER_ID,
      });
    }
  }
  return secureNotesActor;
};

export const getCurrentPrincipal = async () => {
  const client = await initAuth();
  if (await client.isAuthenticated()) {
    const identity = client.getIdentity();
    return identity.getPrincipal();
  }
  return null;
};