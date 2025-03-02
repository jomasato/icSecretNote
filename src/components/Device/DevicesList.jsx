import React, { useState, useEffect } from 'react';
import { getDevices, removeDevice } from '../../services/api';
import Loading from '../common/Loading';
import AddDevice from './AddDevice';

function DevicesList() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddDevice, setShowAddDevice] = useState(false);

  useEffect(() => {
    fetchDevices();
  }, []);

  const fetchDevices = async () => {
    setLoading(true);
    try {
      const fetchedDevices = await getDevices();
      setDevices(fetchedDevices);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch devices:', err);
      setError('Failed to load devices. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveDevice = async (deviceId) => {
    if (devices.length <= 1) {
      alert('You cannot remove your last device. You need at least one device to access your account.');
      return;
    }
    
    if (window.confirm('Are you sure you want to remove this device? This action cannot be undone.')) {
      setLoading(true);
      try {
        await removeDevice(deviceId);
        // Update the local state
        setDevices(devices.filter(d => d.id !== deviceId));
      } catch (err) {
        console.error('Failed to remove device:', err);
        setError('Failed to remove device. Please try again.');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleAddDevice = () => {
    setShowAddDevice(true);
  };

  const handleCloseAddDevice = () => {
    setShowAddDevice(false);
    // Refresh the list after adding a device
    fetchDevices();
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

  if (loading && devices.length === 0) {
    return <Loading />;
  }

  return (
    <div className="container mx-auto p-4">
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">My Devices</h1>
        <button
          onClick={handleAddDevice}
          className="bg-primary-600 hover:bg-primary-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition duration-150 ease-in-out flex items-center"
        >
          <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Add Device
        </button>
      </div>

      <div className="bg-white shadow-md rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">About Device Management</h2>
        <p className="text-gray-600 mb-4">
          Devices are the physical hardware you use to access your secure notes. Each device has its own encryption keys.
        </p>
        <ul className="list-disc list-inside text-gray-600 mb-4">
          <li>Each device can decrypt your notes independently</li>
          <li>If you lose a device, you can remove it from your account</li>
          <li>You can add new devices to access your notes from multiple places</li>
          <li>You must always have at least one device registered</li>
        </ul>
      </div>

      {devices.length === 0 ? (
        <div className="text-center py-12 bg-white shadow-md rounded-lg">
          <svg className="mx-auto h-16 w-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          <h3 className="mt-2 text-lg font-medium text-gray-900">No devices found</h3>
          <p className="mt-1 text-gray-500">
            This is unusual. You should have at least one device.
          </p>
          <div className="mt-6">
            <button
              onClick={handleAddDevice}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Add a device
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Device Name
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Registration Date
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Access
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {devices.map((device) => (
                <tr key={device.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center bg-gray-100 rounded-full">
                        <svg className="h-6 w-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {device.name}
                        </div>
                        <div className="text-xs text-gray-500">
                          ID: {device.id.substring(0, 8)}...
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(device.registrationTime)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(device.lastAccessTime)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleRemoveDevice(device.id)}
                      className="text-red-600 hover:text-red-900"
                      disabled={devices.length <= 1}
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

      {showAddDevice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md">
            <AddDevice onClose={handleCloseAddDevice} />
          </div>
        </div>
      )}
    </div>
  );
}

export default DevicesList;