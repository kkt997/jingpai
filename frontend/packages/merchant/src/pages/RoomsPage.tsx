import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LiveRoom, roomApi, uploadApi } from '@jingpai/shared';
import { Plus, Users, Play, Square, Video, X } from 'lucide-react';

const statusLabels: Record<string, { label: string; color: string }> = {
  PREPARING: { label: '准备中', color: 'bg-zinc-100 text-zinc-600 border-zinc-200/60' },
  LIVE: { label: '直播中', color: 'bg-red-50 text-red-600 border-red-200/60 animate-pulse' },
  ENDED: { label: '已结束', color: 'bg-zinc-100 text-zinc-400 border-zinc-200/60' },
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
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900">直播间管理</h2>
          <p className="text-sm text-zinc-500 mt-1">创建直播专场，监控与控制推流状态</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 transition-all duration-200 text-sm font-semibold shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>创建直播间</span>
        </button>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-zinc-950/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-zinc-200 rounded-xl p-6 w-full max-w-lg shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => { setShowCreate(false); resetForm(); }}
              className="absolute right-4 top-4 p-1 rounded-md text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="text-base font-bold text-zinc-900 mb-5">创建直播间</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1.5">直播间标题</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 outline-none transition"
                  placeholder="例：珠宝专场竞拍"
                />
              </div>

              {/* Video source */}
              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1.5">视频来源（可选）</label>
                <div className="flex gap-1 bg-zinc-100 rounded-lg p-0.5 mb-3">
                  <button
                    type="button"
                    onClick={() => { setVideoMode('upload'); setForm((p) => ({ ...p, streamUrl: '' })); setUploadedName(''); }}
                    className={`flex-1 text-xs py-1.5 rounded-md transition font-medium ${videoMode === 'upload' ? 'bg-white text-zinc-900 shadow-sm border border-zinc-200/10' : 'text-zinc-500 hover:text-zinc-800'}`}
                  >
                    上传视频
                  </button>
                  <button
                    type="button"
                    onClick={() => { setVideoMode('url'); setForm((p) => ({ ...p, streamUrl: '' })); setUploadedName(''); }}
                    className={`flex-1 text-xs py-1.5 rounded-md transition font-medium ${videoMode === 'url' ? 'bg-white text-zinc-900 shadow-sm border border-zinc-200/10' : 'text-zinc-500 hover:text-zinc-800'}`}
                  >
                    输入链接
                  </button>
                </div>

                {videoMode === 'upload' ? (
                  <div>
                    {!uploadedName ? (
                      <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-zinc-200 rounded-xl cursor-pointer hover:border-zinc-400 hover:bg-zinc-50/50 transition">
                        <svg className="w-8 h-8 text-zinc-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                        </svg>
                        <span className="text-sm text-zinc-500">点击选择视频文件</span>
                        <span className="text-xs text-zinc-400 mt-1">MP4 / WebM / MOV，最大 200MB</span>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.avi,.mkv"
                          onChange={handleFileSelect}
                          className="hidden"
                        />
                      </label>
                    ) : (
                      <div className="border border-zinc-200 rounded-xl p-3 bg-zinc-50/30">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <svg className="w-5 h-5 text-brand flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.91 11.672a.375.375 0 010 .656l-5.603 3.113a.375.375 0 01-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112z" />
                            </svg>
                            <span className="text-sm text-zinc-700 font-semibold truncate">{uploadedName}</span>
                          </div>
                          {!uploading && (
                            <button onClick={handleRemoveFile} className="text-zinc-400 hover:text-red-500 flex-shrink-0 ml-2 transition">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                        </div>
                        {/* Progress bar */}
                        {(uploading || uploadProgress > 0) && (
                          <div className="mt-2">
                            <div className="h-1.5 bg-zinc-150 rounded-full overflow-hidden">
                              <div
                                  className={`h-full rounded-full transition-all duration-300 ${uploadProgress >= 100 ? 'bg-emerald-500' : 'bg-brand'}`}
                                style={{ width: `${uploadProgress}%` }}
                              />
                            </div>
                            <div className="text-xs text-zinc-400 mt-1 text-right font-medium">
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
                      className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 outline-none transition"
                      placeholder="https://example.com/video.mp4"
                    />
                    <p className="text-xs text-zinc-400 mt-1.5 font-medium">
                      填写 http/https 开头的视频链接（MP4/WebM）
                    </p>
                  </div>
                )}

                <p className="text-xs text-zinc-400 mt-2 font-medium">留空则使用默认演示视频</p>
              </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => { setShowCreate(false); resetForm(); }}
                className="px-4 py-2 border border-zinc-200 rounded-lg text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 text-sm font-semibold transition"
              >
                取消
              </button>
              <button
                onClick={handleCreate}
                disabled={loading || uploading}
                className="px-4 py-2 bg-zinc-900 text-white rounded-lg text-sm font-semibold hover:bg-zinc-800 disabled:opacity-50 transition shadow-sm"
              >
                {loading ? '创建中...' : uploading ? '上传中...' : '确认创建'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Room list */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {rooms.length === 0 && (
          <div className="col-span-full text-center py-20 text-zinc-400 bg-white rounded-xl border border-zinc-200/80 shadow-sm">
            <Video className="w-10 h-10 mx-auto text-zinc-300 mb-3" />
            <p className="text-sm font-medium">暂无活动直播间</p>
            <p className="text-xs text-zinc-400 mt-1">点击右上角按钮新建一个直播间吧</p>
          </div>
        )}
        {rooms.map((room) => {
          const s = statusLabels[room.status] || statusLabels.PREPARING;
          return (
            <div
              key={room.id}
              className="bg-white border border-zinc-200/80 rounded-xl p-6 hover:shadow-md hover:border-zinc-300 transition duration-300 flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-start gap-4 mb-3">
                  <h3 className="font-bold text-zinc-900 text-base leading-snug line-clamp-1">{room.title}</h3>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${s.color}`}>
                    {s.label}
                  </span>
                </div>
                <div className="text-xs text-zinc-400 font-medium space-y-1.5 mt-4">
                  <div className="flex items-center gap-1.5">
                    <span className="text-zinc-500">ID:</span>
                    <span className="text-zinc-700">#{room.id}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-zinc-400" />
                    <span className="text-zinc-700">在线人数:</span>
                    <span className="text-zinc-900 font-semibold">{room.onlineCount}</span>
                  </div>
                </div>
              </div>
              {room.streamUrl && (
                <div className="flex items-center gap-1.5 mt-2 text-[11px] text-zinc-400 font-semibold bg-zinc-50 border border-zinc-150 px-2.5 py-1 rounded-lg truncate" title={room.streamUrl}>
                  <span className="text-zinc-500">流地址:</span>
                  <span className="truncate">{room.streamUrl}</span>
                </div>
              )}
              
              <div className="mt-6 pt-4 border-t border-zinc-100 flex flex-wrap gap-2">
                {room.status === 'PREPARING' && (
                  <button
                    onClick={() => handleStart(room.id)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-zinc-900 text-white rounded-lg text-xs font-semibold hover:bg-zinc-800 transition"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>开启直播</span>
                  </button>
                )}
                {room.status === 'LIVE' && (
                  <div className="flex gap-2 w-full">
                    <button
                      onClick={() => navigate(`/room/${room.id}`)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-zinc-900 text-white rounded-lg text-xs font-semibold hover:bg-zinc-800 transition"
                    >
                      <Video className="w-3.5 h-3.5" />
                      <span>进入直播</span>
                    </button>
                    <button
                      onClick={() => handleEnd(room.id)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 transition"
                    >
                      <Square className="w-3.5 h-3.5" />
                      <span>结束直播</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
