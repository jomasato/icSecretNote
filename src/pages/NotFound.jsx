import React, { useState, useEffect } from 'react';

const NotFoundPage = () => {
  const [visible, setVisible] = useState(false);
  const [bounce, setBounce] = useState(false);
  
  useEffect(() => {
    // フェードインアニメーション
    setVisible(true);
    
    // 数秒ごとにバウンスアニメーションを実行
    const bounceInterval = setInterval(() => {
      setBounce(true);
      setTimeout(() => setBounce(false), 500);
    }, 3000);
    
    return () => clearInterval(bounceInterval);
  }, []);
  
  return (
    <div className={`flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white p-4 transition-opacity duration-1000 ${visible ? 'opacity-100' : 'opacity-0'}`}>
      <div className="relative">
        <h1 className={`text-9xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600 mb-2 transition-transform duration-500 ${bounce ? 'transform -translate-y-6' : ''}`}>
          404
        </h1>
        <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center">
          <div className="w-64 h-64 bg-purple-500 rounded-full opacity-10 animate-ping"></div>
        </div>
      </div>
      
      <h2 className="text-2xl md:text-4xl font-semibold mb-6 text-gray-300">ページが見つかりませんでした</h2>
      
      <p className="text-lg text-gray-400 mb-8 text-center max-w-md">
        お探しのページは存在しないか、移動した可能性があります。
      </p>
      
      <div className="relative">
        <button 
          className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-600 text-white font-medium rounded-lg hover:from-purple-600 hover:to-pink-700 transition-all duration-300 transform hover:scale-105"
          onClick={() => alert('ホームページに戻ります')}
        >
          ホームに戻る
        </button>
        <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 w-12 h-1 bg-purple-400 blur-sm animate-pulse"></div>
      </div>
      
      {/* 浮遊する円のアニメーション要素 */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        {[...Array(10)].map((_, i) => (
          <div 
            key={i}
            className="absolute rounded-full bg-gradient-to-r from-purple-400 to-pink-600 opacity-20"
            style={{
              width: `${20 + Math.random() * 60}px`,
              height: `${20 + Math.random() * 60}px`,
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              animationDuration: `${10 + Math.random() * 20}s`,
              animationDelay: `${Math.random() * 5}s`,
              animation: `float ${15 + Math.random() * 15}s linear infinite`
            }}
          />
        ))}
      </div>
      
      {/* 背景の点ネットワーク */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiMyMjIiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMSIvPjwvZz48L2c+PC9zdmc+')] opacity-20" />
      
      <style jsx>{`
        @keyframes float {
          0% {
            transform: translateY(0) translateX(0);
          }
          50% {
            transform: translateY(-100px) translateX(50px);
          }
          100% {
            transform: translateY(0) translateX(0);
          }
        }
      `}</style>
    </div>
  );
};

export default NotFoundPage;