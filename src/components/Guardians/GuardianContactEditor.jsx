import React, { useState, useEffect } from 'react';
import { updateGuardianInfo } from '../../services/api';

function GuardianContactEditor({ guardian, onSave, onCancel }) {
  const [name, setName] = useState(guardian?.name || '');
  const [email, setEmail] = useState(guardian?.email || '');
  const [phone, setPhone] = useState(guardian?.phone || '');
  const [relationship, setRelationship] = useState(guardian?.relationship || '');
  const [isEmergency, setIsEmergency] = useState(guardian?.isEmergency || false);
  const [notes, setNotes] = useState(guardian?.notes || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // ガーディアン情報が変更された場合に状態を更新
    if (guardian) {
      setName(guardian.name || '');
      setEmail(guardian.email || '');
      setPhone(guardian.phone || '');
      setRelationship(guardian.relationship || '');
      setIsEmergency(guardian.isEmergency || false);
      setNotes(guardian.notes || '');
    }
  }, [guardian]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // ガーディアン情報の更新APIを呼び出し
      const result = await updateGuardianInfo(guardian.principal, {
        name, 
        email, 
        phone, 
        relationship, 
        isEmergency,
        notes
      });

      if (!result.success) {
        throw new Error(result.error || 'ガーディアン情報の更新に失敗しました');
      }

      // 親コンポーネントに保存成功を通知
      onSave && onSave({
        ...guardian,
        name,
        email,
        phone,
        relationship,
        isEmergency,
        notes
      });
    } catch (err) {
      console.error('ガーディアン情報の更新に失敗:', err);
      setError(err.message || '更新処理中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold mb-4">ガーディアン連絡先情報</h3>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
          <span className="block sm:inline">{error}</span>
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* 名前フィールド */}
          <div className="col-span-2 md:col-span-1">
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              名前
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border-gray-300 rounded-md"
              placeholder="ガーディアンの名前"
            />
          </div>
          
          {/* メールアドレスフィールド */}
          <div className="col-span-2 md:col-span-1">
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              メールアドレス
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border-gray-300 rounded-md"
              placeholder="example@email.com"
            />
          </div>
          
          {/* 電話番号フィールド */}
          <div className="col-span-2 md:col-span-1">
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
              電話番号
            </label>
            <input
              type="tel"
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border-gray-300 rounded-md"
              placeholder="090-1234-5678"
            />
          </div>
          
          {/* 関係性フィールド */}
          <div className="col-span-2 md:col-span-1">
            <label htmlFor="relationship" className="block text-sm font-medium text-gray-700 mb-1">
              あなたとの関係
            </label>
            <select
              id="relationship"
              value={relationship}
              onChange={(e) => setRelationship(e.target.value)}
              className="shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border-gray-300 rounded-md"
            >
              <option value="">選択してください</option>
              <option value="family">家族</option>
              <option value="friend">友人</option>
              <option value="colleague">同僚</option>
              <option value="lawyer">弁護士</option>
              <option value="accountant">会計士</option>
              <option value="other">その他</option>
            </select>
          </div>
          
          {/* メモフィールド */}
          <div className="col-span-2">
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
              メモ (任意)
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border-gray-300 rounded-md"
              placeholder="ガーディアンに関する追加情報"
            />
          </div>
          
          {/* 緊急連絡先チェックボックス */}
          <div className="col-span-2">
            <div className="flex items-start">
              <div className="flex items-center h-5">
                <input
                  id="isEmergency"
                  type="checkbox"
                  checked={isEmergency}
                  onChange={(e) => setIsEmergency(e.target.checked)}
                  className="focus:ring-primary-500 h-4 w-4 text-primary-600 border-gray-300 rounded"
                />
              </div>
              <div className="ml-3 text-sm">
                <label htmlFor="isEmergency" className="font-medium text-gray-700">緊急連絡先</label>
                <p className="text-gray-500">このガーディアンを緊急時の最優先連絡先として設定します</p>
              </div>
            </div>
          </div>
        </div>
        
        {/* プリンシパルID表示（読み取り専用） */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            プリンシパルID
          </label>
          <div className="bg-gray-100 p-2 rounded-md text-sm text-gray-600 font-mono break-all">
            {guardian?.principal || 'プリンシパル未設定'}
          </div>
          <p className="mt-1 text-xs text-gray-500">このIDは変更できません</p>
        </div>
        
        {/* ボタングループ */}
        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            キャンセル
          </button>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:bg-primary-400 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                保存中...
              </span>
            ) : (
              "保存"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

export default GuardianContactEditor;