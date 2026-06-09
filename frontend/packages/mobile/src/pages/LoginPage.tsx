import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { Eye, EyeOff, Lock, Mail, Phone, User, Landmark } from 'lucide-react';

type LoginMethod = 'phone' | 'email';

type FormErrors = {
  phone?: string;
  email?: string;
  nickname?: string;
  password?: string;
  submit?: string;
};

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
  const { login, register } = useAuthStore();
  const navigate = useNavigate();

  const activeFieldError = useMemo(() => {
    if (isRegister) {
      return method === 'phone' ? fieldErrors.phone : fieldErrors.email;
    }
    return method === 'phone' ? fieldErrors.phone : fieldErrors.email;
  }, [fieldErrors, isRegister, method]);

  const mapAuthError = (msg: string): FormErrors => {
    if (!msg) return { submit: '操作失败，请稍后重试' };
    if (msg.includes('手机号')) return { phone: msg };
    if (msg.includes('邮箱')) return { email: msg };
    if (msg.includes('昵称')) return { nickname: msg };
    if (msg.includes('密码')) return { password: msg };
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
        nextErrors.phone = isRegister ? '请输入手机号' : '请输入登录手机号';
      } else if (!/^\d{11}$/.test(trimmedPhone)) {
        nextErrors.phone = '手机号需为 11 位数字';
      }
    } else {
      if (!trimmedEmail) {
        nextErrors.email = isRegister ? '请输入邮箱地址' : '请输入登录邮箱';
      } else if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(trimmedEmail)) {
        nextErrors.email = '邮箱格式不正确';
      }
    }

    if (isRegister) {
      if (!trimmedNickname) {
        nextErrors.nickname = '请输入昵称';
      } else if (trimmedNickname.length < 2 || trimmedNickname.length > 20) {
        nextErrors.nickname = '昵称长度需为 2-20 个字符';
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
        await register({
          ...(method === 'phone' ? { phone: phone.trim() } : { email: email.trim() }),
          nickname: nickname.trim(),
          password,
        });
      } else {
        const account = method === 'phone' ? phone.trim() : email.trim();
        await login(account, password);
      }
      navigate('/');
    } catch (err: any) {
      const msg = err?.msg || err?.message || '操作失败';
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
            onClick={() => {
              setMethod('phone');
              setFieldErrors({});
              setError('');
            }}
            className={`flex-grow py-2 text-xs rounded-lg transition-all duration-200 font-semibold ${
              method === 'phone' ? 'bg-zinc-800/80 text-zinc-100 shadow-sm' : 'text-zinc-500 hover:text-zinc-400'
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
            className={`flex-grow py-2 text-xs rounded-lg transition-all duration-200 font-semibold ${
              method === 'email' ? 'bg-zinc-800/80 text-zinc-100 shadow-sm' : 'text-zinc-500 hover:text-zinc-400'
            }`}
          >
            邮箱
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {method === 'phone' ? (
            <div>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="tel"
                  placeholder="手机号"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    clearFieldError('phone');
                  }}
                  maxLength={11}
                  className={`w-full pl-10 pr-4 py-3 rounded-xl bg-zinc-950/40 border text-sm font-semibold text-zinc-100 placeholder-zinc-600 focus:border-brand/80 focus:ring-1 focus:ring-brand/30 outline-none transition duration-200 ${
                    fieldErrors.phone ? 'border-red-500' : 'border-zinc-800'
                  }`}
                />
              </div>
              {fieldErrors.phone && <p className="mt-1 text-xs font-medium text-red-400">{fieldErrors.phone}</p>}
            </div>
          ) : (
            <div>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="email"
                  placeholder="邮箱地址"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    clearFieldError('email');
                  }}
                  className={`w-full pl-10 pr-4 py-3 rounded-xl bg-zinc-950/40 border text-sm font-semibold text-zinc-100 placeholder-zinc-600 focus:border-brand/80 focus:ring-1 focus:ring-brand/30 outline-none transition duration-200 ${
                    fieldErrors.email ? 'border-red-500' : 'border-zinc-800'
                  }`}
                />
              </div>
              {fieldErrors.email && <p className="mt-1 text-xs font-medium text-red-400">{fieldErrors.email}</p>}
            </div>
          )}

          {isRegister && (
            <div>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="text"
                  placeholder="昵称"
                  value={nickname}
                  onChange={(e) => {
                    setNickname(e.target.value);
                    clearFieldError('nickname');
                  }}
                  className={`w-full pl-10 pr-4 py-3 rounded-xl bg-zinc-950/40 border text-sm font-semibold text-zinc-100 placeholder-zinc-600 focus:border-brand/80 focus:ring-1 focus:ring-brand/30 outline-none transition duration-200 ${
                    fieldErrors.nickname ? 'border-red-500' : 'border-zinc-800'
                  }`}
                />
              </div>
              {fieldErrors.nickname && <p className="mt-1 text-xs font-medium text-red-400">{fieldErrors.nickname}</p>}
            </div>
          )}

          <div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type={showPwd ? 'text' : 'password'}
                placeholder="密码"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  clearFieldError('password');
                }}
                className={`w-full pl-10 pr-12 py-3 rounded-xl bg-zinc-950/40 border text-sm font-semibold text-zinc-100 placeholder-zinc-600 focus:border-brand/80 focus:ring-1 focus:ring-brand/30 outline-none transition duration-200 ${
                  fieldErrors.password ? 'border-red-500' : 'border-zinc-800'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPwd(!showPwd)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition duration-200 p-1"
              >
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {fieldErrors.password && <p className="mt-1 text-xs font-medium text-red-400">{fieldErrors.password}</p>}
          </div>

          {error && <p className="text-red-400 text-xs font-semibold text-center mt-1">{error}</p>}
          {!error && fieldErrors.submit && <p className="text-red-400 text-xs font-semibold text-center mt-1">{fieldErrors.submit}</p>}
          {!fieldErrors.submit && activeFieldError === undefined && isRegister && (
            <p className="text-[11px] text-zinc-500 text-center -mt-1">注册失败时会直接提示对应字段原因</p>
          )}

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
