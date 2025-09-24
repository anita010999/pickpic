import React, { useState, useRef, useEffect } from 'react';
import { Upload, Heart, X, Users, Trophy, Image, Share2, Copy, Wifi, RefreshCw } from 'lucide-react';

const App = () => {
  const [photos, setPhotos] = useState([]);
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [joinRoomCode, setJoinRoomCode] = useState('');
  const [roomData, setRoomData] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(0);
  const fileInputRef = useRef(null);

  // 生成房間代碼
  const generateRoomCode = () => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    return code;
  };

  // 創建房間
  const createRoom = () => {
    const code = generateRoomCode();
    const newRoomData = {
      roomCode: code,
      photos: [],
      users: [],
      created: Date.now(),
      host: 'Host',
      lastUpdated: Date.now()
    };
    
    setRoomCode(code);
    setIsHost(true);
    setRoomData(newRoomData);
    setIsConnected(true);
    setLastSyncTime(Date.now());
    
    // 存儲到 localStorage
    localStorage.setItem(`room_${code}`, JSON.stringify(newRoomData));
    
    // 廣播給其他分頁
    broadcastToOtherTabs('room_created', { roomCode: code, roomData: newRoomData });
  };

  // 加入房間
  const joinRoom = () => {
    if (!joinRoomCode.trim()) return;
    
    const code = joinRoomCode.trim().toUpperCase();
    const storedData = localStorage.getItem(`room_${code}`);
    
    if (storedData) {
      const data = JSON.parse(storedData);
      setRoomCode(code);
      setRoomData(data);
      setPhotos(data.photos || []);
      setUsers(data.users || []);
      setIsHost(false);
      setIsConnected(true);
      setJoinRoomCode('');
      setLastSyncTime(data.lastUpdated || Date.now());
      
      // 通知其他分頁有新用戶加入
      broadcastToOtherTabs('user_joined', { roomCode: code });
    } else {
      alert('房間代碼不存在或已過期');
    }
  };

  // 廣播訊息給其他分頁/視窗
  const broadcastToOtherTabs = (type, data) => {
    const message = {
      type,
      data,
      timestamp: Date.now(),
      sender: 'photo-picker-app',
      senderId: window.name || Math.random().toString()
    };
    
    // 使用 localStorage 事件進行跨分頁通訊
    localStorage.setItem('broadcast_message', JSON.stringify(message));
    // 立即移除，觸發其他分頁的 storage 事件
    setTimeout(() => {
      localStorage.removeItem('broadcast_message');
    }, 100);
  };

  // 監聽其他分頁的訊息（包含不同視窗）
  useEffect(() => {
    // 設置視窗ID（如果沒有的話）
    if (!window.name) {
      window.name = 'tab_' + Math.random().toString(36).substr(2, 9);
    }

    const handleStorageChange = (e) => {
      // 監聽廣播訊息
      if (e.key === 'broadcast_message') {
        if (e.newValue) {
          try {
            const message = JSON.parse(e.newValue);
            if (message.sender === 'photo-picker-app' && message.senderId !== window.name) {
              handleBroadcastMessage(message);
            }
          } catch (error) {
            console.error('解析廣播訊息失敗:', error);
          }
        }
      }

      // 監聽房間資料的直接變更
      if (e.key && e.key.startsWith('room_') && roomCode) {
        if (e.key === `room_${roomCode}`) {
          if (e.newValue) {
            try {
              const updatedRoomData = JSON.parse(e.newValue);
              if (updatedRoomData.lastUpdated > lastSyncTime) {
                setRoomData(updatedRoomData);
                setPhotos(updatedRoomData.photos || []);
                setUsers(updatedRoomData.users || []);
                setLastSyncTime(updatedRoomData.lastUpdated);
                console.log('從 localStorage 同步資料:', updatedRoomData.lastUpdated);
              }
            } catch (error) {
              console.error('同步房間資料失敗:', error);
            }
          }
        }
      }
    };

    const handleFocus = () => {
      // 視窗獲得焦點時強制同步
      console.log('視窗獲得焦點，強制同步');
      syncRoomData();
    };

    const handleVisibilityChange = () => {
      // 頁面變為可見時強制同步
      if (!document.hidden) {
        console.log('頁面變為可見，強制同步');
        syncRoomData();
      }
    };

    // 添加事件監聽器
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [roomCode, lastSyncTime]);

  // 處理來自其他分頁的訊息
  const handleBroadcastMessage = (message) => {
    if (!roomCode || message.data.roomCode !== roomCode) return;

    switch (message.type) {
      case 'room_updated':
        // 同步房間資料
        syncRoomData();
        break;
      case 'user_joined':
        // 有新用戶加入，重新載入資料
        syncRoomData();
        break;
      default:
        break;
    }
  };

  // 同步房間資料
  const syncRoomData = () => {
    if (!roomCode) return;
    
    const storedData = localStorage.getItem(`room_${roomCode}`);
    if (storedData) {
      try {
        const data = JSON.parse(storedData);
        
        // 只有當資料更新時間比本地新時才更新
        if (data.lastUpdated > lastSyncTime) {
          console.log('同步資料 - 本地時間:', lastSyncTime, '遠端時間:', data.lastUpdated);
          setRoomData(data);
          setPhotos(data.photos || []);
          setUsers(data.users || []);
          setLastSyncTime(data.lastUpdated);
        }
      } catch (error) {
        console.error('同步資料解析失敗:', error);
      }
    }
  };

  // 定期同步資料（每1.5秒檢查一次，更頻繁）
  useEffect(() => {
    if (!roomCode || !isConnected) return;

    const syncInterval = setInterval(() => {
      syncRoomData();
    }, 1500);

    return () => clearInterval(syncInterval);
  }, [roomCode, isConnected, lastSyncTime]);

  // 更新房間資料
  const updateRoomData = (newData) => {
    if (!roomCode) return;
    
    const updatedData = {
      ...roomData,
      ...newData,
      lastUpdated: Date.now()
    };
    
    console.log('更新房間資料:', updatedData.lastUpdated);
    setRoomData(updatedData);
    setLastSyncTime(updatedData.lastUpdated);
    
    // 存儲到 localStorage
    localStorage.setItem(`room_${roomCode}`, JSON.stringify(updatedData));
    
    // 通知其他分頁資料已更新
    broadcastToOtherTabs('room_updated', { roomCode, roomData: updatedData });
  };

  // 添加用戶
  const addUser = () => {
    if (newUserName.trim() && !users.includes(newUserName.trim())) {
      const newUsers = [...users, newUserName.trim()];
      setUsers(newUsers);
      updateRoomData({ users: newUsers });
      setNewUserName('');
    }
  };

  // 處理照片上傳
  const handleFileUpload = (event) => {
    const files = Array.from(event.target.files);
    let processedFiles = 0;
    const newPhotos = [];
    
    if (files.length === 0) return;
    
    files.forEach((file, index) => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const newPhoto = {
            id: Date.now() + Math.random() + index,
            url: e.target.result,
            name: file.name,
            votes: {},
            totalVotes: 0,
            uploadedBy: currentUser || 'Unknown',
            uploadedAt: Date.now()
          };
          
          newPhotos.push(newPhoto);
          processedFiles++;
          
          if (processedFiles === files.filter(f => f.type.startsWith('image/')).length) {
            const updatedPhotos = [...photos, ...newPhotos];
            setPhotos(updatedPhotos);
            updateRoomData({ photos: updatedPhotos });
          }
        };
        reader.readAsDataURL(file);
      } else {
        processedFiles++;
      }
    });
    
    event.target.value = '';
  };

  // 投票功能
  const toggleVote = (photoId) => {
    if (!currentUser) {
      alert('請先選擇您的身份！');
      return;
    }

    const updatedPhotos = photos.map(photo => {
      if (photo.id === photoId) {
        const newVotes = { ...photo.votes };
        
        if (newVotes[currentUser]) {
          delete newVotes[currentUser];
        } else {
          newVotes[currentUser] = true;
        }
        
        return {
          ...photo,
          votes: newVotes,
          totalVotes: Object.keys(newVotes).length
        };
      }
      return photo;
    });
    
    setPhotos(updatedPhotos);
    updateRoomData({ photos: updatedPhotos });
  };

  // 刪除照片
  const deletePhoto = (photoId) => {
    const updatedPhotos = photos.filter(photo => photo.id !== photoId);
    setPhotos(updatedPhotos);
    updateRoomData({ photos: updatedPhotos });
  };

  // 複製房間代碼
  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode).then(() => {
      alert('房間代碼已複製到剪貼板！');
    }).catch(() => {
      const textArea = document.createElement('textarea');
      textArea.value = roomCode;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert('房間代碼已複製到剪貼板！');
    });
  };

  // 離開房間
  const leaveRoom = () => {
    setIsConnected(false);
    setRoomCode('');
    setRoomData(null);
    setPhotos([]);
    setUsers([]);
    setCurrentUser('');
    setIsHost(false);
  };

  // 排序照片
  const sortedPhotos = [...photos].sort((a, b) => b.totalVotes - a.totalVotes);
  const topPhoto = sortedPhotos[0];

  // 如果未連接，顯示房間選擇界面
  if (!isConnected) {
    return (
      <div className="max-w-md mx-auto p-6 bg-gradient-to-br from-purple-50 to-pink-50 min-h-screen flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg p-8 w-full">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Image className="text-purple-600" size={40} />
              <Wifi className="text-blue-600" size={32} />
            </div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">照片選擇器</h1>
            <p className="text-gray-600 text-sm">支援多分頁即時同步</p>
          </div>

          <div className="space-y-6">
            <div>
              <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <Trophy className="text-yellow-500" size={20} />
                創建新房間
              </h2>
              <button
                onClick={createRoom}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all font-medium"
              >
                創建房間並開始
              </button>
              <p className="text-xs text-gray-500 mt-2 text-center">
                你將成為房主，可以邀請其他人加入
              </p>
            </div>

            <div className="border-t pt-6">
              <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <Users className="text-green-500" size={20} />
                加入現有房間
              </h2>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={joinRoomCode}
                  onChange={(e) => setJoinRoomCode(e.target.value.toUpperCase())}
                  placeholder="輸入房間代碼"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center font-mono text-lg"
                  maxLength={6}
                />
                <button
                  onClick={joinRoom}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                >
                  加入
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2 text-center">
                可以在新分頁或新視窗開啟相同網址測試多人功能
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 bg-gradient-to-br from-purple-50 to-pink-50 min-h-screen">
      <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
            <Image className="text-purple-600" size={36} />
            照片選擇室
          </h1>
          
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
              <Wifi size={16} />
              多視窗同步
            </div>
            <RefreshCw className="text-gray-400 animate-spin" size={16} title="即時同步中" />
            <button
              onClick={leaveRoom}
              className="text-sm text-red-600 hover:text-red-800 px-2 py-1 rounded"
            >
              離開房間
            </button>
          </div>
        </div>

        <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold flex items-center gap-2">
              <Share2 className="text-blue-600" size={20} />
              房間代碼: <span className="font-mono text-lg text-blue-600">{roomCode}</span>
            </h2>
            <div className="flex gap-2">
              <button
                onClick={copyRoomCode}
                className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                title="複製房間代碼"
              >
                <Copy size={16} />
              </button>
            </div>
          </div>
          
          <div className="text-sm text-gray-600 mb-2">
            {isHost ? '您是房主' : '您已加入房間'} • {users.length} 個參與者 • {photos.length} 張照片
          </div>
          
          <div className="text-xs text-green-600">
            💡 提示: 複製房間代碼，在新分頁或新視窗加入來測試多人功能
          </div>
        </div>

        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Users className="text-blue-600" size={20} />
            參與者管理
          </h2>
          
          <div className="flex flex-wrap gap-2 mb-3">
            {users.map(user => (
              <button
                key={user}
                onClick={() => setCurrentUser(user)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-all ${
                  currentUser === user 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {user}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={newUserName}
              onChange={(e) => setNewUserName(e.target.value)}
              placeholder="輸入新參與者姓名"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              onKeyPress={(e) => e.key === 'Enter' && addUser()}
            />
            <button
              onClick={addUser}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              添加
            </button>
          </div>
          
          {currentUser && (
            <div className="mt-3 text-sm text-gray-600">
              當前身份: <span className="font-semibold text-blue-600">{currentUser}</span>
            </div>
          )}
        </div>

        <div className="mb-6">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-purple-400 hover:bg-purple-50 transition-colors flex flex-col items-center gap-2"
          >
            <Upload className="text-gray-400" size={32} />
            <span className="text-gray-600 font-medium">點擊上傳照片（可多選）</span>
            <span className="text-xs text-gray-500">上傳後會即時同步到所有視窗</span>
          </button>
        </div>

        {photos.length > 0 && (
          <div className="mb-6 p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg">
            <div className="flex justify-between items-center text-sm text-gray-600 mb-2">
              <span>總照片數: {photos.length}</span>
              <span>參與者數: {users.length}</span>
            </div>
            
            {topPhoto && (
              <div className="flex items-center gap-2 text-sm">
                <Trophy className="text-yellow-500" size={16} />
                <span>目前最受歡迎: {topPhoto.name} ({topPhoto.totalVotes} 票)</span>
              </div>
            )}
          </div>
        )}
      </div>

      {photos.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {sortedPhotos.map((photo) => (
            <div key={photo.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
              <div className="relative">
                <img
                  src={photo.url}
                  alt={photo.name}
                  className="w-full h-48 object-cover"
                />
                <button
                  onClick={() => deletePhoto(photo.id)}
                  className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                >
                  <X size={16} />
                </button>
                
                {photo.totalVotes > 0 && photo.totalVotes === topPhoto?.totalVotes && (
                  <div className="absolute top-2 left-2 bg-yellow-500 text-white rounded-full p-1">
                    <Trophy size={16} />
                  </div>
                )}
              </div>
              
              <div className="p-4">
                <h3 className="font-medium text-gray-800 truncate mb-1">{photo.name}</h3>
                <p className="text-xs text-gray-500 mb-2">上傳者: {photo.uploadedBy}</p>
                
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-500">
                    {photo.totalVotes} 人喜歡
                  </span>
                  <button
                    onClick={() => toggleVote(photo.id)}
                    className={`flex items-center gap-1 px-3 py-1 rounded-full transition-colors ${
                      photo.votes[currentUser] 
                        ? 'bg-red-500 text-white' 
                        : 'bg-gray-200 text-gray-700 hover:bg-red-50 hover:text-red-600'
                    }`}
                  >
                    <Heart 
                      size={16} 
                      fill={photo.votes[currentUser] ? 'white' : 'none'}
                    />
                    <span className="text-sm">喜歡</span>
                  </button>
                </div>
                
                {photo.totalVotes > 0 && (
                  <div className="text-xs text-gray-500">
                    投票者: {Object.keys(photo.votes).join(', ')}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {photos.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <Image size={64} className="mx-auto mb-4 text-gray-300" />
          <p className="text-lg">還沒有照片，開始上傳吧！</p>
          <p className="text-sm mt-2">支援多視窗即時同步</p>
        </div>
      )}
    </div>
  );
};

export default App;
