import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LiveRoom, roomApi, uploadApi } from '@jingpai/shared';

const statusLabels: Record<string, { label: string; color: string }> = {
  PREPARING: { label: '准备中', color: 'bg-gray-100 text-gray-600' },
  LIVE: { label: '直播中', color: 'bg-green-100 text-green-600' },
  ENDED: { label: '已结束', color: 'bg-red-100 text-red-500' },
};

type VideoMode = 'upload' | 'url';

export default function RoomsPage() {
  const [rooms, setRooms] = useState<LiveRoom[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', streamUrl: '' });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const [videoMode, setVideoMode] = useState<VideoMode>('upload');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadedName, setUploadedName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchRooms = () => {
    roomApi.list().then((res: any) => setRooms(res.data || []));
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  const resetForm = () => {
    setForm({ title: '', streamUrl: '' });
    setVideoMode('upload');
    setUploadProgress(0);
    setUploading(false);
    setUploadedName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSize = 200 * 1024 * 1024;
    if (file.size > maxSize) {
      alert('文件大小不能超过 200MB');
      e.target.value = '';
      return;
    }

    const allowed = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];
    if (!allowed.includes(file.type) && !file.name.match(/\.(mp4|webm|mov|avi|mkv)$/i)) {
      alert('仅支持 MP4/WebM/MOV/AVI/MKV 视频格式');
      e.target.value = '';
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadedName(file.name);

    try {
      const res: any = await uploadApi.upload(file, (pct) => setUploadProgress(pct));
      setForm((prev) => ({ ...prev, streamUrl: res.data.url }));
      setUploadProgress(100);
    } catch (err: any) {
      alert(err?.msg || '上传失败，请重试');
      setUploadedName('');
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveFile = () => {
    setForm((prev) => ({ ...prev, streamUrl: '' }));
    setUploadedName('');
    setUploadProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCreate = async () => {
    if (!form.title.trim()) return alert('请输入直播间标题');
    if (uploading) return alert('视频正在上传中，请等待完成');
    setLoading(true);
    try {
      await roomApi.create({ title: form.title, streamUrl: form.streamUrl });
      setShowCreate(false);
      resetForm();
      fetchRooms();
    } catch (err: any) {
      alert(err?.msg || '创建失败');
    } finally {
      setLoading(false);
    }
  };

  const handleStart = async (id: number) => {
    if (!confirm('确定开播？')) return;
    try {
      await roomApi.start(id);
      fetchRooms();
    } catch (err: any) {
      alert(err?.msg || '操作失败');
    }
  };

  const handleEnd = async (id: number) => {
    if (!confirm('确定结束直播？')) return;
    try {
      await roomApi.end(id);
      fetchRooms();
    } catch (err: any) {
      alert(err?.msg || '操作失败');
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">直播间管理</h2>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
        >
          + 创建直播间
        </button>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-2xl">
            <h3 className="text-lg font-bold mb-4">创建直播间</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">直播间标题</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  placeholder="例：珠宝专场竞拍"
                />
              </div>

              {/* Video source */}
              <div>
                <label className="block text-sm text-gray-600 mb-2">视频来源（可选）</label>
                <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5 mb-3">
                  <button
                    type="button"
                    onClick={() => { setVideoMode('upload'); setForm((p) => ({ ...p, streamUrl: '' })); setUploadedName(''); }}
                    className={`flex-1 text-xs py-1.5 rounded-md transition font-medium ${videoMode === 'upload' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}
                  >
                    上传视频
                  </button>
                  <button
                    type="button"
                    onClick={() => { setVideoMode('url'); setForm((p) => ({ ...p, streamUrl: '' })); setUploadedName(''); }}
                    className={`flex-1 text-xs py-1.5 rounded-md transition font-medium ${videoMode === 'url' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}
                  >
                    输入链接
                  </button>
                </div>

                {videoMode === 'upload' ? (
                  <div>
                    {!uploadedName ? (
                      <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition">
                        <svg className="w-8 h-8 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                        </svg>
                        <span className="text-sm text-gray-500">点击选择视频文件</span>
                        <span className="text-xs text-gray-400 mt-1">MP4 / WebM / MOV，最大 200MB</span>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.avi,.mkv"
                          onChange={handleFileSelect}
                          className="hidden"
                        />
                      </label>
                    ) : (
                      <div className="border rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <svg className="w-5 h-5 text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.91 11.672a.375.375 0 010 .656l-5.603 3.113a.375.375 0 01-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112z" />
                            </svg>
                            <span className="text-sm text-gray-700 truncate">{uploadedName}</span>
                          </div>
                          {!uploading && (
                            <button onClick={handleRemoveFile} className="text-gray-400 hover:text-red-500 flex-shrink-0 ml-2">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                        </div>
                        {/* Progress bar */}
                        {(uploading || uploadProgress > 0) && (
                          <div className="mt-2">
                            <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${uploadProgress >= 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                                style={{ width: `${uploadProgress}%` }}
                              />
                            </div>
                            <div className="text-xs text-gray-400 mt-1 text-right">
                              {uploading ? `上传中 ${uploadProgress}%` : uploadProgress >= 100 ? '上传完成' : ''}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <input
                      type="text"
                      value={form.streamUrl}
                      onChange={(e) => setForm({ ...form, streamUrl: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                      placeholder="https://example.com/video.mp4"
                    />
                    <p className="text-xs text-gray-400 mt-1.5">
                      填写 http/https 开头的视频链接（MP4/WebM）
                    </p>
                  </div>
                )}

                <p className="text-xs text-gray-400 mt-2">留空则使用默认演示视频</p>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => { setShowCreate(false); resetForm(); }} className="px-4 py-2 text-gray-600 text-sm">取消</button>
              <button
                onClick={handleCreate}
                disabled={loading || uploading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50"
              >
                {loading ? '创建中...' : uploading ? '上传中...' : '确认创建'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Room list */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {rooms.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-400 bg-white rounded-xl border">
            暂无直播间，点击上方按钮创建
          </div>
        )}
        {rooms.map((room) => {
          const s = statusLabels[room.status] || statusLabels.PREPARING;
          return (
            <div key={room.id} className="bg-white rounded-xl border p-5 hover:shadow-md transition">
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-bold text-gray-800">{room.title}</h3>
                <span className={`px-2 py-0.5 rounded-full text-xs ${s.color}`}>{s.label}</span>
              </div>
              <div className="text-sm text-gray-500 space-y-1">
                <div>ID: #{room.id}</div>
                <div>在线人数: {room.onlineCount}</div>
                {room.streamUrl && (
                  <div className="truncate text-xs text-gray-400" title={room.streamUrl}>
                    视频: {room.streamUrl}
                  </div>
                )}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {room.status === 'PREPARING' && (
                  <button
                    onClick={() => handleStart(room.id)}
                    className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
                  >
                    开播
                  </button>
                )}
                {room.status === 'LIVE' && (
                  <>
                    <button
                      onClick={() => navigate(`/room/${room.id}`)}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                    >
                      进入直播间
                    </button>
                    <button
                      onClick={() => handleEnd(room.id)}
                      className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600"
                    >
                      结束直播
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
