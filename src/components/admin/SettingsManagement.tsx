import React, { useState, useEffect } from 'react';
import { Save, CheckCircle2, Settings, Mail, Send, AlertCircle, Eye, EyeOff, MessageSquare, QrCode, ShieldCheck, CalendarDays, Printer, RotateCcw } from 'lucide-react';
import { AdminPageHeader } from './shared/AdminPageHeader';
import { AdminTabs } from './shared/AdminTabs';
import { fetchEmailSettings, saveEmailSettings, sendTestEmail, defaultEmailSettings, type EmailSettings } from '../../services/emailSettingsService';
import { WhatsAppManagement } from './WhatsAppManagement';
import { QrCodeManagement } from './QrCodeManagement';
import { AuditLogsManagement } from './AuditLogsManagement';
import { AgendaAvailabilitySettings } from './AgendaAvailabilitySettings';
import { defaultPrintSettings, fetchPrintSettings, savePrintSettings, type PrintSettings, type PrintFormat } from '../../services/printSettingsService';

export type SettingsTab = 'email' | 'whatsapp' | 'qrcode' | 'audit' | 'availability' | 'print';

interface SettingsManagementProps {
  initialTab?: SettingsTab;
  hideTabs?: boolean;
}

export const SettingsManagement: React.FC<SettingsManagementProps> = ({ initialTab = 'email', hideTabs = false }) => {
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
      case 'print':
        return <PrintSettingsTab />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300 min-w-0">
      <AdminPageHeader icon={Settings} title="Configurações do Sistema" />

      {!hideTabs && <>
      {/* TAB BAR */}
      <AdminTabs
        tabs={[
          { id: 'email', label: 'E-mail (SMTP)', icon: Mail },
          { id: 'whatsapp', label: 'Painel WhatsApp', icon: MessageSquare },
          { id: 'qrcode', label: 'QR Code & Balcão', icon: QrCode },
          { id: 'audit', label: 'Logs & Auditoria', icon: ShieldCheck },
          { id: 'availability', label: 'Agenda e Disponibilidade', icon: CalendarDays },
          { id: 'print', label: 'Impressões', icon: Printer },
        ]}
        activeId={activeTab}
        onChange={(id) => setActiveTab(id as SettingsTab)}
      />
      </>}

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
        <p className="text-xs text-content-muted mb-4">
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
          <p className="text-xs text-content-muted">Quando desativado, nenhum e-mail é enviado, mesmo com os dados preenchidos.</p>
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
            <label className="text-xs font-bold text-content-muted uppercase tracking-wider block mb-1">Servidor SMTP (host)</label>
            <input
              type="text"
              placeholder="smtp.gmail.com"
              value={settings.smtpHost}
              onChange={(e) => update('smtpHost', e.target.value)}
              className="w-full bg-surface-card border border-border-subtle rounded-xl p-2.5 text-xs text-content-base focus:outline-none focus:border-gold-base min-w-0"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-content-muted uppercase tracking-wider block mb-1">Porta</label>
            <input
              type="number"
              placeholder="587"
              value={settings.smtpPort}
              onChange={(e) => update('smtpPort', Number(e.target.value) || 587)}
              className="w-full bg-surface-card border border-border-subtle rounded-xl p-2.5 text-xs text-content-base focus:outline-none focus:border-gold-base min-w-0 num-tabular"
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-xs text-content-muted">
          <input
            type="checkbox"
            checked={settings.smtpSecure}
            onChange={(e) => update('smtpSecure', e.target.checked)}
            className="w-3.5 h-3.5 accent-gold-base"
          />
          Usar TLS implícito (marque para porta 465; deixe desmarcado para 587/STARTTLS)
        </label>

        <div>
          <label className="text-xs font-bold text-content-muted uppercase tracking-wider block mb-1">Usuário SMTP</label>
          <input
            type="text"
            placeholder="seuemail@gmail.com"
            value={settings.smtpUser}
            onChange={(e) => update('smtpUser', e.target.value)}
            className="w-full bg-surface-card border border-border-subtle rounded-xl p-2.5 text-xs text-content-base focus:outline-none focus:border-gold-base min-w-0"
          />
        </div>

        <div>
          <label className="text-xs font-bold text-content-muted uppercase tracking-wider block mb-1">
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
            <label className="text-xs font-bold text-content-muted uppercase tracking-wider block mb-1">Nome do remetente</label>
            <input
              type="text"
              placeholder="Navo Barber & Club"
              value={settings.fromName}
              onChange={(e) => update('fromName', e.target.value)}
              className="w-full bg-surface-card border border-border-subtle rounded-xl p-2.5 text-xs text-content-base focus:outline-none focus:border-gold-base min-w-0"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-content-muted uppercase tracking-wider block mb-1">E-mail de envio</label>
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
          <label className="text-xs font-bold text-content-muted uppercase tracking-wider block mb-1">Responder para (opcional)</label>
          <input
            type="email"
            placeholder="Deixe em branco para usar o e-mail de envio"
            value={settings.replyTo}
            onChange={(e) => update('replyTo', e.target.value)}
            className="w-full bg-surface-card border border-border-subtle rounded-xl p-2.5 text-xs text-content-base focus:outline-none focus:border-gold-base min-w-0"
          />
        </div>

        <div>
          <label className="text-xs font-bold text-content-muted uppercase tracking-wider block mb-1">E-mail padrão da barbearia</label>
          <input
            type="email"
            placeholder="administrativo@suabarbearia.com"
            value={settings.notificationEmail}
            onChange={(e) => update('notificationEmail', e.target.value)}
            className="w-full bg-surface-card border border-border-subtle rounded-xl p-2.5 text-xs text-content-base focus:outline-none focus:border-gold-base min-w-0"
          />
          <p className="mt-1 text-xs text-content-muted">Receberá avisos de novos agendamentos, reagendamentos e cancelamentos. Se ficar vazio, o sistema não envia alertas administrativos por e-mail.</p>
        </div>

        <div className="pt-2 space-y-2">
          <label className="flex items-center gap-2 text-xs text-content-base">
            <input
              type="checkbox"
              checked={settings.notifyOnBooking}
              onChange={(e) => update('notifyOnBooking', e.target.checked)}
              className="w-3.5 h-3.5 accent-gold-base"
            />
            Enviar e-mail ao confirmar agendamento
          </label>
          <label className="flex items-center gap-2 text-xs text-content-base">
            <input
              type="checkbox"
              checked={settings.notifyOnReschedule}
              onChange={(e) => update('notifyOnReschedule', e.target.checked)}
              className="w-3.5 h-3.5 accent-gold-base"
            />
            Enviar e-mail ao reagendar agendamento
          </label>
          <label className="flex items-center gap-2 text-xs text-content-base">
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
        <p className="text-xs text-content-muted">Salve os dados acima antes de testar. O teste funciona mesmo com o envio desativado.</p>
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


const PrintSettingsTab: React.FC = () => {
  const [settings, setSettings] = useState<PrintSettings>(defaultPrintSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchPrintSettings()
      .then((data) => { if (!cancelled) setSettings({ ...defaultPrintSettings, ...data }); })
      .catch((error) => { if (!cancelled) setStatus({ type: 'error', text: error.message || 'Não foi possível carregar as configurações de impressão.' }); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const update = <K extends keyof PrintSettings>(key: K, value: PrintSettings[K]) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setStatus(null);
    try {
      const saved = await savePrintSettings(settings);
      setSettings(saved);
      setStatus({ type: 'success', text: 'Configurações de impressão salvas com sucesso.' });
    } catch (error: any) {
      setStatus({ type: 'error', text: error.message || 'Não foi possível salvar as configurações de impressão.' });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    try {
      const saved = await fetchPrintSettings();
      setSettings(saved);
      setStatus({ type: 'success', text: 'Alterações descartadas.' });
    } catch (error: any) {
      setStatus({ type: 'error', text: error.message || 'Não foi possível restaurar as configurações salvas.' });
    }
  };

  const openPreview = (kind: 'receipt' | 'report' | 'qr') => {
    const popup = window.open('', '_blank', 'width=760,height=900');
    if (!popup) {
      setStatus({ type: 'error', text: 'O preview foi bloqueado pelo navegador. Permita pop-ups para testar a impressão.' });
      return;
    }
    const format = kind === 'receipt' ? settings.receiptFormat : kind === 'report' ? settings.reportFormat : settings.qrFormat;
    const width = format === 'thermal' ? `${settings.thermalWidthMm}mm` : '210mm';
    const pageSize = format === 'thermal' ? `${settings.thermalWidthMm}mm auto` : `A4 ${settings.a4Orientation}`;
    const density = settings.density === 'compact' ? '3px' : settings.density === 'spacious' ? '12px' : '7px';
    const title = kind === 'receipt' ? 'Comprovante de recebimento' : kind === 'report' ? 'Relatório financeiro' : 'Totem de agendamento';
    const content = kind === 'qr'
      ? '<div class="qr">QR</div><h1>NAVO PREMIUM</h1><p>Aponte a câmera para agendar seu horário.</p>'
      : kind === 'report'
        ? '<h1>Relatório financeiro</h1><p>Período: exemplo de validação</p><hr><div class="metric"><strong>Entradas confirmadas</strong><b>R$ 1.280,00</b></div><div class="metric"><strong>Saídas registradas</strong><b>R$ 320,00</b></div><div class="metric"><strong>Resultado líquido</strong><b>R$ 960,00</b></div>'
        : '<h1>Navo Barber & Club</h1><p>Comprovante de recebimento</p><hr><p><strong>Cliente:</strong> Cliente de teste</p><p><strong>Serviço:</strong> Corte Premium</p><p><strong>Profissional:</strong> Profissional Navo</p><hr><div class="metric"><strong>Total recebido</strong><b>R$ 85,00</b></div>';
    popup.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${title}</title><style>@page{size:${pageSize};margin:${settings.marginMm}mm}*{box-sizing:border-box}body{width:${width};max-width:100%;margin:0 auto;padding:${settings.marginMm}mm;font-family:Arial,sans-serif;color:#111;font-size:${settings.fontSize}px;line-height:1.35}h1{text-align:center;font-size:${settings.fontSize + 6}px;margin:0 0 ${density} 0}p{margin:${density} 0}hr{border:0;border-top:1px dashed #777;margin:${Number.parseInt(density) * 2}px 0}.metric{display:flex;justify-content:space-between;gap:12px;padding:${density} 0}.qr{width:48mm;height:48mm;margin:10mm auto;border:3px solid #111;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:700}@media print{body{box-shadow:none}}button{font-size:14px;padding:10px 16px}</style></head><body>${content}${settings.showFooter ? `<footer style="text-align:center;margin-top:24px;color:#555">${settings.footerText}</footer>` : ''}<p style="text-align:center;margin-top:28px"><button onclick="window.print()">Imprimir teste</button></p></body></html>`);
    popup.document.close();
  };

  if (loading) return <div className="text-xs text-content-muted py-8 text-center">Carregando configurações de impressão...</div>;

  const toggles: Array<[keyof PrintSettings, string, string]> = [
    ['showLogo', 'Exibir marca da barbearia', 'Cabeçalho com Navo Barber & Club.'],
    ['showClientData', 'Exibir dados do cliente', 'Nome e telefone quando disponíveis.'],
    ['showProfessional', 'Exibir profissional', 'Nome do barbeiro no documento.'],
    ['showService', 'Exibir serviço', 'Serviço, item ou atendimento realizado.'],
    ['showPayment', 'Exibir pagamento', 'Forma de pagamento e valores.'],
    ['showObservations', 'Exibir observações', 'Observações digitadas no checkout.'],
    ['showQr', 'Exibir QR Code quando aplicável', 'Inclui QR em documentos que suportam essa área.'],
    ['showFooter', 'Exibir rodapé', 'Texto institucional ao fim do documento.'],
  ];

  return (
    <div className="space-y-6 max-w-4xl text-xs min-w-0">
      <div>
        <h2 className="text-sm font-serif font-bold text-content-base">Impressões</h2>
        <p className="text-xs text-content-muted mt-1">Defina como comprovantes, relatórios e QR Codes devem ser preparados para impressora térmica ou folha A4. As mudanças afetam novos previews e impressões do navegador.</p>
      </div>

      {status && <div className={`p-3 rounded-xl flex items-center gap-2 font-bold ${status.type === 'success' ? 'bg-status-success/10 border border-status-success/30 text-status-success' : 'bg-status-error/10 border border-status-error/30 text-status-error'}`}><span>{status.text}</span></div>}

      <section className="space-y-3">
        <h3 className="text-xs font-bold text-content-base uppercase tracking-wider flex items-center gap-2"><Printer className="w-4 h-4 text-gold-base" /> Modelo por documento</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {([['receiptFormat', 'Comprovantes', 'receipt'], ['reportFormat', 'Relatórios', 'report'], ['qrFormat', 'QR Code / Totem', 'qr']] as const).map(([key, label, kind]) => (
            <div key={key} className="bg-surface-base border border-border-subtle rounded-xl p-3 space-y-3">
              <div><p className="font-bold text-content-base">{label}</p><p className="text-xs text-content-muted mt-0.5">Escolha o padrão mais adequado.</p></div>
              <select value={settings[key]} onChange={(e) => update(key, e.target.value as PrintFormat)} className="w-full bg-surface-card border border-border-subtle rounded-xl p-2.5 text-content-base"><option value="thermal">Impressora térmica</option><option value="a4">Folha A4</option></select>
              <button type="button" onClick={() => openPreview(kind)} className="w-full h-9 rounded-xl border border-border-subtle text-content-base font-bold flex items-center justify-center gap-2 hover:border-gold-base"><Printer className="w-3.5 h-3.5" /> Pré-visualizar</button>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-surface-base border border-border-subtle rounded-xl p-4 space-y-4">
        <div><h3 className="text-xs font-bold text-content-base uppercase tracking-wider">Papel e legibilidade</h3><p className="text-xs text-content-muted mt-1">Esses valores controlam largura, orientação, margem, tamanho e espaçamento no documento gerado.</p></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <label className="space-y-1"><span className="block text-xs font-bold text-content-muted uppercase">Largura térmica</span><select value={settings.thermalWidthMm} onChange={(e) => update('thermalWidthMm', Number(e.target.value) as 58 | 80)} className="w-full bg-surface-card border border-border-subtle rounded-xl p-2.5 text-content-base"><option value="58">58 mm</option><option value="80">80 mm</option></select></label>
          <label className="space-y-1"><span className="block text-xs font-bold text-content-muted uppercase">Orientação A4</span><select value={settings.a4Orientation} onChange={(e) => update('a4Orientation', e.target.value as PrintSettings['a4Orientation'])} className="w-full bg-surface-card border border-border-subtle rounded-xl p-2.5 text-content-base"><option value="portrait">Retrato</option><option value="landscape">Paisagem</option></select></label>
          <label className="space-y-1"><span className="block text-xs font-bold text-content-muted uppercase">Tamanho da fonte</span><input type="number" min="9" max="18" value={settings.fontSize} onChange={(e) => update('fontSize', Number(e.target.value))} className="w-full bg-surface-card border border-border-subtle rounded-xl p-2.5 text-content-base num-tabular" /></label>
          <label className="space-y-1"><span className="block text-xs font-bold text-content-muted uppercase">Margem (mm)</span><input type="number" min="0" max="30" value={settings.marginMm} onChange={(e) => update('marginMm', Number(e.target.value))} className="w-full bg-surface-card border border-border-subtle rounded-xl p-2.5 text-content-base num-tabular" /></label>
        </div>
        <label className="space-y-1 block max-w-sm"><span className="block text-xs font-bold text-content-muted uppercase">Densidade do conteúdo</span><select value={settings.density} onChange={(e) => update('density', e.target.value as PrintSettings['density'])} className="w-full bg-surface-card border border-border-subtle rounded-xl p-2.5 text-content-base"><option value="compact">Compacta — economiza papel</option><option value="comfortable">Confortável — padrão</option><option value="spacious">Espaçosa — mais respiro</option></select></label>
      </section>

      <section className="bg-surface-base border border-border-subtle rounded-xl p-4 space-y-3">
        <div><h3 className="text-xs font-bold text-content-base uppercase tracking-wider">Detalhes dos comprovantes</h3><p className="text-xs text-content-muted mt-1">Controle o que aparece no recibo sem apagar dados do banco.</p></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{toggles.map(([key, label, description]) => <label key={String(key)} className="flex items-start gap-2 p-2.5 rounded-xl border border-border-subtle bg-surface-card"><input type="checkbox" checked={Boolean(settings[key])} onChange={(e) => update(key, e.target.checked as PrintSettings[typeof key])} className="mt-0.5 accent-gold-base" /><span><strong className="text-content-base">{label}</strong><span className="block text-xs text-content-muted mt-0.5">{description}</span></span></label>)}</div>
        <label className="block space-y-1 pt-2"><span className="block text-xs font-bold text-content-muted uppercase">Texto do rodapé</span><input value={settings.footerText} onChange={(e) => update('footerText', e.target.value)} className="w-full bg-surface-card border border-border-subtle rounded-xl p-2.5 text-content-base" /></label>
      </section>

      <section className="bg-surface-base border border-border-subtle rounded-xl p-4 space-y-3">
        <div><h3 className="text-xs font-bold text-content-base uppercase tracking-wider">Relatórios</h3><p className="text-xs text-content-muted mt-1">O CSV continua independente; estas opções controlam a impressão visual do relatório.</p></div>
        <label className="flex items-start gap-2 p-2.5 rounded-xl border border-border-subtle bg-surface-card"><input type="checkbox" checked={settings.reportIncludeCharts} onChange={(e) => update('reportIncludeCharts', e.target.checked)} className="mt-0.5 accent-gold-base" /><span><strong className="text-content-base">Incluir gráficos e indicadores</strong><span className="block text-xs text-content-muted mt-0.5">Inclui a leitura visual do período quando houver dados.</span></span></label>
        <label className="flex items-start gap-2 p-2.5 rounded-xl border border-border-subtle bg-surface-card"><input type="checkbox" checked={settings.reportIncludeDetails} onChange={(e) => update('reportIncludeDetails', e.target.checked)} className="mt-0.5 accent-gold-base" /><span><strong className="text-content-base">Incluir detalhes e rankings</strong><span className="block text-xs text-content-muted mt-0.5">Inclui serviços, formas de pagamento, despesas e clientes.</span></span></label>
      </section>

      <div className="pt-4 border-t border-border-subtle flex flex-col sm:flex-row sm:justify-end gap-2"><button type="button" onClick={handleReset} disabled={saving} className="h-11 sm:h-10 w-full sm:w-auto px-5 rounded-xl border border-border-subtle bg-surface-card text-content-muted font-bold flex items-center justify-center gap-2"><RotateCcw className="w-4 h-4" />Cancelar</button><button type="button" onClick={handleSave} disabled={saving} className="h-11 sm:h-10 w-full sm:w-auto px-5 rounded-xl bg-gold-base text-surface-base font-bold flex items-center justify-center gap-2 disabled:opacity-50"><Save className="w-4 h-4" />{saving ? 'Salvando...' : 'Salvar Alterações'}</button></div>
    </div>
  );
};
