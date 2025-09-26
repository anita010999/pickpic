import React, { useState, useRef, useEffect } from 'react';
import { Upload, Heart, X, Users, Trophy, Image, Share2, Copy, Cloud, Loader, AlertCircle } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

// Supabase 配置
const supabaseUrl = 'https://bmtrsorncvwwcfixqvcd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJtdHJzb3JuY3Z3d2NmaXhxdmNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg2ODA1NDUsImV4cCI6MjA3NDI1NjU0NX0.U59kJUCLVds-pWbXxD2q5vLxa_VwmacUmmDjcWUoUQY';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const App = () => {
  const [photos, setPhotos] = useState([]);
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [roomId, setRoomId] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [joinRoomCode, setJoinRoomCode] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');
  const [supabaseReady, setSupabaseReady] = useState(false);
  const fileInputRef = useRef(null);

  // 檢查 Supabase 連線
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const { data, error } = await supabase.from('rooms').select('id').limit(1);
        if (error) {
          console.error('Supabase 連線檢查失敗:', error);
          setSupabaseReady(false);
        } else {
          console.log('Supabase 連線成功');
          setSupabaseReady(true);
        }
      } catch (error) {
        console.error('Supabase 初始化失敗:', error);
        setSupabaseReady(false);
      }
    };
    
    checkConnection();
  }, []);

  // 生成房間代碼
  const generateRoomCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  // 創建房間
  const createRoom = async () => {
    setLoading(true);
    try {
      const code = generateRoomCode();
      
      const { data, error } = await supabase
        .from('rooms')
        .insert([
          {
            room_code: code,
            host_name: 'Host',
            updated_at: new Date().toISOString()
          }
        ])
        .select()
        .single();

      if (error) throw error;

      setRoomCode(code);
      setRoomId(data.id);
      setIsHost(true);
      setIsConnected(true);
      
      subscribeToRoom(data.id);
      
    } catch (error) {
      console.error('創建房間失敗:', error);
      alert(`創建房間失敗: ${error.message || '請檢查網路連線'}`);
    } finally {
      setLoading(false);
    }
  };

  // 加入房間
  const joinRoom = async () => {
    if (!joinRoomCode.trim()) return;
    
    setLoading(true);
    try {
      const code = joinRoomCode.trim().toUpperCase();
      
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('room_code', code)
        .single();

      if (error || !data) {
        alert('房間代碼不存在或無效');
        return;
      }

      setRoomCode(code);
      setRoomId(data.id);
      setIsHost(false);
      setIsConnected(true);
      setJoinRoomCode('');
      
      await loadRoomData(data.id);
      subscribeToRoom(data.id);
      
    } catch (error) {
      console.error('加入房間失敗:', error);
      alert(`加入房間失敗: ${error.message || '請重試'}`);
    } finally {
      setLoading(false);
    }
  };

  // 載入房間資料
  const loadRoomData = async (currentRoomId) => {
    try {
      const { data: photosData } = await supabase
        .from('photos')
        .select('*')
        .eq('room_id', currentRoomId)
        .order('uploaded_at', { ascending: false });

      const { data: usersData } = await supabase
        .from('room_users')
        .select('user_name')
        .eq('room_id', currentRoomId);

      setPhotos(photosData || []);
      setUsers(usersData?.map(u => u.user_name) || []);
      
    } catch (error) {
      console.error('載入房間資料失敗:', error);
    }
  };

  // 即時監聽
  const subscribeToRoom = (currentRoomId) => {
    supabase
      .channel(`photos_${currentRoomId}`)
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'photos', filter: `room_id=eq.${currentRoomId}` },
        () => loadRoomData(currentRoomId)
      )
      .subscribe();

    supabase
      .channel(`users_${currentRoomId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'room_users', filter: `room_id=eq.${currentRoomId}` },
        () => loadRoomData(currentRoomId)
      )
      .subscribe();
  };

  // 添加用戶
  const addUser = async () => {
    if (!newUserName.trim() || users.includes(newUserName.trim()) || !roomId) return;
    
    try {
      const { error } = await supabase
        .from('room_users')
        .insert([
          {
            room_id: roomId,
            user_name: newUserName.trim(),
            joined_at: new Date().toISOString()
          }
        ]);

      if (error) throw error;
      setNewUserName('');
      
    } catch (error) {
      console.error('添加用戶失敗:', error);
      alert(`添加用戶失敗: ${error.message}`);
    }
  };

  // 上傳照片
  const uploadPhotoToStorage = async (file, fileName) => {
    const fileExt = file.name.split('.').pop();
    const uniqueFileName = `${fileName}.${fileExt}`;
    const filePath = `${roomCode}/${uniqueFileName}`;

    const { data, error } = await supabase.storage
      .from('photos')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) throw error;

    const { data: urlData } = supabase.storage
      .from('photos')
      .getPublicUrl(filePath);

    return {
      filePath: data.path,
      publicUrl: urlData.publicUrl
    };
  };

  // 處理照片上傳
  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files);
    
    if (files.length === 0 || !roomId) return;

    setLoading(true);
    setUploadProgress(0);
    setUploadStatus('準備上傳...');
    
    try {
      const imageFiles = files.filter(file => file.type.startsWith('image/'));

      for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i];
        
        try {
          setUploadStatus(`上傳照片 ${i + 1}/${imageFiles.length}: ${file.name}`);
          
          const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
          const { publicUrl } = await uploadPhotoToStorage(file, fileName);

          const { error: dbError } = await supabase
            .from('photos')
            .insert([
              {
                room_id: roomId,
                file_name: file.name,
                file_url: publicUrl,
                uploaded_by: currentUser || 'Unknown',
                uploaded_at: new Date().toISOString(),
                votes: {}
              }
            ]);

          if (dbError) throw dbError;
          setUploadProgress(((i + 1) / imageFiles.length) * 100);
          
        } catch (error) {
          console.error(`上傳 ${file.name} 失敗:`, error);
          alert(`上傳 ${file.name} 失敗: ${error.message}`);
        }
      }
      
      setUploadStatus(`完成上傳 ${imageFiles.length} 張照片`);
      setTimeout(() => setUploadStatus(''), 2000);
      
    } catch (error) {
      console.error('批量上傳失敗:', error);
      alert(`上傳失敗: ${error.message}`);
    } finally {
      setLoading(false);
      setUploadProgress(0);
      event.target.value = '';
    }
  };

  // 投票功能
  const toggleVote = async (photoId) => {
    if (!currentUser) {
      alert('請先選擇您的身份！');
      return;
    }

    try {
      const photo = photos.find(p => p.id === photoId);
      if (!photo) return;

      const currentVotes = photo.votes || {};
      const newVotes = { ...currentVotes };

      if (newVotes[currentUser]) {
        delete newVotes[currentUser];
      } else {
        newVotes[currentUser] = true;
      }

      const { error } = await supabase
        .from('photos')
        .update({ 
          votes: newVotes,
          updated_at: new Date().toISOString()
        })
        .eq('id', photoId);

      if (error) throw error;
      
    } catch (error) {
      console.error('投票失敗:', error);
      alert(`投票失敗: ${error.message}`);
    }
  };

  // 刪除照片 - 替換 confirm 為 window.confirm
  const deletePhoto = async (photoId) => {
    // 使用 window.confirm 避免 ESLint 錯誤
    const shouldDelete = window.confirm('確定要刪除這張照片嗎？');
    if (!shouldDelete) return;

    try {
      const photo = photos.find(p => p.id === photoId);
      if (!photo) return;

      const urlParts = photo.file_url.split('/');
      const fileName = urlParts[urlParts.length - 1];
      const filePath = `${roomCode}/${fileName}`;
      
      await supabase.storage.from('photos').remove([filePath]);

      const { error: dbError } = await supabase
        .from('photos')
        .delete()
        .eq('id', photoId);

      if (dbError) throw dbError;
      
    } catch (error) {
      console.error('刪除照片失敗:', error);
      alert(`刪除失敗: ${error.message}`);
    }
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
    setRoomId('');
    setPhotos([]);
    setUsers([]);
    setCurrentUser('');
    setIsHost(false);
  };

  // 計算投票數並排序
  const photosWithVotes = photos.map(photo => ({
    ...photo,
    totalVotes: Object.keys(photo.votes || {}).length
  }));
  const sortedPhotos = [...photosWithVotes].sort((a, b) => b.totalVotes - a.totalVotes);
  const topPhoto = sortedPhotos[0];

  // 檢查 Supabase 連線狀態
  if (!supabaseReady) {
    return (
      <div className="max-w-md mx-auto p-6 bg-gradient-to-br from-red-50 to-orange-50 min-h-screen flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg p-8 w-full text-center">
          <AlertCircle className="text-red-500 mx-auto mb-4" size={48} />
          <h1 className="text-xl font-bold text-gray-800 mb-2">連線失敗</h1>
          <p className="text-gray-600 text-sm mb-4">
            無法連接到 Supabase 資料庫，請檢查網路連線
          </p>
          <button 
            onClick={() => window.location.reload()} 
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
          >
            重新載入
          </button>
        </div>
      </div>
    );
  }

  // 如果未連接，顯示房間選擇界面
  if (!isConnected) {
    return (
      <div className="max-w-md mx-auto p-6 bg-gradient-to-br from-purple-50 to-pink-50 min-h-screen flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg p-8 w-full">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Cloud className="text-blue-600" size={40} />
              <Image className="text-purple-600" size={40} />
            </div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">雲端照片選擇器</h1>
            <p className="text-gray-600 text-sm">無限制上傳 • 真正跨裝置同步</p>
          </div>

          <div className="space-y-6">
            <div>
              <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <Trophy className="text-yellow-500" size={20} />
                創建新房間
              </h2>
              <button
                onClick={createRoom}
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader className="animate-spin" size={20} /> : <Cloud size={20} />}
                {loading ? '創建中...' : '創建雲端房間'}
              </button>
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
                  disabled={loading}
                />
                <button
                  onClick={joinRoom}
                  disabled={loading}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50"
                >
                  {loading ? <Loader className="animate-spin" size={16} /> : '加入'}
                </button>
              </div>
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
            <Cloud className="text-blue-600" size={36} />
            雲端照片選擇室
          </h1>
          
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
              <Cloud size={16} />
              雲端同步
            </div>
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
            <button
              onClick={copyRoomCode}
              className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              title="複製房間代碼"
            >
              <Copy size={16} />
            </button>
          </div>
          
          <div className="text-sm text-gray-600 mb-2">
            {isHost ? '您是房主' : '您已加入房間'} • {users.length} 個參與者 • {photos.length} 張照片
          </div>
          
          <div className="text-xs text-green-600">
            雲端版本：無限制照片上傳，支援任何裝置即時同步
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
              disabled={loading}
            />
            <button
              onClick={addUser}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
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
            disabled={loading}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            className="w-full p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors flex flex-col items-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader className="animate-spin text-blue-500" size={32} /> : <Upload className="text-gray-400" size={32} />}
            <span className="text-gray-600 font-medium">
              {loading ? '上傳中...' : '點擊上傳照片（無限制數量）'}
            </span>
            <span className="text-xs text-gray-500">雲端存儲，即時同步到所有裝置</span>
          </button>
          
          {(uploadProgress > 0 || uploadStatus) && (
            <div className="mt-3">
              {uploadProgress > 0 && (
                <div className="bg-gray-200 rounded-full h-2 mb-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
              )}
              {uploadStatus && (
                <p className="text-sm text-gray-600 text-center">{uploadStatus}</p>
              )}
            </div>
          )}
        </div>

        {photos.length > 0 && (
          <div className="mb-6 p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg">
            <div className="flex justify-between items-center text-sm text-gray-600 mb-2">
              <span>總照片數: {photos.length} (無限制)</span>
              <span>參與者數: {users.length}</span>
            </div>
            
            {topPhoto && (
              <div className="flex items-center gap-2 text-sm">
                <Trophy className="text-yellow-500" size={16} />
                <span>目前最受歡迎: {topPhoto.file_name} ({topPhoto.totalVotes} 票)</span>
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
                  src={photo.file_url}
                  alt={photo.file_name}
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
                <h3 className="font-medium text-gray-800 truncate mb-1">{photo.file_name}</h3>
                <p className="text-xs text-gray-500 mb-2">上傳者: {photo.uploaded_by}</p>
                
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-500">
                    {photo.totalVotes} 人喜歡
                  </span>
                  <button
                    onClick={() => toggleVote(photo.id)}
                    className={`flex items-center gap-1 px-3 py-1 rounded-full transition-colors ${
                      photo.votes?.[currentUser]
                        ? 'bg-red-500 text-white' 
                        : 'bg-gray-200 text-gray-700 hover:bg-red-50 hover:text-red-600'
                    }`}
                  >
                    <Heart 
                      size={16} 
                      fill={photo.votes?.[currentUser] ? 'white' : 'none'}
                    />
                    <span className="text-sm">喜歡</span>
                  </button>
                </div>
                
                {photo.totalVotes > 0 && (
                  <div className="text-xs text-gray-500">
                    投票者: {Object.keys(photo.votes || {}).join(', ')}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {photos.length === 0 && !loading && (
        <div className="text-center py-12 text-gray-500">
          <Cloud size={64} className="mx-auto mb-4 text-gray-300" />
          <p className="text-lg">還沒有照片，開始上傳吧！</p>
          <p className="text-sm mt-2">雲端版本支援無限制照片上傳</p>
        </div>
      )}
    </div>
  );
};

export default App;
