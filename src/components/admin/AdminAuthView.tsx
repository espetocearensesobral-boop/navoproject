import React, { useState, useEffect } from 'react';
import { authFetch, setStoredToken } from '../../lib/api';
import { 
  ShieldCheck, 
  Lock, 
  User, 
  Eye, 
  EyeOff, 
  ArrowLeft, 
  Scissors, 
  CheckCircle2, 
  AlertCircle
} from 'lucide-react';

interface AdminAuthViewProps {
  onLoginSuccess: (user: any) => void;
}

export const AdminAuthView: React.FC<AdminAuthViewProps> = ({ onLoginSuccess }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [shopLogo, setShopLogo] = useState<string | null>(null);
  const [shopName, setShopName] = useState<string>('Management System');

  // Form State
  const [loginData, setLoginData] = useState({
    loginId: '',
    password: ''
  });

  useEffect(() => {
    authFetch('/api/shop-profile')
      .then(res => res.json())
      .then(data => {
        if (data.logoUrl) {
          setShopLogo(data.logoUrl);
        }
        if (data.name) {
          setShopName(data.name);
        }
      })
      .catch(console.error);
  }, []);

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

      if (data.token) {
        setStoredToken(data.token);
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

  return (
    <div className="min-h-[100dvh] w-full bg-[#0a0b0e] text-stone-100 flex flex-col justify-center items-center p-4 sm:p-6 relative overflow-hidden font-sans box-border">
      {/* Background Image with Dark Overlay */}
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center opacity-30 mix-blend-luminosity pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(180deg, rgba(10,11,14,0.85) 0%, rgba(10,11,14,0.95) 50%, #06070a 100%), url('https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=1200&q=80')`
        }}
      />

      {/* Main Card */}
      <main className="w-full max-w-md my-auto py-6 z-10">
        <div className="bg-[#12131A]/90 border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative">
          
          {/* Logo & Portal Header */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="relative p-[3px] rounded-full bg-gradient-to-tr from-amber-600 via-gold-base to-amber-300 shadow-xl mb-4">
              <div className="p-[2.5px] bg-[#12131A] rounded-full">
                <div className="w-20 h-20 rounded-full overflow-hidden bg-neutral-900 flex items-center justify-center relative shadow-inner">
                  {shopLogo ? (
                    <img src={shopLogo} alt={shopName} className="w-full h-full object-cover rounded-full" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gold-base">
                      <Scissors className="w-8 h-8" />
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <h1 className="text-xl font-serif font-extrabold text-stone-100 tracking-tight flex items-center gap-2">
              Painel <span className="text-gold-base">Administrativo</span>
            </h1>
            <p className="text-xs text-stone-400 mt-1">
              {shopName} • Gestão e Controle
            </p>
          </div>

          {/* Alert Messages */}
          {errorMsg && (
            <div className="mb-5 p-3 rounded-xl bg-status-error/10 border border-status-error/20 text-status-error text-xs font-medium flex items-start gap-2.5 animate-fadeIn">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-5 p-3 rounded-xl bg-status-success/10 border border-status-success/20 text-status-success text-xs font-medium flex items-start gap-2.5 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* LOGIN FORM */}
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-stone-100 mb-1.5">
                E-mail ou Telefone
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-500">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  placeholder="admin@exemplo.com ou telefone"
                  value={loginData.loginId}
                  onChange={(e) => setLoginData({ ...loginData, loginId: e.target.value })}
                  className="w-full pl-10 pr-3.5 py-2.5 bg-stone-900/80 border border-white/10 rounded-xl text-stone-100 text-xs placeholder:text-stone-500 focus:outline-none focus:border-gold-base focus:ring-1 focus:ring-gold-base/50 transition-all shadow-inner"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-100 mb-1.5">
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
                  className="w-full pl-10 pr-10 py-2.5 bg-stone-900/80 border border-white/10 rounded-xl text-stone-100 text-xs placeholder:text-stone-500 focus:outline-none focus:border-gold-base focus:ring-1 focus:ring-gold-base/50 transition-all shadow-inner"
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
              className="w-full mt-2 py-3 px-4 rounded-xl bg-gold-base hover:brightness-110 text-stone-950 font-extrabold text-xs shadow-lg shadow-gold-base/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
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
        </div>
      </main>

      {/* Footer info */}
      <footer className="w-full max-w-md text-center py-2 z-10">
        <p className="text-[11px] text-stone-500 font-medium">
          {shopName} &copy; {new Date().getFullYear()} • Todos os direitos reservados.
        </p>
      </footer>
    </div>
  );
};
