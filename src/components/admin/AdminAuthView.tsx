import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { authFetch } from "../../lib/api";
import { Turnstile } from "@marsidev/react-turnstile";
import { useTheme } from "../../contexts/ThemeContext";
import {
  ShieldCheck,
  Lock,
  User,
  Eye,
  EyeOff,
  Scissors,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Sun,
  Moon,
} from "lucide-react";

interface AdminAuthViewProps {
  onLoginSuccess: (user: any) => void;
}

export const AdminAuthView: React.FC<AdminAuthViewProps> = ({
  onLoginSuccess,
}) => {
  const { theme, setTheme } = useTheme();
  const [showPassword, setShowPassword] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [shopLogo, setShopLogo] = useState<string | null>(null);
  const [shopName, setShopName] = useState<string>("Navo Premium");

  const [loginData, setLoginData] = useState({
    loginId: "",
    password: "",
  });

  useEffect(() => {
    authFetch("/api/shop-profile")
      .then((res) => res.json())
      .then((data) => {
        if (data.logoUrl) setShopLogo(data.logoUrl);
        if (data.name) setShopName(data.name);
      })
      .catch(() => {
        // Fallback default
      });
  }, []);

  const handleLoginIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const isPhone = /^[\d\s()\-+]+$/.test(val);

    if (isPhone) {
      let digits = val.replace(/\D/g, "");
      if (digits.length > 11) digits = digits.slice(0, 11);
      let masked = val;
      if (digits.length > 0) {
        if (digits.length <= 2) masked = digits;
        else if (digits.length <= 6) masked = `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
        else if (digits.length <= 10)
          masked = `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
        else
          masked = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
      }
      setLoginData((prev) => ({ ...prev, loginId: masked }));
    } else {
      setLoginData((prev) => ({ ...prev, loginId: val }));
    }
  };

  const handleLoginSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!loginData.loginId.trim()) {
      setErrorMsg("Informe o seu e-mail ou telefone de administrador.");
      return;
    }
    if (!loginData.password) {
      setErrorMsg("Informe a sua senha.");
      return;
    }
    if (!turnstileToken) {
      setErrorMsg("Por favor, confirme que você não é um robô.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await authFetch("/api/auth/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loginId: loginData.loginId.trim(),
          password: loginData.password,
          turnstileToken,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          data.error || "Credenciais de administrador inválidas.",
        );
      }

      setSuccessMsg("Acesso autorizado. Carregando painel...");
      window.setTimeout(() => onLoginSuccess(data), 400);
    } catch (error: any) {
      setErrorMsg(error.message || "Erro ao realizar login administrativo.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-[100dvh] w-full flex items-center justify-center p-4 bg-surface-base text-content-base geometric-grid-bg overflow-x-hidden select-none">
      {/* Ambient luxury lighting effects identical to client application */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] h-[480px] bg-gold-base/10 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute bottom-10 right-1/4 w-72 h-72 bg-gold-deep/5 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Top action header: Back to client app & Theme Switcher */}
      <div className="absolute top-4 left-4 right-4 sm:top-6 sm:left-6 sm:right-6 flex items-center justify-between z-20 pointer-events-auto">
        <a
          href="/"
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-surface-base/80 border border-border-subtle text-xs font-semibold text-content-muted hover:text-content-base hover:border-gold-base/40 backdrop-blur-md transition-all shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-base"
          aria-label="Voltar para a página inicial do cliente"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Voltar ao aplicativo</span>
          <span className="sm:hidden">App</span>
        </a>

        <button
          type="button"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="p-2 rounded-full bg-surface-base/80 border border-border-subtle text-content-muted hover:text-content-base hover:border-gold-base/40 backdrop-blur-md transition-all shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-base"
          aria-label={theme === "dark" ? "Mudar para modo claro" : "Mudar para modo escuro"}
        >
          {theme === "dark" ? (
            <Sun className="w-4 h-4 text-gold-base" />
          ) : (
            <Moon className="w-4 h-4 text-gold-deep" />
          )}
        </button>
      </div>

      <main className="relative z-10 w-full max-w-md my-auto py-8">
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="w-full bg-surface-base rounded-3xl border border-border-subtle shadow-2xl p-6 sm:p-8 relative backdrop-blur-xl"
        >
          {/* Brand Emblem */}
          <div className="mb-6 flex flex-col items-center text-center">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border border-gold-base/30 bg-surface-card p-1 shadow-lg shadow-black/20 flex items-center justify-center mb-4 transition-transform hover:scale-105">
              <div className="w-full h-full rounded-full border border-border-subtle bg-surface-base flex items-center justify-center overflow-hidden">
                {shopLogo ? (
                  <img
                    src={shopLogo}
                    alt={shopName}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <Scissors className="w-9 h-9 sm:w-10 sm:h-10 text-gold-base" />
                )}
              </div>
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gold-base/10 border border-gold-base/20 text-[11px] font-bold uppercase tracking-[0.2em] text-gold-base mb-2">
              <ShieldCheck className="w-3.5 h-3.5 text-gold-base" />
              <span>Área Administrativa</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold font-serif text-content-base tracking-tight">
              Painel <span className="text-gold-base">Gerencial</span>
            </h1>
            <p className="mt-1.5 text-xs sm:text-sm text-content-muted leading-relaxed max-w-xs">
              {shopName} • Acesso exclusivo para equipe e gestão
            </p>
          </div>

          {/* Feedback messages */}
          {errorMsg && (
            <div
              role="alert"
              className="mb-5 p-3.5 rounded-xl bg-status-error/10 border border-status-error/20 text-status-error text-xs font-medium flex items-start gap-2.5 animate-in fade-in duration-200"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div
              role="status"
              className="mb-5 p-3.5 rounded-xl bg-status-success/10 border border-status-success/20 text-status-success text-xs font-medium flex items-start gap-2.5 animate-in fade-in duration-200"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{successMsg}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="admin-login-id"
                className="text-xs font-bold text-content-muted block mb-1.5"
              >
                E-mail ou Telefone
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-content-muted" />
                <input
                  id="admin-login-id"
                  type="text"
                  required
                  autoComplete="username"
                  placeholder="admin@exemplo.com ou telefone"
                  value={loginData.loginId}
                  onChange={handleLoginIdChange}
                  className="w-full bg-surface-base border border-border-subtle rounded-xl py-3.5 pl-11 pr-4 text-content-base text-sm focus:border-gold-base focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-base transition-all placeholder:text-content-muted/60"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="admin-password"
                  className="text-xs font-bold text-content-muted block"
                >
                  Senha de Acesso
                </label>
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-content-muted" />
                <input
                  id="admin-password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  placeholder="Digite sua senha"
                  value={loginData.password}
                  onChange={(event) =>
                    setLoginData({ ...loginData, password: event.target.value })
                  }
                  className="w-full bg-surface-base border border-border-subtle rounded-xl py-3.5 pl-11 pr-11 text-content-base text-sm focus:border-gold-base focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-base transition-all placeholder:text-content-muted/60"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-content-muted hover:text-content-base transition-colors p-1.5 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-base"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex justify-center my-4 pt-1">
              <Turnstile
                siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY || "1x00000000000000000000AA"}
                onSuccess={(token) => setTurnstileToken(token)}
                onError={() =>
                  setErrorMsg(
                    "Falha ao carregar o verificador de segurança. Atualize a página.",
                  )
                }
                onExpire={() => setTurnstileToken("")}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gold-base text-surface-base font-extrabold rounded-xl py-3.5 mt-2 active:scale-95 hover:opacity-95 shadow-lg shadow-[#C9A96E]/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-base focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base flex items-center justify-center gap-2 text-sm"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-surface-base/30 border-t-surface-base rounded-full animate-spin" />
                  <span>Autenticando...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Acessar Painel</span>
                </>
              )}
            </button>
          </form>

          {/* Footer security note */}
          <div className="mt-6 pt-4 border-t border-border-subtle text-center">
            <p className="text-[11px] text-content-muted/80 flex items-center justify-center gap-1.5">
              <Lock className="w-3 h-3 text-gold-base" />
              <span>Conexão criptografada e autenticação segura</span>
            </p>
          </div>
        </motion.div>

        <p className="mt-4 text-center text-xs text-content-muted/70">
          {shopName} &copy; {new Date().getFullYear()} • Todos os direitos reservados
        </p>
      </main>
    </div>
  );
};

export default AdminAuthView;
