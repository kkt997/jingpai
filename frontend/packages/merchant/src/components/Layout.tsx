import { NavLink, Outlet, useNavigate } from 'react-router-dom';

const navItems = [
  { path: '/', label: '仪表盘', icon: '📊' },
  { path: '/products', label: '商品管理', icon: '📦' },
  { path: '/auctions', label: '竞拍管理', icon: '🔨' },
  { path: '/rooms', label: '直播间', icon: '📺' },
  { path: '/live-panel', label: '实时面板', icon: '📡' },
  { path: '/orders', label: '订单管理', icon: '🧾' },
];

export default function Layout() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-60 bg-gray-900 text-white flex flex-col">
        <div className="px-6 py-5 border-b border-gray-800">
          <h1 className="text-lg font-bold">竞拍大师</h1>
          <p className="text-xs text-gray-500 mt-1">商家管理后台</p>
        </div>
        <nav className="flex-1 py-4">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-6 py-3 text-sm transition ${
                  isActive ? 'bg-blue-600/20 text-blue-400 border-r-2 border-blue-400' : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`
              }
            >
              <span>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-800">
          <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-red-400 transition">
            退出登录
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 bg-gray-50">
        <Outlet />
      </main>
    </div>
  );
}
