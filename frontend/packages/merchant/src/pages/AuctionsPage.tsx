import { useEffect, useState } from 'react';
import { Auction, Product, LiveRoom, auctionApi, productApi, roomApi } from '@jingpai/shared';

const statusLabels: Record<string, { label: string; color: string }> = {
  DRAFT: { label: '草稿', color: 'bg-gray-100 text-gray-600' },
  PENDING: { label: '待开始', color: 'bg-blue-100 text-blue-600' },
  ACTIVE: { label: '进行中', color: 'bg-green-100 text-green-600' },
  EXTENDED: { label: '延时中', color: 'bg-yellow-100 text-yellow-700' },
  COMPLETED: { label: '已成交', color: 'bg-purple-100 text-purple-600' },
  FAILED: { label: '流拍', color: 'bg-gray-100 text-gray-500' },
  CANCELLED: { label: '已取消', color: 'bg-red-100 text-red-600' },
};

interface CreateForm {
  productId: string;
  roomId: string;
  mode: 'OPEN' | 'BLIND';
  startingPrice: string;
  incrementAmount: string;
  ceilingPrice: string;
  depositAmount: string;
  durationSeconds: string;
  autoExtendSeconds: string;
}

const emptyForm: CreateForm = {
  productId: '',
  roomId: '',
  mode: 'OPEN',
  startingPrice: '0',
  incrementAmount: '100',
  ceilingPrice: '',
  depositAmount: '500',
  durationSeconds: '120',
  autoExtendSeconds: '20',
};

