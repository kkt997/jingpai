import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MerchantProfileSummary, conversationApi, followApi, profileApi } from '@jingpai/shared';

export default function MerchantProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const merchantId = Number(id);
  const [profile, setProfile] = useState<MerchantProfileSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadProfile = async () => {
    if (!merchantId) return;
    const res: any = await profileApi.merchant(merchantId);
    setProfile(res.data || null);
  };

  useEffect(() => {
    loadProfile().finally(() => setLoading(false));
  }, [merchantId]);

  const handleToggleFollow = async () => {
    if (!profile || submitting) return;
    setSubmitting(true);
    try {
      if (profile.isFollowing) {
        await followApi.unfollow(profile.id);
      } else {
        await followApi.follow(profile.id);
      }
      await loadProfile();
    } finally {
      setSubmitting(false);
    }
  };

  const handleChat = async () => {
    if (!profile) return;
    const res: any = await conversationApi.create(profile.id);
    navigate(`/messages/${res.data.id}`);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="sticky top-0 z-10 bg-gray-900/80 backdrop-blur-lg border-b border-gray-800 px-4 py-3 flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="text-gray-400 text-lg">&larr;</button>
        <h1 className="text-lg font-bold">商家主页</h1>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">加载中...</div>
      ) : !profile ? (
        <div className="flex items-center justify-center py-20 text-gray-400">商家不存在</div>
      ) : (
        <div className="p-4 space-y-4">
          <div className="bg-gradient-to-br from-orange-500/20 to-red-500/10 border border-orange-500/20 rounded-2xl p-5">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-2xl font-bold">
                {profile.nickname?.charAt(0) || '商'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xl font-bold truncate">{profile.nickname}</div>
                <div className="text-sm text-orange-200/80 mt-1">认证商家</div>
                <div className="text-xs text-orange-100/70 mt-2">入驻于 {new Date(profile.createdAt).toLocaleDateString()}</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
              <div className="text-xs text-gray-500">粉丝</div>
              <div className="mt-2 text-2xl font-bold">{profile.followerCount}</div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
              <div className="text-xs text-gray-500">关注</div>
              <div className="mt-2 text-2xl font-bold">{profile.followingCount}</div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
              <div className="text-xs text-gray-500">商品数</div>
              <div className="mt-2 text-2xl font-bold">{profile.productCount || 0}</div>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <button
              type="button"
              onClick={handleToggleFollow}
              disabled={submitting}
              className={`w-full py-3 rounded-2xl text-sm font-medium transition ${
                profile.isFollowing ? 'bg-gray-900 border border-gray-700 text-gray-300' : 'bg-orange-500 text-white'
              }`}
            >
              {profile.isFollowing ? '已关注，点击取消' : '关注商家'}
            </button>
            <button
              type="button"
              onClick={handleChat}
              className="w-full py-3 rounded-2xl text-sm font-medium bg-gray-900 border border-gray-800 text-gray-100"
            >
              联系商家
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
