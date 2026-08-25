import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  MessageSquare,
  RefreshCw,
  Save,
  Send,
  Settings2,
  Sparkles,
  Wifi,
  WifiOff,
} from "lucide-react";
import { AdminPageHeader } from "./shared/AdminPageHeader";
import {
  applyEvolutionWebhook,
  defaultEvolutionApiSettings,
  fetchEvolutionApiSettings,
  fetchEvolutionApiStatus,
  saveEvolutionApiSettings,
  sendEvolutionApiTest,
  testEvolutionApi,
  testNavoBotAi,
  type EvolutionApiSettings,
  type EvolutionApiSettingsInput,
  type EvolutionApiStatus,
  type NavoBotAiTestResult,
} from "../../services/evolutionApiService";

type StatusMessage = { type: "success" | "error"; text: string } | null;

const statusLabel = (status: EvolutionApiStatus | null) => {
  if (!status?.configured) return "não configurado";
  if (!status.reachable) return "indisponível";
  if (status.instanceStatus === "open" || status.instanceStatus === "connected")
    return "WhatsApp conectado";
  if (status.instanceStatus === "not_created") return "instância não criada";
  return status.instanceStatus || "conectado à API";
};

export const WhatsAppManagement: React.FC = () => {
  const [settings, setSettings] = useState<EvolutionApiSettings>(
    defaultEvolutionApiSettings,
  );
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [webhookSecretInput, setWebhookSecretInput] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [status, setStatus] = useState<EvolutionApiStatus | null>(null);
  const [message, setMessage] = useState<StatusMessage>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [sending, setSending] = useState(false);
  const [applyingWebhook, setApplyingWebhook] = useState(false);
  const [testingAi, setTestingAi] = useState(false);
  const [aiResult, setAiResult] = useState<NavoBotAiTestResult | null>(null);
  const [testNumber, setTestNumber] = useState("");
  const [testText, setTestText] = useState(
    "Olá! Esta é uma mensagem de teste do Navo Premium.",
  );

  const load = async () => {
    setLoading(true);
    try {
      const [config, currentStatus] = await Promise.all([
        fetchEvolutionApiSettings(),
        fetchEvolutionApiStatus(),
      ]);
      setSettings(config);
      setApiKeyInput("");
      setWebhookSecretInput("");
      setStatus(currentStatus);
    } catch (error: any) {
      setMessage({
        type: "error",
        text:
          error?.message ||
          "Não foi possível carregar a configuração do WhatsApp.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const update = <K extends keyof EvolutionApiSettings>(
    key: K,
    value: EvolutionApiSettings[K],
  ) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const payload: EvolutionApiSettingsInput = {
        enabled: settings.enabled,
        baseUrl: settings.baseUrl,
        instanceName: settings.instanceName,
        webhookEnabled: settings.webhookEnabled,
        webhookUrl: settings.webhookUrl,
        navoBotEnabled: settings.navoBotEnabled,
        whatsappAccountType: settings.whatsappAccountType,
        useInteractiveMessages: settings.useInteractiveMessages,
      };
      if (apiKeyInput.trim()) payload.apiKey = apiKeyInput.trim();
      if (webhookSecretInput.trim())
        payload.webhookSecret = webhookSecretInput.trim();
      const saved = await saveEvolutionApiSettings(payload);
      setSettings(saved);
      setApiKeyInput("");
      setWebhookSecretInput("");
      setMessage({
        type: "success",
        text: "Configurações da Evolution API salvas com sucesso.",
      });
      setStatus(await fetchEvolutionApiStatus());
    } catch (error: any) {
      setMessage({
        type: "error",
        text: error?.message || "Não foi possível salvar a configuração.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setMessage(null);
    try {
      const result = await testEvolutionApi();
      setMessage({ type: "success", text: result });
      setStatus(await fetchEvolutionApiStatus());
    } catch (error: any) {
      setMessage({
        type: "error",
        text: error?.message || "Não foi possível testar a conexão.",
      });
    } finally {
      setTesting(false);
    }
  };

  const handleApplyWebhook = async () => {
    setApplyingWebhook(true);
    setMessage(null);
    try {
      const result = await applyEvolutionWebhook();
      setMessage({ type: "success", text: result });
    } catch (error: any) {
      setMessage({
        type: "error",
        text: error?.message || "Não foi possível aplicar o webhook.",
      });
    } finally {
      setApplyingWebhook(false);
    }
  };

  const handleAiTest = async () => {
    setTestingAi(true);
    setAiResult(null);
    try {
      setAiResult(await testNavoBotAi());
    } catch (error: any) {
      setAiResult({
        ok: false,
        configured: false,
        usedGemini: false,
        model: "gemini-3.6-flash",
        latencyMs: 0,
        message:
          error?.message || "Não foi possível testar o Gemini do NavoBot.",
      });
    } finally {
      setTestingAi(false);
    }
  };

  const handleSendTest = async () => {
    if (!testNumber.trim() || !testText.trim()) return;
    setSending(true);
    setMessage(null);
    try {
      const result = await sendEvolutionApiTest(testNumber, testText);
      setMessage({ type: "success", text: result });
    } catch (error: any) {
      setMessage({
        type: "error",
        text: error?.message || "Não foi possível enviar a mensagem.",
      });
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="py-10 text-center text-xs text-[var(--admin-text-muted)]">
        Carregando configuração do WhatsApp...
      </div>
    );
  }

  const connected = !!status?.configured && !!status.reachable;
  const statusTone = connected
    ? "success"
    : status?.configured
      ? "warning"
      : "muted";

  return (
    <div className="space-y-4 animate-fade-in text-[var(--admin-text-main)] min-w-0">
      <AdminPageHeader
        icon={MessageSquare}
        title="WhatsApp / Evolution API"
        stats={[
          {
            label: statusLabel(status),
            value: "",
            tone: connected
              ? "success"
              : status?.configured
                ? "warning"
                : "muted",
          },
        ]}
        action={{
          label: "Atualizar status",
          onClick: () => void load(),
          icon: RefreshCw,
        }}
      />

      {message && (
        <div
          className={`p-3 rounded-xl flex items-center gap-2 text-xs font-bold ${message.type === "success" ? "bg-status-success/10 border border-status-success/30 text-status-success" : "bg-status-error/10 border border-status-error/30 text-status-error"}`}
        >
          {message.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      <section className="p-4 bg-[var(--admin-surface)] rounded-xl space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-[var(--admin-text-main)] flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-[var(--admin-accent)]" />{" "}
              Conexão da Evolution API
            </h2>
            <p className="text-xs text-[var(--admin-text-muted)] mt-1">
              A URL, instância e chave ficam configuradas aqui. A chave nunca é
              devolvida ao navegador.
            </p>
          </div>
          <div
            className={`flex items-center gap-1.5 text-xs font-bold shrink-0 ${statusTone === "success" ? "text-status-success" : statusTone === "warning" ? "text-status-warning" : "text-[var(--admin-text-muted)]"}`}
          >
            {connected ? (
              <Wifi className="w-4 h-4" />
            ) : (
              <WifiOff className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">{statusLabel(status)}</span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 p-3.5 rounded-xl bg-[var(--admin-bg)]/70">
          <div className="min-w-0">
            <p className="text-xs font-bold text-[var(--admin-text-main)]">
              Ativar integração
            </p>
            <p className="text-xs text-[var(--admin-text-muted)] mt-0.5">
              Quando desativada, o Navo não envia mensagens pela Evolution API.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings.enabled}
            onClick={() => update("enabled", !settings.enabled)}
            className={`w-11 h-6 rounded-full transition-colors shrink-0 relative ${settings.enabled ? "bg-[var(--admin-accent)]" : "bg-[var(--admin-border)]"}`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${settings.enabled ? "translate-x-5" : "translate-x-0.5"}`}
            />
          </button>
        </div>

        <div className="flex items-center justify-between gap-4 p-3.5 rounded-xl bg-[var(--admin-accent)]/10">
          <div className="min-w-0">
            <p className="text-xs font-bold text-[var(--admin-text-main)]">
              Ativar NavoBot
            </p>
            <p className="text-xs text-[var(--admin-text-muted)] mt-0.5">
              Processa mensagens recebidas, consulta a agenda e conduz
              confirmações, reagendamentos, cancelamentos e novos agendamentos.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings.navoBotEnabled}
            onClick={() => update("navoBotEnabled", !settings.navoBotEnabled)}
            className={`w-11 h-6 rounded-full transition-colors shrink-0 relative ${settings.navoBotEnabled ? "bg-[var(--admin-accent)]" : "bg-[var(--admin-border)]"}`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${settings.navoBotEnabled ? "translate-x-5" : "translate-x-0.5"}`}
            />
          </button>
        </div>

        <label className="block p-3.5 rounded-xl bg-[var(--admin-bg)]/70 space-y-2">
          <span className="block text-xs font-bold text-[var(--admin-text-main)]">
            Tipo de conta conectada por QR Code
          </span>
          <select
            value={settings.whatsappAccountType}
            onChange={(event) =>
              update(
                "whatsappAccountType",
                event.target
                  .value as EvolutionApiSettings["whatsappAccountType"],
              )
            }
            className="w-full bg-[var(--admin-surface)] rounded-xl p-2.5 text-xs text-[var(--admin-text-main)] focus:outline-none focus:ring-1 focus:ring-[var(--admin-accent)]"
          >
            <option value="personal_qr">WhatsApp pessoal</option>
            <option value="business_qr">WhatsApp Business</option>
          </select>
          <span className="block text-xs text-[var(--admin-text-muted)]">
            Selecione WhatsApp Business somente depois de conectar a conta
            Business no QR Code. A opção não transforma uma conta pessoal em
            Business.
          </span>
        </label>

        <div className="flex items-center justify-between gap-4 p-3.5 rounded-xl bg-[var(--admin-bg)]/70">
          <div className="min-w-0">
            <p className="text-xs font-bold text-[var(--admin-text-main)]">
              Mensagens interativas (botões e listas)
            </p>
            <p className="text-xs text-[var(--admin-text-muted)] mt-0.5">
              {settings.whatsappAccountType === "business_qr"
                ? "Recomendado para a conta WhatsApp Business conectada por QR Code; teste no celular, Web e Desktop antes de manter ativo."
                : "Desative para usar somente texto e evitar o erro “Não foi possível carregar a mensagem”. Recomendado para contas pessoais conectadas por QR Code."}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings.useInteractiveMessages}
            onClick={() =>
              update("useInteractiveMessages", !settings.useInteractiveMessages)
            }
            className={`w-11 h-6 rounded-full transition-colors shrink-0 relative ${settings.useInteractiveMessages ? "bg-[var(--admin-accent)]" : "bg-[var(--admin-border)]"}`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${settings.useInteractiveMessages ? "translate-x-5" : "translate-x-0.5"}`}
            />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="space-y-1 sm:col-span-2">
            <span className="block text-xs font-bold text-[var(--admin-text-muted)] uppercase tracking-wider">
              URL base da Evolution API
            </span>
            <input
              value={settings.baseUrl}
              onChange={(event) => update("baseUrl", event.target.value)}
              placeholder="http://129.159.50.100:8080"
              className="w-full bg-[var(--admin-bg)]/70 rounded-xl p-2.5 text-xs text-[var(--admin-text-main)] focus:outline-none focus:ring-1 focus:ring-[var(--admin-accent)] min-w-0"
            />
            <span className="block text-xs text-[var(--admin-text-muted)]">
              Não inclua a rota final, como `/instance` ou `/message`.
            </span>
          </label>
          <label className="space-y-1">
            <span className="block text-xs font-bold text-[var(--admin-text-muted)] uppercase tracking-wider">
              Nome da instância
            </span>
            <input
              value={settings.instanceName}
              onChange={(event) => update("instanceName", event.target.value)}
              placeholder="navo-bot"
              className="w-full bg-[var(--admin-bg)]/70 rounded-xl p-2.5 text-xs text-[var(--admin-text-main)] focus:outline-none focus:ring-1 focus:ring-[var(--admin-accent)] min-w-0"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-xs font-bold text-[var(--admin-text-muted)] uppercase tracking-wider">
              Chave da API{" "}
              {settings.hasApiKey && (
                <span className="normal-case font-normal">(já salva)</span>
              )}
            </span>
            <div className="relative">
              <input
                type={showApiKey ? "text" : "password"}
                value={apiKeyInput}
                onChange={(event) => setApiKeyInput(event.target.value)}
                placeholder={
                  settings.hasApiKey
                    ? "••••••••"
                    : "Cole a chave da Evolution API"
                }
                className="w-full bg-[var(--admin-bg)]/70 rounded-xl p-2.5 pr-10 text-xs text-[var(--admin-text-main)] focus:outline-none focus:ring-1 focus:ring-[var(--admin-accent)] min-w-0"
              />
              <button
                type="button"
                aria-label={showApiKey ? "Ocultar chave" : "Mostrar chave"}
                onClick={() => setShowApiKey((visible) => !visible)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)]"
              >
                {showApiKey ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </label>
        </div>

        <div className="p-3.5 rounded-xl bg-[var(--admin-bg)]/70 space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-bold text-[var(--admin-text-main)]">
                Receber eventos por webhook
              </p>
              <p className="text-xs text-[var(--admin-text-muted)] mt-0.5">
                Aplica mensagens recebidas, conexão e QR Code na URL informada.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.webhookEnabled}
              onClick={() => update("webhookEnabled", !settings.webhookEnabled)}
              className={`w-11 h-6 rounded-full transition-colors shrink-0 relative ${settings.webhookEnabled ? "bg-[var(--admin-accent)]" : "bg-[var(--admin-border)]"}`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${settings.webhookEnabled ? "translate-x-5" : "translate-x-0.5"}`}
              />
            </button>
          </div>
          {settings.webhookEnabled && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="space-y-1 block">
                <span className="block text-xs font-bold text-[var(--admin-text-muted)] uppercase tracking-wider">
                  URL do webhook
                </span>
                <input
                  value={settings.webhookUrl}
                  onChange={(event) => update("webhookUrl", event.target.value)}
                  placeholder="https://seu-dominio.com/api/webhooks/evolution"
                  className="w-full bg-[var(--admin-surface)] rounded-xl p-2.5 text-xs text-[var(--admin-text-main)] focus:outline-none focus:ring-1 focus:ring-[var(--admin-accent)] min-w-0"
                />
              </label>
              <label className="space-y-1 block">
                <span className="block text-xs font-bold text-[var(--admin-text-muted)] uppercase tracking-wider">
                  Segredo do webhook{" "}
                  {settings.hasWebhookSecret && (
                    <span className="normal-case font-normal">(já salvo)</span>
                  )}
                </span>
                <input
                  type="password"
                  value={webhookSecretInput}
                  onChange={(event) =>
                    setWebhookSecretInput(event.target.value)
                  }
                  placeholder={
                    settings.hasWebhookSecret ? "••••••••" : "Defina um segredo"
                  }
                  className="w-full bg-[var(--admin-surface)] rounded-xl p-2.5 text-xs text-[var(--admin-text-main)] focus:outline-none focus:ring-1 focus:ring-[var(--admin-accent)] min-w-0"
                />
              </label>
            </div>
          )}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void handleApplyWebhook()}
              disabled={
                applyingWebhook ||
                saving ||
                (!settings.webhookEnabled && !settings.webhookUrl)
              }
              className="h-9 w-full sm:w-auto px-4 rounded-xl bg-[var(--admin-surface)] hover:bg-surface-elevated text-[var(--admin-text-main)] font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
            >
              <Wifi className="w-3.5 h-3.5" />
              {applyingWebhook ? "Aplicando..." : "Aplicar webhook"}
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={() => void handleTest()}
            disabled={testing || saving}
            className="admin-btn admin-btn-secondary h-10 px-4 text-xs font-bold flex items-center justify-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${testing ? "animate-spin" : ""}`} />
            {testing ? "Testando..." : "Testar conexão"}
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="admin-btn admin-btn-primary h-10 px-4 text-xs font-bold flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            {saving ? "Salvando..." : "Salvar configuração"}
          </button>
        </div>
      </section>

      <section className="p-4 bg-[var(--admin-surface)] rounded-xl space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-[var(--admin-text-main)] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[var(--admin-accent)]" />{" "}
              Diagnóstico do Gemini
            </h2>
            <p className="text-xs text-[var(--admin-text-muted)] mt-1">
              Executa uma chamada real ao <code>gemini-3.6-flash</code> usado
              pelo NavoBot. Use para confirmar a chave e a comunicação com a
              API.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleAiTest()}
            disabled={testingAi}
            className="h-9 px-3 rounded-xl bg-[var(--admin-bg)]/80 text-[var(--admin-text-main)] font-bold text-xs flex items-center gap-2 shrink-0 disabled:opacity-50"
          >
            <Loader2
              className={`w-3.5 h-3.5 ${testingAi ? "animate-spin" : ""}`}
            />
            {testingAi ? "Testando..." : "Testar Gemini"}
          </button>
        </div>
        {aiResult && (
          <div
            className={`p-3 rounded-xl text-xs ${aiResult.ok ? "bg-status-success/10 text-status-success" : "bg-status-error/10 text-status-error"}`}
          >
            <p className="font-bold">{aiResult.message}</p>
            <p className="mt-1">
              Modelo: {aiResult.model} · Latência: {aiResult.latencyMs} ms ·
              Gemini utilizado: {aiResult.usedGemini ? "sim" : "não"}
              {aiResult.response ? ` · Resposta: ${aiResult.response}` : ""}
            </p>
          </div>
        )}
      </section>

      <section className="p-4 bg-[var(--admin-surface)] rounded-xl space-y-3">
        <div>
          <h2 className="text-sm font-bold text-[var(--admin-text-main)]">
            Mensagem de teste
          </h2>
          <p className="text-xs text-[var(--admin-text-muted)] mt-1">
            Use o telefone com código do país e DDD, somente números. Exemplo:
            `5511999998888`.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="space-y-1">
            <span className="block text-xs font-bold text-[var(--admin-text-muted)] uppercase tracking-wider">
              Telefone
            </span>
            <input
              value={testNumber}
              onChange={(event) => setTestNumber(event.target.value)}
              placeholder="5511999998888"
              inputMode="tel"
              className="w-full bg-[var(--admin-bg)]/70 rounded-xl p-2.5 text-xs text-[var(--admin-text-main)] focus:outline-none focus:ring-1 focus:ring-[var(--admin-accent)] min-w-0"
            />
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className="block text-xs font-bold text-[var(--admin-text-muted)] uppercase tracking-wider">
              Mensagem
            </span>
            <input
              value={testText}
              onChange={(event) => setTestText(event.target.value)}
              className="w-full bg-[var(--admin-bg)]/70 rounded-xl p-2.5 text-xs text-[var(--admin-text-main)] focus:outline-none focus:ring-1 focus:ring-[var(--admin-accent)] min-w-0"
            />
          </label>
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => void handleSendTest()}
            disabled={sending || !testNumber.trim() || !testText.trim()}
            className="h-10 w-full sm:w-auto px-4 rounded-xl bg-[var(--admin-bg)]/80 hover:bg-[var(--admin-bg)] text-[var(--admin-text-main)] font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
          >
            <Send className="w-4 h-4" />
            {sending ? "Enviando..." : "Enviar mensagem de teste"}
          </button>
        </div>
      </section>

      <div className="p-3 rounded-xl bg-[var(--admin-bg)]/60 text-xs text-[var(--admin-text-muted)]">
        Para ativar o NavoBot, informe uma URL pública HTTPS no webhook, defina
        um segredo, salve a configuração, aplique o webhook e só então ative o
        agente. A Evolution API enviará eventos da instância para{" "}
        <code className="text-[var(--admin-text-main)]">
          /api/evolution/webhook
        </code>
        .
      </div>
    </div>
  );
};
