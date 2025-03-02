import React, { createContext, useContext, useState, useEffect } from 'react';
import { getNotes, createNote, updateNote, deleteNote } from '../services/api';
import { useAuth } from './AuthContext';

const NotesContext = createContext();

export function useNotes() {
  return useContext(NotesContext);
}

export function NotesProvider({ children }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchNotes();
    } else {
      setNotes([]);
      setLoading(false);
    }
  }, [user]);

  async function fetchNotes() {
    setLoading(true);
    setError(null);
    try {
      const fetchedNotes = await getNotes();
      setNotes(fetchedNotes);
    } catch (err) {
      console.error('Failed to fetch notes:', err);
      setError('Failed to load notes. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function addNote(title, content) {
    setLoading(true);
    setError(null);
    try {
      const noteId = await createNote(title, content);
      
      // Add the new note to the local state
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
      setError('Failed to add note. Please try again.');
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
      
      // Update the note in the local state
      const updatedNotes = notes.map(note => 
        note.id === id 
          ? { ...note, title, content, updated: new Date() } 
          : note
      );
      
      setNotes(updatedNotes);
      return { success: true };
    } catch (err) {
      console.error(`Failed to update note ${id}:`, err);
      setError('Failed to update note. Please try again.');
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
      
      // Remove the note from the local state
      const updatedNotes = notes.filter(note => note.id !== id);
      setNotes(updatedNotes);
      return { success: true };
    } catch (err) {
      console.error(`Failed to delete note ${id}:`, err);
      setError('Failed to delete note. Please try again.');
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }

  const value = {
    notes,
    loading,
    error,
    refreshNotes: fetchNotes,
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