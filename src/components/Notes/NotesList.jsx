import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNotes } from '../../context/NotesContext';
import NoteItem from './NoteItem';
import NoteEditor from './NoteEditor';
import Loading from '../common/Loading';
import { debounce } from 'lodash';
import DeviceSetupScanner from '../Device/DeviceSetupScanner';

function NotesList() {
  const { notes, loading, error, noProfile, refreshNotes, setupProfile, needDeviceSetup  } = useNotes();
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOption, setSortOption] = useState('updated');
  const [creatingProfile, setCreatingProfile] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const [showDeviceSetup, setShowDeviceSetup] = useState(false);
  
  // デバウンスされたリフレッシュ関数
  const debouncedRefresh = useMemo(
    () => 
      debounce(() => {
        console.log("Debounced refresh called");
        refreshNotes();
      }, 300),
    [refreshNotes]
  );
  
  // 最適化されたリフレッシュ関数
  const optimizedRefresh = useCallback(() => {
    const now = Date.now();
    if (now - lastRefreshTime > 3000) { // 3秒以上経過していれば更新
      setLastRefreshTime(now);
      debouncedRefresh();
    } else {
      console.log("Skipping refresh, too soon");
    }
  }, [debouncedRefresh, lastRefreshTime]);

  // コンポーネントマウント時のみデータ取得
  useEffect(() => {
    let isMounted = true;
    
    if (notes.length === 0 && !loading && !noProfile && isMounted) {
      console.log("Initial data fetch");
      optimizedRefresh();
    }
    
    return () => {
      isMounted = false;
      debouncedRefresh.cancel(); // コンポーネントのアンマウント時にデバウンス関数をキャンセル
    };
  }, []);  // 依存配列を空にして初回のみ実行

  // needDeviceSetup が true の場合、ポップアップを表示
useEffect(() => {
    if (needDeviceSetup) {
      setShowDeviceSetup(true);
    }
  }, [needDeviceSetup]);

  // エラー後の自動再試行
  useEffect(() => {
    let retryTimeout;
    
    if (error && !noProfile && !isRetrying) {
      setIsRetrying(true);
      console.log("Scheduling auto-retry after error");
      
      retryTimeout = setTimeout(() => {
        console.log("Auto-retrying after error");
        refreshNotes();
        setIsRetrying(false);
      }, 5000); // 5秒後に再試行
    }
    
    return () => {
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
    };
  }, [error, noProfile, refreshNotes]);

  // 以下は省略 - 元のコードと同じ
  const handleAddNote = () => {
    setEditingNote(null);
    setIsEditorOpen(true);
  };

  const handleEditNote = (note) => {
    setEditingNote(note);
    setIsEditorOpen(true);
  };

  const handleCloseEditor = () => {
    setIsEditorOpen(false);
    setEditingNote(null);
  };

  const handleCreateProfile = async () => {
    console.log("handleCreateProfile called");
    setCreatingProfile(true);
    try {
      const result = await setupProfile();
      console.log("Profile setup result:", result);
      if (!result.success) {
        throw new Error(result.error || 'プロファイルの作成に失敗しました');
      }
    } catch (err) {
      console.error('Profile creation failed:', err);
    } finally {
      setCreatingProfile(false);
    }
  };

  // メモ化されたフィルタリングと並べ替え
// filteredAndSortedNotes の useMemo 内のコードを修正