export default function AuctionsPage() {
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [rooms, setRooms] = useState<LiveRoom[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CreateForm>(emptyForm);
  const [loading, setLoading] = useState(false);

  const fetchAuctions = () => {
    auctionApi.list().then((res: any) => setAuctions(res.data || []));
  };

  useEffect(() => {
    fetchAuctions();
  }, []);

  const openCreateModal = async () => {
    const [prodRes, roomRes] = await Promise.all([
      productApi.list(),
      roomApi.list(),
    ]) as any[];
    setProducts(prodRes.data || []);
    setRooms(roomRes.data || []);
    setForm(emptyForm);
    setShowCreate(true);
  };

  const handleCreate = async () => {
    if (!form.productId || !form.roomId) return alert('请选择商品和直播间');
    if (!form.incrementAmount || Number(form.incrementAmount) <= 0) return alert('加价幅度必须大于0');
    setLoading(true);
    try {
      const data: Record<string, unknown> = {
        productId: Number(form.productId),
        roomId: Number(form.roomId),
        mode: form.mode,
        startingPrice: Number(form.startingPrice) || 0,
        incrementAmount: Number(form.incrementAmount),
        durationSeconds: Number(form.durationSeconds) || 120,
        autoExtendSeconds: Number(form.autoExtendSeconds) || 20,
      };
      if (form.ceilingPrice) {
        data.ceilingPrice = Number(form.ceilingPrice);
      }
      if (form.depositAmount && Number(form.depositAmount) > 0) {
        data.depositAmount = Number(form.depositAmount);
      }
      await auctionApi.create(data);
      setShowCreate(false);
      fetchAuctions();
    } catch (err: any) {
      alert(err?.msg || '创建失败');
    } finally {
      setLoading(false);
    }
  };

  const handleStart = async (id: number) => {
    if (!confirm('确定开始竞拍？开始后用户即可出价')) return;
    setLoading(true);
    try {
      await auctionApi.start(id);
      fetchAuctions();
    } catch (err: any) {
      alert(err?.msg || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (id: number) => {
    const reason = prompt('请输入取消原因（可选）');
    if (reason === null) return;
    setLoading(true);
    try {
      await auctionApi.cancel(id, reason || undefined);
      fetchAuctions();
    } catch (err: any) {
      alert(err?.msg || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">竞拍管理</h2>
        <button
          onClick={openCreateModal}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
        >
          + 发布竞拍
        </button>
      </div>

      {/* Create auction modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center overflow-y-auto py-8">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-2xl">
            <h3 className="text-lg font-bold mb-4">发布竞拍</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">选择商品 *</label>
                <select
                  value={form.productId}
                  onChange={(e) => setForm({ ...form, productId: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">-- 请选择 --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">选择直播间 *</label>
                <select
                  value={form.roomId}
                  onChange={(e) => setForm({ ...form, roomId: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">-- 请选择 --</option>
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>{r.title} ({r.status})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">竞拍模式</label>
                  <select
                    value={form.mode}
                    onChange={(e) => setForm({ ...form, mode: e.target.value as 'OPEN' | 'BLIND' })}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="OPEN">明拍</option>
                    <option value="BLIND">盲拍</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">起拍价 (¥)</label>
                  <input
                    type="number"
                    value={form.startingPrice}
                    onChange={(e) => setForm({ ...form, startingPrice: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    min="0"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">加价幅度 (¥) *</label>
                  <input
                    type="number"
                    value={form.incrementAmount}
                    onChange={(e) => setForm({ ...form, incrementAmount: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    min="1"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">封顶价 (¥, 可选)</label>
                  <input
                    type="number"
                    value={form.ceilingPrice}
                    onChange={(e) => setForm({ ...form, ceilingPrice: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    placeholder="不填则无封顶"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">保证金 (¥, 0 = 无需保证金)</label>
                <input
                  type="number"
                  value={form.depositAmount}
                  onChange={(e) => setForm({ ...form, depositAmount: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  min="0"
                  placeholder="0 表示无需保证金"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">竞拍时长 (秒)</label>
                  <input
                    type="number"
                    value={form.durationSeconds}
                    onChange={(e) => setForm({ ...form, durationSeconds: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    min="10"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">延时秒数</label>
                  <input
                    type="number"
                    value={form.autoExtendSeconds}
                    onChange={(e) => setForm({ ...form, autoExtendSeconds: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    min="5" max="60"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-gray-600 text-sm">取消</button>
              <button onClick={handleCreate} disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50">
                {loading ? '创建中...' : '确认发布'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-6 py-3 text-sm text-gray-500 font-medium">商品</th>
              <th className="text-left px-6 py-3 text-sm text-gray-500 font-medium">模式</th>
              <th className="text-left px-6 py-3 text-sm text-gray-500 font-medium">起拍价</th>
              <th className="text-left px-6 py-3 text-sm text-gray-500 font-medium">当前价</th>
              <th className="text-left px-6 py-3 text-sm text-gray-500 font-medium">出价次数</th>
              <th className="text-left px-6 py-3 text-sm text-gray-500 font-medium">保证金</th>
              <th className="text-left px-6 py-3 text-sm text-gray-500 font-medium">状态</th>
              <th className="text-left px-6 py-3 text-sm text-gray-500 font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {auctions.length === 0 && (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-gray-400">暂无竞拍</td>
              </tr>
            )}
            {auctions.map((a) => {
              const s = statusLabels[a.status] || statusLabels.DRAFT;
              return (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium">{a.product?.title || '-'}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-xs ${a.mode === 'BLIND' ? 'bg-purple-100 text-purple-600' : 'bg-blue-50 text-blue-600'}`}>
                      {a.mode === 'BLIND' ? '盲拍' : '明拍'}
                    </span>
                  </td>
                  <td className="px-6 py-4 tabular-nums">¥{a.startingPrice}</td>
                  <td className="px-6 py-4 tabular-nums font-medium text-orange-600">¥{a.currentPrice}</td>
                  <td className="px-6 py-4">{a.bidCount}</td>
                  <td className="px-6 py-4 tabular-nums text-sm">
                    {a.depositAmount > 0 ? `¥${a.depositAmount}` : <span className="text-gray-400">-</span>}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs ${s.color}`}>{s.label}</span>
                  </td>
                  <td className="px-6 py-4 space-x-2">
                    {a.status === 'PENDING' && (
                      <button onClick={() => handleStart(a.id)} disabled={loading} className="text-green-600 text-sm hover:underline disabled:opacity-50">
                        开始竞拍
                      </button>
                    )}
                    {(a.status === 'ACTIVE' || a.status === 'EXTENDED') && (
                      <button onClick={() => handleCancel(a.id)} disabled={loading} className="text-red-500 text-sm hover:underline disabled:opacity-50">
                        取消竞拍
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
