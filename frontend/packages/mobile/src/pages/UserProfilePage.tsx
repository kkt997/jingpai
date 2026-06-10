import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { followApi, profileApi, UserProfileSummary, conversationApi } from '@jingpai/shared';

export default function UserProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const userId = Number(id);
  const [profile, setProfile] = useState<UserProfileSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadProfile = async () => {
    if (!userId) return;
    const res: any = await profileApi.user(userId);
    setProfile(res.data || null);
  };

  useEffect(() => {
    loadProfile().finally(() => setLoading(false));
  }, [userId]);

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
        <h1 className="text-lg font-bold">用户资料</h1>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">加载中...</div>
      ) : !profile ? (
        <div className="flex items-center justify-center py-20 text-gray-400">资料不存在</div>
      ) : (
        <div className="p-4 space-y-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-2xl font-bold">
                {profile.nickname?.charAt(0) || '?'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xl font-bold truncate">{profile.nickname}</div>
                <div className="text-sm text-gray-500 mt-1">{profile.role === 'MERCHANT' ? '商家账号' : '用户账号'}</div>
                <div className="text-xs text-gray-500 mt-2">加入于 {new Date(profile.createdAt).toLocaleDateString()}</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
              <div className="text-xs text-gray-500">粉丝数</div>
              <div className="mt-2 text-2xl font-bold">{profile.followerCount}</div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
              <div className="text-xs text-gray-500">关注数</div>
              <div className="mt-2 text-2xl font-bold">{profile.followingCount}</div>
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
              {profile.isFollowing ? '已关注，点击取消' : '关注Ta'}
            </button>
            <button
              type="button"
              onClick={handleChat}
              className="w-full py-3 rounded-2xl text-sm font-medium bg-gray-900 border border-gray-800 text-gray-100"
            >
              发起私聊
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
