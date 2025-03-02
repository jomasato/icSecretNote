import React, { useState, useEffect } from 'react';
import { getGuardians, removeGuardian } from '../../services/api';
import Loading from '../common/Loading';
import AddGuardian from './AddGuardian';

function GuardiansList() {
  const [guardians, setGuardians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddGuardian, setShowAddGuardian] = useState(false);

  useEffect(() => {
    fetchGuardians();
  }, []);

  const fetchGuardians = async () => {
    setLoading(true);
    try {
      const fetchedGuardians = await getGuardians();
      setGuardians(fetchedGuardians);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch guardians:', err);
      setError('Failed to load guardians. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveGuardian = async (principal) => {
    if (window.confirm('Are you sure you want to remove this guardian?')) {
      setLoading(true);
      try {
        await removeGuardian(principal);
        // Update the local state
        setGuardians(guardians.filter(g => g.principal !== principal));
      } catch (err) {
        console.error('Failed to remove guardian:', err);
        setError('Failed to remove guardian. Please try again.');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleAddGuardian = () => {
    setShowAddGuardian(true);
  };

  const handleCloseAddGuardian = () => {
    setShowAddGuardian(false);
    // Refresh the list after adding a guardian
    fetchGuardians();
  };

  if (loading && guardians.length === 0) {
    return <Loading />;
  }

  // Helper function to format principal ID for display
  const formatPrincipal = (principal) => {
    if (!principal) return '';
    if (principal.length <= 10) return principal;
    return `${principal.substring(0, 5)}...${principal.substring(principal.length - 5)}`;
  };

  return (
    <div className="container mx-auto p-4">
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">My Guardians</h1>
        <button
          onClick={handleAddGuardian}
          className="bg-primary-600 hover:bg-primary-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition duration-150 ease-in-out flex items-center"
        >
          <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Add Guardian
        </button>
      </div>

      <div className="bg-white shadow-md rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">About Guardians</h2>
        <p className="text-gray-600 mb-4">
          Guardians are trusted contacts who can help you recover access to your notes if you lose your device or access to your Internet Identity.
        </p>
        <ul className="list-disc list-inside text-gray-600 mb-4">
          <li>Each guardian holds an encrypted share of your recovery key</li>
          <li>You need a certain number of guardians to approve your recovery request</li>
          <li>Guardians can't access your notes without your permission</li>
          <li>Choose guardians wisely - people you trust and can easily contact</li>
        </ul>
      </div>

      {guardians.length === 0 ? (
        <div className="text-center py-12 bg-white shadow-md rounded-lg">
          <svg className="mx-auto h-16 w-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <h3 className="mt-2 text-lg font-medium text-gray-900">No guardians set up</h3>
          <p className="mt-1 text-gray-500">
            To enable account recovery, you need to add trusted guardians.
          </p>
          <div className="mt-6">
            <button
              onClick={handleAddGuardian}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Add your first guardian
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Guardian ID
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {guardians.map((guardian) => (
                <tr key={guardian.principal}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {formatPrincipal(guardian.principal)}
                    </div>
                    <div className="text-xs text-gray-500">
                      <button 
                        className="text-primary-600 hover:text-primary-800"
                        onClick={() => {
                          navigator.clipboard.writeText(guardian.principal);
                          alert('Guardian ID copied to clipboard');
                        }}
                      >
                        Copy ID
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                      Active
                    </span>
                    {guardian.approved && (
                      <span className="ml-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                        Approved Recovery
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleRemoveGuardian(guardian.principal)}
                      className="text-red-600 hover:text-red-900 ml-3"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAddGuardian && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md">
            <AddGuardian onClose={handleCloseAddGuardian} />
          </div>
        </div>
      )}
    </div>
  );
}

export default GuardiansList;