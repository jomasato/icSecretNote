import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout/Layout';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import Login from './pages/Login';
import Notes from './pages/Notes';
import GuardiansManagement from './pages/GuardiansManagement';
import RecoveryApproval from './pages/RecoveryApproval';
import Devices from './pages/Devices';
import './styles.css';
import GuardianInvitePage from './pages/GuardianInvitePage';
import DeviceSetupPage from './pages/DeviceSetupPage';
import DeviceSetupScanner from './components/Device/DeviceSetupScanner';
import RecoveryProcessPage from './pages/RecoveryProcessPage';

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
            <Route path="recovery" element={<RecoveryProcessPage />} />
            <Route path="approve-recovery" element={<RecoveryApproval />} />
            <Route path="devices" element={<Devices />} />
          </Route>
          <Route path="/guardian-invite" element={<GuardianInvitePage />} />
          <Route path="/setup-device" element={<DeviceSetupPage />} />
          <Route path="/link-device" element={<ProtectedRoute> <DeviceSetupScanner /> </ProtectedRoute>}/>
          <Route path="*" element={<Navigate to="/" replace />} />
          <Route path="GuardianInvitePage" element={<GuardianInvitePage />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;