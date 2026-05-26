import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

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
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-gradient-to-b from-gray-900 to-gray-950">
      <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-orange-400 to-red-500 bg-clip-text text-transparent">
        竞拍大师
      </h1>
      <p className="text-gray-500 mb-8">实时直播竞拍平台</p>

      {/* Method tabs */}
      <div className="flex w-full max-w-sm mb-5 bg-gray-800/50 rounded-xl p-1">
        <button
          type="button"
          onClick={() => setMethod('phone')}
          className={`flex-1 py-2 text-sm rounded-lg transition font-medium ${
            method === 'phone' ? 'bg-gray-700 text-white' : 'text-gray-500'
          }`}
        >
          手机号
        </button>
        <button
          type="button"
          onClick={() => setMethod('email')}
          className={`flex-1 py-2 text-sm rounded-lg transition font-medium ${
            method === 'email' ? 'bg-gray-700 text-white' : 'text-gray-500'
          }`}
        >
          邮箱
        </button>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        {method === 'phone' ? (
          <input
            type="tel"
            placeholder="手机号"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            maxLength={11}
            className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-gray-700 focus:border-orange-500 focus:outline-none transition"
          />
        ) : (
          <input
            type="email"
            placeholder="邮箱地址"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-gray-700 focus:border-orange-500 focus:outline-none transition"
          />
        )}

        {isRegister && (
          <input
            type="text"
            placeholder="昵称"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-gray-700 focus:border-orange-500 focus:outline-none transition"
          />
        )}

        <div className="relative">
          <input
            type={showPwd ? 'text' : 'password'}
            placeholder="密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 pr-12 rounded-xl bg-gray-800 border border-gray-700 focus:border-orange-500 focus:outline-none transition"
          />
          <button
            type="button"
            onClick={() => setShowPwd(!showPwd)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition p-1"
          >
            {showPwd ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>

        {error && <p className="text-red-400 text-sm text-center">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl font-bold text-white bg-gradient-to-r from-orange-500 to-red-500 hover:opacity-90 disabled:opacity-50 transition"
        >
          {loading ? '请稍候...' : isRegister ? '注册' : '登录'}
        </button>

        <p className="text-center text-gray-500 text-sm">
          {isRegister ? '已有账号？' : '没有账号？'}
          <button
            type="button"
            onClick={switchMode}
            className="text-orange-400 ml-1 hover:underline"
          >
            {isRegister ? '去登录' : '去注册'}
          </button>
        </p>
      </form>
    </div>
  );
}
