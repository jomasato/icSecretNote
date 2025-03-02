import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout/Layout';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import Login from './pages/Login';
import Notes from './pages/Notes';
import GuardiansManagement from './pages/GuardiansManagement';
import RecoveryProcess from './pages/RecoveryProcess';
import RecoveryApproval from './pages/RecoveryApproval';
import Devices from './pages/Devices';
import './styles.css';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route 
            path="/" 
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/notes" replace />} />
            <Route path="notes" element={<Notes />} />
            <Route path="guardians" element={<GuardiansManagement />} />
            <Route path="recovery" element={<RecoveryProcess />} />
            <Route path="approve-recovery" element={<RecoveryApproval />} />
            <Route path="devices" element={<Devices />} />
          </Route>
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;