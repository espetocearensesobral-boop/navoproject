import React, { useState, useMemo } from 'react';
import { authFetch, readApiJson } from '../../lib/api';
import { Turnstile } from '@marsidev/react-turnstile';
import { X, Mail, Lock, User, Phone, Eye, EyeOff, KeyRound, CheckCircle, ArrowLeft, XCircle, ShieldCheck } from 'lucide-react';
import { TermsAndPrivacyModal } from '../shared/TermsAndPrivacyModal';

interface ClientLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (profile: any) => void;
  initialView?: 'login' | 'register';
}

const validateEmail = (email: string) => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
};

const validatePhone = (phone: string) => {
  const digits = phone.replace(/\D/g, '');
  return digits.length === 10 || digits.length === 11;
};

const validatePassword = (password: string) => {
  return {
    minLength: password.length >= 8,
    hasNumber: /\d/.test(password),
    hasUpperCase: /[A-Z]/.test(password)
  };
};

export const ClientLoginModal: React.FC<ClientLoginModalProps> = ({ isOpen, onClose, onLoginSuccess, initialView = 'login' }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>(initialView);
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [isSubmittingForgot, setIsSubmittingForgot] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalTab, setModalTab] = useState<'terms' | 'privacy' | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string>('');

  // Reset-password step (after the WhatsApp code was requested)
  const [resetCode, setResetCode] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [isSubmittingReset, setIsSubmittingReset] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  // Sync state if initialView changes
  React.useEffect(() => {
    setMode(initialView);
    setForgotSuccess(false);
    setErrorMsg('');
    setResetCode('');
    setResetNewPassword('');
    setResetDone(false);
  }, [initialView, isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, nextFieldId?: string) => {
    if (e.key === 'Enter') {
      if (nextFieldId) {
        e.preventDefault();
        document.getElementById(nextFieldId)?.focus();
      }
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    let digits = val.replace(/\D/g, '');
    if (digits.length > 11) digits = digits.slice(0, 11);
    let masked = val;
    if (digits.length > 0) {
      if (digits.length <= 2) masked = digits;
      else if (digits.length <= 6) masked = `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
      else if (digits.length <= 10) masked = `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
      else masked = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
    }
    setFormData({ ...formData, phone: masked });
  };

  const handleLoginIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const isPhone = /^[\d\s()\-+]+$/.test(val);
    
    if (isPhone) {
      let digits = val.replace(/\D/g, '');
      if (digits.length > 11) digits = digits.slice(0, 11);
      let masked = val;
      if (digits.length > 0) {
        if (digits.length <= 2) masked = digits;
        else if (digits.length <= 6) masked = `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
        else if (digits.length <= 10) masked = `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
        else masked = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
      }
      setFormData({ ...formData, loginId: masked, email: masked });
    } else {
      setFormData({ ...formData, loginId: val, email: val });
    }
  };

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    loginId: '', // For email or phone
    lgpdConsent: false
  });

  const [touched, setTouched] = useState({
    name: false,
    email: false,
    phone: false,
    password: false,
    loginId: false,
  });

  React.useEffect(() => {
    if (!isOpen) {
      setFormData({
        name: '',
        email: '',
        phone: '',
        password: '',
        loginId: '',
        lgpdConsent: false
      });
      setTouched({
        name: false,
        email: false,
        phone: false,
        password: false,
        loginId: false,
      });
      setErrorMsg('');
      setSuccessMsg('');
      setForgotSuccess(false);
      setResetCode('');
      setResetNewPassword('');
      setResetDone(false);
    } else {
      setMode(initialView);
    }
  }, [isOpen, initialView]);

  const pwVal = validatePassword(formData.password);
  const pwScore = (pwVal.minLength ? 1 : 0) + (pwVal.hasNumber ? 1 : 0) + (pwVal.hasUpperCase ? 1 : 0);
  const isEmailValid = validateEmail(formData.email);
  const isPhoneValid = validatePhone(formData.phone);
  const isNameValid = formData.name.trim().length >= 3;
  const isLoginIdValid = formData.loginId.trim().length > 0;

  const isRegisterValid = isNameValid && isEmailValid && isPhoneValid && pwScore === 3 && formData.lgpdConsent;
  const isLoginValid = isLoginIdValid && formData.password.length > 0;
  const isForgotValid = (mode === 'forgot') && (formData.loginId.trim().length > 0 || isEmailValid);

  if (!isOpen) return null;

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isForgotValid) return;
    setErrorMsg('');
    setSuccessMsg('');
    setIsSubmittingForgot(true);
    try {
      const res = await authFetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loginId: formData.loginId || formData.email, turnstileToken })
      });
      const data = await readApiJson<any>(res);
      setForgotSuccess(true);
      setSuccessMsg(data.message || 'Instruções enviadas para o seu e-mail / WhatsApp!');
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao processar solicitação.');
    } finally {
      setIsSubmittingForgot(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    if (resetCode.trim().length !== 6) {
      setErrorMsg('Digite o código de 6 dígitos recebido no WhatsApp.');
      return;
    }
    if (resetNewPassword.length < 8 || !/\d/.test(resetNewPassword) || !/[A-Z]/.test(resetNewPassword)) {
      setErrorMsg('A nova senha deve ter pelo menos 8 caracteres, uma letra maiúscula e um número.');
      return;
    }
    setIsSubmittingReset(true);
    try {
      const res = await authFetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loginId: formData.loginId || formData.email,
          code: resetCode.trim(),
          newPassword: resetNewPassword
        })
      });
      const data = await readApiJson<any>(res);
      setResetDone(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao redefinir senha.');
    } finally {
      setIsSubmittingReset(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    
    if (mode === 'forgot') {
      return handleForgotPassword(e);
    }

    setIsSubmitting(true);
    
    const effectiveToken = turnstileToken || (import.meta.env.DEV || !import.meta.env.VITE_TURNSTILE_SITE_KEY ? 'dev-turnstile-token' : '');

    if (mode === 'register') {
      if (!isRegisterValid) {
        setErrorMsg("Por favor, preencha todos os campos do cadastro corretamente.");
        setIsSubmitting(false);
        return;
      }
      if (!effectiveToken) {
        setErrorMsg("Por favor, aguarde ou complete a verificação de segurança (Cloudflare).");
        setIsSubmitting(false);
        return;
      }
      // Create profile
      try {
        const pendingRef = new URLSearchParams(window.location.search).get('ref')?.trim().toUpperCase() || undefined;
        const res = await authFetch('/api/profiles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formData.name,
            email: formData.email,
            phone: formData.phone,
            password: formData.password,
            lgpdConsent: formData.lgpdConsent,
            lgpdConsentDate: new Date().toISOString(),
            referralCode: pendingRef || undefined,
            turnstileToken: effectiveToken
          })
        });

        const data = await readApiJson<any>(res);
        if (pendingRef) {
          try {
            const refRes = await authFetch('/api/referrals/apply-code', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ referralCode: pendingRef })
            });
            if (!refRes.ok) {
              const err = await refRes.json().catch(() => ({}));
              console.warn('Falha ao aplicar código de indicação no cadastro:', err);
            }
          } catch (e) {
            console.error('Erro de rede ao aplicar indicação:', e);
          }
        }
        onLoginSuccess(data);
      } catch (err: any) {
        console.warn('Registration failed:', err);
        setErrorMsg(err.message || 'Erro ao cadastrar. Tente novamente.');
      }
    } else {
      if (!isLoginValid) {
        setErrorMsg("Informe seu e-mail/telefone e senha.");
        setIsSubmitting(false);
        return;
      }
      if (!effectiveToken) {
        setErrorMsg("Por favor, aguarde ou complete a verificação de segurança (Cloudflare).");
        setIsSubmitting(false);
        return;
      }
      try {
        const res = await authFetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            loginId: formData.loginId,
            password: formData.password,
            turnstileToken: effectiveToken
          })
        });

        const user = await readApiJson<any>(res);
        onLoginSuccess(user);
      } catch (err: any) {
        console.warn('Login failed:', err);
        setErrorMsg(err.message || 'Erro ao fazer login. Tente novamente.');
      }
    }
    setIsSubmitting(false);
  };

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-surface-base/60 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-modal-title"
    >
      <div className="w-full max-w-md bg-surface-base rounded-3xl border border-border-subtle shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto custom-scrollbar">
        <button 
          onClick={onClose} 
          aria-label="Fechar modal de autenticação"
          className="absolute top-4 right-4 p-2 bg-surface-base rounded-full text-content-muted hover:text-content-base focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-base"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 id="login-modal-title" className="text-xl font-extrabold text-content-base mb-6 flex items-center gap-2">
          {mode === 'forgot' && (
            <button
              type="button"
              onClick={() => { setMode('login'); setErrorMsg(''); setForgotSuccess(false); }}
              aria-label="Voltar para a tela de login"
              className="p-1 rounded-full hover:bg-surface-card text-content-muted hover:text-content-base transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-base"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          {mode === 'register' ? 'Criar Conta' : mode === 'forgot' ? 'Recuperar Senha' : 'Acessar Conta'}
        </h2>

        {errorMsg && (
          <div id="login-error-msg" role="alert" className="mb-4 p-3.5 rounded-xl bg-status-error/10 border border-status-error/20 text-status-error text-xs font-medium space-y-2">
            <div>{errorMsg}</div>
            {(errorMsg.includes('/admin') || errorMsg.includes('administrador')) && (
              <button
                type="button"
                onClick={() => { window.location.href = '/admin'; }}
                className="w-full mt-1.5 py-2 px-3 rounded-lg bg-gold-base text-surface-base font-bold text-xs hover:brightness-110 transition-all flex items-center justify-center gap-1.5 shadow-md active:scale-95"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Ir para Painel Administrativo (/admin)</span>
              </button>
            )}
          </div>
        )}
        {successMsg && <div className="mb-4 p-3 rounded-xl bg-status-success/10 border border-status-success/20 text-status-success text-sm font-medium flex items-center gap-2"><CheckCircle className="w-4 h-4 shrink-0" /><span>{successMsg}</span></div>}

        {mode === 'forgot' && forgotSuccess && resetDone ? (
          <div className="space-y-4 text-center py-2">
            <div className="w-12 h-12 rounded-full bg-status-success/20 border border-status-success/30 text-status-success mx-auto flex items-center justify-center">
              <CheckCircle className="w-6 h-6" />
            </div>
            <p className="text-xs text-content-muted leading-relaxed">
              Senha redefinida com sucesso! Já pode entrar com a nova senha.
            </p>
            <button
              type="button"
              onClick={() => { setMode('login'); setForgotSuccess(false); setResetDone(false); setErrorMsg(''); }}
              className="w-full bg-gold-base text-surface-base font-extrabold rounded-xl py-3 mt-2 active:scale-95 transition-all shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-base focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base"
            >
              Voltar ao Login
            </button>
          </div>
        ) : mode === 'forgot' && forgotSuccess ? (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-2 text-center py-1">
              <div className="w-12 h-12 rounded-full bg-status-success/20 border border-status-success/30 text-status-success mx-auto flex items-center justify-center">
                <CheckCircle className="w-6 h-6" />
              </div>
              <p className="text-xs text-content-muted leading-relaxed">
                Se o cadastro existir, enviamos um código de 6 dígitos por WhatsApp. Ele expira em 10 minutos.
              </p>
            </div>

            <div>
              <label className="text-xs font-bold text-content-muted block mb-1">Código de verificação</label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-3 w-5 h-5 text-content-muted" />
                <input
                  id="reset-code"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  aria-describedby={errorMsg ? "login-error-msg" : undefined}
                  value={resetCode}
                  onChange={(e) => setResetCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  onKeyDown={(e) => handleKeyDown(e, 'reset-new-password')}
                  className="w-full bg-surface-base border border-border-subtle rounded-xl py-3 pl-10 pr-4 text-content-base text-sm tracking-[0.3em] focus:border-gold-base focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-base"
                  placeholder="000000"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-content-muted block mb-1">Nova senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-5 h-5 text-content-muted" />
                <input
                  id="reset-new-password"
                  type={showResetPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  value={resetNewPassword}
                  onChange={(e) => setResetNewPassword(e.target.value)}
                  className="w-full bg-surface-base border border-border-subtle rounded-xl py-3 pl-10 pr-10 text-content-base text-sm focus:border-gold-base focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-base"
                  placeholder="8 caracteres, número e maiúscula"
                />
                <button
                  type="button"
                  onClick={() => setShowResetPassword(prev => !prev)}
                  className="absolute right-3 top-3 text-content-muted"
                  aria-label={showResetPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showResetPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            
            <div className="flex justify-center items-center my-3.5 pt-1 min-h-[65px] w-full">
              <Turnstile
                key="reset-password-step"
                siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY || '1x00000000000000000000AA'}
                options={{ theme: 'auto', size: 'normal', action: 'reset-password' }}
                onSuccess={(token) => {
                  setTurnstileToken(token);
                  setErrorMsg('');
                }}
                onError={(err) => {
                  console.warn('Turnstile error:', err);
                }}
                onExpire={() => setTurnstileToken('')}
              />
            </div>
<button
              type="submit"
              disabled={isSubmittingReset || resetCode.length !== 6 || resetNewPassword.length < 6}
              className="w-full bg-gold-base text-surface-base font-extrabold rounded-xl py-3 mt-2 active:scale-95 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-base focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base"
            >
              {isSubmittingReset ? 'Redefinindo...' : 'Redefinir Senha'}
            </button>

            <button
              type="button"
              onClick={() => { setForgotSuccess(false); setErrorMsg(''); setResetCode(''); }}
              className="w-full flex items-center justify-center gap-1.5 text-xs text-content-muted hover:text-content-base transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Não recebi o código, tentar de novo</span>
            </button>
          </form>
        ) : mode === 'forgot' ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-xs text-content-muted leading-relaxed mb-2">
              Digite seu e-mail ou telefone cadastrado. Enviaremos um código de recuperação para redefinir sua senha.
            </p>
            
            <div>
              <label className="text-xs font-bold text-content-muted block mb-1">E-mail ou Telefone</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-5 h-5 text-content-muted" />
                <input
                  id="forgot-loginid"
                  type="text"
                  required
                  aria-describedby={errorMsg ? "login-error-msg" : undefined}
                  value={formData.loginId || formData.email}
                  onChange={handleLoginIdChange}
                  className="w-full bg-surface-base border border-border-subtle rounded-xl py-3 pl-10 pr-4 text-content-base text-sm focus:border-gold-base focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-base"
                  placeholder="Seu e-mail ou telefone"
                />
              </div>
            </div>

            <div className="flex justify-center items-center my-3.5 pt-1 min-h-[65px] w-full">
              <Turnstile
                key="forgot-step1"
                siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY || '1x00000000000000000000AA'}
                options={{ theme: 'auto', size: 'normal', action: 'forgot-password' }}
                onSuccess={(token) => {
                  setTurnstileToken(token);
                  setErrorMsg('');
                }}
                onError={(err) => {
                  console.warn('Turnstile error:', err);
                }}
                onExpire={() => setTurnstileToken('')}
              />
            </div>

            <button
              type="submit"
              disabled={isSubmittingForgot || !isForgotValid}
              className="w-full bg-gold-base text-surface-base font-extrabold rounded-xl py-3 mt-2 active:scale-95 hover:opacity-95 shadow-lg shadow-[#C9A96E]/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-base focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base"
            >
              <KeyRound className="w-4 h-4" />
              <span>{isSubmittingForgot ? 'Enviando...' : 'Enviar Código de Recuperação'}</span>
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <>
                <div>
                  <label className="text-xs font-bold text-content-muted block mb-1">Nome Completo</label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 w-5 h-5 text-content-muted" />
                    <input
                      id="reg-name"
                      type="text"
                      required
                      value={formData.name}
                      onBlur={() => setTouched(t => ({ ...t, name: true }))}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      onKeyDown={(e) => handleKeyDown(e, 'reg-phone')}
                      className="w-full bg-surface-base border border-border-subtle rounded-xl py-3 pl-10 pr-10 text-content-base text-sm focus:border-gold-base focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-base"
                      placeholder="Seu nome"
                    />
                    {touched.name && (
                      <div className="absolute right-3 top-3">
                        {isNameValid ? <CheckCircle className="w-5 h-5 text-status-success" /> : <XCircle className="w-5 h-5 text-status-error" />}
                      </div>
                    )}
                  </div>
                  {touched.name && !isNameValid && <p className="text-[10px] text-status-error mt-1">Insira seu nome completo.</p>}
                </div>
                
                <div>
                  <label className="text-xs font-bold text-content-muted block mb-1">Telefone</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 w-5 h-5 text-content-muted" />
                    <input
                      id="reg-phone"
                      type="tel"
                      required
                      value={formData.phone}
                      onBlur={() => setTouched(t => ({ ...t, phone: true }))}
                      onChange={handlePhoneChange}
                      onKeyDown={(e) => handleKeyDown(e, 'reg-email')}
                      className="w-full bg-surface-base border border-border-subtle rounded-xl py-3 pl-10 pr-10 text-content-base text-sm focus:border-gold-base focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-base"
                      placeholder="(11) 90000-0000"
                    />
                    {touched.phone && (
                      <div className="absolute right-3 top-3">
                        {isPhoneValid ? <CheckCircle className="w-5 h-5 text-status-success" /> : <XCircle className="w-5 h-5 text-status-error" />}
                      </div>
                    )}
                  </div>
                  {touched.phone && !isPhoneValid && <p className="text-[10px] text-status-error mt-1">Insira um número de telefone válido (10 ou 11 dígitos).</p>}
                </div>
              </>
            )}

            {mode === 'register' ? (
              <div>
                <label className="text-xs font-bold text-content-muted block mb-1">E-mail</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 w-5 h-5 text-content-muted" />
                  <input
                    id="reg-email"
                    type="email"
                    required
                    value={formData.email}
                    onBlur={() => setTouched(t => ({ ...t, email: true }))}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    onKeyDown={(e) => handleKeyDown(e, 'reg-password')}
                    className="w-full bg-surface-base border border-border-subtle rounded-xl py-3 pl-10 pr-10 text-content-base text-sm focus:border-gold-base focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-base"
                    placeholder="seu@email.com"
                  />
                  {touched.email && (
                    <div className="absolute right-3 top-3">
                      {isEmailValid ? <CheckCircle className="w-5 h-5 text-status-success" /> : <XCircle className="w-5 h-5 text-status-error" />}
                    </div>
                  )}
                </div>
                {touched.email && !isEmailValid && <p className="text-[10px] text-status-error mt-1">Insira um e-mail válido.</p>}
              </div>
            ) : (
              <div>
                <label className="text-xs font-bold text-content-muted block mb-1">E-mail ou Telefone</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 w-5 h-5 text-content-muted" />
                  <input
                    id="log-loginid"
                    type="text"
                    required
                    value={formData.loginId}
                    onChange={handleLoginIdChange}
                    onKeyDown={(e) => handleKeyDown(e, 'log-password')}
                    className="w-full bg-surface-base border border-border-subtle rounded-xl py-3 pl-10 pr-4 text-content-base text-sm focus:border-gold-base focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-base"
                    placeholder="E-mail ou telefone"
                  />
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-content-muted">Senha</label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => { setMode('forgot'); setTurnstileToken(''); setErrorMsg(''); setSuccessMsg(''); }}
                    className="text-[11px] font-bold text-gold-base hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-base rounded px-1"
                  >
                    Esqueci minha senha
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-5 h-5 text-content-muted" />
                <input
                  id={mode === 'register' ? "reg-password" : "log-password"}
                  type={showPassword ? "text" : "password"}
                  required
                  value={formData.password}
                  onBlur={() => setTouched(t => ({ ...t, password: true }))}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  onKeyDown={(e) => handleKeyDown(e, mode === 'register' ? 'reg-submit' : 'log-submit')}
                  className="w-full bg-surface-base border border-border-subtle rounded-xl py-3 pl-10 pr-12 text-content-base text-sm focus:border-gold-base focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-base"
                  placeholder="******"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-content-muted hover:text-content-base transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-base rounded"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              
              {mode === 'register' && (
                <div className="mt-2 space-y-1">
                  <div className="flex gap-1 h-1.5 w-full">
                    <div className={`flex-1 rounded-full ${pwScore >= 1 ? 'bg-status-error' : 'bg-border-subtle'}`}></div>
                    <div className={`flex-1 rounded-full ${pwScore >= 2 ? 'bg-status-warning' : 'bg-border-subtle'}`}></div>
                    <div className={`flex-1 rounded-full ${pwScore >= 3 ? 'bg-status-success' : 'bg-border-subtle'}`}></div>
                  </div>
                  <ul className="text-[10px] text-content-muted mt-1 space-y-0.5">
                    <li className="flex items-center gap-1">
                      {pwVal.minLength ? <CheckCircle className="w-3 h-3 text-status-success" /> : <XCircle className="w-3 h-3 text-status-error" />}
                      Mínimo 8 caracteres
                    </li>
                    <li className="flex items-center gap-1">
                      {pwVal.hasNumber ? <CheckCircle className="w-3 h-3 text-status-success" /> : <XCircle className="w-3 h-3 text-status-error" />}
                      Pelo menos um número
                    </li>
                    <li className="flex items-center gap-1">
                      {pwVal.hasUpperCase ? <CheckCircle className="w-3 h-3 text-status-success" /> : <XCircle className="w-3 h-3 text-status-error" />}
                      Pelo menos uma letra maiúscula
                    </li>
                  </ul>
                </div>
              )}
            </div>

            {mode === 'register' && (
              <div className="flex items-start space-x-2 mt-4 bg-border-subtle p-3 rounded-xl border border-border-subtle">
                <input
                  type="checkbox"
                  id="lgpdConsent"
                  required
                  className="mt-0.5 w-4 h-4 rounded border-border-subtle bg-surface-base text-content-base focus:ring-gold-base focus-visible:ring-2 focus-visible:ring-gold-base"
                  checked={formData.lgpdConsent}
                  onChange={(e) => setFormData({ ...formData, lgpdConsent: e.target.checked })}
                />
                <label htmlFor="lgpdConsent" className="text-[10px] text-content-muted leading-tight cursor-pointer">
                  Ao criar uma conta, eu concordo com os{' '}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setModalTab('terms');
                    }}
                    className="text-gold-base underline hover:text-gold-hover font-semibold inline-block"
                  >
                    Termos de Serviço
                  </button>{' '}
                  e{' '}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setModalTab('privacy');
                    }}
                    className="text-gold-base underline hover:text-gold-hover font-semibold inline-block"
                  >
                    Política de privacidade
                  </button>.
                </label>
              </div>
            )}

            <div className="flex justify-center items-center my-3.5 pt-1 min-h-[65px] w-full">
              <Turnstile
                key={mode}
                siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY || '1x00000000000000000000AA'}
                options={{
                  theme: 'auto',
                  size: 'normal',
                  action: mode === 'register' ? 'client-register' : 'client-login',
                }}
                onSuccess={(token) => {
                  setTurnstileToken(token);
                  setErrorMsg('');
                }}
                onError={(err) => {
                  console.warn('Turnstile error:', err);
                }}
                onExpire={() => setTurnstileToken('')}
              />
            </div>

            <button
              id={mode === 'register' ? 'reg-submit' : 'log-submit'}
              type="submit"
              disabled={isSubmitting || (mode === 'register' ? !isRegisterValid : !isLoginValid)}
              className="w-full bg-gold-base text-surface-base font-extrabold rounded-xl py-3 mt-2 active:scale-95 hover:opacity-95 shadow-lg shadow-[#C9A96E]/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-base focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base flex items-center justify-center"
            >
              {isSubmitting ? (mode === 'register' ? 'Cadastrando...' : 'Entrando...') : (mode === 'register' ? 'Cadastrar' : 'Entrar')}
            </button>
          </form>
        )}

        <div className="mt-6 text-center">
          <button
            onClick={() => { setMode(mode === 'register' ? 'login' : 'register'); setTurnstileToken(''); setErrorMsg(''); setSuccessMsg(''); }}
            className="text-xs font-bold text-content-base hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-base rounded px-2 py-1"
          >
            {mode === 'register' ? 'Já tenho uma conta. Entrar' : mode === 'forgot' ? 'Voltar para o Entrar' : 'Não tem conta? Criar uma'}
          </button>
        </div>

        <TermsAndPrivacyModal
          isOpen={!!modalTab}
          defaultTab={modalTab || 'terms'}
          onClose={() => setModalTab(null)}
        />
      </div>
    </div>
  );
};
