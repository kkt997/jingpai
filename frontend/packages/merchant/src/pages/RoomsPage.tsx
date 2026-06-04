import { useEffect, useState } from 'react';
import { LiveRoom, roomApi } from '@jingpai/shared';
import { Plus, Users, Play, Square, Video, X } from 'lucide-react';

const statusLabels: Record<string, { label: string; color: string }> = {
  PREPARING: { label: '准备中', color: 'bg-zinc-100 text-zinc-600 border-zinc-200/60' },
  LIVE: { label: '直播中', color: 'bg-red-50 text-red-600 border-red-200/60 animate-pulse' },
  ENDED: { label: '已结束', color: 'bg-zinc-100 text-zinc-400 border-zinc-200/60' },
};

export default function RoomsPage() {
  const [rooms, setRooms] = useState<LiveRoom[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', streamUrl: '' });
  const [loading, setLoading] = useState(false);

  const fetchRooms = () => {
    roomApi.list().then((res: any) => setRooms(res.data || []));
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  const handleCreate = async () => {
    if (!form.title.trim()) return alert('请输入直播间标题');
    setLoading(true);
    try {
      await roomApi.create({ title: form.title, streamUrl: form.streamUrl });
      setShowCreate(false);
      setForm({ title: '', streamUrl: '' });
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
          <div className="bg-white border border-zinc-200 rounded-xl p-6 w-full max-w-md shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setShowCreate(false)}
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
              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1.5">直播流地址（可选）</label>
                <input
                  type="text"
                  value={form.streamUrl}
                  onChange={(e) => setForm({ ...form, streamUrl: e.target.value })}
                  className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 outline-none transition"
                  placeholder="rtmp://..."
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 border border-zinc-200 rounded-lg text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 text-sm font-semibold transition"
              >
                取消
              </button>
              <button
                onClick={handleCreate}
                disabled={loading}
                className="px-4 py-2 bg-zinc-900 text-white rounded-lg text-sm font-semibold hover:bg-zinc-800 disabled:opacity-50 transition shadow-sm"
              >
                {loading ? '创建中...' : '确认创建'}
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
              
              <div className="mt-6 pt-4 border-t border-zinc-100 flex gap-2">
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
                  <button
                    onClick={() => handleEnd(room.id)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 transition"
                  >
                    <Square className="w-3.5 h-3.5" />
                    <span>结束直播</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
