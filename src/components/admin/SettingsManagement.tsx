import React, { useState, useEffect } from 'react';
import { Store, Phone, Link as LinkIcon, Save, Camera, CheckCircle2, Globe, Clock, MapPin, Palette, Check, Settings, Mail, Send, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { PALETTES, useTheme } from '../../contexts/ThemeContext';
import { AdminPageHeader } from './shared/AdminPageHeader';
import { fetchEmailSettings, saveEmailSettings, sendTestEmail, defaultEmailSettings, type EmailSettings } from '../../services/emailSettingsService';

type SettingsTab = 'contacts' | 'links' | 'appearance' | 'email';

export const SettingsManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('contacts');
  const [isSaving, setIsSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      showToast('Configurações salvas com sucesso!');
    }, 600);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'contacts':
        return <ContactSettings onSave={handleSave} isSaving={isSaving} />;
      case 'links':
        return <LinkSettings onSave={handleSave} isSaving={isSaving} />;
      case 'appearance':
        return <AppearanceSettings />;
      case 'email':
        return <EmailSettingsTab />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300 min-w-0">
      {/* Header (desktop) */}
      <AdminPageHeader
        icon={Settings}
        title="Configurações do Sistema"
        stats={[{ label: 'Geral', value: '', tone: 'gold' }]}
        action={{ label: isSaving ? 'Salvando...' : 'Salvar Alterações', onClick: handleSave, icon: Save }}
      />

      {/* Ação (mobile) */}
      <button
        onClick={handleSave}
        disabled={isSaving}
        className="md:hidden w-full h-10 bg-gold-base text-surface-base hover:bg-gold-base/90 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 disabled:opacity-50 shrink-0"
        aria-label="Salvar Alterações"
      >
        <Save className="w-4 h-4" />
        <span>{isSaving ? 'Salvando...' : 'Salvar Alterações'}</span>
      </button>

      {/* TOAST MESSAGE */}
      {toastMsg && (
        <div className="bg-status-success/10 border border-status-success/30 text-status-success p-3 rounded-xl flex items-center gap-2 text-xs font-bold animate-fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span className="truncate">{toastMsg}</span>
        </div>
      )}

      {/* TAB BAR */}
      <div className="bg-surface-card border border-border-subtle rounded-xl p-1 flex items-center gap-1 overflow-x-auto custom-scrollbar">
        <TabButton active={activeTab === 'contacts'} onClick={() => setActiveTab('contacts')} icon={Phone} label="Canais de Contato" />
        <TabButton active={activeTab === 'links'} onClick={() => setActiveTab('links')} icon={LinkIcon} label="Links & Redes" />
        <TabButton active={activeTab === 'email'} onClick={() => setActiveTab('email')} icon={Mail} label="E-mail" />
        <TabButton active={activeTab === 'appearance'} onClick={() => setActiveTab('appearance')} icon={Palette} label="Aparência" />
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="bg-surface-card border border-border-subtle rounded-xl p-4 sm:p-6 min-w-0">
        {renderContent()}
      </div>
    </div>
  );
};


const TabButton = ({ active, onClick, icon: Icon, label }: any) => (
  <button
    onClick={onClick}
    className={`
      h-10 sm:h-9 px-3.5 flex items-center justify-center gap-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap shrink-0 active:scale-95
      ${active ? 'bg-gold-base text-surface-base' : 'text-content-muted hover:text-content-base bg-surface-card/60 hover:bg-surface-base'}
    `}
  >
    <Icon className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
    <span>{label}</span>
  </button>
);

// --- Subcomponents for each tab ---

