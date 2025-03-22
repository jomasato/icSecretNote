import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout/Layout';
import NotesList from './components/Notes/NotesList';
import NoteEditor from './components/Notes/NoteEditor';
import DevicesList from './components/Device/DevicesList';
import GuardiansList from './components/Guardians/GuardiansList';
import RecoveryRequest from './components/Recovery/RecoveryRequest.jsx';
import ShareCollection from './components/Recovery/ShareCollection.jsx';
import AccountRestore from './components/Recovery/AccountRestore.jsx';
import Login from './pages/Login';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import AcceptGuardian from './components/Guardians/AcceptGuardian.jsx';
import { AuthProvider } from './context/AuthContext'; // AuthProviderをインポート

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* 認証ルート */}
          <Route path="/login" element={<Login />} />
          <Route path="/accept-guardian" element={<AcceptGuardian />} />
          
          {/* リカバリールート（認証不要） */}
          <Route path="/recovery" element={<RecoveryRequest />} />
          <Route path="/recovery/collect/:userPrincipal" element={<ShareCollection />} />
          <Route path="/recovery/restore" element={<AccountRestore />} />
          
          {/* 保護されたルート */}
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            {/* ノート関連 */}
            <Route path="/notes" element={<NotesList />} />
            <Route path="/notes/new" element={<NoteEditor />} />
            <Route path="/notes/:noteId" element={<NoteEditor />} />
            
            {/* デバイス管理 */}
            <Route path="/devices" element={<DevicesList />} />
            
            {/* ガーディアン管理 */}
            <Route path="/guardians" element={<GuardiansList />} />
            
            {/* リダイレクト */}
            <Route path="/" element={<Navigate to="/notes" replace />} />
          </Route>
          
          {/* 404 - 存在しないルートは/へリダイレクト */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;