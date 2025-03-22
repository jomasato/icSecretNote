import React, { useState } from 'react';
import { addDevice } from '../../services/api';
import { QRCodeSVG as QRCode } from 'qrcode.react';
import { Switch } from '@headlessui/react';

function AddDevice({ onClose }) {
  const [deviceName, setDeviceName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [step, setStep] = useState(1);
  const [setupData, setSetupData] = useState(null);
  const [showQR, setShowQR] = useState(true);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    
    if (step === 1) {
      if (!deviceName.trim()) {
        setError('Device name is required');
        return;
      }
      
      setLoading(true);
      try {
        // 新デバイスを追加してセットアップトークンを取得
        const result = await addDevice(deviceName);
        setSetupData(result);
        setStep(2);
      } catch (err) {
        console.error('Failed to create device:', err);
        setError(err.message || 'Failed to create device. Please try again.');
      } finally {
        setLoading(false);
      }
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(setupData.setupToken)
      .then(() => {
        alert('Setup token copied to clipboard!');
      })
      .catch(err => {
        console.error('Failed to copy text: ', err);
        setError('Could not copy to clipboard. Please select and copy the text manually.');
      });
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">
          {step === 1 ? 'Add New Device' : 'Device Setup'}
        </h2>
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

      {step === 1 && (
        <>
          <p className="text-gray-600 mb-4">
            Enter a name for the new device you want to add. This will help you identify it later.
          </p>
          
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
                disabled={loading || !deviceName}
                className="bg-primary-600 hover:bg-primary-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
              >
                {loading ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Creating...
                  </span>
                ) : (
                  'Create Device'
                )}
              </button>
            </div>
          </form>
        </>
      )}

      {step === 2 && setupData && (
        <>
          <div className="mb-6">
            <p className="text-green-600 font-medium mb-2">Device created successfully!</p>
            <p className="text-gray-600 mb-4">
              To set up your new device, you need to transfer the setup information. You can either scan the QR code or copy the setup token.
            </p>
            
            <div className="mb-4">
              <Switch.Group>
                <div className="flex items-center mb-2">
                  <Switch.Label className="mr-4 text-sm font-medium">Show as:</Switch.Label>
                  <Switch
                    checked={showQR}
                    onChange={setShowQR}
                    className={`${
                      showQR ? 'bg-primary-600' : 'bg-gray-300'
                    } relative inline-flex items-center h-6 rounded-full w-11 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500`}
                  >
                    <span
                      className={`${
                        showQR ? 'translate-x-6' : 'translate-x-1'
                      } inline-block w-4 h-4 transform bg-white rounded-full transition-transform`}
                    />
                  </Switch>
                  <span className="ml-2 text-sm text-gray-600">{showQR ? 'QR Code' : 'Text'}</span>
                </div>
              </Switch.Group>
            </div>
            
            {showQR ? (
              <div className="flex flex-col items-center justify-center p-4 bg-gray-50 rounded-lg">
                <QRCode 
                  value={setupData.setupToken}
                  size={200}
                  level="H"
                  includeMargin={true}
                  className="mb-2"
                />
                <p className="text-sm text-gray-600 text-center mt-2">
                  Scan this QR code on your new device
                </p>
              </div>
            ) : (
              <div className="p-4 bg-gray-50 rounded-lg">
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  Setup Token
                </label>
                <div className="relative">
                  <textarea
                    readOnly
                    value={setupData.setupToken}
                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline h-24"
                  />
                  <button
                    type="button"
                    onClick={copyToClipboard}
                    className="absolute right-2 top-2 bg-primary-100 text-primary-800 px-2 py-1 rounded text-xs font-medium"
                  >
                    Copy
                  </button>
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  Copy this token and paste it on your new device
                </p>
              </div>
            )}
          </div>
          
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  This setup token will expire in 10 minutes. Use it immediately to set up your new device.
                </p>
              </div>
            </div>
          </div>
          
          <div className="text-sm text-gray-600 mb-4">
            <h3 className="font-bold mb-1">Instructions:</h3>
            <ol className="list-decimal list-inside pl-2 space-y-1">
              <li>On your new device, open the Secure Notes app</li>
              <li>Select "Add Existing Account"</li>
              <li>Scan the QR code or paste the setup token</li>
              <li>Your notes will sync automatically</li>
            </ol>
          </div>
          
          <div className="flex items-center justify-end">
            <button
              onClick={onClose}
              className="bg-primary-600 hover:bg-primary-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            >
              Done
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default AddDevice;