const AppearanceSettings: React.FC = () => {
  const { palette, setPalette } = useTheme();

  return (
    <div className="space-y-6 max-w-3xl text-xs min-w-0">
      <div>
        <h2 className="text-sm font-serif font-bold text-content-base mb-0.5">Paleta do sistema</h2>
        <p className="text-[11px] text-content-muted mb-4 max-w-xl">
          Personalize a cor de destaque do Navo sem alterar o tema claro/preto. A escolha é salva neste dispositivo e aplicada em todo o sistema.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {PALETTES.map((item) => {
          const selected = palette === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setPalette(item.id)}
              aria-pressed={selected}
              className={`group text-left rounded-lg border p-3 transition-all active:scale-[0.98] ${selected ? 'border-gold-base bg-gold-base/10 shadow-sm' : 'border-border-subtle bg-surface-base hover:border-gold-base/50 hover:bg-surface-elevated'}`}
            >
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-8 h-8 rounded-xl shrink-0 border border-white/10 shadow-inner" style={{ background: `linear-gradient(135deg, ${item.accentSoft}, ${item.deep})` }} />
                  <span className="min-w-0">
                    <span className="block text-xs font-bold text-content-base truncate">{item.name}</span>
                    <span className="block text-[10px] text-content-muted truncate">{item.description}</span>
                  </span>
                </div>
                {selected && <span className="w-5 h-5 rounded-full flex items-center justify-center bg-gold-base text-surface-base"><Check className="w-3 h-3" /></span>}
              </div>
              <div className="flex gap-1.5" aria-hidden="true">
                <span className="h-1.5 flex-1 rounded-full" style={{ backgroundColor: item.deep }} />
                <span className="h-1.5 flex-1 rounded-full" style={{ backgroundColor: item.accent }} />
                <span className="h-1.5 flex-1 rounded-full" style={{ backgroundColor: item.accentSoft }} />
              </div>
            </button>
          );
        })}
      </div>

      <div className="pt-4 border-t border-border-subtle flex items-start gap-2 text-[11px] text-content-muted">
        <Palette className="w-4 h-4 text-gold-base shrink-0 mt-0.5" />
        <p>O dourado Heritage permanece como padrão original. As demais opções alteram apenas os tokens de destaque, mantendo contraste, estados e hierarquia visual nativos.</p>
      </div>
    </div>
  );
};

