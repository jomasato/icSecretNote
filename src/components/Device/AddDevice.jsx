import React, { useState } from 'react';
import { addDevice } from '../../services/api';
import { generateKeyPair } from '../../services/crypto';
import { useAuth } from '../../context/AuthContext';

function AddDevice({ onClose }) {
  const [deviceName, setDeviceName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const {user} = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    
    try {
      if (!deviceName.trim()) {
        throw new Error('Device name is required');
      }
      
      if (!user || !user.principal) {
        throw new Error('User authentication required');
      }
      
      // Call the updated addDevice function
      const result = await addDevice(deviceName);
      
      console.log('Device added successfully:', result.deviceId);
      onClose();
    } catch (err) {
      console.error('Failed to add device:', err);
      setError(err.message || 'Failed to add device. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Add New Device</h2>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700"
          aria-label="Close"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label htmlFor="deviceName" className="block text-gray-700 text-sm font-bold mb-2">
            Device Name
          </label>
          <input
            type="text"
            id="deviceName"
            value={deviceName}
            onChange={(e) => setDeviceName(e.target.value)}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            placeholder="e.g., My Laptop, Work Phone"
            required
          />
        </div>

        <div className="mb-6">
          <p className="text-sm text-gray-600">
            Adding a new device will allow you to access your encrypted notes from this device.
            The device will receive its own encryption keys.
          </p>
        </div>

        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="mr-2 bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !deviceName.trim()}
            className="bg-primary-600 hover:bg-primary-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
          >
            {loading ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Adding...
              </span>
            ) : (
              'Add Device'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

export default AddDevice;