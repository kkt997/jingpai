import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LiveRoom, roomApi } from '@jingpai/shared';

export default function RoomListPage() {
  const [rooms, setRooms] = useState<LiveRoom[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    roomApi.list({ status: 'LIVE' }).then((res: any) => {
      setRooms(res.data || []);
    });
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 pb-20">
      <header className="sticky top-0 z-10 bg-gray-900/80 backdrop-blur-lg border-b border-gray-800 px-4 py-3">
        <h1 className="text-lg font-bold">直播竞拍</h1>
      </header>

      <div className="p-4 space-y-3">
        {rooms.length === 0 && (
          <div className="text-center text-gray-500 py-20">暂无直播间</div>
        )}
        {rooms.map((room) => (
          <div
            key={room.id}
            onClick={() => navigate(`/room/${room.id}`)}
            className="bg-gray-900 rounded-2xl overflow-hidden border border-gray-800 active:scale-[0.98] transition cursor-pointer"
          >
            <div className="h-40 bg-gradient-to-br from-gray-800 to-gray-700 flex items-center justify-center">
              {room.coverUrl ? (
                <img src={room.coverUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-4xl">🎬</span>
              )}
            </div>
            <div className="p-4 flex justify-between items-center">
              <div>
                <h3 className="font-bold">{room.title}</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {room.onlineCount} 人在看
                </p>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-500/20 text-red-400">
                直播中
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-[480px] mx-auto bg-gray-900 border-t border-gray-800 flex">
        <button className="flex-1 py-3 text-center text-orange-400 text-sm font-medium">
          首页
        </button>
        <button
          onClick={() => navigate('/my-bids')}
          className="flex-1 py-3 text-center text-gray-500 text-sm"
        >
          我的竞拍
        </button>
        <button
          onClick={() => navigate('/orders')}
          className="flex-1 py-3 text-center text-gray-500 text-sm"
        >
          我的订单
        </button>
      </nav>
    </div>
  );
}
