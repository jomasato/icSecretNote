import React, { createContext, useContext, useState, useEffect } from 'react';
import { getNotes, createNote, updateNote, deleteNote } from '../services/api';
import { useAuth } from './AuthContext';
import { checkProfileExists, createProfile, generateKeyPair } from '../services/auth';

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

  useEffect(() => {
    if (user) {
      fetchNotes();
    } else {
      setNotes([]);
      setLoading(false);
      setNoProfile(false);
    }
  }, [user]);

  async function fetchNotes() {
    setLoading(true);
    setError(null);
    setNoProfile(false);
    
    try {
      // プロファイルの存在を確認
      const profileExists = await checkProfileExists();
      
      if (!profileExists) {
        setNoProfile(true);
        setError('プロファイルが見つかりません。プロファイルを作成してください。');
        setLoading(false);
        return;
      }
      
      const fetchedNotes = await getNotes();
      setNotes(fetchedNotes);
    } catch (err) {
      console.error('Failed to fetch notes:', err);
      
      // プロファイルに関するエラーの特別処理
      if (err.message === "プロファイルが見つかりません") {
        setNoProfile(true);
        setError('プロファイルが見つかりません。プロファイルを作成してください。');
      } else {
        setError('ノートの読み込みに失敗しました。再試行してください。');
      }
    } finally {
      setLoading(false);
    }
  }

  async function setupProfile() {
    setLoading(true);
    try {
      // デバイスのキーペアを生成
      const deviceKeyPair = await generateKeyPair();
      
      // プロファイルを作成
      await createProfile('Initial Device', deviceKeyPair);
      
      // プロファイル作成後にノートを再取得
      setNoProfile(false);
      await fetchNotes();
      
      return { success: true };
    } catch (err) {
      console.error('Failed to create profile:', err);
      setError('プロファイルの作成に失敗しました。もう一度お試しください。');
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }

  async function addNote(title, content) {
    setLoading(true);
    setError(null);
    try {
      // プロファイルの存在確認
      if (noProfile) {
        return { success: false, error: 'プロファイルが見つかりません。プロファイルを作成してください。' };
      }
      
      const noteId = await createNote(title, content);
      
      // 新しいノートをローカル状態に追加
      const newNote = {
        id: noteId,
        title,
        content,
        created: new Date(),
        updated: new Date()
      };
      
      setNotes([...notes, newNote]);
      return { success: true, noteId };
    } catch (err) {
      console.error('Failed to add note:', err);
      setError('ノートの追加に失敗しました。もう一度お試しください。');
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }

  async function editNote(id, title, content) {
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
      setError('ノートの更新に失敗しました。もう一度お試しください。');
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }

  async function removeNote(id) {
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
      setError('ノートの削除に失敗しました。もう一度お試しください。');
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }

  const value = {
    notes,
    loading,
    error,
    noProfile,
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