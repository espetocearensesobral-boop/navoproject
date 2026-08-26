import React, { useEffect, useState, useMemo } from "react";
import {
  AlertCircle,
  Bell,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Eye,
  EyeOff,
  Headphones,
  Loader2,
  MessageCircle,
  MessageSquare,
  Phone,
  RefreshCw,
  RotateCcw,
  Save,
  Scissors,
  Search,
  Send,
  Settings2,
  Sparkles,
  UserCheck,
  Wifi,
  WifiOff,
} from "lucide-react";
import { AdminPageHeader } from "./shared/AdminPageHeader";
import {
  applyEvolutionWebhook,
  defaultEvolutionApiSettings,
  fetchBotConversations,
  fetchEvolutionApiSettings,
  fetchEvolutionApiStatus,
  resolveBotConversation,
  resumeBotForConversation,
  saveEvolutionApiSettings,
  sendEvolutionApiTest,
  sendManualBotMessage,
  testEvolutionApi,
  testNavoBotAi,
  type BotConversation,
  type EvolutionApiSettings,
  type EvolutionApiSettingsInput,
  type EvolutionApiStatus,
  type NavoBotAiTestResult,
} from "../../services/evolutionApiService";

type StatusMessage = { type: "success" | "error"; text: string } | null;
type ActiveTab = "conversations" | "handoff_settings" | "connection";
type ConversationFilter = "all" | "pending_human" | "in_service" | "bot_active";

const statusLabel = (status: EvolutionApiStatus | null) => {
  if (!status?.configured) return "não configurado";
  if (!status.reachable) return "indisponível";
  if (status.instanceStatus === "open" || status.instanceStatus === "connected")
    return "WhatsApp conectado";
  if (status.instanceStatus === "not_created") return "instância não criada";
  return status.instanceStatus || "conectado à API";
};