const EmailSettingsTab: React.FC = () => {
  const [settings, setSettings] = useState<EmailSettings>(defaultEmailSettings);
  const [smtpPasswordInput, setSmtpPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchEmailSettings()
      .then((data) => { if (!cancelled) setSettings(data); })
      .catch((e) => { if (!cancelled) setStatusMsg({ type: 'error', text: e.message || 'Erro ao carregar configurações.' }); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const update = <K extends keyof EmailSettings>(key: K, value: EmailSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setStatusMsg(null);
    try {
      const payload: Partial<EmailSettings> & { smtpPassword?: string } = { ...settings };
      // Só envia a senha se o admin efetivamente digitou algo nesta sessão;
      // caso contrário o backend preserva a senha já salva.
      if (smtpPasswordInput.trim().length > 0) {
        payload.smtpPassword = smtpPasswordInput.trim();
      }
      const saved = await saveEmailSettings(payload);
      setSettings(saved);
      setSmtpPasswordInput('');
      setStatusMsg({ type: 'success', text: 'Configurações de e-mail salvas com sucesso!' });
    } catch (e: any) {
      setStatusMsg({ type: 'error', text: e.message || 'Erro ao salvar configurações de e-mail.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestSend = async () => {
    if (!testEmail.trim()) return;
    setIsTesting(true);
    setStatusMsg(null);
    try {
      const msg = await sendTestEmail(testEmail.trim());
      setStatusMsg({ type: 'success', text: msg });
    } catch (e: any) {
      setStatusMsg({ type: 'error', text: e.message || 'Erro ao enviar e-mail de teste.' });
    } finally {
      setIsTesting(false);
    }
  };

  if (loading) {
    return <div className="text-xs text-content-muted py-8 text-center">Carregando configurações de e-mail...</div>;
  }

  return (
    <div className="space-y-6 max-w-2xl text-xs min-w-0">
      <div>
        <h2 className="text-sm font-serif font-bold text-content-base mb-0.5 truncate">Envio de E-mails (SMTP)</h2>
        <p className="text-[11px] text-content-muted mb-4">
          Configure um servidor SMTP para enviar e-mails de confirmação e cancelamento de agendamentos aos clientes.
          Você pode usar um provedor gratuito, como o Gmail (com uma "Senha de app"), Brevo ou Zoho Mail.
        </p>
      </div>

      {statusMsg && (
        <div className={`p-3 rounded-xl flex items-center gap-2 text-xs font-bold ${statusMsg.type === 'success' ? 'bg-status-success/10 border border-status-success/30 text-status-success' : 'bg-status-error/10 border border-status-error/30 text-status-error'}`}>
          {statusMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{statusMsg.text}</span>
        </div>
      )}

      <div className="flex items-center justify-between bg-surface-base p-3.5 rounded-xl border border-border-subtle">
        <div>
          <p className="text-xs font-bold text-content-base">Ativar envio de e-mails</p>
          <p className="text-[11px] text-content-muted">Quando desativado, nenhum e-mail é enviado, mesmo com os dados preenchidos.</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={settings.enabled}
          onClick={() => update('enabled', !settings.enabled)}
          className={`w-11 h-6 rounded-full transition-colors shrink-0 relative ${settings.enabled ? 'bg-gold-base' : 'bg-border-subtle'}`}
        >
          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${settings.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label className="text-[10px] font-bold text-content-muted uppercase tracking-wider block mb-1">Servidor SMTP (host)</label>
            <input
              type="text"
              placeholder="smtp.gmail.com"
              value={settings.smtpHost}
              onChange={(e) => update('smtpHost', e.target.value)}
              className="w-full bg-surface-card border border-border-subtle rounded-xl p-2.5 text-xs text-content-base focus:outline-none focus:border-gold-base min-w-0"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-content-muted uppercase tracking-wider block mb-1">Porta</label>
            <input
              type="number"
              placeholder="587"
              value={settings.smtpPort}
              onChange={(e) => update('smtpPort', Number(e.target.value) || 587)}
              className="w-full bg-surface-card border border-border-subtle rounded-xl p-2.5 text-xs text-content-base focus:outline-none focus:border-gold-base min-w-0 num-tabular"
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-[11px] text-content-muted">
          <input
            type="checkbox"
            checked={settings.smtpSecure}
            onChange={(e) => update('smtpSecure', e.target.checked)}
            className="w-3.5 h-3.5 accent-gold-base"
          />
          Usar TLS implícito (marque para porta 465; deixe desmarcado para 587/STARTTLS)
        </label>

        <div>
          <label className="text-[10px] font-bold text-content-muted uppercase tracking-wider block mb-1">Usuário SMTP</label>
          <input
            type="text"
            placeholder="seuemail@gmail.com"
            value={settings.smtpUser}
            onChange={(e) => update('smtpUser', e.target.value)}
            className="w-full bg-surface-card border border-border-subtle rounded-xl p-2.5 text-xs text-content-base focus:outline-none focus:border-gold-base min-w-0"
          />
        </div>

        <div>
          <label className="text-[10px] font-bold text-content-muted uppercase tracking-wider block mb-1">
            Senha SMTP {settings.hasPassword && !smtpPasswordInput && <span className="normal-case font-normal text-content-muted">(já salva — deixe em branco para manter)</span>}
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder={settings.hasPassword ? '••••••••' : 'Senha ou senha de app'}
              value={smtpPasswordInput}
              onChange={(e) => setSmtpPasswordInput(e.target.value)}
              className="w-full bg-surface-card border border-border-subtle rounded-xl p-2.5 pr-9 text-xs text-content-base focus:outline-none focus:border-gold-base min-w-0"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-content-muted hover:text-content-base"
              aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
            >
              {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-bold text-content-muted uppercase tracking-wider block mb-1">Nome do remetente</label>
            <input
              type="text"
              placeholder="Navo Barber & Club"
              value={settings.fromName}
              onChange={(e) => update('fromName', e.target.value)}
              className="w-full bg-surface-card border border-border-subtle rounded-xl p-2.5 text-xs text-content-base focus:outline-none focus:border-gold-base min-w-0"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-content-muted uppercase tracking-wider block mb-1">E-mail de envio</label>
            <input
              type="email"
              placeholder="contato@suabarbearia.com"
              value={settings.fromEmail}
              onChange={(e) => update('fromEmail', e.target.value)}
              className="w-full bg-surface-card border border-border-subtle rounded-xl p-2.5 text-xs text-content-base focus:outline-none focus:border-gold-base min-w-0"
            />
          </div>
        </div>

        <div>
          <label className="text-[10px] font-bold text-content-muted uppercase tracking-wider block mb-1">Responder para (opcional)</label>
          <input
            type="email"
            placeholder="Deixe em branco para usar o e-mail de envio"
            value={settings.replyTo}
            onChange={(e) => update('replyTo', e.target.value)}
            className="w-full bg-surface-card border border-border-subtle rounded-xl p-2.5 text-xs text-content-base focus:outline-none focus:border-gold-base min-w-0"
          />
        </div>

        <div className="pt-2 space-y-2">
          <label className="flex items-center gap-2 text-[11px] text-content-base">
            <input
              type="checkbox"
              checked={settings.notifyOnBooking}
              onChange={(e) => update('notifyOnBooking', e.target.checked)}
              className="w-3.5 h-3.5 accent-gold-base"
            />
            Enviar e-mail ao confirmar agendamento
          </label>
          <label className="flex items-center gap-2 text-[11px] text-content-base">
            <input
              type="checkbox"
              checked={settings.notifyOnCancel}
              onChange={(e) => update('notifyOnCancel', e.target.checked)}
              className="w-3.5 h-3.5 accent-gold-base"
            />
            Enviar e-mail ao cancelar agendamento
          </label>
        </div>
      </div>

      {/* Action Zone: Save */}
      <div className="pt-4 border-t border-border-subtle flex justify-end">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="h-11 sm:h-10 w-full sm:w-auto px-5 bg-gold-base text-surface-base hover:bg-gold-base/90 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 whitespace-nowrap"
        >
          <Save className="w-4 h-4" />
          <span>{isSaving ? 'Salvando...' : 'Salvar Configurações de E-mail'}</span>
        </button>
      </div>

      {/* Test send */}
      <div className="pt-4 border-t border-border-subtle space-y-2">
        <h3 className="text-xs font-bold text-content-base">Testar envio</h3>
        <p className="text-[11px] text-content-muted">Salve os dados acima antes de testar. O teste funciona mesmo com o envio desativado.</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="email"
            placeholder="destinatario@exemplo.com"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            className="flex-1 bg-surface-card border border-border-subtle rounded-xl p-2.5 text-xs text-content-base focus:outline-none focus:border-gold-base min-w-0"
          />
          <button
            onClick={handleTestSend}
            disabled={isTesting || !testEmail.trim()}
            className="h-10 px-4 bg-surface-base border border-border-subtle hover:border-gold-base text-content-base rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{isTesting ? 'Enviando...' : 'Enviar Teste'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

const ProfileSettings = ({ onSave, isSaving }: { onSave: () => void; isSaving: boolean }) => (
  <div className="space-y-6 max-w-2xl text-xs min-w-0">
    <div>
      <h2 className="text-sm font-serif font-bold text-content-base mb-0.5 truncate">Identidade Visual da Barbearia</h2>
      <p className="text-[11px] text-content-muted mb-4 truncate">Atualize a logomarca e o nome exibidos no app do cliente.</p>

      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 bg-surface-base p-3.5 rounded-xl border border-border-subtle">
        <div className="w-20 h-20 bg-surface-card rounded-xl border border-border-subtle flex items-center justify-center relative group shrink-0 shadow-inner">
          <Store className="w-8 h-8 text-gold-base" />
          <button className="absolute inset-0 bg-surface-base/80 rounded-xl opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity text-content-base text-[10px] font-bold gap-1">
            <Camera className="w-4 h-4" />
            <span>Alterar</span>
          </button>
        </div>
        <div className="flex-1 space-y-2 w-full min-w-0">
          <div>
            <label className="text-[10px] font-bold text-content-muted uppercase tracking-wider block mb-1">
              Nome Fantasia / Unidade
            </label>
            <input
              type="text"
              defaultValue="Navo Barber & Club - Unidade Principal"
              className="w-full bg-surface-card border border-border-subtle rounded-xl p-2.5 text-xs text-content-base focus:outline-none focus:border-gold-base min-w-0"
            />
          </div>
        </div>
      </div>
    </div>

    <hr className="border-border-subtle" />

    <div className="space-y-3">
      <h2 className="text-sm font-serif font-bold text-content-base mb-0.5 truncate">Informações Gerais & Funcionamento</h2>

      <div>
        <label className="text-[10px] font-bold text-content-muted uppercase tracking-wider block mb-1">Slogan / Subtítulo</label>
        <input
          type="text"
          defaultValue="Estilo, Tradição e Excelência na Medida Certa"
          className="w-full bg-surface-card border border-border-subtle rounded-xl p-2.5 text-xs text-content-base focus:outline-none focus:border-gold-base min-w-0"
        />
      </div>

      <div>
        <label className="text-[10px] font-bold text-content-muted uppercase tracking-wider block mb-1">
          <MapPin className="w-3 h-3 inline mr-1 text-gold-base" /> Endereço Completo
        </label>
        <input
          type="text"
          defaultValue="Av. Paulista, 1000 - Bela Vista, São Paulo - SP"
          className="w-full bg-surface-card border border-border-subtle rounded-xl p-2.5 text-xs text-content-base focus:outline-none focus:border-gold-base min-w-0"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-bold text-content-muted uppercase tracking-wider block mb-1">
            <Clock className="w-3 h-3 inline mr-1 text-gold-base" /> Abertura
          </label>
          <input
            type="time"
            defaultValue="09:00"
            className="w-full bg-surface-card border border-border-subtle rounded-xl p-2.5 text-xs text-content-base focus:outline-none focus:border-gold-base min-w-0 num-tabular whitespace-nowrap"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold text-content-muted uppercase tracking-wider block mb-1">
            <Clock className="w-3 h-3 inline mr-1 text-gold-base" /> Fechamento
          </label>
          <input
            type="time"
            defaultValue="20:00"
            className="w-full bg-surface-card border border-border-subtle rounded-xl p-2.5 text-xs text-content-base focus:outline-none focus:border-gold-base min-w-0 num-tabular whitespace-nowrap"
          />
        </div>
      </div>
    </div>

    {/* Action Zone: Form Footer (Touch target >= 40px) */}
    <div className="pt-4 border-t border-border-subtle flex justify-end">
      <button
        onClick={onSave}
        disabled={isSaving}
        className="h-11 sm:h-10 w-full sm:w-auto px-5 bg-gold-base text-surface-base hover:bg-gold-base/90 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 whitespace-nowrap"
      >
        <Save className="w-4 h-4" />
        <span>{isSaving ? 'Salvando...' : 'Salvar Alterações do Perfil'}</span>
      </button>
    </div>
  </div>
);

const ContactSettings = ({ onSave, isSaving }: { onSave: () => void; isSaving: boolean }) => (
  <div className="space-y-6 max-w-2xl text-xs min-w-0">
    <div>
      <h2 className="text-sm font-serif font-bold text-content-base mb-0.5 truncate">Canais de Atendimento</h2>
      <p className="text-[11px] text-content-muted mb-4 truncate">
        Defina os contatos oficiais disponíveis no app para suporte aos clientes.
      </p>

      <div className="space-y-3">
        <div>
          <label className="text-[10px] font-bold text-content-muted uppercase tracking-wider block mb-1">
            WhatsApp Oficial de Agendamentos
          </label>
          <input
            type="text"
            defaultValue="(11) 99999-8888"
            className="w-full bg-surface-card border border-border-subtle rounded-xl p-2.5 text-xs text-content-base focus:outline-none focus:border-gold-base min-w-0 num-tabular whitespace-nowrap"
          />
        </div>

        <div>
          <label className="text-[10px] font-bold text-content-muted uppercase tracking-wider block mb-1">Telefone Fixo da Recepção</label>
          <input
            type="text"
            defaultValue="(11) 3211-0000"
            className="w-full bg-surface-card border border-border-subtle rounded-xl p-2.5 text-xs text-content-base focus:outline-none focus:border-gold-base min-w-0 num-tabular whitespace-nowrap"
          />
        </div>

        <div>
          <label className="text-[10px] font-bold text-content-muted uppercase tracking-wider block mb-1">E-mail de Suporte</label>
          <input
            type="email"
            defaultValue="contato@barberclub.com.br"
            className="w-full bg-surface-card border border-border-subtle rounded-xl p-2.5 text-xs text-content-base focus:outline-none focus:border-gold-base min-w-0"
          />
        </div>
      </div>
    </div>

    {/* Action Zone: Form Footer */}
    <div className="pt-4 border-t border-border-subtle flex justify-end">
      <button
        onClick={onSave}
        disabled={isSaving}
        className="h-11 sm:h-10 w-full sm:w-auto px-5 bg-gold-base text-surface-base hover:bg-gold-base/90 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 whitespace-nowrap"
      >
        <Save className="w-4 h-4" />
        <span>{isSaving ? 'Salvando...' : 'Salvar Contatos'}</span>
      </button>
    </div>
  </div>
);

const LinkSettings = ({ onSave, isSaving }: { onSave: () => void; isSaving: boolean }) => (
  <div className="space-y-6 max-w-2xl text-xs min-w-0">
    <div>
      <h2 className="text-sm font-serif font-bold text-content-base mb-0.5 truncate">Redes Sociais & Links Externos</h2>
      <p className="text-[11px] text-content-muted mb-4 truncate">
        Conecte suas redes sociais e página de localização do Google Maps.
      </p>

      <div className="space-y-3">
        <div>
          <label className="text-[10px] font-bold text-content-muted uppercase tracking-wider block mb-1">Instagram (@usuario)</label>
          <div className="flex min-w-0">
            <span className="bg-surface-base border border-r-0 border-border-subtle rounded-l-md px-3 py-2.5 text-content-muted font-bold shrink-0">
              @
            </span>
            <input
              type="text"
              defaultValue="navobarber_oficial"
              className="flex-1 min-w-0 bg-surface-card border border-border-subtle rounded-r-md p-2.5 text-xs text-content-base focus:outline-none focus:border-gold-base"
            />
          </div>
        </div>

        <div>
          <label className="text-[10px] font-bold text-content-muted uppercase tracking-wider block mb-1">Página do Facebook</label>
          <input
            type="url"
            defaultValue="https://facebook.com/navobarber"
            className="w-full bg-surface-card border border-border-subtle rounded-xl p-2.5 text-xs text-content-base focus:outline-none focus:border-gold-base min-w-0"
          />
        </div>

        <div>
          <label className="text-[10px] font-bold text-content-muted uppercase tracking-wider block mb-1">
            <Globe className="w-3 h-3 inline mr-1 text-gold-base" /> Link do Google Maps / Avaliações
          </label>
          <input
            type="url"
            defaultValue="https://maps.google.com/..."
            className="w-full bg-surface-card border border-border-subtle rounded-xl p-2.5 text-xs text-content-base focus:outline-none focus:border-gold-base min-w-0"
          />
        </div>
      </div>
    </div>

    {/* Action Zone: Form Footer */}
    <div className="pt-4 border-t border-border-subtle flex justify-end">
      <button
        onClick={onSave}
        disabled={isSaving}
        className="h-11 sm:h-10 w-full sm:w-auto px-5 bg-gold-base text-surface-base hover:bg-gold-base/90 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 whitespace-nowrap"
      >
        <Save className="w-4 h-4" />
        <span>{isSaving ? 'Salvando...' : 'Salvar Links'}</span>
      </button>
    </div>
  </div>
);
