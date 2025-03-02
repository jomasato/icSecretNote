import { getActor } from './auth';
import { 
  stringToBlob, 
  blobToString, 
  encryptWithKey, 
  decryptWithKey, 
  encryptWithPublicKey, 
  decryptWithPrivateKey,
  generateRecoveryData
} from './crypto';

// Notes API
export const getNotes = async () => {
  try {
    const actor = await getActor();
    const result = await actor.getNotes();
    
    // Get device private key from local storage
    const devicePrivateKey = localStorage.getItem('devicePrivateKey');
    if (!devicePrivateKey) {
      throw new Error('Device private key not found');
    }
    
    // Decrypt notes using device private key
    return result.map(note => {
      try {
        const title = decryptWithPrivateKey(note.title, devicePrivateKey);
        const content = decryptWithPrivateKey(note.content, devicePrivateKey);
        
        return {
          id: note.id,
          title,
          content,
          created: new Date(Number(note.created) / 1000000),
          updated: new Date(Number(note.updated) / 1000000)
        };
      } catch (error) {
        console.error(`Failed to decrypt note ${note.id}:`, error);
        return {
          id: note.id,
          title: 'Unable to decrypt',
          content: 'Unable to decrypt this note',
          created: new Date(Number(note.created) / 1000000),
          updated: new Date(Number(note.updated) / 1000000)
        };
      }
    });
  } catch (error) {
    console.error('Failed to get notes:', error);
    throw error;
  }
};

export const getNote = async (id) => {
  try {
    const actor = await getActor();
    const result = await actor.getNote(id);
    
    if (result.err) {
      throw new Error(result.err);
    }
    
    const note = result.ok;
    
    // Get device private key from local storage
    const devicePrivateKey = localStorage.getItem('devicePrivateKey');
    if (!devicePrivateKey) {
      throw new Error('Device private key not found');
    }
    
    // Decrypt the note
    const title = decryptWithPrivateKey(note.title, devicePrivateKey);
    const content = decryptWithPrivateKey(note.content, devicePrivateKey);
    
    return {
      id: note.id,
      title,
      content,
      created: new Date(Number(note.created) / 1000000),
      updated: new Date(Number(note.updated) / 1000000)
    };
  } catch (error) {
    console.error(`Failed to get note ${id}:`, error);
    throw error;
  }
};

