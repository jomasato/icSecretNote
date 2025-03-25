import React, { useState } from 'react';
import InheritanceRequestForm from '../components/Recovery/InheritanceRequestForm';

function InheritanceRequestPage() {
  const [userPrincipal, setUserPrincipal] = useState('');
  const [showForm, setShowForm] = useState(false);

  const handlePrincipalSubmit = (e) => {
    e.preventDefault();
    if (userPrincipal.trim()) {
      setShowForm(true);
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">アカウント相続リクエスト</h1>
      
      {!showForm ? (
        <div className="bg-white shadow-md rounded-lg p-6 mb-6">
          <p className="text-gray-600 mb-4">
            このページでは、ユーザーのアカウントの相続プロセスを開始できます。
            相続元のユーザーのプリンシパルIDを入力してください。
          </p>
          
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  注意: 相続プロセスは、正当なガーディアンとして登録されている場合のみ開始できます。
                  ユーザーから明示的に指定されたガーディアンだけがこのプロセスを使用できます。
                </p>
              </div>
            </div>
          </div>
          
          <form onSubmit={handlePrincipalSubmit}>
            <div className="mb-4">
              <label htmlFor="userPrincipal" className="block text-gray-700 text-sm font-bold mb-2">
                ユーザーのプリンシパルID
              </label>
              <input
                type="text"
                id="userPrincipal"
                value={userPrincipal}
                onChange={(e) => setUserPrincipal(e.target.value)}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                placeholder="例: aaaaa-bbbbb-ccccc-ddddd-eee"
                required
              />
            </div>
            
            <div className="flex justify-end">
              <button
                type="submit"
                className="bg-primary-600 hover:bg-primary-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
              >
                次へ
              </button>
            </div>
          </form>
        </div>
      ) : (
        <>
          <div className="bg-white shadow-md rounded-lg p-4 mb-6">
            <p className="font-medium">
              ユーザーID: <span className="font-mono">{userPrincipal}</span>
            </p>
          </div>
          <InheritanceRequestForm userPrincipal={userPrincipal} />
        </>
      )}
    </div>
  );
}

export default InheritanceRequestPage;