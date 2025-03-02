import React from 'react';
import NotesList from '../components/Notes/NotesList';
import { NotesProvider } from '../context/NotesContext';

function Notes() {
  return (
    <NotesProvider>
      <NotesList />
    </NotesProvider>
  );
}

export default Notes;