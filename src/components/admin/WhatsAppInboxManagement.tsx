import React, { useEffect, useState, useMemo } from "react";
import {
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Headphones,
  Loader2,
  MessageCircle,
  MessageSquare,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  AlertCircle
} from "lucide-react";
import { AdminPageHeader } from "./shared/AdminPageHeader";
import {
  fetchBotConversations,
  resolveBotConversation,
  resumeBotForConversation,
  sendManualBotMessage,
  type BotConversation,
} from "../../services/evolutionApiService";

type StatusMessage = { type: "success" | "error"; text: string } | null;
type ConversationFilter = "all" | "pending_human" | "in_service" | "bot_active";

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

export const WhatsAppInboxManagement: React.FC = () => {
  const [message, setMessage] = useState<StatusMessage>(null);
  const [conversations, setConversations] = useState<BotConversation[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [conversationFilter, setConversationFilter] = useState<ConversationFilter>("all");
  const [searchFilter, setSearchFilter] = useState("");
  const [expandedConvId, setExpandedConvId] = useState<string | null>(null);
  const [manualReplyText, setManualReplyText] = useState<Record<string, string>>({});
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resumingId, setResumingId] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);

  const loadConversations = async (silent = false) => {
    if (!silent) setConversationsLoading(true);
    try {
      const list = await fetchBotConversations();
      setConversations(list);
    } catch (error: any) {
      console.error("Erro ao carregar conversas:", error);
      if (!silent) {
        setMessage({ type: "error", text: "Erro ao carregar conversas." });
      }
    } finally {
      if (!silent) setConversationsLoading(false);
      setInitialLoading(false);
    }
  };

  useEffect(() => {
    void loadConversations();
    const interval = setInterval(() => {
      void loadConversations(true);
    }, 15000);
    return () => clearInterval(interval);
  }, []);

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
    return conversations.filter((c) => c.handoffRequested || c.state === "human").length;
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
        if (!matchName && !matchPhone && !matchProf && !matchReason) return false;
      }

      return true;
    });
  }, [conversations, conversationFilter, searchFilter]);

  if (initialLoading) {
    return (
      <div className="py-12 text-center text-xs text-[var(--admin-text-muted)] flex flex-col items-center justify-center gap-2">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--admin-accent)]" />
        <span>Carregando conversas do NavoBot...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in text-[var(--admin-text-main)] min-w-0 p-4">
      <AdminPageHeader
        icon={MessageSquare}
        title="Atendimento & Conversas"
        stats={
          pendingHandoffCount > 0
            ? [
                {
                  label: "Aguardando humano",
                  value: pendingHandoffCount,
                  tone: "warning" as const,
                },
              ]
            : []
        }
        action={{
          label: "Atualizar",
          onClick: () => void loadConversations(),
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
                      onClick={() => setExpandedConvId(isExpanded ? null : conv.id)}
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
                                      isInbound ? "text-[var(--admin-text-muted)]" : "opacity-70"
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
                          disabled={replyingId === conv.id || !manualReplyText[conv.id]?.trim()}
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
  );
};
