import React, { useState, useEffect } from "react";
import { authFetch } from "../../lib/api";
import {
  ShieldCheck,
  Lock,
  User,
  Eye,
  EyeOff,
  Scissors,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

interface AdminAuthViewProps {
  onLoginSuccess: (user: any) => void;
}

export const AdminAuthView: React.FC<AdminAuthViewProps> = ({
  onLoginSuccess,
}) => {
  const [showPassword, setShowPassword] = useState(false);
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
        // O fallback visual permanece disponível quando o perfil ainda não foi configurado.
      });
  }, []);

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

    setIsLoading(true);

    try {
      const response = await authFetch("/api/auth/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loginId: loginData.loginId.trim(),
          password: loginData.password,
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
    <div className="relative flex min-h-[100dvh] w-full items-center justify-center overflow-hidden bg-[var(--admin-bg)] px-4 py-8 text-[var(--admin-text-main)] sm:px-6">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-cover bg-center opacity-[0.12] mix-blend-luminosity"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=1200&q=80')",
        }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-br from-gold-base/10 via-surface-base/80 to-[var(--admin-bg)]"
      />
      <div
        aria-hidden="true"
        className="absolute -right-32 -top-32 h-80 w-80 rounded-full bg-[var(--admin-accent)]/10 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="absolute -bottom-40 -left-32 h-96 w-96 rounded-full bg-[var(--admin-accent)]/10 blur-3xl"
      />

      <main className="relative z-10 my-auto w-full max-w-md">
        <div className="rounded-3xl border border-[var(--admin-border)] bg-[var(--admin-bg)]/90 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
          <div className="mb-7 flex flex-col items-center text-center">
            <div className="mb-5 rounded-full bg-[var(--admin-accent)] p-1 shadow-xl shadow-gold-base/20">
              <div className="rounded-full bg-[var(--admin-bg)] p-1">
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-[var(--admin-surface)] sm:h-24 sm:w-24">
                  {shopLogo ? (
                    <img
                      src={shopLogo}
                      alt={shopName}
                      className="h-full w-full rounded-full object-cover"
                    />
                  ) : (
                    <Scissors className="h-9 w-9 text-[var(--admin-accent)]" />
                  )}
                </div>
              </div>
            </div>

            <p className="mb-2 text-xs font-bold uppercase tracking-[0.24em] text-[var(--admin-accent)]">
              Área restrita
            </p>
            <h1 className="text-2xl font-extrabold tracking-tight text-[var(--admin-text-main)] sm:text-3xl">
              Painel{" "}
              <span className="text-[var(--admin-accent)]">Administrativo</span>
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-[var(--admin-text-muted)]">
              {shopName} <span className="mx-1 text-border-strong">•</span>{" "}
              Gestão e controle da operação
            </p>
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="mb-5 flex items-start gap-3 rounded-2xl border border-status-error/20 bg-status-error/10 p-4 text-sm font-medium text-status-error"
            >
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div
              role="status"
              className="mb-5 flex items-start gap-3 rounded-2xl border border-status-success/20 bg-status-success/10 p-4 text-sm font-medium text-status-success"
            >
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="admin-login-id"
                className="mb-2 block text-sm font-bold text-[var(--admin-text-main)]"
              >
                E-mail ou telefone
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--admin-text-muted)]" />
                <input
                  id="admin-login-id"
                  type="text"
                  required
                  autoComplete="username"
                  placeholder="admin@exemplo.com ou telefone"
                  value={loginData.loginId}
                  onChange={(event) =>
                    setLoginData({ ...loginData, loginId: event.target.value })
                  }
                  className="min-h-12 w-full rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] pl-12 pr-4 text-base text-[var(--admin-text-main)] placeholder:text-[var(--admin-text-muted)] focus:border-[var(--admin-accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-accent)]"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="admin-password"
                className="mb-2 block text-sm font-bold text-[var(--admin-text-main)]"
              >
                Senha
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--admin-text-muted)]" />
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
                  className="min-h-12 w-full rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] pl-12 pr-12 text-base text-[var(--admin-text-main)] placeholder:text-[var(--admin-text-muted)] focus:border-[var(--admin-accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-accent)]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl text-[var(--admin-text-muted)] hover:bg-[var(--admin-bg)] hover:text-[var(--admin-text-main)]"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--admin-accent)] px-4 text-sm font-extrabold text-[var(--admin-accent-text)] shadow-lg shadow-gold-base/20 transition-all hover:brightness-110 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-surface-base/30 border-t-surface-base" />
                  <span>Entrando...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="h-5 w-5" />
                  <span>Acessar painel</span>
                </>
              )}
            </button>
          </form>
        </div>

        <p className="mt-5 text-center text-xs font-medium text-[var(--admin-text-muted)]">
          {shopName} &copy; {new Date().getFullYear()}{" "}
          <span className="mx-1 text-border-strong">•</span> Acesso seguro para
          a equipe
        </p>
      </main>
    </div>
  );
};

export default AdminAuthView;
