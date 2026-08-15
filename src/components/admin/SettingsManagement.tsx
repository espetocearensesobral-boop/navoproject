import React, { useState, useEffect } from 'react';
import { Save, CheckCircle2, Settings, Mail, Send, AlertCircle, Eye, EyeOff, MessageSquare, QrCode, ShieldCheck, CalendarDays } from 'lucide-react';
import { AdminPageHeader } from './shared/AdminPageHeader';
import { AdminTabs } from './shared/AdminTabs';
import { fetchEmailSettings, saveEmailSettings, sendTestEmail, defaultEmailSettings, type EmailSettings } from '../../services/emailSettingsService';
import { WhatsAppManagement } from './WhatsAppManagement';
import { QrCodeManagement } from './QrCodeManagement';
import { AuditLogsManagement } from './AuditLogsManagement';
import { AgendaAvailabilitySettings } from './AgendaAvailabilitySettings';

export type SettingsTab = 'email' | 'whatsapp' | 'qrcode' | 'audit' | 'availability';

interface SettingsManagementProps {
  initialTab?: SettingsTab;
}

export const SettingsManagement: React.FC<SettingsManagementProps> = ({ initialTab = 'email' }) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const renderContent = () => {
    switch (activeTab) {
      case 'email':
        return <EmailSettingsTab />;
      case 'whatsapp':
        return <WhatsAppManagement />;
      case 'qrcode':
        return <QrCodeManagement />;
      case 'audit':
        return <AuditLogsManagement />;
      case 'availability':
        return <AgendaAvailabilitySettings />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300 min-w-0">
      <AdminPageHeader icon={Settings} title="Configurações do Sistema" />

      {/* TAB BAR */}
      <AdminTabs
        tabs={[
          { id: 'email', label: 'E-mail (SMTP)', icon: Mail },
          { id: 'whatsapp', label: 'Painel WhatsApp', icon: MessageSquare },
          { id: 'qrcode', label: 'QR Code & Balcão', icon: QrCode },
          { id: 'audit', label: 'Logs & Auditoria', icon: ShieldCheck },
          { id: 'availability', label: 'Agenda e Disponibilidade', icon: CalendarDays },
        ]}
        activeId={activeTab}
        onChange={(id) => setActiveTab(id as SettingsTab)}
      />

      {/* MAIN CONTENT AREA */}
      <div className="bg-surface-card border border-border-subtle rounded-xl p-4 sm:p-6 min-w-0">
        {renderContent()}
      </div>
    </div>
  );
};

// --- Subcomponents for each tab ---

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
          Configure um servidor SMTP para enviar avisos à barbearia e aos clientes que informarem e-mail no agendamento.
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

        <div>
          <label className="text-[10px] font-bold text-content-muted uppercase tracking-wider block mb-1">E-mail padrão da barbearia</label>
          <input
            type="email"
            placeholder="administrativo@suabarbearia.com"
            value={settings.notificationEmail}
            onChange={(e) => update('notificationEmail', e.target.value)}
            className="w-full bg-surface-card border border-border-subtle rounded-xl p-2.5 text-xs text-content-base focus:outline-none focus:border-gold-base min-w-0"
          />
          <p className="mt-1 text-[10px] text-content-muted">Receberá avisos de novos agendamentos, reagendamentos e cancelamentos. Se ficar vazio, o sistema não envia alertas administrativos por e-mail.</p>
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
              checked={settings.notifyOnReschedule}
              onChange={(e) => update('notifyOnReschedule', e.target.checked)}
              className="w-3.5 h-3.5 accent-gold-base"
            />
            Enviar e-mail ao reagendar agendamento
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

      {/* Ações finais da configuração de e-mail. */}
      <div className="pt-5 mt-2 border-t border-border-subtle flex flex-col sm:flex-row sm:justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            fetchEmailSettings()
              .then((data) => {
                setSettings(data);
                setSmtpPasswordInput('');
                setStatusMsg({ type: 'success', text: 'Alterações descartadas.' });
              })
              .catch((e) => setStatusMsg({ type: 'error', text: e.message || 'Não foi possível restaurar as configurações salvas.' }));
          }}
          disabled={isSaving}
          className="h-11 sm:h-10 w-full sm:w-auto px-5 rounded-xl border border-border-subtle bg-surface-card text-content-muted hover:text-content-base hover:bg-surface-base text-xs font-bold transition-colors disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="h-11 sm:h-10 w-full sm:w-auto px-5 bg-gold-base text-surface-base hover:bg-gold-base/90 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 whitespace-nowrap"
        >
          <Save className="w-4 h-4" />
          <span>{isSaving ? 'Salvando...' : 'Salvar Alterações'}</span>
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
