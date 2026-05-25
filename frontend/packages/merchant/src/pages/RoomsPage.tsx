import { useEffect, useState } from 'react';
import { LiveRoom, roomApi } from '@jingpai/shared';

const statusLabels: Record<string, { label: string; color: string }> = {
  PREPARING: { label: '准备中', color: 'bg-gray-100 text-gray-600' },
  LIVE: { label: '直播中', color: 'bg-green-100 text-green-600' },
  ENDED: { label: '已结束', color: 'bg-red-100 text-red-500' },
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
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
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
              <div>
                <label className="block text-sm text-gray-600 mb-1">直播流地址（可选）</label>
                <input
                  type="text"
                  value={form.streamUrl}
                  onChange={(e) => setForm({ ...form, streamUrl: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  placeholder="rtmp://..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-gray-600 text-sm">取消</button>
              <button onClick={handleCreate} disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50">
                {loading ? '创建中...' : '确认创建'}
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
              </div>
              <div className="mt-4 flex gap-2">
                {room.status === 'PREPARING' && (
                  <button
                    onClick={() => handleStart(room.id)}
                    className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
                  >
                    开播
                  </button>
                )}
                {room.status === 'LIVE' && (
                  <button
                    onClick={() => handleEnd(room.id)}
                    className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600"
                  >
                    结束直播
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
