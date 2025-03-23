import React, { useState } from 'react';
import GuardiansList from '../components/Guardians/GuardiansList';
import GuardianShares from '../components/Guardians/GuardianShares';

function GuardiansManagement() {
  const [activeTab, setActiveTab] = useState('guardians');
  
  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">ガーディアン管理</h1>
      
      {/* タブナビゲーション */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex">
          <button
            className={`mr-8 py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'guardians'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
            onClick={() => setActiveTab('guardians')}
          >
            ガーディアン一覧
          </button>
          <button
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'shares'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
            onClick={() => setActiveTab('shares')}
          >
            保有シェア一覧
          </button>
        </nav>
      </div>
      
      {/* タブコンテンツ */}
      {activeTab === 'guardians' ? (
        <GuardiansList />
      ) : (
        <GuardianShares />
      )}
    </div>
  );
}

export default GuardiansManagement;