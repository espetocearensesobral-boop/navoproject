import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2, MessageSquare, RefreshCw, Save, Send, Settings2, Wifi, WifiOff } from 'lucide-react';
import { AdminPageHeader } from './shared/AdminPageHeader';
import {
  applyEvolutionWebhook,
  defaultEvolutionApiSettings,
  fetchEvolutionApiSettings,
  fetchEvolutionApiStatus,
  saveEvolutionApiSettings,
  sendEvolutionApiTest,
  testEvolutionApi,
  type EvolutionApiSettings,
  type EvolutionApiStatus,
} from '../../services/evolutionApiService';

type StatusMessage = { type: 'success' | 'error'; text: string } | null;

const statusLabel = (status: EvolutionApiStatus | null) => {
  if (!status?.configured) return 'não configurado';
  if (!status.reachable) return 'indisponível';
  if (status.instanceStatus === 'open' || status.instanceStatus === 'connected') return 'WhatsApp conectado';
  if (status.instanceStatus === 'not_created') return 'instância não criada';
  return status.instanceStatus || 'conectado à API';
};

export const WhatsAppManagement: React.FC = () => {
  const [settings, setSettings] = useState<EvolutionApiSettings>(defaultEvolutionApiSettings);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [webhookSecretInput, setWebhookSecretInput] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [status, setStatus] = useState<EvolutionApiStatus | null>(null);
  const [message, setMessage] = useState<StatusMessage>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [sending, setSending] = useState(false);
  const [applyingWebhook, setApplyingWebhook] = useState(false);
  const [testNumber, setTestNumber] = useState('');
  const [testText, setTestText] = useState('Olá! Esta é uma mensagem de teste do Navo Premium.');

  const load = async () => {
    setLoading(true);
    try {
      const [config, currentStatus] = await Promise.all([
        fetchEvolutionApiSettings(),
        fetchEvolutionApiStatus(),
      ]);
      setSettings(config);
      setApiKeyInput('');
      setWebhookSecretInput('');
      setStatus(currentStatus);
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Não foi possível carregar a configuração do WhatsApp.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const update = <K extends keyof EvolutionApiSettings>(key: K, value: EvolutionApiSettings[K]) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const payload: Partial<EvolutionApiSettings> & { apiKey?: string; webhookSecret?: string } = { ...settings };
      if (apiKeyInput.trim()) payload.apiKey = apiKeyInput.trim();
      if (webhookSecretInput.trim()) payload.webhookSecret = webhookSecretInput.trim();
      const saved = await saveEvolutionApiSettings(payload);
      setSettings(saved);
      setApiKeyInput('');
      setWebhookSecretInput('');
      setMessage({ type: 'success', text: 'Configurações da Evolution API salvas com sucesso.' });
      setStatus(await fetchEvolutionApiStatus());
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Não foi possível salvar a configuração.' });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setMessage(null);
    try {
      const result = await testEvolutionApi();
      setMessage({ type: 'success', text: result });
      setStatus(await fetchEvolutionApiStatus());
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Não foi possível testar a conexão.' });
    } finally {
      setTesting(false);
    }
  };

  const handleApplyWebhook = async () => {
    setApplyingWebhook(true);
    setMessage(null);
    try {
      const result = await applyEvolutionWebhook();
      setMessage({ type: 'success', text: result });
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Não foi possível aplicar o webhook.' });
    } finally {
      setApplyingWebhook(false);
    }
  };

  const handleSendTest = async () => {
    if (!testNumber.trim() || !testText.trim()) return;
    setSending(true);
    setMessage(null);
    try {
      const result = await sendEvolutionApiTest(testNumber, testText);
      setMessage({ type: 'success', text: result });
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Não foi possível enviar a mensagem.' });
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return <div className="py-10 text-center text-xs text-content-muted">Carregando configuração do WhatsApp...</div>;
  }

  const connected = !!status?.configured && !!status.reachable;
  const statusTone = connected ? 'success' : status?.configured ? 'warning' : 'muted';

  return (
    <div className="space-y-4 animate-fade-in text-content-base min-w-0">
      <AdminPageHeader
        icon={MessageSquare}
        title="WhatsApp / Evolution API"
        stats={[{ label: statusLabel(status), value: '', tone: connected ? 'success' : status?.configured ? 'warning' : 'muted' }]}
        action={{ label: 'Atualizar status', onClick: () => void load(), icon: RefreshCw }}
      />

      {message && (
        <div className={`p-3 rounded-xl flex items-center gap-2 text-xs font-bold ${message.type === 'success' ? 'bg-status-success/10 border border-status-success/30 text-status-success' : 'bg-status-error/10 border border-status-error/30 text-status-error'}`}>
          {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}

      <section className="p-4 bg-surface-base border border-border-subtle rounded-xl space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-content-base flex items-center gap-2"><Settings2 className="w-4 h-4 text-gold-base" /> Conexão da Evolution API</h2>
            <p className="text-xs text-content-muted mt-1">A URL, instância e chave ficam configuradas aqui. A chave nunca é devolvida ao navegador.</p>
          </div>
          <div className={`flex items-center gap-1.5 text-xs font-bold shrink-0 ${statusTone === 'success' ? 'text-status-success' : statusTone === 'warning' ? 'text-status-warning' : 'text-content-muted'}`}>
            {connected ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
            <span className="hidden sm:inline">{statusLabel(status)}</span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 p-3.5 rounded-xl border border-border-subtle bg-surface-card">
          <div className="min-w-0"><p className="text-xs font-bold text-content-base">Ativar integração</p><p className="text-xs text-content-muted mt-0.5">Quando desativada, o Navo não envia mensagens pela Evolution API.</p></div>
          <button type="button" role="switch" aria-checked={settings.enabled} onClick={() => update('enabled', !settings.enabled)} className={`w-11 h-6 rounded-full transition-colors shrink-0 relative ${settings.enabled ? 'bg-gold-base' : 'bg-border-subtle'}`}>
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${settings.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="space-y-1 sm:col-span-2"><span className="block text-xs font-bold text-content-muted uppercase tracking-wider">URL base da Evolution API</span><input value={settings.baseUrl} onChange={(event) => update('baseUrl', event.target.value)} placeholder="http://129.159.50.100:8080" className="w-full bg-surface-card border border-border-subtle rounded-xl p-2.5 text-xs text-content-base focus:outline-none focus:border-gold-base min-w-0" /><span className="block text-xs text-content-muted">Não inclua a rota final, como `/instance` ou `/message`.</span></label>
          <label className="space-y-1"><span className="block text-xs font-bold text-content-muted uppercase tracking-wider">Nome da instância</span><input value={settings.instanceName} onChange={(event) => update('instanceName', event.target.value)} placeholder="navo-bot" className="w-full bg-surface-card border border-border-subtle rounded-xl p-2.5 text-xs text-content-base focus:outline-none focus:border-gold-base min-w-0" /></label>
          <label className="space-y-1"><span className="block text-xs font-bold text-content-muted uppercase tracking-wider">Chave da API {settings.hasApiKey && <span className="normal-case font-normal">(já salva)</span>}</span><div className="relative"><input type={showApiKey ? 'text' : 'password'} value={apiKeyInput} onChange={(event) => setApiKeyInput(event.target.value)} placeholder={settings.hasApiKey ? '••••••••' : 'Cole a chave da Evolution API'} className="w-full bg-surface-card border border-border-subtle rounded-xl p-2.5 pr-10 text-xs text-content-base focus:outline-none focus:border-gold-base min-w-0" /><button type="button" aria-label={showApiKey ? 'Ocultar chave' : 'Mostrar chave'} onClick={() => setShowApiKey((visible) => !visible)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-content-muted hover:text-content-base">{showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button></div></label>
        </div>

        <div className="p-3 rounded-xl border border-border-subtle bg-surface-card space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0"><p className="text-xs font-bold text-content-base">Receber eventos por webhook</p><p className="text-xs text-content-muted mt-0.5">Aplica mensagens recebidas, conexão e QR Code na URL informada.</p></div>
            <button type="button" role="switch" aria-checked={settings.webhookEnabled} onClick={() => update('webhookEnabled', !settings.webhookEnabled)} className={`w-11 h-6 rounded-full transition-colors shrink-0 relative ${settings.webhookEnabled ? 'bg-gold-base' : 'bg-border-subtle'}`}>
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${settings.webhookEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>
          {settings.webhookEnabled && <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><label className="space-y-1 block"><span className="block text-xs font-bold text-content-muted uppercase tracking-wider">URL do webhook</span><input value={settings.webhookUrl} onChange={(event) => update('webhookUrl', event.target.value)} placeholder="https://seu-dominio.com/api/webhooks/evolution" className="w-full bg-surface-base border border-border-subtle rounded-xl p-2.5 text-xs text-content-base focus:outline-none focus:border-gold-base min-w-0" /></label><label className="space-y-1 block"><span className="block text-xs font-bold text-content-muted uppercase tracking-wider">Segredo do webhook {settings.hasWebhookSecret && <span className="normal-case font-normal">(já salvo)</span>}</span><input type="password" value={webhookSecretInput} onChange={(event) => setWebhookSecretInput(event.target.value)} placeholder={settings.hasWebhookSecret ? '••••••••' : 'Defina um segredo'} className="w-full bg-surface-base border border-border-subtle rounded-xl p-2.5 text-xs text-content-base focus:outline-none focus:border-gold-base min-w-0" /></label></div>}
          <div className="flex justify-end"><button type="button" onClick={() => void handleApplyWebhook()} disabled={applyingWebhook || saving || !settings.webhookEnabled && !settings.webhookUrl} className="h-9 w-full sm:w-auto px-4 rounded-xl border border-border-subtle text-content-base font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-50"><Wifi className="w-3.5 h-3.5" />{applyingWebhook ? 'Aplicando...' : 'Aplicar webhook'}</button></div>
        </div>

        <div className="flex flex-col sm:flex-row sm:justify-end gap-2 pt-2 border-t border-border-subtle">
          <button type="button" onClick={() => void handleTest()} disabled={testing || saving} className="h-10 px-4 rounded-xl border border-border-subtle bg-surface-card text-content-base font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-50"><RefreshCw className={`w-4 h-4 ${testing ? 'animate-spin' : ''}`} />{testing ? 'Testando...' : 'Testar conexão'}</button>
          <button type="button" onClick={() => void handleSave()} disabled={saving} className="h-10 px-4 rounded-xl bg-gold-base text-surface-base font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-50"><Save className="w-4 h-4" />{saving ? 'Salvando...' : 'Salvar configuração'}</button>
        </div>
      </section>

      <section className="p-4 bg-surface-card border border-border-subtle rounded-xl space-y-3">
        <div><h2 className="text-sm font-bold text-content-base">Mensagem de teste</h2><p className="text-xs text-content-muted mt-1">Use o telefone com código do país e DDD, somente números. Exemplo: `5511999998888`.</p></div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="space-y-1"><span className="block text-xs font-bold text-content-muted uppercase tracking-wider">Telefone</span><input value={testNumber} onChange={(event) => setTestNumber(event.target.value)} placeholder="5511999998888" inputMode="tel" className="w-full bg-surface-base border border-border-subtle rounded-xl p-2.5 text-xs text-content-base focus:outline-none focus:border-gold-base min-w-0" /></label>
          <label className="space-y-1 sm:col-span-2"><span className="block text-xs font-bold text-content-muted uppercase tracking-wider">Mensagem</span><input value={testText} onChange={(event) => setTestText(event.target.value)} className="w-full bg-surface-base border border-border-subtle rounded-xl p-2.5 text-xs text-content-base focus:outline-none focus:border-gold-base min-w-0" /></label>
        </div>
        <div className="flex justify-end"><button type="button" onClick={() => void handleSendTest()} disabled={sending || !testNumber.trim() || !testText.trim()} className="h-10 w-full sm:w-auto px-4 rounded-xl bg-surface-base border border-border-subtle text-content-base font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-50"><Send className="w-4 h-4" />{sending ? 'Enviando...' : 'Enviar mensagem de teste'}</button></div>
      </section>

      <div className="p-3 rounded-xl border border-border-subtle bg-surface-base text-xs text-content-muted">Para conectar um número, crie ou selecione a instância no Manager da Evolution API e leia o QR Code. Depois mantenha o mesmo nome da instância neste painel.</div>
    </div>
  );
};
