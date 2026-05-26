import { useEffect, useState } from 'react';
import { Product, productApi } from '@jingpai/shared';

const statusLabels: Record<string, { label: string; color: string }> = {
  DRAFT: { label: '草稿', color: 'bg-gray-100 text-gray-600' },
  LISTED: { label: '上架中', color: 'bg-green-100 text-green-600' },
  SOLD: { label: '已售出', color: 'bg-purple-100 text-purple-600' },
  REMOVED: { label: '已下架', color: 'bg-red-100 text-red-500' },
};

interface ProductForm {
  title: string;
  description: string;
  images: string;
  category: string;
}

const emptyForm: ProductForm = { title: '', description: '', images: '', category: '' };

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [loading, setLoading] = useState(false);

  const fetchProducts = () => {
    productApi.list().then((res: any) => setProducts(res.data || []));
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (p: Product) => {
    setEditingId(p.id);
    setForm({
      title: p.title,
      description: p.description || '',
      images: (p.images || []).join('\n'),
      category: p.category || '',
    });
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) return alert('请输入商品名称');
    setLoading(true);
    const data = {
      title: form.title,
      description: form.description,
      images: form.images.split('\n').map((s) => s.trim()).filter(Boolean),
      category: form.category,
    };
    try {
      if (editingId) {
        await productApi.update(editingId, data);
      } else {
        await productApi.create(data);
      }
      setShowModal(false);
      fetchProducts();
    } catch (err: any) {
      alert(err?.msg || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除该商品？')) return;
    try {
      await productApi.delete(id);
      fetchProducts();
    } catch (err: any) {
      alert(err?.msg || '删除失败');
    }
  };

  const handleList = async (id: number) => {
    try {
      await productApi.listProduct(id);
      fetchProducts();
    } catch (err: any) {
      alert(err?.msg || '上架失败');
    }
  };

  const handleUnlist = async (id: number) => {
    if (!confirm('确定下架该商品？')) return;
    try {
      await productApi.unlistProduct(id);
      fetchProducts();
    } catch (err: any) {
      alert(err?.msg || '下架失败');
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">商品管理</h2>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
        >
          + 添加商品
        </button>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-2xl">
            <h3 className="text-lg font-bold mb-4">{editingId ? '编辑商品' : '添加商品'}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">商品名称 *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  placeholder="例：缅甸天然翡翠手镯"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">商品描述</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm h-24 resize-none"
                  placeholder="详细描述商品信息..."
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">图片URL（每行一个）</label>
                <textarea
                  value={form.images}
                  onChange={(e) => setForm({ ...form, images: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm h-20 resize-none font-mono"
                  placeholder="https://example.com/image1.jpg&#10;https://example.com/image2.jpg"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">分类</label>
                <input
                  type="text"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  placeholder="例：珠宝、手表、包包"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-600 text-sm">取消</button>
              <button onClick={handleSubmit} disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50">
                {loading ? '保存中...' : '确认保存'}
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
              <th className="text-left px-6 py-3 text-sm text-gray-500 font-medium">商品名称</th>
              <th className="text-left px-6 py-3 text-sm text-gray-500 font-medium">分类</th>
              <th className="text-left px-6 py-3 text-sm text-gray-500 font-medium">状态</th>
              <th className="text-left px-6 py-3 text-sm text-gray-500 font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {products.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-gray-400">
                  暂无商品，点击右上角添加
                </td>
              </tr>
            )}
            {products.map((p) => {
              const s = statusLabels[(p as any).status] || statusLabels.DRAFT;
              return (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium">{p.title}</td>
                  <td className="px-6 py-4 text-gray-500">{p.category || '-'}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs ${s.color}`}>{s.label}</span>
                  </td>
                  <td className="px-6 py-4 space-x-3">
                    {(p as any).status === 'DRAFT' && (
                      <>
                        <button onClick={() => handleList(p.id)} className="text-green-600 text-sm hover:underline">上架</button>
                        <button onClick={() => openEdit(p)} className="text-blue-600 text-sm hover:underline">编辑</button>
                        <button onClick={() => handleDelete(p.id)} className="text-red-500 text-sm hover:underline">删除</button>
                      </>
                    )}
                    {(p as any).status === 'LISTED' && (
                      <button onClick={() => handleUnlist(p.id)} className="text-orange-500 text-sm hover:underline">下架</button>
                    )}
                    {(p as any).status === 'SOLD' && (
                      <span className="text-gray-400 text-sm">已售出</span>
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
