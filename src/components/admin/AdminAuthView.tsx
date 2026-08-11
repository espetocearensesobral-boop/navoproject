import React, { useState } from 'react';
import { authFetch } from '../../lib/api';
import { 
  ShieldCheck, 
  Lock, 
  Mail, 
  User, 
  Phone, 
  Eye, 
  EyeOff, 
  ArrowLeft, 
  Scissors, 
  CheckCircle2, 
  AlertCircle,
  Sparkles,
  KeyRound
} from 'lucide-react';

interface AdminAuthViewProps {
  onLoginSuccess: (user: any) => void;
}

export const AdminAuthView: React.FC<AdminAuthViewProps> = ({ onLoginSuccess }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form State
  const [loginData, setLoginData] = useState({
    loginId: '',
    password: ''
  });

  const [registerData, setRegisterData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: ''
  });

  // Phone masking
  const handlePhoneChange = (val: string) => {
    let digits = val.replace(/\D/g, '');
    if (digits.length > 11) digits = digits.slice(0, 11);
    let masked = val;
    if (digits.length > 0) {
      if (digits.length <= 2) masked = digits;
      else if (digits.length <= 6) masked = `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
      else if (digits.length <= 10) masked = `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
      else masked = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
    }
    setRegisterData(prev => ({ ...prev, phone: masked }));
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!loginData.loginId.trim()) {
      setErrorMsg('Informe o seu e-mail ou telefone de administrador.');
      return;
    }
    if (!loginData.password) {
      setErrorMsg('Informe a sua senha.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await authFetch('/api/auth/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loginId: loginData.loginId.trim(),
          password: loginData.password
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Credenciais de administrador inválidas.');
      }

      setSuccessMsg('Acesso autorizado! Carregando painel...');
      setTimeout(() => {
        onLoginSuccess(data);
      }, 400);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao realizar login administrativo.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (registerData.name.trim().length < 3) {
      setErrorMsg('Informe o nome completo do administrador (mínimo 3 letras).');
      return;
    }
    if (!registerData.email || !registerData.email.includes('@')) {
      setErrorMsg('Informe um e-mail válido.');
      return;
    }
    if (registerData.password.length < 6) {
      setErrorMsg('A senha deve conter pelo menos 6 caracteres.');
      return;
    }
    if (registerData.password !== registerData.confirmPassword) {
      setErrorMsg('As senhas digitadas não conferem.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await authFetch('/api/auth/admin/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: registerData.name.trim(),
          email: registerData.email.trim(),
          phone: registerData.phone.trim(),
          password: registerData.password
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Não foi possível cadastrar o administrador.');
      }

      setSuccessMsg('Conta de administrador criada com sucesso!');
      setTimeout(() => {
        onLoginSuccess(data);
      }, 500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao cadastrar administrador.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] w-full bg-[#0B0C10] text-stone-100 flex flex-col justify-between items-center p-4 sm:p-6 relative overflow-hidden font-sans">
      {/* Dynamic Background Accents */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-gradient-to-b from-amber-500/10 via-amber-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-gold-base/5 rounded-full blur-2xl pointer-events-none" />

      {/* Header Bar */}
      <header className="w-full max-w-md flex items-center justify-between py-2 z-10">
        <button
          onClick={() => { window.location.href = '/'; }}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-stone-900/80 hover:bg-stone-800 text-stone-300 hover:text-gold-base text-xs font-semibold border border-white/10 transition-all active:scale-95"
          title="Voltar para a área do cliente"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Área de Clientes</span>
        </button>

        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-400/90 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full">
          <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
          <span>Acesso Restrito</span>
        </div>
      </header>

      {/* Main Card */}
      <main className="w-full max-w-md my-auto py-6 z-10">
        <div className="bg-[#12131A] border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative">
          
          {/* Logo & Portal Header */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 via-gold-base to-amber-600 flex items-center justify-center text-stone-950 shadow-lg shadow-amber-500/20 mb-3.5">
              <Scissors className="w-7 h-7" />
            </div>
            <h1 className="text-xl font-serif font-extrabold text-stone-100 tracking-tight flex items-center gap-2">
              Painel Administrativo
            </h1>
            <p className="text-xs text-stone-400 mt-1">
              BarberX Management • Gestão e Controle
            </p>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="grid grid-cols-2 p-1 bg-stone-900/90 rounded-xl border border-white/10 mb-6">
            <button
              type="button"
              onClick={() => { setMode('login'); setErrorMsg(''); setSuccessMsg(''); }}
              className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
                mode === 'login'
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-stone-950 shadow-md'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Login Admin</span>
            </button>
            <button
              type="button"
              onClick={() => { setMode('register'); setErrorMsg(''); setSuccessMsg(''); }}
              className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
                mode === 'register'
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-stone-950 shadow-md'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Novo Admin</span>
            </button>
          </div>

          {/* Alert Messages */}
          {errorMsg && (
            <div className="mb-5 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium flex items-start gap-2.5 animate-fadeIn">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium flex items-start gap-2.5 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* LOGIN FORM */}
          {mode === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-300 mb-1.5">
                  E-mail ou Telefone
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-500">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="admin@barberx.app ou telefone"
                    value={loginData.loginId}
                    onChange={(e) => setLoginData({ ...loginData, loginId: e.target.value })}
                    className="w-full pl-10 pr-3.5 py-2.5 bg-stone-900/80 border border-white/10 rounded-xl text-stone-100 text-xs placeholder:text-stone-500 focus:outline-none focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/50 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-300 mb-1.5">
                  Senha
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    value={loginData.password}
                    onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                    className="w-full pl-10 pr-10 py-2.5 bg-stone-900/80 border border-white/10 rounded-xl text-stone-100 text-xs placeholder:text-stone-500 focus:outline-none focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/50 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-stone-500 hover:text-stone-300"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-gold-base to-amber-600 hover:brightness-110 text-stone-950 font-extrabold text-xs shadow-lg shadow-amber-500/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-stone-950/30 border-t-stone-950 rounded-full animate-spin" />
                    <span>Entrando...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Acessar Painel Admin</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* REGISTER FORM */}
          {mode === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-stone-300 mb-1">
                  Nome Completo
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-500">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Carlos Andrade"
                    value={registerData.name}
                    onChange={(e) => setRegisterData({ ...registerData, name: e.target.value })}
                    className="w-full pl-10 pr-3.5 py-2 bg-stone-900/80 border border-white/10 rounded-xl text-stone-100 text-xs placeholder:text-stone-500 focus:outline-none focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/50 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-300 mb-1">
                  E-mail Corporativo
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-500">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    required
                    placeholder="admin@barberx.app"
                    value={registerData.email}
                    onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                    className="w-full pl-10 pr-3.5 py-2 bg-stone-900/80 border border-white/10 rounded-xl text-stone-100 text-xs placeholder:text-stone-500 focus:outline-none focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/50 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-300 mb-1">
                  Telefone / WhatsApp
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-500">
                    <Phone className="w-4 h-4" />
                  </div>
                  <input
                    type="tel"
                    placeholder="(11) 99999-9999"
                    value={registerData.phone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2 bg-stone-900/80 border border-white/10 rounded-xl text-stone-100 text-xs placeholder:text-stone-500 focus:outline-none focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/50 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-300 mb-1">
                  Senha
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Mínimo 6 caracteres"
                    value={registerData.password}
                    onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                    className="w-full pl-10 pr-10 py-2 bg-stone-900/80 border border-white/10 rounded-xl text-stone-100 text-xs placeholder:text-stone-500 focus:outline-none focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/50 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-stone-500 hover:text-stone-300"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-300 mb-1">
                  Confirmar Senha
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Repita a senha"
                    value={registerData.confirmPassword}
                    onChange={(e) => setRegisterData({ ...registerData, confirmPassword: e.target.value })}
                    className="w-full pl-10 pr-3.5 py-2 bg-stone-900/80 border border-white/10 rounded-xl text-stone-100 text-xs placeholder:text-stone-500 focus:outline-none focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/50 transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-gold-base to-amber-600 hover:brightness-110 text-stone-950 font-extrabold text-xs shadow-lg shadow-amber-500/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-stone-950/30 border-t-stone-950 rounded-full animate-spin" />
                    <span>Cadastrando Admin...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Cadastrar e Acessar Painel</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </main>

      {/* Footer info */}
      <footer className="w-full max-w-md text-center py-2 z-10">
        <p className="text-[11px] text-stone-500 font-medium">
          BarberX Management System &copy; {new Date().getFullYear()} • Todos os direitos reservados.
        </p>
      </footer>
    </div>
  );
};
