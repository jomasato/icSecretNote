import { AuthClient } from '@dfinity/auth-client';
import { Actor, HttpAgent } from '@dfinity/agent';
import { idlFactory as secureNotesIDL } from '../declarations/secure_notes.js';
import { initCrypto, generateKeyPair, encryptWithPublicKey } from './crypto';

// Constants
const II_CANISTER_ID = process.env.REACT_APP_II_CANISTER_ID || 'rdmx6-jaaaa-aaaaa-aaadq-cai';
const NOTES_CANISTER_ID = process.env.REACT_APP_NOTES_CANISTER_ID || 'your-canister-id';
const HOST = process.env.REACT_APP_IC_HOST || 'https://ic0.app';

// Initialize the Auth Client
let authClient;
let secureNotesActor;
let cryptoInitialized = false;

// Try to initialize crypto module
export const ensureCryptoInit = async () => {
  if (!cryptoInitialized) {
    try {
      cryptoInitialized = initCrypto();
      if (!cryptoInitialized) {
        console.error('Failed to initialize crypto module');
      }
    } catch (error) {
      console.error('Error initializing crypto module:', error);
    }
  }
  return cryptoInitialized;
};

export const initAuth = async () => {
  // Make sure crypto is initialized
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
  
  // Make sure crypto is initialized before generating keys
  if (!await ensureCryptoInit()) {
    throw new Error('Crypto module initialization failed');
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
      identityProvider: `${HOST}/?canisterId=${II_CANISTER_ID}`,
      onSuccess: async () => {
        const identity = client.getIdentity();
        const agent = new HttpAgent({ identity, host: HOST });
        
        // In development, we need to fetch the root key
        if (process.env.NODE_ENV !== 'production') {
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
      
      if (process.env.NODE_ENV !== 'production') {
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