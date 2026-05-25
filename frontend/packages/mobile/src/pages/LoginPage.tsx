import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

export default function LoginPage() {
  const [isRegister, setIsRegister] = useState(false);
  const [phone, setPhone] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
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
        await register(phone, nickname, password);
      } else {
        await login(phone, password);
      }
      navigate('/');
    } catch (err: any) {
      setError(err?.msg || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-gradient-to-b from-gray-900 to-gray-950">
      <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-orange-400 to-red-500 bg-clip-text text-transparent">
        竞拍大师
      </h1>
      <p className="text-gray-500 mb-8">实时直播竞拍平台</p>

      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <input
          type="tel"
          placeholder="手机号"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          maxLength={11}
          className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-gray-700 focus:border-orange-500 focus:outline-none transition"
        />

        {isRegister && (
          <input
            type="text"
            placeholder="昵称"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-gray-700 focus:border-orange-500 focus:outline-none transition"
          />
        )}

        <input
          type="password"
          placeholder="密码"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-gray-700 focus:border-orange-500 focus:outline-none transition"
        />

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
            onClick={() => setIsRegister(!isRegister)}
            className="text-orange-400 ml-1 hover:underline"
          >
            {isRegister ? '去登录' : '去注册'}
          </button>
        </p>
      </form>
    </div>
  );
}
