import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  Gavel,
  Tv,
  Radio,
  FileText,
  LogOut,
  Store,
} from 'lucide-react';

const navItems = [
  { path: '/', label: '仪表盘', icon: LayoutDashboard },
  { path: '/products', label: '商品管理', icon: Package },
  { path: '/auctions', label: '竞拍管理', icon: Gavel },
  { path: '/rooms', label: '直播间管理', icon: Tv },
  { path: '/live-panel', label: '实时大屏', icon: Radio },
  { path: '/orders', label: '订单管理', icon: FileText },
];

export default function Layout() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex bg-zinc-50/50 text-zinc-900 antialiased">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-zinc-200/80 flex flex-col shrink-0">
        {/* Sidebar Header */}
        <div className="px-6 py-6 border-b border-zinc-100 flex items-center gap-3">
          <div className="p-2 bg-zinc-950 text-white rounded-lg">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-zinc-900">竞拍大师</h1>
            <p className="text-xs text-zinc-500 font-medium">商家管理后台</p>
          </div>
        </div>

        {/* Sidebar Nav */}
        <nav className="flex-1 px-4 py-6 space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-zinc-900 text-white shadow-sm shadow-zinc-900/10'
                      : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100/80'
                  }`
                }
              >
                <Icon className="w-4 h-4 text-inherit" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-zinc-100">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-4 py-2 text-sm text-zinc-500 hover:text-red-600 hover:bg-red-50/50 rounded-lg transition duration-200"
          >
            <LogOut className="w-4 h-4" />
            <span>退出登录</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
