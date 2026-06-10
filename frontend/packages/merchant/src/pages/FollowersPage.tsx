import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FollowListItem, conversationApi, followApi } from '@jingpai/shared';

export default function FollowersPage() {
  const navigate = useNavigate();
  const [followers, setFollowers] = useState<FollowListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    followApi.merchantFollowers().then((res: any) => {
      setFollowers(res.data || []);
      setLoading(false);
    });
  }, []);

  const handleChat = async (userId: number) => {
    const res: any = await conversationApi.create(userId);
    navigate(`/messages/${res.data.id}`);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">粉丝管理</h1>
        <p className="text-sm text-zinc-500 mt-1">查看关注你的用户并快速发起私聊</p>
      </div>

      {loading ? (
        <div className="py-20 text-center text-zinc-400">加载中...</div>
      ) : followers.length === 0 ? (
        <div className="bg-white border border-zinc-200/80 rounded-2xl p-12 text-center text-zinc-400 shadow-sm">
          暂无粉丝关注
        </div>
      ) : (
        <div className="bg-white border border-zinc-200/80 rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-zinc-50">
              <tr>
                <th className="text-left px-6 py-4 text-sm font-medium text-zinc-500">用户</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-zinc-500">角色</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-zinc-500">关注时间</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-zinc-500">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {followers.map((follower) => (
                <tr key={follower.id} className="hover:bg-zinc-50/70">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-red-500 text-white font-bold flex items-center justify-center">
                        {follower.nickname?.charAt(0) || '?'}
                      </div>
                      <div>
                        <div className="font-medium text-zinc-900">{follower.nickname}</div>
                        <div className="text-xs text-zinc-500">ID #{follower.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-zinc-600">{follower.role === 'MERCHANT' ? '商家' : '用户'}</td>
                  <td className="px-6 py-4 text-sm text-zinc-500">{formatTime(follower.followedAt)}</td>
                  <td className="px-6 py-4">
                    <button
                      type="button"
                      onClick={() => handleChat(follower.id)}
                      className="px-4 py-2 rounded-xl bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-800"
                    >
                      发起私聊
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function formatTime(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
