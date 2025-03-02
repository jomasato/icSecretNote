import React from 'react';
import { Navigate } from 'react-router-dom';
import InternetIdentity from '../components/Auth/InternetIdentity';
import { useAuth } from '../context/AuthContext';
import Loading from '../components/common/Loading';

function Login() {
  const { user, loading } = useAuth();

  if (loading) {
    return <Loading />;
  }

  if (user) {
    return <Navigate to="/notes" />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <InternetIdentity />
    </div>
  );
}

export default Login;