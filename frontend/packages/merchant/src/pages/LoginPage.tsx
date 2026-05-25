import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '@jingpai/shared';

export default function LoginPage() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res: any = await authApi.login({ phone, password });
      const token = res.data.token;
      const user = res.data.user;

      if (user?.role !== 'MERCHANT') {
        setError('该账号不是商家账号，请使用商家账号登录');
        return;
      }

      localStorage.setItem('token', token);
      navigate('/');
    } catch (err: any) {
      setError(err?.msg || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-2xl shadow-lg w-96 space-y-4">
        <h1 className="text-2xl font-bold text-center text-gray-800">商家登录</h1>
        <p className="text-sm text-gray-500 text-center">竞拍大师管理后台</p>

        <input
          type="tel"
          placeholder="手机号"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-blue-500 focus:outline-none"
        />
        <input
          type="password"
          placeholder="密码"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-blue-500 focus:outline-none"
        />

        {error && <p className="text-red-500 text-sm text-center">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-lg font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition"
        >
          {loading ? '登录中...' : '登录'}
        </button>

        <p className="text-xs text-gray-400 text-center mt-4">
          需要商家账号？注册时请选择"商家"角色
        </p>
      </form>
    </div>
  );
}
