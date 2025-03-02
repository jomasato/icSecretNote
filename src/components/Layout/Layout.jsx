import React from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import { useAuth } from '../../context/AuthContext';
import Loading from '../common/Loading';

function Layout() {
  const { loading } = useAuth();

  if (loading) {
    return <Loading />;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      <main className="py-6">
        <Outlet />
      </main>
    </div>
  );
}

export default Layout;