const filteredAndSortedNotes = useMemo(() => {
  console.log("Recomputing filtered and sorted notes");
  
  // Filter notes based on search term
  const filtered = notes.filter(note => {
    // null や undefined のプロパティに対する保護を追加
    const title = note?.title || '';
    const content = note?.content || '';
    
    return title.toLowerCase().includes(searchTerm.toLowerCase()) || 
           content.toLowerCase().includes(searchTerm.toLowerCase());
  });

  // Sort notes based on sort option
  return [...filtered].sort((a, b) => {
    if (sortOption === 'title') {
      // ここも null 対策
      const titleA = a?.title || '';
      const titleB = b?.title || '';
      return titleA.localeCompare(titleB);
    } else if (sortOption === 'created') {
      return new Date(b.created || 0) - new Date(a.created || 0);
    } else {
      return new Date(b.updated || 0) - new Date(a.updated || 0);
    }
  });
}, [notes, searchTerm, sortOption]);

  console.log("NotesList render", {
    loading,
    notes: notes.length,
    noProfile,
    error
  });

  // プロファイルがない場合の表示
  if (noProfile) {
    console.log("Rendering no-profile view");
    return (
      <div className="container mx-auto p-4">
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">プロファイルが見つかりません</h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>
                  アプリを使用するには、まずユーザープロファイルを作成する必要があります。
                </p>
                {error && (
                  <p className="mt-2 text-red-600">
                    エラー: {error}
                  </p>
                )}
              </div>
              <div className="mt-4">
                <button
                  onClick={handleCreateProfile}
                  disabled={creatingProfile}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  {creatingProfile ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      プロファイル作成中...
                    </span>
                  ) : (
                    'プロファイルを作成'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ローディングの表示（ダミー表示の時間制限を設ける）
  if (loading) {
    console.log("Rendering loading view");
    return (
      <div className="container mx-auto p-4">
        <Loading />
        <div className="mt-4 text-center text-gray-500">
          {notes.length === 0 ? "ノートをロード中..." : "更新中..."}
        </div>
      </div>
    );
  }

// Filter notes based on search term
const filteredNotes = notes.filter(note => {
  // null や undefined のプロパティに対する保護を追加
  const title = note?.title || '';
  const content = note?.content || '';
  
  return title.toLowerCase().includes(searchTerm.toLowerCase()) || 
         content.toLowerCase().includes(searchTerm.toLowerCase());
});

// Sort notes based on sort option
const sortedNotes = [...filteredNotes].sort((a, b) => {
  if (sortOption === 'title') {
    const titleA = a?.title || '';
    const titleB = b?.title || '';
    return titleA.localeCompare(titleB);
  } else if (sortOption === 'created') {
    return new Date(b.created || 0) - new Date(a.created || 0);
  } else {
    return new Date(b.updated || 0) - new Date(a.updated || 0);
  }
});

  console.log("Rendering main notes view");
  return (
    <div className="container mx-auto p-4">
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 flex justify-between items-center">
          <span className="block sm:inline">{error}</span>
          <button 
            onClick={optimizedRefresh} 
            className="bg-red-200 hover:bg-red-300 text-red-800 font-bold py-1 px-2 rounded text-sm"
          >
            再試行
          </button>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-4 md:mb-0">マイセキュアノート</h1>
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 w-full md:w-auto">
          <div className="relative">
          <input
            type="text"
            placeholder="ノートを検索..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full sm:w-64 px-4 py-2 bg-gray-50 border border-gray-300 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
          
          <select
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value)}
            className="w-full sm:w-auto px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
          >
            <option value="updated">最終更新日順</option>
            <option value="created">作成日順</option>
            <option value="title">タイトル順</option>
          </select>
          
          <button
            onClick={handleAddNote}
            className="bg-primary-600 hover:bg-primary-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition duration-150 ease-in-out flex items-center justify-center"
          >
            <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            ノートを追加
          </button>
        </div>
      </div>

      {isEditorOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-3xl">
            <NoteEditor note={editingNote} onClose={handleCloseEditor} />
          </div>
        </div>
      )}

        {showDeviceSetup && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="w-full max-w-md bg-white rounded-lg shadow-xl">
              <div className="p-6">
                <h2 className="text-xl font-bold mb-4">デバイスセットアップが必要です</h2>
                <p className="mb-4 text-gray-600">
                  このデバイスはまだセットアップされていません。既存のデバイスからQRコードをスキャンするか、
                  セットアップコードを入力してください。
                </p>
                
                <DeviceSetupScanner 
                  onSetupComplete={() => setShowDeviceSetup(false)}
                  embedded={true} 
                />
              </div>
            </div>
          </div>
        )}

      {sortedNotes.length === 0 ? (
        <div className="text-center py-12">
          <svg className="mx-auto h-16 w-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="mt-2 text-lg font-medium text-gray-900">ノートが見つかりません</h3>
          <p className="mt-1 text-gray-500">
            {searchTerm ? `"${searchTerm}"に一致するノートはありません` : '最初のノートを作成しましょう'}
          </p>
          {!searchTerm && (
            <div className="mt-6">
              <button
                onClick={handleAddNote}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                ノートを作成
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedNotes.map(note => (
            <NoteItem key={note.id} note={note} onEdit={handleEditNote} />
          ))}
        </div>
      )}
    </div>
  );
}

export default NotesList;