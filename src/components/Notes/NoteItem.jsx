import React from 'react';
import { useNotes } from '../../context/NotesContext';

function NoteItem({ note, onEdit }) {
  const { removeNote } = useNotes();
  
  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this note?')) {
      await removeNote(note.id);
    }
  };
  
  const formatDate = (date) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  // Truncate content if it's too long
  const truncateContent = (text, maxLength = 150) => {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-5 mb-4 border-l-4 border-primary-500 hover:shadow-lg transition duration-200">
      <div className="flex justify-between items-start">
        <h3 className="text-lg font-semibold text-gray-800 mb-2">{note.title}</h3>
        <div className="flex space-x-2">
          <button
            onClick={() => onEdit(note)}
            className="text-gray-500 hover:text-primary-600 transition duration-200"
            aria-label="Edit"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
          <button
            onClick={handleDelete}
            className="text-gray-500 hover:text-red-600 transition duration-200"
            aria-label="Delete"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
      
      <div className="mt-2 text-gray-600 mb-3 whitespace-pre-line">
        {truncateContent(note.content)}
      </div>
      
      <div className="flex justify-between text-xs text-gray-500 italic">
        <span>Created: {formatDate(note.created)}</span>
        <span>Updated: {formatDate(note.updated)}</span>
      </div>
    </div>
  );
}

export default NoteItem;