export const createNote = async (title, content) => {
  try {
    const actor = await getActor();
    
    // Get device private key from local storage
    const devicePrivateKey = localStorage.getItem('devicePrivateKey');
    if (!devicePrivateKey) {
      throw new Error('Device private key not found');
    }
    
    // Get user profile to get the device public key
    const profileResult = await actor.getProfile();
    if (profileResult.err) {
      throw new Error(profileResult.err);
    }
    
    const profile = profileResult.ok;
    const deviceInfo = profile.devices[0]; // Use the first device
    
    // Encrypt the note with the device's public key
    const encryptedTitle = encryptWithPublicKey(title, deviceInfo.publicKey);
    const encryptedContent = encryptWithPublicKey(content, deviceInfo.publicKey);
    
    // Generate a unique ID for the note
    const noteId = `note-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    
    // Save the encrypted note
    const result = await actor.saveNote(noteId, encryptedTitle, encryptedContent);
    
    if (result.err) {
      throw new Error(result.err);
    }
    
    return result.ok;
  } catch (error) {
    console.error('Failed to create note:', error);
    throw error;
  }
};

export const updateNote = async (id, title, content) => {
  try {
    const actor = await getActor();
    
    // Get device private key from local storage
    const devicePrivateKey = localStorage.getItem('devicePrivateKey');
    if (!devicePrivateKey) {
      throw new Error('Device private key not found');
    }
    
    // Get user profile to get the device public key
    const profileResult = await actor.getProfile();
    if (profileResult.err) {
      throw new Error(profileResult.err);
    }
    
    const profile = profileResult.ok;
    const deviceInfo = profile.devices[0]; // Use the first device
    
    // Encrypt the note with the device's public key
    const encryptedTitle = encryptWithPublicKey(title, deviceInfo.publicKey);
    const encryptedContent = encryptWithPublicKey(content, deviceInfo.publicKey);
    
    // Update the encrypted note
    const result = await actor.updateNote(id, encryptedTitle, encryptedContent);
    
    if (result.err) {
      throw new Error(result.err);
    }
    
    return true;
  } catch (error) {
    console.error(`Failed to update note ${id}:`, error);
    throw error;
  }
};

export const deleteNote = async (id) => {
  try {
    const actor = await getActor();
    const result = await actor.deleteNote(id);
    
    if (result.err) {
      throw new Error(result.err);
    }
    
    return true;
  } catch (error) {
    console.error(`Failed to delete note ${id}:`, error);
    throw error;
  }
};

// Guardian API
export const getGuardians = async () => {
  try {
    const actor = await getActor();
    const result = await actor.getMyGuardians();
    
    return result.map(([principal, approved]) => ({
      principal: principal.toString(),
      approved
    }));
  } catch (error) {
    console.error('Failed to get guardians:', error);
    throw error;
  }
};

export const setupRecovery = async (totalGuardians, requiredShares) => {
  try {
    const actor = await getActor();
    
    // Generate a master encryption key
    const masterKey = localStorage.getItem('masterEncryptionKey');
    
    // Generate recovery data (shares & public data)
    const recoveryData = generateRecoveryData(masterKey, totalGuardians, requiredShares);
    
    // Save public recovery data to the canister
    const result = await actor.setPublicRecoveryData(recoveryData.publicRecoveryData);
    
    if (result.err) {
      throw new Error(result.err);
    }
    
    return {
      shares: recoveryData.shares
    };
  } catch (error) {
    console.error('Failed to setup recovery:', error);
    throw error;
  }
};

export const addGuardian = async (guardianPrincipal, share) => {
  try {
    const actor = await getActor();
    
    // Get user profile to get the guardian's public key
    // In a real app, you would have a separate API to get the guardian's public key
    // For this demo, we'll simulate it
    
    // Encrypt the share for the guardian
    const encryptedShare = stringToBlob(JSON.stringify({
      share: share.value,
      encryptedAt: new Date().toISOString()
    }));
    
    // Add the guardian with the encrypted share
    const result = await actor.manageGuardian(
      guardianPrincipal,
      { Add: null },
      encryptedShare,
      share.id
    );
    
    if (result.err) {
      throw new Error(result.err);
    }
    
    return true;
  } catch (error) {
    console.error('Failed to add guardian:', error);
    throw error;
  }
};

export const removeGuardian = async (guardianPrincipal) => {
  try {
    const actor = await getActor();
    
    const result = await actor.manageGuardian(
      guardianPrincipal,
      { Remove: null },
      null,
      null
    );
    
    if (result.err) {
      throw new Error(result.err);
    }
    
    return true;
  } catch (error) {
    console.error('Failed to remove guardian:', error);
    throw error;
  }
};

// Recovery API
export const initiateRecovery = async (userPrincipal) => {
  try {
    const actor = await getActor();
    const result = await actor.initiateRecovery(userPrincipal);
    
    if (result.err) {
      throw new Error(result.err);
    }
    
    return true;
  } catch (error) {
    console.error('Failed to initiate recovery:', error);
    throw error;
  }
};

export const approveRecovery = async (userPrincipal) => {
  try {
    const actor = await getActor();
    const result = await actor.approveRecovery(userPrincipal);
    
    if (result.err) {
      throw new Error(result.err);
    }
    
    return true;
  } catch (error) {
    console.error('Failed to approve recovery:', error);
    throw error;
  }
};

export const submitRecoveryShare = async (userPrincipal, shareId) => {
  try {
    const actor = await getActor();
    const result = await actor.submitRecoveryShare(userPrincipal, shareId);
    
    if (result.err) {
      throw new Error(result.err);
    }
    
    return true;
  } catch (error) {
    console.error('Failed to submit recovery share:', error);
    throw error;
  }
};

export const getRecoveryStatus = async (userPrincipal) => {
  try {
    const actor = await getActor();
    const result = await actor.getRecoveryStatus(userPrincipal);
    
    if (result.err) {
      throw new Error(result.err);
    }
    
    const [session, profile] = result.ok;
    
    return {
      session: {
        userPrincipal: session.userPrincipal.toString(),
        requestTime: new Date(Number(session.requestTime) / 1000000),
        approvedGuardians: session.approvedGuardians.map(p => p.toString()),
        tempAccessPrincipal: session.tempAccessPrincipal ? session.tempAccessPrincipal[0].toString() : null,
        status: Object.keys(session.status)[0],
        collectedShares: session.collectedShares
      },
      profile: {
        principal: profile.principal.toString(),
        totalGuardians: profile.totalGuardians,
        requiredShares: profile.requiredShares,
        recoveryEnabled: profile.recoveryEnabled,
        publicRecoveryData: profile.publicRecoveryData ? JSON.parse(blobToString(profile.publicRecoveryData[0])) : null,
        devices: profile.devices.map(device => ({
          id: device.id,
          name: device.name,
          registrationTime: new Date(Number(device.registrationTime) / 1000000),
          lastAccessTime: new Date(Number(device.lastAccessTime) / 1000000)
        }))
      }
    };
  } catch (error) {
    console.error('Failed to get recovery status:', error);
    throw error;
  }
};

// Device API
export const getDevices = async () => {
  try {
    const actor = await getActor();
    const result = await actor.getDevices();
    
    if (result.err) {
      throw new Error(result.err);
    }
    
    return result.ok.map(device => ({
      id: device.id,
      name: device.name,
      registrationTime: new Date(Number(device.registrationTime) / 1000000),
      lastAccessTime: new Date(Number(device.lastAccessTime) / 1000000)
    }));
  } catch (error) {
    console.error('Failed to get devices:', error);
    throw error;
  }
};

export const addDevice = async (deviceName) => {
  try {
    const actor = await getActor();
    
    // Generate a new key pair for the device
    const deviceKeyPair = {
      privateKey: localStorage.getItem('devicePrivateKey'),
      publicKey: stringToBlob('dummyPublicKey') // In a real app, use proper public key
    };
    
    // Encrypt the master key for the new device
    const masterKey = localStorage.getItem('masterEncryptionKey');
    const encryptedDeviceData = encryptWithPublicKey(masterKey, deviceKeyPair.publicKey);
    
    const result = await actor.addDevice(deviceName, deviceKeyPair.publicKey, encryptedDeviceData);
    
    if (result.err) {
      throw new Error(result.err);
    }
    
    return result.ok;
  } catch (error) {
    console.error('Failed to add device:', error);
    throw error;
  }
};

export const removeDevice = async (deviceId) => {
  try {
    const actor = await getActor();
    const result = await actor.removeDevice(deviceId);
    
    if (result.err) {
      throw new Error(result.err);
    }
    
    return true;
  } catch (error) {
    console.error('Failed to remove device:', error);
    throw error;
  }
};