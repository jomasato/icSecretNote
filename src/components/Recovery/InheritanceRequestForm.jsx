import React, { useState } from 'react';
import { requestInheritanceTransfer } from '../../services/api';

function InheritanceRequestForm({ userPrincipal }) {
  const [reason, setReason] = useState('');
  const [confirmation, setConfirmation] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      const result = await requestInheritanceTransfer(userPrincipal, reason);
      
      if (result.success) {
        setSuccess(true);
      } else {
        setError(result.error || '相続リクエストに失敗しました');
      }
    } catch (err) {
      setError(err.message || '予期せぬエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="bg-white shadow-md rounded-lg p-6">
      <h2 className="text-xl font-bold mb-4">相続プロセスを開始</h2>
      
      {success ? (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          <p>相続リクエストが正常に送信されました。ガーディアンの承認を待ちます。</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              <span>{error}</span>
            </div>
          )}
          
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              相続理由
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700"
              placeholder="相続が必要な理由を説明してください"
              rows={4}
              required
            />
          </div>
          
          <div className="mb-6">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={confirmation}
                onChange={(e) => setConfirmation(e.target.checked)}
                className="mr-2"
                required
              />
              <span className="text-sm text-gray-700">
                これは重大なアクションであり、ユーザーのデータの所有権が移転されることを理解しています。
              </span>
            </label>
          </div>
          
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading || !confirmation}
              className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:bg-red-300"
            >
              {loading ? '処理中...' : '相続プロセスを開始'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export default InheritanceRequestForm;