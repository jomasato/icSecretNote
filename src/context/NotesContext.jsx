import React, { createContext, useContext, useState, useEffect } from 'react';
import { getNotes, createNote, updateNote, deleteNote } from '../services/api';
import { useAuth } from './AuthContext';
import { checkProfileExists, createProfile } from '../services/auth';
import { generateKeyPair } from '../services/crypto';


const NotesContext = createContext();

export function useNotes() {
  return useContext(NotesContext);
}

export function NotesProvider({ children }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [noProfile, setNoProfile] = useState(false);
  const { user } = useAuth();
  const [needDeviceSetup, setNeedDeviceSetup] = useState(false);


  useEffect(() => {
    console.log("NotesProvider useEffect triggered, user:", user);
    if (user) {
      fetchNotes();
    } else {
      console.log("No user, clearing notes state");
      setNotes([]);
      setLoading(false);
      setNoProfile(false);
    }
  }, [user]);

  async function fetchNotes() {
    console.log("fetchNotes called");
    setLoading(true);
    setError(null);
    setNoProfile(false);
    
    try {
      // プロファイルの存在を確認
      console.log("Checking if profile exists...");
      const profileExists = await checkProfileExists();
      console.log("Profile exists:", profileExists);
      
      if (!profileExists) {
        console.log("No profile found, setting noProfile to true");
        setNoProfile(true);
        setError('プロファイルが見つかりません。プロファイルを作成してください。');
        setLoading(false);
        return;
      }

    // マスターキーの有効性をチェック - これを追加
    const isKeyValid = await checkMasterKeyValid();
    if (!isKeyValid) {
      console.log("Master key is invalid or missing");
      setError('復号化キーが無効または見つかりません。デバイスのセットアップが必要です。');
      setLoading(false);
      return;
    }
      
      console.log("Fetching notes...");
      const fetchedNotes = await getNotes();


      // ノートの復号失敗を検出
      const decryptionFailCount = fetchedNotes.filter(note => {
        // タイトルまたは内容が復号失敗を示すパターンと一致するか確認
        return (
          note.title === 'Unable to decrypt' || 
          note.content === 'Unable to decrypt this note' ||
          note.title?.includes('decrypt') || 
          note.content?.includes('decrypt') ||
          note.title === 'Error' ||
          note.content?.includes('error')
        );
      }).length;
      
      console.log(`Notes with decryption issues: ${decryptionFailCount}/${fetchedNotes.length}`);
      
      // 一部のノートでも復号失敗があればフラグを立てる
      // (少なくとも1つ以上のノートが復号失敗している場合)
      if (fetchedNotes.length > 0 && decryptionFailCount > 0) {
        console.log("Decryption issues detected, needDeviceSetup = true");
        setNeedDeviceSetup(true);
      } else {
        console.log("No decryption issues detected, needDeviceSetup = false");
        setNeedDeviceSetup(false);
      }
      console.log("Notes fetched:", fetchedNotes);
      setNotes(fetchedNotes);
    } catch (err) {
      console.error('Failed to fetch notes:', err);
      
      // プロファイルに関するエラーの特別処理
      if (err.message === "プロファイルが見つかりません") {
        console.log("Profile not found error detected");
        setNoProfile(true);
        setError('プロファイルが見つかりません。プロファイルを作成してください。');
      } else {
        setError('ノートの読み込みに失敗しました: ' + err.message);
      }
    } finally {
      console.log("Setting loading to false");
      setLoading(false);
    }
  }

  async function setupProfile() {
    console.log("setupProfile called");
    setLoading(true);
    try {
      // デバイスのキーペアを生成
      console.log("Generating key pair...");
      const deviceKeyPair = await generateKeyPair();
      
      // プロファイルを作成
      console.log("Creating profile...");
      await createProfile('Initial Device', deviceKeyPair);
      
      // プロファイル作成後にノートを再取得
      console.log("Profile created successfully");
      setNoProfile(false);
      
      // 少し待機して再取得（非同期処理の完了を待つ）
      setTimeout(async () => {
        console.log("Fetching notes after profile creation");
        await fetchNotes();
      }, 1000);
      
      return { success: true };
    } catch (err) {
      console.error('Failed to create profile:', err);
      setError('プロファイルの作成に失敗しました: ' + err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }

  // マスターキーのチェック関数
  async function checkMasterKeyValid() {
    console.log("Checking if master key is valid");
    
    try {
      // localStorage からマスターキーを取得
      const masterKey = localStorage.getItem('masterEncryptionKey');
      
      if (!masterKey) {
        console.log("No master key found");
        setNeedDeviceSetup(true);
        return false;
      }
      
      // masterKeyの形式を確認（単純な有効性チェック）
      if (typeof masterKey !== 'string' || masterKey.length < 16) {
        console.log("Master key is invalid format");
        setNeedDeviceSetup(true);
        return false;
      }
      
      // 復号テストは実際のデータに対して行われるのでここでは省略
      
      console.log("Master key format is valid");
      return true;
    } catch (err) {
      console.error("Error checking master key:", err);
      setNeedDeviceSetup(true);
      return false;
    }
  }

  async function addNote(title, content) {
    console.log("addNote called", { title });
    setLoading(true);
    setError(null);
    try {
      // プロファイルの存在確認
      if (noProfile) {
        console.log("Cannot add note: no profile");
        return { success: false, error: 'プロファイルが見つかりません。プロファイルを作成してください。' };
      }
      
      console.log("Creating note...");
      const noteId = await createNote(title, content);
      console.log("Note created with ID:", noteId);
      
      // 新しいノートをローカル状態に追加
      const newNote = {
        id: noteId,
        title,
        content,
        created: new Date(),
        updated: new Date()
      };
      
      setNotes(prevNotes => [...prevNotes, newNote]);
      return { success: true, noteId };
    } catch (err) {
      console.error('Failed to add note:', err);
      setError('ノートの追加に失敗しました: ' + err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }

  async function editNote(id, title, content) {
    console.log("editNote called", { id, title });
    setLoading(true);
    setError(null);
    try {
      await updateNote(id, title, content);
      
      // ノートをローカル状態で更新
      const updatedNotes = notes.map(note => 
        note.id === id 
          ? { ...note, title, content, updated: new Date() } 
          : note
      );
      
      setNotes(updatedNotes);
      return { success: true };
    } catch (err) {
      console.error(`Failed to update note ${id}:`, err);
      setError('ノートの更新に失敗しました: ' + err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }

  async function removeNote(id) {
    console.log("removeNote called", { id });
    setLoading(true);
    setError(null);
    try {
      await deleteNote(id);
      
      // ノートをローカル状態から削除
      const updatedNotes = notes.filter(note => note.id !== id);
      setNotes(updatedNotes);
      return { success: true };
    } catch (err) {
      console.error(`Failed to delete note ${id}:`, err);
      setError('ノートの削除に失敗しました: ' + err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }

  // コンテキスト値
  const value = {
    notes,
    loading,
    error,
    noProfile,
    needDeviceSetup,
    refreshNotes: fetchNotes,
    setupProfile,
    addNote,
    editNote,
    removeNote
  };

  return (
    <NotesContext.Provider value={value}>
      {children}
    </NotesContext.Provider>
  );
}