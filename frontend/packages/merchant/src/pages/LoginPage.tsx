import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '@jingpai/shared';

type LoginMethod = 'phone' | 'email';

type FormErrors = {
  phone?: string;
  email?: string;
  nickname?: string;
  password?: string;
  submit?: string;
};

const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export default function LoginPage() {
  const [isRegister, setIsRegister] = useState(false);
  const [method, setMethod] = useState<LoginMethod>('phone');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const mapAuthError = (msg: string): FormErrors => {
    if (!msg) return { submit: '操作失败，请稍后重试' };
    if (msg.includes('手机号')) return { phone: msg };
    if (msg.includes('邮箱')) return { email: msg };
    if (msg.includes('昵称')) return { nickname: msg };
    if (msg.includes('密码')) return { password: msg };
    if (msg.includes('用户不存在')) {
      return method === 'phone' ? { phone: '该手机号未注册' } : { email: '该邮箱未注册' };
    }
    if (msg.includes('商家账号')) return { submit: msg };
    if (msg.includes('至少填写一项')) {
      return method === 'phone' ? { phone: msg } : { email: msg };
    }
    return { submit: msg };
  };

  const validateForm = (): FormErrors => {
    const nextErrors: FormErrors = {};
    const trimmedPhone = phone.trim();
    const trimmedEmail = email.trim();
    const trimmedNickname = nickname.trim();

    if (method === 'phone') {
      if (!trimmedPhone) {
        nextErrors.phone = isRegister ? '请输入注册手机号' : '请输入登录手机号';
      } else if (!/^\d{11}$/.test(trimmedPhone)) {
        nextErrors.phone = '手机号需为 11 位数字';
      }
    } else if (!trimmedEmail) {
      nextErrors.email = isRegister ? '请输入注册邮箱' : '请输入登录邮箱';
    } else if (!emailPattern.test(trimmedEmail)) {
      nextErrors.email = '邮箱格式不正确';
    }

    if (isRegister) {
      if (!trimmedNickname) {
        nextErrors.nickname = '请输入店铺/商家名称';
      } else if (trimmedNickname.length < 2 || trimmedNickname.length > 20) {
        nextErrors.nickname = '店铺/商家名称需为 2-20 个字符';
      }
    }

    if (!password) {
      nextErrors.password = isRegister ? '请输入注册密码' : '请输入登录密码';
    } else if (isRegister && password.length < 6) {
      nextErrors.password = '密码至少需要 6 位';
    }

    return nextErrors;
  };

  const clearFieldError = (name: keyof FormErrors) => {
    setFieldErrors((prev) => ({ ...prev, [name]: undefined, submit: undefined }));
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const clientErrors = validateForm();
    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors);
      return;
    }

    setFieldErrors({});
    setLoading(true);
    try {
      if (isRegister) {
        const res: any = await authApi.register({
          ...(method === 'phone' ? { phone: phone.trim() } : { email: email.trim() }),
          nickname: nickname.trim(),
          password,
          role: 'MERCHANT',
        });
        localStorage.setItem('token', res.data.token);
        navigate('/');
      } else {
        const account = method === 'phone' ? phone.trim() : email.trim();
        const res: any = await authApi.login({ account, password });
        const user = res.data.user;
        if (user?.role !== 'MERCHANT') {
          setFieldErrors({ submit: '该账号不是商家账号，请使用商家账号登录' });
          return;
        }
        localStorage.setItem('token', res.data.token);
        navigate('/');
      }
    } catch (err: any) {
      const msg = err?.msg || err?.message || '操作失败，请稍后重试';
      const nextErrors = mapAuthError(msg);
      setFieldErrors(nextErrors);
      setError(nextErrors.submit || '');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setIsRegister(!isRegister);
    setError('');
    setFieldErrors({});
    setPassword('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-8 rounded-2xl shadow-lg w-[420px] space-y-4"
      >
        <h1 className="text-2xl font-bold text-center text-gray-800">
          {isRegister ? '商家注册' : '商家登录'}
        </h1>
        <p className="text-sm text-gray-500 text-center">竞拍大师管理后台</p>

        {/* Method tabs */}
        <div className="flex bg-gray-100 rounded-lg p-1">
          <button
            type="button"
            onClick={() => {
              setMethod('phone');
              setFieldErrors({});
              setError('');
            }}
            className={`flex-1 py-2 text-sm rounded-md transition font-medium ${
              method === 'phone'
                ? 'bg-white text-gray-800 shadow-sm'
                : 'text-gray-500'
            }`}
          >
            手机号
          </button>
          <button
            type="button"
            onClick={() => {
              setMethod('email');
              setFieldErrors({});
              setError('');
            }}
            className={`flex-1 py-2 text-sm rounded-md transition font-medium ${
              method === 'email'
                ? 'bg-white text-gray-800 shadow-sm'
                : 'text-gray-500'
            }`}
          >
            邮箱
          </button>
        </div>

        {method === 'phone' ? (
          <div>
            <input
              type="tel"
              placeholder="手机号"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                clearFieldError('phone');
              }}
              maxLength={11}
              className={`w-full px-4 py-3 rounded-lg border focus:border-blue-500 focus:outline-none transition ${
                fieldErrors.phone ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {fieldErrors.phone && <p className="mt-1 text-xs text-red-500">{fieldErrors.phone}</p>}
          </div>
        ) : (
          <div>
            <input
              type="email"
              placeholder="邮箱地址"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                clearFieldError('email');
              }}
              className={`w-full px-4 py-3 rounded-lg border focus:border-blue-500 focus:outline-none transition ${
                fieldErrors.email ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {fieldErrors.email && <p className="mt-1 text-xs text-red-500">{fieldErrors.email}</p>}
          </div>
        )}

        {isRegister && (
          <div>
            <input
              type="text"
              placeholder="店铺/商家名称"
              value={nickname}
              onChange={(e) => {
                setNickname(e.target.value);
                clearFieldError('nickname');
              }}
              className={`w-full px-4 py-3 rounded-lg border focus:border-blue-500 focus:outline-none transition ${
                fieldErrors.nickname ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {fieldErrors.nickname && <p className="mt-1 text-xs text-red-500">{fieldErrors.nickname}</p>}
          </div>
        )}

        <div className="relative">
          <input
            type={showPwd ? 'text' : 'password'}
            placeholder="密码"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              clearFieldError('password');
            }}
            className={`w-full px-4 py-3 pr-12 rounded-lg border focus:border-blue-500 focus:outline-none transition ${
              fieldErrors.password ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          <button
            type="button"
            onClick={() => setShowPwd(!showPwd)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition p-1"
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

        {fieldErrors.password && <p className="-mt-3 text-xs text-red-500">{fieldErrors.password}</p>}

        {error && <p className="text-red-500 text-sm text-center">{error}</p>}
        {!error && fieldErrors.submit && <p className="text-red-500 text-sm text-center">{fieldErrors.submit}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-lg font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition"
        >
          {loading ? '请稍候...' : isRegister ? '注册商家账号' : '登录'}
        </button>

        <p className="text-center text-sm text-gray-500">
          {isRegister ? '已有商家账号？' : '还没有商家账号？'}
          <button
            type="button"
            onClick={switchMode}
            className="text-blue-600 ml-1 hover:underline"
          >
            {isRegister ? '去登录' : '立即注册'}
          </button>
        </p>
      </form>
    </div>
  );
}