const formatPhoneNumber = (phone: string) => {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 13 && digits.startsWith("55")) {
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  }
  if (digits.length === 12 && digits.startsWith("55")) {
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`;
  }
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return phone;
};

const formatTimeAgo = (dateString?: string | null) => {
  if (!dateString) return "recente";
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return "agora";
  if (diffMinutes < 60) return `há ${diffMinutes}m`;
  if (diffHours < 24) return `há ${diffHours}h`;
  return `há ${diffDays}d`;
};

export const WhatsAppManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>("conversations");
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

  // Conversations State
  const [conversations, setConversations] = useState<BotConversation[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [conversationFilter, setConversationFilter] =
    useState<ConversationFilter>("all");
  const [searchFilter, setSearchFilter] = useState("");
  const [expandedConvId, setExpandedConvId] = useState<string | null>(null);
  const [manualReplyText, setManualReplyText] = useState<Record<string, string>>(
    {},
  );
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resumingId, setResumingId] = useState<string | null>(null);

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [config, currentStatus, convList] = await Promise.all([
        fetchEvolutionApiSettings(),
        fetchEvolutionApiStatus(),
        fetchBotConversations().catch(() => []),
      ]);
      setSettings(config);
      setApiKeyInput("");
      setWebhookSecretInput("");
      setStatus(currentStatus);
      setConversations(convList);
    } catch (error: any) {
      setMessage({
        type: "error",
        text:
          error?.message ||
          "Não foi possível carregar a configuração do WhatsApp.",
      });
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const loadConversations = async () => {
    setConversationsLoading(true);
    try {
      const list = await fetchBotConversations();
      setConversations(list);
    } catch (error: any) {
      console.error("Erro ao carregar conversas:", error);
    } finally {
      setConversationsLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const interval = setInterval(() => {
      void load(true);
    }, 15000);
    return () => clearInterval(interval);
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
        managerNotificationPhone: settings.managerNotificationPhone || "",
        notifyBarberOnHandoff: settings.notifyBarberOnHandoff !== false,
        notifyManagerOnHandoff: settings.notifyManagerOnHandoff !== false,
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
        text: "Configurações do WhatsApp salvas com sucesso.",
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

  const handleResumeBot = async (convId: string) => {
    setResumingId(convId);
    try {
      await resumeBotForConversation(convId, true);
      setMessage({
        type: "success",
        text: "Assistente virtual reativado com sucesso para este cliente.",
      });
      await loadConversations();
    } catch (error: any) {
      setMessage({
        type: "error",
        text: error?.message || "Não foi possível reativar o robô.",
      });
    } finally {
      setResumingId(null);
    }
  };

  const handleResolveConversation = async (convId: string) => {
    setResolvingId(convId);
    try {
      await resolveBotConversation(convId);
      setMessage({
        type: "success",
        text: "Atendimento concluído com sucesso.",
      });
      await loadConversations();
    } catch (error: any) {
      setMessage({
        type: "error",
        text: error?.message || "Não foi possível concluir o atendimento.",
      });
    } finally {
      setResolvingId(null);
    }
  };

  const handleSendManualReply = async (convId: string) => {
    const text = manualReplyText[convId]?.trim();
    if (!text) return;
    setReplyingId(convId);
    try {
      await sendManualBotMessage(convId, text);
      setManualReplyText((prev) => ({ ...prev, [convId]: "" }));
      setMessage({
        type: "success",
        text: "Mensagem enviada com sucesso ao cliente!",
      });
      await loadConversations();
    } catch (error: any) {
      setMessage({
        type: "error",
        text: error?.message || "Não foi possível enviar a mensagem.",
      });
    } finally {
      setReplyingId(null);
    }
  };

  const pendingHandoffCount = useMemo(() => {
    return conversations.filter(
      (c) => c.handoffRequested || c.state === "human",
    ).length;
  }, [conversations]);

  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      // Status filter
      if (conversationFilter === "pending_human") {
        if (!c.handoffRequested && c.state !== "human") return false;
      } else if (conversationFilter === "in_service") {
        if (c.state !== "human") return false;
      } else if (conversationFilter === "bot_active") {
        if (c.state === "human" || c.handoffRequested) return false;
      }

      // Search filter
      if (searchFilter.trim()) {
        const query = searchFilter.toLowerCase();
        const matchName = c.clientName?.toLowerCase().includes(query);
        const matchPhone = c.phone?.toLowerCase().includes(query);
        const matchProf = c.assignedProfessionalName?.toLowerCase().includes(query);
        const matchReason = c.handoffReason?.toLowerCase().includes(query);
        if (!matchName && !matchPhone && !matchProf && !matchReason)
          return false;
      }

      return true;
    });
  }, [conversations, conversationFilter, searchFilter]);

  if (loading) {
    return (
      <div className="py-12 text-center text-xs text-[var(--admin-text-muted)] flex flex-col items-center justify-center gap-2">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--admin-accent)]" />
        <span>Carregando ecossistema do WhatsApp & NavoBot...</span>
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
        title="WhatsApp & NavoBot"
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
          ...(pendingHandoffCount > 0
            ? [
                {
                  label: "Aguardando humano",
                  value: pendingHandoffCount,
                  tone: "warning" as const,
                },
              ]
            : []),
        ]}
        action={{
          label: "Atualizar status",
          onClick: () => void load(),
          icon: RefreshCw,
        }}
      />

      {message && (
        <div
          className={`p-3 rounded-xl flex items-center gap-2 text-xs font-bold ${
            message.type === "success"
              ? "bg-status-success/10 border border-status-success/30 text-status-success"
              : "bg-status-error/10 border border-status-error/30 text-status-error"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* TABS NAVIGATION */}
      <div className="flex items-center gap-2 border-b border-[var(--admin-border)] pb-2 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setActiveTab("conversations")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === "conversations"
              ? "bg-[var(--admin-accent)] text-[var(--admin-accent-text)] shadow-sm"
              : "bg-[var(--admin-surface)] text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] border border-[var(--admin-border)]"
          }`}
        >
          <Headphones className="w-3.5 h-3.5" />
          Atendimento & Conversas
          {pendingHandoffCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-black">
              {pendingHandoffCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("handoff_settings")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === "handoff_settings"
              ? "bg-[var(--admin-accent)] text-[var(--admin-accent-text)] shadow-sm"
              : "bg-[var(--admin-surface)] text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] border border-[var(--admin-border)]"
          }`}
        >
          <Bell className="w-3.5 h-3.5" />
          Notificações no WhatsApp
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("connection")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === "connection"
              ? "bg-[var(--admin-accent)] text-[var(--admin-accent-text)] shadow-sm"
              : "bg-[var(--admin-surface)] text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] border border-[var(--admin-border)]"
          }`}
        >
          <Settings2 className="w-3.5 h-3.5" />
          Conexão & API Evolution
        </button>
      </div>

      {/* TAB 1: ATENDIMENTO HUMANO & CONVERSAS */}
      {activeTab === "conversations" && (
        <div className="space-y-4">
          {/* TOP CONTROLS & FILTER */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-[var(--admin-surface)] p-3 rounded-xl border border-[var(--admin-border)]">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--admin-text-muted)]" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Buscar por cliente, telefone ou barbeiro..."
                className="w-full bg-[var(--admin-bg)] border border-[var(--admin-border)] rounded-xl pl-8 pr-3 py-1.5 text-xs text-[var(--admin-text-main)] focus:outline-none focus:border-[var(--admin-accent)]"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={() => setConversationFilter("all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  conversationFilter === "all"
                    ? "bg-[var(--admin-accent)] text-[var(--admin-accent-text)]"
                    : "bg-[var(--admin-bg)] text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)]"
                }`}
              >
                Todas ({conversations.length})
              </button>
              <button
                type="button"
                onClick={() => setConversationFilter("pending_human")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                  conversationFilter === "pending_human"
                    ? "bg-amber-500 text-black font-bold"
                    : "bg-[var(--admin-bg)] text-amber-500 hover:bg-amber-500/10"
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                Aguardando ({pendingHandoffCount})
              </button>
              <button
                type="button"
                onClick={() => setConversationFilter("bot_active")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  conversationFilter === "bot_active"
                    ? "bg-[var(--admin-accent)] text-[var(--admin-accent-text)]"
                    : "bg-[var(--admin-bg)] text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)]"
                }`}
              >
                Bot Ativo
              </button>
              <button
                type="button"
                onClick={() => void loadConversations()}
                disabled={conversationsLoading}
                className="p-1.5 rounded-lg bg-[var(--admin-bg)] text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] border border-[var(--admin-border)]"
                title="Recarregar conversas"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${conversationsLoading ? "animate-spin" : ""}`}
                />
              </button>
            </div>
          </div>

          {/* CONVERSATION CARDS */}
          {filteredConversations.length === 0 ? (
            <div className="p-10 text-center bg-[var(--admin-surface)] rounded-xl border border-[var(--admin-border)] space-y-2">
              <Headphones className="w-8 h-8 text-[var(--admin-text-muted)] mx-auto opacity-50" />
              <p className="text-sm font-bold text-[var(--admin-text-main)]">
                Nenhuma conversa encontrada
              </p>
              <p className="text-xs text-[var(--admin-text-muted)] max-w-sm mx-auto">
                Quando os clientes interagirem com o WhatsApp da barbearia, as
                conversas e solicitações de atendimento aparecerão aqui em tempo
                real.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredConversations.map((conv) => {
                const isExpanded = expandedConvId === conv.id;
                const isHuman = conv.handoffRequested || conv.state === "human";
                const cleanPhone = conv.cleanPhone || conv.phone.replace(/\D/g, "");
                const waDirectLink = `https://wa.me/${cleanPhone}`;

                return (
                  <article
                    key={conv.id}
                    className={`bg-[var(--admin-surface)] rounded-xl border transition-all overflow-hidden ${
                      isHuman
                        ? "border-amber-500/40 shadow-sm"
                        : "border-[var(--admin-border)]"
                    }`}
                  >
                    {/* CARD HEADER */}
                    <div className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[var(--admin-bg)]/30">
                      <div className="flex items-start gap-3 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                            isHuman
                              ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                              : "bg-[var(--admin-accent)]/10 text-[var(--admin-accent)] border border-[var(--admin-accent)]/20"
                          }`}
                        >
                          {isHuman ? (
                            <Headphones className="w-5 h-5" />
                          ) : (
                            <Bot className="w-5 h-5" />
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-xs font-bold text-[var(--admin-text-main)]">
                              {conv.clientName}
                            </h3>
                            <span className="text-[11px] text-[var(--admin-text-muted)] font-mono">
                              {formatPhoneNumber(conv.phone)}
                            </span>
                            {isHuman ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-500 border border-amber-500/30">
                                🔔 Atendimento Humano
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-status-success/10 text-status-success border border-status-success/20">
                                🤖 Bot Ativo
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 text-[11px] text-[var(--admin-text-muted)] mt-1 flex-wrap">
                            {conv.assignedProfessionalName && (
                              <span className="flex items-center gap-1 text-[var(--admin-accent)] font-medium">
                                <Scissors className="w-3 h-3" />
                                Barbeiro: {conv.assignedProfessionalName}
                              </span>
                            )}
                            {conv.handoffReason && (
                              <span className="text-amber-500/90 font-medium">
                                Motivo: {conv.handoffReason}
                              </span>
                            )}
                            <span>
                              Última interação:{" "}
                              {formatTimeAgo(conv.lastInboundAt || conv.lastOutboundAt)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* QUICK ACTIONS */}
                      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                        <a
                          href={waDirectLink}
                          target="_blank"
                          rel="noreferrer"
                          className="h-8 px-3 rounded-lg bg-status-success text-white font-bold text-xs flex items-center gap-1.5 shadow-sm hover:brightness-105 transition-all"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Abrir no</span> WhatsApp
                          <ExternalLink className="w-3 h-3 ml-0.5 opacity-70" />
                        </a>

                        {isHuman && (
                          <>
                            <button
                              type="button"
                              onClick={() => void handleResumeBot(conv.id)}
                              disabled={resumingId === conv.id}
                              className="h-8 px-2.5 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] hover:bg-[var(--admin-bg)] text-xs font-medium text-[var(--admin-text-main)] flex items-center gap-1.5 transition-colors disabled:opacity-50"
                              title="Reativar robô"
                            >
                              <RotateCcw className="w-3.5 h-3.5 text-[var(--admin-accent)]" />
                              <span className="hidden md:inline">Reativar Bot</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => void handleResolveConversation(conv.id)}
                              disabled={resolvingId === conv.id}
                              className="h-8 px-2.5 rounded-lg border border-status-success/30 bg-status-success/10 hover:bg-status-success/20 text-xs font-bold text-status-success flex items-center gap-1.5 transition-colors disabled:opacity-50"
                              title="Concluir atendimento"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span className="hidden md:inline">Concluir</span>
                            </button>
                          </>
                        )}

                        <button
                          type="button"
                          onClick={() =>
                            setExpandedConvId(isExpanded ? null : conv.id)
                          }
                          className="h-8 w-8 rounded-lg border border-[var(--admin-border)] flex items-center justify-center text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] bg-[var(--admin-surface)] transition-colors"
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* EXPANDED CONTENT: MESSAGES HISTORY & MANUAL REPLY */}
                    {isExpanded && (
                      <div className="border-t border-[var(--admin-border)] p-4 space-y-4 bg-[var(--admin-surface)]">
                        <div>
                          <p className="text-[11px] uppercase tracking-wider font-bold text-[var(--admin-text-muted)] mb-2">
                            Histórico Recente de Mensagens
                          </p>

                          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                            {conv.messages && conv.messages.length > 0 ? (
                              conv.messages.map((msg) => {
                                const isInbound = msg.direction === "inbound";
                                return (
                                  <div
                                    key={msg.id}
                                    className={`flex ${
                                      isInbound ? "justify-start" : "justify-end"
                                    }`}
                                  >
                                    <div
                                      className={`max-w-[85%] rounded-xl p-2.5 text-xs ${
                                        isInbound
                                          ? "bg-[var(--admin-bg)] border border-[var(--admin-border)] text-[var(--admin-text-main)]"
                                          : "bg-[var(--admin-accent)] text-[var(--admin-accent-text)] font-medium"
                                      }`}
                                    >
                                      <p className="whitespace-pre-wrap">{msg.text}</p>
                                      <p
                                        className={`text-[9px] mt-1 text-right ${
                                          isInbound
                                            ? "text-[var(--admin-text-muted)]"
                                            : "opacity-70"
                                        }`}
                                      >
                                        {formatTimeAgo(msg.createdAt)}
                                      </p>
                                    </div>
                                  </div>
                                );
                              })
                            ) : (
                              <p className="text-xs text-[var(--admin-text-muted)] italic">
                                Nenhuma mensagem arquivada ainda nesta conversa.
                              </p>
                            )}
                          </div>
                        </div>

                        {/* MANUAL REPLY FORM */}
                        <div className="border-t border-[var(--admin-border)] pt-3 space-y-2">
                          <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--admin-text-muted)]">
                            Enviar mensagem manual pelo WhatsApp
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={manualReplyText[conv.id] || ""}
                              onChange={(e) =>
                                setManualReplyText((prev) => ({
                                  ...prev,
                                  [conv.id]: e.target.value,
                                }))
                              }
                              placeholder="Digite uma mensagem para o cliente..."
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  void handleSendManualReply(conv.id);
                                }
                              }}
                              className="flex-1 bg-[var(--admin-bg)] border border-[var(--admin-border)] rounded-xl px-3 py-2 text-xs text-[var(--admin-text-main)] focus:outline-none focus:border-[var(--admin-accent)]"
                            />
                            <button
                              type="button"
                              onClick={() => void handleSendManualReply(conv.id)}
                              disabled={
                                replyingId === conv.id ||
                                !manualReplyText[conv.id]?.trim()
                              }
                              className="px-4 rounded-xl bg-[var(--admin-accent)] hover:brightness-110 text-[var(--admin-accent-text)] font-bold text-xs flex items-center justify-center gap-1.5 disabled:opacity-50 transition-all shrink-0"
                            >
                              <Send className="w-3.5 h-3.5" />
                              {replyingId === conv.id ? "Enviando..." : "Enviar"}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ALERTAS & ENCAMINHAMENTO WHATSAPP */}
      {activeTab === "handoff_settings" && (
        <div className="space-y-4">
          <section className="p-4 bg-[var(--admin-surface)] rounded-xl border border-[var(--admin-border)] space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-[var(--admin-accent)]/10 text-[var(--admin-accent)] flex items-center justify-center shrink-0">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-[var(--admin-text-main)]">
                  Encaminhamento Inteligente & Notificações
                </h2>
                <p className="text-xs text-[var(--admin-text-muted)] mt-1">
                  Configure como o NavoBot transfere conversas para os barbeiros
                  e gerência quando um cliente pede atendimento humano ou
                  apresenta dúvidas fora do escopo.
                </p>
              </div>
            </div>

            {/* FLOW EXPLANATION BANNER */}
            <div className="p-3.5 rounded-xl bg-[var(--admin-bg)]/80 border border-[var(--admin-border)] space-y-2 text-xs">
              <p className="font-bold text-[var(--admin-text-main)] flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-[var(--admin-accent)]" />
                Como funciona o fluxo de notificação:
              </p>
              <ul className="space-y-1.5 text-[var(--admin-text-muted)] list-disc list-inside">
                <li>
                  <strong className="text-[var(--admin-text-main)]">
                    Identificação do Barbeiro:
                  </strong>{" "}
                  Se o cliente estiver agendando ou tiver horário com um
                  profissional específico, o NavoBot avisa o WhatsApp do próprio
                  barbeiro com o link direto do cliente.
                </li>
                <li>
                  <strong className="text-[var(--admin-text-main)]">
                    Aviso à Gerência / Recepção:
                  </strong>{" "}
                  Dúvidas gerais, reclamações ou clientes sem barbeiro definido
                  são encaminhados ao telefone principal de atendimento.
                </li>
                <li>
                  <strong className="text-[var(--admin-text-main)]">
                    Pausa Segura do Robô:
                  </strong>{" "}
                  Durante o atendimento humano, as respostas automáticas do bot
                  são pausadas para evitar desencontro de mensagens.
                </li>
              </ul>
            </div>

            {/* TOGGLE: NOTIFY BARBER */}
            <div className="flex items-center justify-between gap-4 p-3.5 rounded-xl bg-[var(--admin-bg)]/70 border border-[var(--admin-border)]">
              <div className="min-w-0">
                <p className="text-xs font-bold text-[var(--admin-text-main)] flex items-center gap-1.5">
                  <Scissors className="w-3.5 h-3.5 text-[var(--admin-accent)]" />
                  Notificar Barbeiro no WhatsApp
                </p>
                <p className="text-xs text-[var(--admin-text-muted)] mt-0.5">
                  Envia um alerta com link direto do WhatsApp do cliente para o
                  número cadastrado na ficha do barbeiro (em Equipe).
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.notifyBarberOnHandoff !== false}
                onClick={() =>
                  update(
                    "notifyBarberOnHandoff",
                    !(settings.notifyBarberOnHandoff !== false),
                  )
                }
                className={`w-11 h-6 rounded-full transition-colors shrink-0 relative ${
                  settings.notifyBarberOnHandoff !== false
                    ? "bg-[var(--admin-accent)]"
                    : "bg-[var(--admin-border)]"
                }`}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    settings.notifyBarberOnHandoff !== false
                      ? "translate-x-5"
                      : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>

            {/* TOGGLE: NOTIFY MANAGER */}
            <div className="flex items-center justify-between gap-4 p-3.5 rounded-xl bg-[var(--admin-bg)]/70 border border-[var(--admin-border)]">
              <div className="min-w-0">
                <p className="text-xs font-bold text-[var(--admin-text-main)] flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-[var(--admin-accent)]" />
                  Notificar Gerência / Recepção
                </p>
                <p className="text-xs text-[var(--admin-text-muted)] mt-0.5">
                  Envia uma notificação no WhatsApp da gerência em qualquer
                  transição de atendimento ou solicitação de suporte.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.notifyManagerOnHandoff !== false}
                onClick={() =>
                  update(
                    "notifyManagerOnHandoff",
                    !(settings.notifyManagerOnHandoff !== false),
                  )
                }
                className={`w-11 h-6 rounded-full transition-colors shrink-0 relative ${
                  settings.notifyManagerOnHandoff !== false
                    ? "bg-[var(--admin-accent)]"
                    : "bg-[var(--admin-border)]"
                }`}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    settings.notifyManagerOnHandoff !== false
                      ? "translate-x-5"
                      : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>

            {/* MANAGER PHONE INPUT */}
            <label className="block p-3.5 rounded-xl bg-[var(--admin-bg)]/70 border border-[var(--admin-border)] space-y-1.5">
              <span className="block text-xs font-bold text-[var(--admin-text-main)] flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-[var(--admin-accent)]" />
                Telefone da Gerência / Recepção para Alertas (com DDD)
              </span>
              <input
                type="tel"
                value={settings.managerNotificationPhone || ""}
                onChange={(e) =>
                  update("managerNotificationPhone", e.target.value)
                }
                placeholder="Ex: 5511999998888 ou (11) 99999-8888"
                className="w-full bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-xl p-2.5 text-xs text-[var(--admin-text-main)] focus:outline-none focus:ring-1 focus:ring-[var(--admin-accent)]"
              />
              <span className="block text-[11px] text-[var(--admin-text-muted)]">
                Este número receberá os alertas quando um cliente solicitar
                atendente humano, registrar reclamação ou quando o barbeiro não
                estiver disponível.
              </span>
            </label>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className="admin-btn admin-btn-primary h-10 px-5 text-xs font-bold flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                {saving ? "Salvando..." : "Salvar Notificações"}
              </button>
            </div>
          </section>
        </div>
      )}

      {/* TAB 3: CONEXÃO & API EVOLUTION */}
      {activeTab === "connection" && (
        <div className="space-y-4">
          <section className="p-4 bg-[var(--admin-surface)] rounded-xl border border-[var(--admin-border)] space-y-4">
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
                className={`flex items-center gap-1.5 text-xs font-bold shrink-0 ${
                  statusTone === "success"
                    ? "text-status-success"
                    : statusTone === "warning"
                      ? "text-status-warning"
                      : "text-[var(--admin-text-muted)]"
                }`}
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
                className={`w-11 h-6 rounded-full transition-colors shrink-0 relative ${
                  settings.enabled
                    ? "bg-[var(--admin-accent)]"
                    : "bg-[var(--admin-border)]"
                }`}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    settings.enabled ? "translate-x-5" : "translate-x-0.5"
                  }`}
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
                onClick={() =>
                  update("navoBotEnabled", !settings.navoBotEnabled)
                }
                className={`w-11 h-6 rounded-full transition-colors shrink-0 relative ${
                  settings.navoBotEnabled
                    ? "bg-[var(--admin-accent)]"
                    : "bg-[var(--admin-border)]"
                }`}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    settings.navoBotEnabled ? "translate-x-5" : "translate-x-0.5"
                  }`}
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
                  update(
                    "useInteractiveMessages",
                    !settings.useInteractiveMessages,
                  )
                }
                className={`w-11 h-6 rounded-full transition-colors shrink-0 relative ${
                  settings.useInteractiveMessages
                    ? "bg-[var(--admin-accent)]"
                    : "bg-[var(--admin-border)]"
                }`}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    settings.useInteractiveMessages
                      ? "translate-x-5"
                      : "translate-x-0.5"
                  }`}
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
                  onChange={(event) =>
                    update("instanceName", event.target.value)
                  }
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
                  onClick={() =>
                    update("webhookEnabled", !settings.webhookEnabled)
                  }
                  className={`w-11 h-6 rounded-full transition-colors shrink-0 relative ${
                    settings.webhookEnabled
                      ? "bg-[var(--admin-accent)]"
                      : "bg-[var(--admin-border)]"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                      settings.webhookEnabled
                        ? "translate-x-5"
                        : "translate-x-0.5"
                    }`}
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
                      onChange={(event) =>
                        update("webhookUrl", event.target.value)
                      }
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
                        settings.hasWebhookSecret
                          ? "••••••••"
                          : "Defina um segredo"
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
                <RefreshCw
                  className={`w-4 h-4 ${testing ? "animate-spin" : ""}`}
                />
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

          <section className="p-4 bg-[var(--admin-surface)] rounded-xl border border-[var(--admin-border)] space-y-3">
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
                className={`p-3 rounded-xl text-xs ${
                  aiResult.ok
                    ? "bg-status-success/10 text-status-success"
                    : "bg-status-error/10 text-status-error"
                }`}
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

          <section className="p-4 bg-[var(--admin-surface)] rounded-xl border border-[var(--admin-border)] space-y-3">
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
        </div>
      )}
    </div>
  );
};
