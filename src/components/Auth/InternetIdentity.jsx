import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

function InternetIdentity() {
  const { login, loading } = useAuth();
  const [error, setError] = useState(null);

  const handleLogin = async () => {
    setError(null);
    try {
      const result = await login();
      if (!result.success) {
        setError(result.error || 'Login failed. Please try again.');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('An unexpected error occurred. Please try again.');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
        <h2 className="text-2xl font-bold text-center mb-6">Secure Notes</h2>
        
        <div className="text-center mb-8">
          <p className="text-gray-600 mb-4">
            Keep your notes secure with end-to-end encryption and social recovery.
          </p>
          <svg className="mx-auto h-24 w-24 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
            <span className="block sm:inline">{error}</span>
          </div>
        )}
        
        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-3 px-4 rounded focus:outline-none focus:shadow-outline transition duration-150 ease-in-out"
        >
          {loading ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Logging in...
            </span>
          ) : (
            'Log in with Internet Identity'
          )}
        </button>
        
        <div className="mt-6 text-center text-sm">
          <p className="text-gray-600">
            Your notes are encrypted on your device and only you can access them.
          </p>
        </div>
      </div>
    </div>
  );
}

export default InternetIdentity;