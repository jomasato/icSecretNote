import React, { createContext, useContext, useState, useEffect } from 'react';
import { getNotes, createNote, updateNote, deleteNote } from '../services/api';
import { useAuth } from './AuthContext';
import { checkProfileExists, createProfile } from '../services/auth';
import { generateKeyPair } from '../services/crypto';
import { listenForDecryptionErrors, setupDecryptionErrorDetection } from '../services/crypto';


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

  // 追加: 復号エラー検出を初期化
  useEffect(() => {
    console.log("Initializing decryption error detection");
    setupDecryptionErrorDetection();
    
    // 復号エラーのイベントリスナーを設定
    const cleanupListener = listenForDecryptionErrors((errorDetails) => {
      console.warn("Decryption error detected in NotesContext:", errorDetails);
      setNeedDeviceSetup(true);
      setError(`復号エラーが検出されました (${errorDetails.errors}/${errorDetails.attempts}). デバイスの設定が必要です。`);
    });
    
    // クリーンアップ関数
    return () => {
      cleanupListener();
      // グローバルタイマーをクリーンアップ
      if (window._cryptoState && window._cryptoState.resetTimer) {
        clearInterval(window._cryptoState.resetTimer);
      }
    };
  }, []);


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

      // マスターキー存在チェック
      const masterKey = localStorage.getItem('masterEncryptionKey');
      if (!masterKey && fetchedNotes.length > 0) {
        console.warn("Master encryption key not found but notes exist!");
        setNeedDeviceSetup(true);
      }
      
      console.log("Fetching notes...");
      const fetchedNotes = await getNotes();


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