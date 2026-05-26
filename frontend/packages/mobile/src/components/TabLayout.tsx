import { Outlet, useNavigate, useLocation } from 'react-router-dom';

const tabs = [
  { path: '/', label: '首页' },
  { path: '/my-bids', label: '我的竞拍' },
  { path: '/orders', label: '我的订单' },
  { path: '/profile', label: '我的' },
];

export default function TabLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <div className="flex-1 pb-14">
        <Outlet />
      </div>

      <nav className="fixed bottom-0 left-0 right-0 max-w-[480px] mx-auto bg-gray-900 border-t border-gray-800 flex z-50">
        {tabs.map((tab) => {
          const active = pathname === tab.path;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={`flex-1 py-3 text-center text-sm transition ${
                active ? 'text-orange-400 font-medium' : 'text-gray-500'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
