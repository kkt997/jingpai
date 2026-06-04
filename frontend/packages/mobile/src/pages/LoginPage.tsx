import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { Eye, EyeOff, Lock, Mail, Phone, User, Landmark } from 'lucide-react';

type LoginMethod = 'phone' | 'email';

export default function LoginPage() {
  const [isRegister, setIsRegister] = useState(false);
  const [method, setMethod] = useState<LoginMethod>('phone');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isRegister) {
        await register({
          ...(method === 'phone' ? { phone } : { email }),
          nickname,
          password,
        });
      } else {
        const account = method === 'phone' ? phone : email;
        await login(account, password);
      }
      navigate('/');
    } catch (err: any) {
      setError(err?.msg || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setIsRegister(!isRegister);
    setError('');
  };

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center px-6 bg-zinc-950 overflow-hidden select-none">
      {/* Decorative Glows */}
      <div className="absolute top-[-10%] left-[-20%] w-[80%] h-[50%] rounded-full bg-brand/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-20%] w-[80%] h-[50%] rounded-full bg-orange-500/5 blur-[120px] pointer-events-none" />

      {/* Brand Header */}
      <div className="text-center z-10 space-y-2 mb-8">
        <div className="inline-flex p-3 bg-zinc-900 border border-zinc-800 rounded-2xl mb-1 shadow-lg shadow-black/20 text-brand">
          <Landmark className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-zinc-100 via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
          竞拍大师
        </h1>
        <p className="text-sm font-semibold text-zinc-500">实时直播竞拍平台</p>
      </div>

      {/* Login Card */}
      <div className="w-full max-w-sm z-10 backdrop-blur-md bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-6 shadow-2xl shadow-black/40">
        {/* Method tabs */}
        <div className="flex w-full mb-6 bg-zinc-950/60 border border-zinc-800/40 rounded-xl p-1">
          <button
            type="button"
            onClick={() => setMethod('phone')}
            className={`flex-grow py-2 text-xs rounded-lg transition-all duration-200 font-semibold ${
              method === 'phone' ? 'bg-zinc-800/80 text-zinc-100 shadow-sm' : 'text-zinc-500 hover:text-zinc-400'
            }`}
          >
            手机号
          </button>
          <button
            type="button"
            onClick={() => setMethod('email')}
            className={`flex-grow py-2 text-xs rounded-lg transition-all duration-200 font-semibold ${
              method === 'email' ? 'bg-zinc-800/80 text-zinc-100 shadow-sm' : 'text-zinc-500 hover:text-zinc-400'
            }`}
          >
            邮箱
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {method === 'phone' ? (
            <div className="relative">
              <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="tel"
                placeholder="手机号"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                maxLength={11}
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-zinc-950/40 border border-zinc-800 text-sm font-semibold text-zinc-100 placeholder-zinc-600 focus:border-brand/80 focus:ring-1 focus:ring-brand/30 outline-none transition duration-200"
              />
            </div>
          ) : (
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="email"
                placeholder="邮箱地址"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-zinc-950/40 border border-zinc-800 text-sm font-semibold text-zinc-100 placeholder-zinc-600 focus:border-brand/80 focus:ring-1 focus:ring-brand/30 outline-none transition duration-200"
              />
            </div>
          )}

          {isRegister && (
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                placeholder="昵称"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-zinc-950/40 border border-zinc-800 text-sm font-semibold text-zinc-100 placeholder-zinc-600 focus:border-brand/80 focus:ring-1 focus:ring-brand/30 outline-none transition duration-200"
              />
            </div>
          )}

          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type={showPwd ? 'text' : 'password'}
              placeholder="密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-10 pr-12 py-3 rounded-xl bg-zinc-950/40 border border-zinc-800 text-sm font-semibold text-zinc-100 placeholder-zinc-600 focus:border-brand/80 focus:ring-1 focus:ring-brand/30 outline-none transition duration-200"
            />
            <button
              type="button"
              onClick={() => setShowPwd(!showPwd)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition duration-200 p-1"
            >
              {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {error && <p className="text-red-400 text-xs font-semibold text-center mt-1">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl font-bold text-white bg-gradient-to-r from-brand to-orange-500 hover:shadow-lg hover:shadow-brand/20 active:scale-[0.98] disabled:opacity-50 transition-all duration-200 text-sm mt-2"
          >
            {loading ? '请稍候...' : isRegister ? '注册账号' : '立即登录'}
          </button>

          <p className="text-center text-zinc-500 text-xs font-semibold pt-2">
            {isRegister ? '已有账号？' : '没有账号？'}
            <button
              type="button"
              onClick={switchMode}
              className="text-brand hover:text-brand-dark ml-1 transition hover:underline"
            >
              {isRegister ? '去登录' : '去注册'}
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
