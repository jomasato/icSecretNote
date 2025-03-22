import React, { useState, useEffect } from 'react';
import { getDevices, removeDevice } from '../../services/api';
import Loading from '../common/Loading';
import AddDevice from './AddDevice';

function DevicesList() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddDevice, setShowAddDevice] = useState(false);
  const [currentDevice, setCurrentDevice] = useState(null);

  useEffect(() => {
    fetchDevices();
    // 現在のデバイスIDを取得
    const deviceId = localStorage.getItem('currentDeviceId');
    setCurrentDevice(deviceId);
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
    // 現在使用中のデバイスは削除できないようにする
    if (deviceId === currentDevice) {
      alert('You cannot remove the current device you are using.');
      return;
    }

    if (window.confirm('Are you sure you want to remove this device?')) {
      setLoading(true);
      try {
        await removeDevice(deviceId);
        // ローカルステートを更新
        setDevices(devices.filter(d => d.id !== deviceId));
      } catch (err) {
        console.error('Failed to remove device:', err);
        setError('Failed to remove device. Please try again.');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleAddDeviceComplete = () => {
    setShowAddDevice(false);
    // デバイス追加後にリストを更新
    fetchDevices();
  };

  if (loading && devices.length === 0) {
    return <Loading />;
  }

  // デバイス登録日をフォーマット
  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // 最終アクセス日をフォーマット
  const formatLastAccess = (date) => {
    const now = new Date();
    const accessDate = new Date(date);
    const diffTime = Math.abs(now - accessDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 1) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return formatDate(date);
    }
  };

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
          onClick={() => setShowAddDevice(true)}
          className="bg-primary-600 hover:bg-primary-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition duration-150 ease-in-out flex items-center"
        >
          <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Add New Device
        </button>
      </div>

      <div className="bg-white shadow-md rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">About Devices</h2>
        <p className="text-gray-600 mb-4">
          Devices are your access points to your encrypted notes. Each device has its own key that can decrypt your master key, which then decrypts your notes.
        </p>
        <ul className="list-disc list-inside text-gray-600 mb-4">
          <li>You can add multiple devices to access your notes</li>
          <li>Your master key is securely encrypted for each device</li>
          <li>Notes are accessible across all your devices</li>
          <li>You can revoke a device's access if it's lost or compromised</li>
        </ul>
      </div>

      {devices.length === 0 ? (
        <div className="text-center py-12 bg-white shadow-md rounded-lg">
          <svg className="mx-auto h-16 w-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <h3 className="mt-2 text-lg font-medium text-gray-900">No devices registered</h3>
          <p className="mt-1 text-gray-500">
            This should not happen. At least your current device should be registered.
          </p>
          <div className="mt-6">
            <button
              onClick={() => setShowAddDevice(true)}
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
                  Registered
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Access
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
              {devices.map((device) => (
                <tr key={device.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {device.name}
                    </div>
                    <div className="text-xs text-gray-500">
                      ID: {device.id.substring(0, 8)}...
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">
                      {formatDate(device.registrationTime)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">
                      {formatLastAccess(device.lastAccessTime)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {device.id === currentDevice ? (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                        Current Device
                      </span>
                    ) : (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                        Registered
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {device.id !== currentDevice && (
                      <button
                        onClick={() => handleRemoveDevice(device.id)}
                        className="text-red-600 hover:text-red-900 ml-3"
                      >
                        Remove
                      </button>
                    )}
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
            <AddDevice onClose={handleAddDeviceComplete} />
          </div>
        </div>
      )}
    </div>
  );
}

export default DevicesList;