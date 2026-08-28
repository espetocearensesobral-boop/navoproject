import React, { useEffect, useState, useMemo } from"react";
import { showToast } from "../ui/Toast";
import {
 AlertCircle,
 Bell,
 Bot,
 Check,
 CheckCircle2,
 ChevronDown,
 ChevronUp,
 Copy,
 ExternalLink,
 Eye,
 EyeOff,
 Headphones,
 Loader2,
 MessageCircle,
 MessageSquare,
 Phone,
 Play,
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
} from"lucide-react";
import { AdminPageHeader } from"./shared/AdminPageHeader";
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
 simulateInboundMessage,
 testEvolutionApi,
 testNavoBotAi,
 type BotConversation,
 type EvolutionApiSettings,
 type EvolutionApiSettingsInput,
 type EvolutionApiStatus,
 type NavoBotAiTestResult,
} from"../../services/evolutionApiService";

type StatusMessage = { type:"success"|"error"; text: string } | null;
type ActiveTab ="handoff_settings"|"connection";

const statusLabel = (status: EvolutionApiStatus | null) => {
 if (!status?.configured) return"não configurado";
 if (!status.reachable) return"indisponível";
 if (status.instanceStatus ==="open"|| status.instanceStatus ==="connected")
 return"WhatsApp conectado";
 if (status.instanceStatus ==="not_created") return"instância não criada";
 return status.instanceStatus ||"conectado à API";
};

const formatPhoneNumber = (phone: string) => {
 const digits = phone.replace(/\D/g,"");
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
 if (!dateString) return"recente";
 const date = new Date(dateString);
 const now = new Date();
 const diffMs = now.getTime() - date.getTime();
 const diffMinutes = Math.floor(diffMs / (1000 * 60));
 const diffHours = Math.floor(diffMinutes / 60);
 const diffDays = Math.floor(diffHours / 24);

 if (diffMinutes < 1) return"agora";
 if (diffMinutes < 60) return `há ${diffMinutes}m`;
 if (diffHours < 24) return `há ${diffHours}h`;
 return `há ${diffDays}d`;
};

export const WhatsAppManagement: React.FC = () => {
 const [activeTab, setActiveTab] = useState<ActiveTab>("handoff_settings");
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
 const [copiedWebhook, setCopiedWebhook] = useState(false);
 const [simPhone, setSimPhone] = useState("5511999998888");
 const [simText, setSimText] = useState("Oi");
 const [simPushName, setSimPushName] = useState("Cliente Teste");
 const [simLoading, setSimLoading] = useState(false);
 const [simResult, setSimResult] = useState<any>(null);

 const load = async (silent = false) => {
 if (!silent) setLoading(true);
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
 type:"error",
 text:
 error?.message ||
"Não foi possível carregar a configuração do WhatsApp.",
 });
 } finally {
 if (!silent) setLoading(false);
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
 managerNotificationPhone: settings.managerNotificationPhone ||"",
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
 showToast("success", "Sucesso", "Configurações do WhatsApp salvas com sucesso.",);
 // Atualiza o status em segundo plano para não travar o botão de salvar
 void fetchEvolutionApiStatus()
 .then((st) => setStatus(st))
 .catch(() => {});
 } catch (error: any) {
 showToast("error", "Erro", error?.message ||"Não foi possível salvar a configuração.",);
 } finally {
 setSaving(false);
 }
 };

 const handleTest = async () => {
 setTesting(true);
 
 try {
 const result = await testEvolutionApi();
 showToast("success", "Sucesso", result);
 void fetchEvolutionApiStatus()
 .then((st) => setStatus(st))
 .catch(() => {});
 } catch (error: any) {
 showToast("error", "Erro", error?.message ||"Não foi possível testar a conexão com a Evolution API.",);
 } finally {
 setTesting(false);
 }
 };

 const handleApplyWebhook = async () => {
 setApplyingWebhook(true);
 
 try {
 const result = await applyEvolutionWebhook();
 showToast("success", "Sucesso", result);
 void fetchEvolutionApiStatus()
 .then((st) => setStatus(st))
 .catch(() => {});
 } catch (error: any) {
 showToast("error", "Erro", error?.message ||"Não foi possível aplicar o webhook.",);
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
 model:"gemini-3.6-flash",
 latencyMs: 0,
 message:
 error?.message ||"Não foi possível testar o Gemini do NavoBot.",
 });
 } finally {
 setTestingAi(false);
 }
 };

 const handleSendTest = async () => {
 if (!testNumber.trim() || !testText.trim()) return;
 setSending(true);
 
 try {
 const result = await sendEvolutionApiTest(testNumber, testText);
 showToast("success", "Sucesso", result);
 } catch (error: any) {
 showToast("error", "Erro", error?.message ||"Não foi possível enviar a mensagem.",);
 } finally {
 setSending(false);
 }
 };

 const handleCopyWebhookUrl = async () => {
 const url = `${window.location.origin}/api/evolution/webhook`;
 try {
 await navigator.clipboard.writeText(url);
 setCopiedWebhook(true);
 setTimeout(() => setCopiedWebhook(false), 2000);
 } catch {
 showToast("error", "Erro", "Não foi possível copiar automaticamente.");
 }
 };

 const handleUseOriginWebhook = () => {
 const url = `${window.location.origin}/api/evolution/webhook`;
 update("webhookUrl", url);
 showToast("success", "Sucesso", "URL do Webhook atualizada com o domínio atual deste servidor.",);
 };

 const handleSimulateInbound = async () => {
 if (!simPhone.trim() || !simText.trim()) return;
 setSimLoading(true);
 setSimResult(null);
 
 try {
 const result = await simulateInboundMessage(simPhone.trim(), simText.trim(), simPushName.trim());
 setSimResult(result);
 showToast("success", "Sucesso", "Simulação executada com sucesso! Veja o resultado do NavoBot abaixo.",);
 } catch (error: any) {
 showToast("error", "Erro", error?.message ||"Não foi possível executar a simulação.",);
 } finally {
 setSimLoading(false);
 }
 };

 if (loading) {
 return (
 <div className="py-12 text-center text-xs text-[var(--admin-text-muted)] flex flex-col items-center justify-center gap-2">
 <Loader2 className="w-6 h-6 animate-spin text-[var(--admin-accent)]"/>
 <span>Carregando ecossistema do WhatsApp & NavoBot...</span>
 </div>
 );
 }

 const connected = !!status?.configured && !!status.reachable;
 const statusTone = connected
 ?"success"
 : status?.configured
 ?"warning"
 :"muted";

 return (
 <div className="space-y-4 animate-fade-in text-[var(--admin-text-main)] min-w-0">
 <AdminPageHeader
 icon={MessageSquare}
 title="WhatsApp & NavoBot"
 stats={[
 {
 label: statusLabel(status),
 value:"",
 tone: connected
 ?"success"
 : status?.configured
 ?"warning"
 :"muted",
 },
 ]}
 action={{
 label:"Atualizar status",
 onClick: () => void load(),
 icon: RefreshCw,
 }}
 />

 {message && (
 <div
 className={`p-3 rounded-[var(--admin-radius-lg)] flex items-center gap-2 text-xs font-bold ${
 message.type ==="success"
 ?"bg-status-success/10 border border-status-success/30 text-status-success"
 :"bg-status-error/10 border border-status-error/30 text-status-error"
 }`}
 >
 {message.type ==="success"? (
 <CheckCircle2 className="w-4 h-4 shrink-0"/>
 ) : (
 <AlertCircle className="w-4 h-4 shrink-0"/>
 )}
 <span>{message.text}</span>
 </div>
 )}

 {/* TABS NAVIGATION */}
 <div className="flex items-center gap-2 border-b border-[var(--admin-border)] pb-2 overflow-x-auto no-scrollbar">
 <button
 type="button"
 onClick={() => setActiveTab("handoff_settings")}
 className={`px-4 py-2 rounded-[var(--admin-radius-lg)] text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
 activeTab ==="handoff_settings"
 ?"bg-[var(--admin-accent)] text-[var(--admin-accent-text)] shadow-sm"
 :"bg-[var(--admin-surface)] text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] border border-[var(--admin-border)]"
 }`}
 >
 <Bell className="w-3.5 h-3.5"/>
 Notificações no WhatsApp
 </button>

 <button
 type="button"
 onClick={() => setActiveTab("connection")}
 className={`px-4 py-2 rounded-[var(--admin-radius-lg)] text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
 activeTab ==="connection"
 ?"bg-[var(--admin-accent)] text-[var(--admin-accent-text)] shadow-sm"
 :"bg-[var(--admin-surface)] text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] border border-[var(--admin-border)]"
 }`}
 >
 <Settings2 className="w-3.5 h-3.5"/>
 Conexão & API Evolution
 </button>
 </div>

 {/* TAB 2: ALERTAS & ENCAMINHAMENTO WHATSAPP */}
 {activeTab ==="handoff_settings"&& (
 <div className="space-y-4">
 <section className="p-4 bg-[var(--admin-surface)] rounded-[var(--admin-radius-lg)] border border-[var(--admin-border)] border border-[var(--admin-border)] space-y-4">
 <div className="flex items-start gap-3">
 <div className="w-9 h-9 rounded-[var(--admin-radius-lg)] bg-[var(--admin-accent)]/10 text-[var(--admin-accent)] flex items-center justify-center shrink-0">
 <Bell className="w-5 h-5"/>
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
 <div className="p-3.5 rounded-[var(--admin-radius-lg)] bg-[var(--admin-bg)]/80 border border-[var(--admin-border)] space-y-2 text-xs">
 <p className="font-bold text-[var(--admin-text-main)] flex items-center gap-1.5">
 <Sparkles className="w-4 h-4 text-[var(--admin-accent)]"/>
 Como funciona o fluxo de notificação:
 </p>
 <ul className="space-y-1.5 text-[var(--admin-text-muted)] list-disc list-inside">
 <li>
 <strong className="text-[var(--admin-text-main)]">
 Identificação do Barbeiro:
 </strong>{""}
 Se o cliente estiver agendando ou tiver horário com um
 profissional específico, o NavoBot avisa o WhatsApp do próprio
 barbeiro com o link direto do cliente.
 </li>
 <li>
 <strong className="text-[var(--admin-text-main)]">
 Aviso à Gerência / Recepção:
 </strong>{""}
 Dúvidas gerais, reclamações ou clientes sem barbeiro definido
 são encaminhados ao telefone principal de atendimento.
 </li>
 <li>
 <strong className="text-[var(--admin-text-main)]">
 Pausa Segura do Robô:
 </strong>{""}
 Durante o atendimento humano, as respostas automáticas do bot
 são pausadas para evitar desencontro de mensagens.
 </li>
 </ul>
 </div>

 {/* TOGGLE: NOTIFY BARBER */}
 <div className="flex items-center justify-between gap-4 p-3.5 rounded-[var(--admin-radius-lg)] bg-[var(--admin-bg)]/70 border border-[var(--admin-border)]">
 <div className="min-w-0">
 <p className="text-xs font-bold text-[var(--admin-text-main)] flex items-center gap-1.5">
 <Scissors className="w-3.5 h-3.5 text-[var(--admin-accent)]"/>
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
 className={`w-11 h-6 rounded-[var(--admin-radius-full)] transition-colors shrink-0 relative ${
 settings.notifyBarberOnHandoff !== false
 ?"bg-[var(--admin-accent)]"
 :"bg-[var(--admin-border)]"
 }`}
 >
 <span
 className={`absolute top-0.5 w-5 h-5 rounded-[var(--admin-radius-full)] bg-white shadow transition-transform ${
 settings.notifyBarberOnHandoff !== false
 ?"translate-x-5"
 :"translate-x-0.5"
 }`}
 />
 </button>
 </div>

 {/* TOGGLE: NOTIFY MANAGER */}
 <div className="flex items-center justify-between gap-4 p-3.5 rounded-[var(--admin-radius-lg)] bg-[var(--admin-bg)]/70 border border-[var(--admin-border)]">
 <div className="min-w-0">
 <p className="text-xs font-bold text-[var(--admin-text-main)] flex items-center gap-1.5">
 <UserCheck className="w-3.5 h-3.5 text-[var(--admin-accent)]"/>
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
 className={`w-11 h-6 rounded-[var(--admin-radius-full)] transition-colors shrink-0 relative ${
 settings.notifyManagerOnHandoff !== false
 ?"bg-[var(--admin-accent)]"
 :"bg-[var(--admin-border)]"
 }`}
 >
 <span
 className={`absolute top-0.5 w-5 h-5 rounded-[var(--admin-radius-full)] bg-white shadow transition-transform ${
 settings.notifyManagerOnHandoff !== false
 ?"translate-x-5"
 :"translate-x-0.5"
 }`}
 />
 </button>
 </div>

 {/* MANAGER PHONE INPUT */}
 <label className="block p-3.5 rounded-[var(--admin-radius-lg)] bg-[var(--admin-bg)]/70 border border-[var(--admin-border)] space-y-1.5">
 <span className="block text-xs font-bold text-[var(--admin-text-main)] flex items-center gap-1.5">
 <Phone className="w-3.5 h-3.5 text-[var(--admin-accent)]"/>
 Telefone da Gerência / Recepção para Alertas (com DDD)
 </span>
 <input
 type="tel"
 value={settings.managerNotificationPhone ||""}
 onChange={(e) =>
 update("managerNotificationPhone", e.target.value)
 }
 placeholder="Ex: 5511999998888 ou (11) 99999-8888"
 className="w-full bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-[var(--admin-radius-lg)] p-2.5 text-xs text-[var(--admin-text-main)] focus:outline-none focus:ring-1 focus:ring-[var(--admin-accent)]"
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
 <Save className="w-4 h-4"/>
 {saving ?"Salvando...":"Salvar Notificações"}
 </button>
 </div>
 </section>
 </div>
 )}

 {/* TAB 3: CONEXÃO & API EVOLUTION */}
 {activeTab ==="connection"&& (
 <div className="space-y-4">
 <section className="p-4 bg-[var(--admin-surface)] rounded-[var(--admin-radius-lg)] border border-[var(--admin-border)] border border-[var(--admin-border)] space-y-4">
 <div className="flex items-start justify-between gap-4">
 <div className="min-w-0">
 <h2 className="text-sm font-bold text-[var(--admin-text-main)] flex items-center gap-2">
 <Settings2 className="w-4 h-4 text-[var(--admin-accent)]"/>{""}
 Conexão da Evolution API
 </h2>
 <p className="text-xs text-[var(--admin-text-muted)] mt-1">
 A URL, instância e chave ficam configuradas aqui. A chave nunca é
 devolvida ao navegador.
 </p>
 </div>
 <div
 className={`flex items-center gap-1.5 text-xs font-bold shrink-0 ${
 statusTone ==="success"
 ?"text-status-success"
 : statusTone ==="warning"
 ?"text-status-warning"
 :"text-[var(--admin-text-muted)]"
 }`}
 >
 {connected ? (
 <Wifi className="w-4 h-4"/>
 ) : (
 <WifiOff className="w-4 h-4"/>
 )}
 <span className="hidden sm:inline">{statusLabel(status)}</span>
 </div>
 </div>

 <div className="flex items-center justify-between gap-4 p-3.5 rounded-[var(--admin-radius-lg)] bg-[var(--admin-bg)]/70">
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
 className={`w-11 h-6 rounded-[var(--admin-radius-full)] transition-colors shrink-0 relative ${
 settings.enabled
 ?"bg-[var(--admin-accent)]"
 :"bg-[var(--admin-border)]"
 }`}
 >
 <span
 className={`absolute top-0.5 w-5 h-5 rounded-[var(--admin-radius-full)] bg-white shadow transition-transform ${
 settings.enabled ?"translate-x-5":"translate-x-0.5"
 }`}
 />
 </button>
 </div>

 <div className="flex items-center justify-between gap-4 p-3.5 rounded-[var(--admin-radius-lg)] bg-[var(--admin-accent)]/10">
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
 className={`w-11 h-6 rounded-[var(--admin-radius-full)] transition-colors shrink-0 relative ${
 settings.navoBotEnabled
 ?"bg-[var(--admin-accent)]"
 :"bg-[var(--admin-border)]"
 }`}
 >
 <span
 className={`absolute top-0.5 w-5 h-5 rounded-[var(--admin-radius-full)] bg-white shadow transition-transform ${
 settings.navoBotEnabled ?"translate-x-5":"translate-x-0.5"
 }`}
 />
 </button>
 </div>

 <label className="block p-3.5 rounded-[var(--admin-radius-lg)] bg-[var(--admin-bg)]/70 space-y-2">
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
 className="w-full bg-[var(--admin-surface)] rounded-[var(--admin-radius-lg)] border border-[var(--admin-border)] p-2.5 text-xs text-[var(--admin-text-main)] focus:outline-none focus:ring-1 focus:ring-[var(--admin-accent)]"
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

 <div className="flex items-center justify-between gap-4 p-3.5 rounded-[var(--admin-radius-lg)] bg-[var(--admin-bg)]/70">
 <div className="min-w-0">
 <p className="text-xs font-bold text-[var(--admin-text-main)]">
 Mensagens interativas (botões e listas)
 </p>
 <p className="text-xs text-[var(--admin-text-muted)] mt-0.5">
 {settings.whatsappAccountType ==="business_qr"
 ?"Recomendado para a conta WhatsApp Business conectada por QR Code; teste no celular, Web e Desktop antes de manter ativo."
 :"Desative para usar somente texto e evitar o erro “Não foi possível carregar a mensagem”. Recomendado para contas pessoais conectadas por QR Code."}
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
 className={`w-11 h-6 rounded-[var(--admin-radius-full)] transition-colors shrink-0 relative ${
 settings.useInteractiveMessages
 ?"bg-[var(--admin-accent)]"
 :"bg-[var(--admin-border)]"
 }`}
 >
 <span
 className={`absolute top-0.5 w-5 h-5 rounded-[var(--admin-radius-full)] bg-white shadow transition-transform ${
 settings.useInteractiveMessages
 ?"translate-x-5"
 :"translate-x-0.5"
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
 className="w-full bg-[var(--admin-bg)]/70 rounded-[var(--admin-radius-lg)] p-2.5 text-xs text-[var(--admin-text-main)] focus:outline-none focus:ring-1 focus:ring-[var(--admin-accent)] min-w-0"
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
 className="w-full bg-[var(--admin-bg)]/70 rounded-[var(--admin-radius-lg)] p-2.5 text-xs text-[var(--admin-text-main)] focus:outline-none focus:ring-1 focus:ring-[var(--admin-accent)] min-w-0"
 />
 </label>
 <label className="space-y-1">
 <span className="block text-xs font-bold text-[var(--admin-text-muted)] uppercase tracking-wider">
 Chave da API{""}
 {settings.hasApiKey && (
 <span className="normal-case font-normal">(já salva)</span>
 )}
 </span>
 <div className="relative">
 <input
 type={showApiKey ?"text":"password"}
 value={apiKeyInput}
 onChange={(event) => setApiKeyInput(event.target.value)}
 placeholder={
 settings.hasApiKey
 ?"••••••••"
 :"Cole a chave da Evolution API"
 }
 className="w-full bg-[var(--admin-bg)]/70 rounded-[var(--admin-radius-lg)] p-2.5 pr-10 text-xs text-[var(--admin-text-main)] focus:outline-none focus:ring-1 focus:ring-[var(--admin-accent)] min-w-0"
 />
 <button
 type="button"
 aria-label={showApiKey ?"Ocultar chave":"Mostrar chave"}
 onClick={() => setShowApiKey((visible) => !visible)}
 className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)]"
 >
 {showApiKey ? (
 <EyeOff className="w-4 h-4"/>
 ) : (
 <Eye className="w-4 h-4"/>
 )}
 </button>
 </div>
 </label>
 </div>

 <div className="p-3.5 rounded-[var(--admin-radius-lg)] bg-[var(--admin-bg)]/70 space-y-3">
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
 className={`w-11 h-6 rounded-[var(--admin-radius-full)] transition-colors shrink-0 relative ${
 settings.webhookEnabled
 ?"bg-[var(--admin-accent)]"
 :"bg-[var(--admin-border)]"
 }`}
 >
 <span
 className={`absolute top-0.5 w-5 h-5 rounded-[var(--admin-radius-full)] bg-white shadow transition-transform ${
 settings.webhookEnabled
 ?"translate-x-5"
 :"translate-x-0.5"
 }`}
 />
 </button>
 </div>
 {settings.webhookEnabled && (
 <div className="space-y-3">
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
 placeholder={`${window.location.origin}/api/evolution/webhook`}
 className="w-full bg-[var(--admin-surface)] rounded-[var(--admin-radius-lg)] border border-[var(--admin-border)] p-2.5 text-xs text-[var(--admin-text-main)] focus:outline-none focus:ring-1 focus:ring-[var(--admin-accent)] min-w-0 font-mono"
 />
 </label>
 <label className="space-y-1 block">
 <span className="block text-xs font-bold text-[var(--admin-text-muted)] uppercase tracking-wider">
 Segredo do webhook{""}
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
 ?"••••••••"
 :"Defina um segredo ou deixe vazio para auto-gerar"
 }
 className="w-full bg-[var(--admin-surface)] rounded-[var(--admin-radius-lg)] border border-[var(--admin-border)] p-2.5 text-xs text-[var(--admin-text-main)] focus:outline-none focus:ring-1 focus:ring-[var(--admin-accent)] min-w-0"
 />
 </label>
 </div>

 <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
 <div className="flex flex-wrap gap-2">
 <button
 type="button"
 onClick={() => void handleCopyWebhookUrl()}
 className="h-8 px-3 rounded-[var(--admin-radius-md)] bg-[var(--admin-bg)] hover:bg-[var(--admin-surface)] text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] border border-[var(--admin-border)] font-semibold text-xs flex items-center gap-1.5 transition-colors"
 >
 {copiedWebhook ? (
 <>
 <Check className="w-3.5 h-3.5 text-status-success"/>
 <span>URL Copiada!</span>
 </>
 ) : (
 <>
 <Copy className="w-3.5 h-3.5"/>
 <span>Copiar URL do Servidor</span>
 </>
 )}
 </button>
 <button
 type="button"
 onClick={handleUseOriginWebhook}
 className="h-8 px-3 rounded-[var(--admin-radius-md)] bg-[var(--admin-bg)] hover:bg-[var(--admin-surface)] text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] border border-[var(--admin-border)] font-semibold text-xs flex items-center gap-1.5 transition-colors"
 >
 <span>Preencher com URL deste Domínio</span>
 </button>
 </div>

 <button
 type="button"
 onClick={() => void handleApplyWebhook()}
 disabled={
 applyingWebhook ||
 saving ||
 (!settings.webhookEnabled && !settings.webhookUrl)
 }
 className="h-8 px-4 rounded-[var(--admin-radius-md)] bg-[var(--admin-accent)] hover:opacity-90 text-white font-bold text-xs flex items-center justify-center gap-1.5 disabled:opacity-50 transition-opacity"
 >
 <Wifi className="w-3.5 h-3.5"/>
 {applyingWebhook ?"Aplicando...":"Aplicar Webhook na Evolution"}
 </button>
 </div>
 </div>
 )}
 </div>

 <div className="flex flex-col sm:flex-row sm:justify-end gap-2 pt-2">
 <button
 type="button"
 onClick={() => void handleTest()}
 disabled={testing || saving}
 className="admin-btn admin-btn-secondary h-10 px-4 text-xs font-bold flex items-center justify-center gap-2"
 >
 <RefreshCw
 className={`w-4 h-4 ${testing ?"animate-spin":""}`}
 />
 {testing ?"Testando...":"Testar conexão"}
 </button>
 <button
 type="button"
 onClick={() => void handleSave()}
 disabled={saving}
 className="admin-btn admin-btn-primary h-10 px-4 text-xs font-bold flex items-center justify-center gap-2"
 >
 <Save className="w-4 h-4"/>
 {saving ?"Salvando...":"Salvar configuração"}
 </button>
 </div>
 </section>

 <section className="p-4 bg-[var(--admin-surface)] rounded-[var(--admin-radius-lg)] border border-[var(--admin-border)] border border-[var(--admin-border)] space-y-3">
 <div className="flex items-start justify-between gap-3">
 <div className="min-w-0">
 <h2 className="text-sm font-bold text-[var(--admin-text-main)] flex items-center gap-2">
 <Sparkles className="w-4 h-4 text-[var(--admin-accent)]"/>{""}
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
 className="h-9 px-3 rounded-[var(--admin-radius-lg)] bg-[var(--admin-bg)]/80 text-[var(--admin-text-main)] font-bold text-xs flex items-center gap-2 shrink-0 disabled:opacity-50"
 >
 <Loader2
 className={`w-3.5 h-3.5 ${testingAi ?"animate-spin":""}`}
 />
 {testingAi ?"Testando...":"Testar Gemini"}
 </button>
 </div>
 {aiResult && (
 <div
 className={`p-3 rounded-[var(--admin-radius-lg)] text-xs ${
 aiResult.ok
 ?"bg-status-success/10 text-status-success"
 :"bg-status-error/10 text-status-error"
 }`}
 >
 <p className="font-bold">{aiResult.message}</p>
 <p className="mt-1">
 Modelo: {aiResult.model} · Latência: {aiResult.latencyMs} ms ·
 Gemini utilizado: {aiResult.usedGemini ?"sim":"não"}
 {aiResult.response ? ` · Resposta: ${aiResult.response}` :""}
 </p>
 </div>
 )}
 </section>

 <section className="p-4 bg-[var(--admin-surface)] rounded-[var(--admin-radius-lg)] border border-[var(--admin-border)] border border-[var(--admin-border)] space-y-3">
 <div>
 <h2 className="text-sm font-bold text-[var(--admin-text-main)] flex items-center gap-2">
 <Play className="w-4 h-4 text-[var(--admin-accent)]"/>
 Simulador de Mensagem Recebida (Testar NavoBot)
 </h2>
 <p className="text-xs text-[var(--admin-text-muted)] mt-1">
 Simula o envio de uma mensagem de WhatsApp para testar a interpretação do NavoBot, fluxo de agendamento e respostas.
 </p>
 </div>
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
 <label className="space-y-1">
 <span className="block text-xs font-bold text-[var(--admin-text-muted)] uppercase tracking-wider">
 Telefone Simulado
 </span>
 <input
 value={simPhone}
 onChange={(event) => setSimPhone(event.target.value)}
 placeholder="5511999998888"
 inputMode="tel"
 className="w-full bg-[var(--admin-bg)]/70 rounded-[var(--admin-radius-lg)] p-2.5 text-xs text-[var(--admin-text-main)] focus:outline-none focus:ring-1 focus:ring-[var(--admin-accent)] min-w-0"
 />
 </label>
 <label className="space-y-1">
 <span className="block text-xs font-bold text-[var(--admin-text-muted)] uppercase tracking-wider">
 Nome do Cliente
 </span>
 <input
 value={simPushName}
 onChange={(event) => setSimPushName(event.target.value)}
 placeholder="Cliente Teste"
 className="w-full bg-[var(--admin-bg)]/70 rounded-[var(--admin-radius-lg)] p-2.5 text-xs text-[var(--admin-text-main)] focus:outline-none focus:ring-1 focus:ring-[var(--admin-accent)] min-w-0"
 />
 </label>
 <label className="space-y-1">
 <span className="block text-xs font-bold text-[var(--admin-text-muted)] uppercase tracking-wider">
 Mensagem
 </span>
 <input
 value={simText}
 onChange={(event) => setSimText(event.target.value)}
 placeholder="Ex: Oi, Quero agendar amanhã às 15h"
 className="w-full bg-[var(--admin-bg)]/70 rounded-[var(--admin-radius-lg)] p-2.5 text-xs text-[var(--admin-text-main)] focus:outline-none focus:ring-1 focus:ring-[var(--admin-accent)] min-w-0"
 />
 </label>
 </div>
 <div className="flex justify-end">
 <button
 type="button"
 onClick={() => void handleSimulateInbound()}
 disabled={simLoading || !simPhone.trim() || !simText.trim()}
 className="h-10 w-full sm:w-auto px-4 rounded-[var(--admin-radius-lg)] bg-[var(--admin-bg)]/80 hover:bg-[var(--admin-bg)] text-[var(--admin-text-main)] font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
 >
 <Play className={`w-4 h-4 ${simLoading ?"animate-spin":""}`} />
 {simLoading ?"Simulando...":"Simular Recebimento no Bot"}
 </button>
 </div>
 {simResult && (
 <div className="p-3 rounded-[var(--admin-radius-lg)] bg-[var(--admin-bg)] border border-[var(--admin-border)] text-xs space-y-2">
 <div className="font-bold text-[var(--admin-text-main)] flex items-center justify-between">
 <span>Resultado da Mensagem</span>
 <span className="text-status-success font-semibold">Processado</span>
 </div>
 <div className="p-2.5 rounded-[var(--admin-radius-md)] bg-[var(--admin-surface)] text-[var(--admin-text-muted)] font-mono text-[11px] overflow-x-auto">
 <pre>{JSON.stringify(simResult.botResult, null, 2)}</pre>
 </div>
 </div>
 )}
 </section>

 <section className="p-4 bg-[var(--admin-surface)] rounded-[var(--admin-radius-lg)] border border-[var(--admin-border)] border border-[var(--admin-border)] space-y-3">
 <div>
 <h2 className="text-sm font-bold text-[var(--admin-text-main)]">
 Mensagem de teste (Envio Direto)
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
 className="w-full bg-[var(--admin-bg)]/70 rounded-[var(--admin-radius-lg)] p-2.5 text-xs text-[var(--admin-text-main)] focus:outline-none focus:ring-1 focus:ring-[var(--admin-accent)] min-w-0"
 />
 </label>
 <label className="space-y-1 sm:col-span-2">
 <span className="block text-xs font-bold text-[var(--admin-text-muted)] uppercase tracking-wider">
 Mensagem
 </span>
 <input
 value={testText}
 onChange={(event) => setTestText(event.target.value)}
 className="w-full bg-[var(--admin-bg)]/70 rounded-[var(--admin-radius-lg)] p-2.5 text-xs text-[var(--admin-text-main)] focus:outline-none focus:ring-1 focus:ring-[var(--admin-accent)] min-w-0"
 />
 </label>
 </div>
 <div className="flex justify-end">
 <button
 type="button"
 onClick={() => void handleSendTest()}
 disabled={sending || !testNumber.trim() || !testText.trim()}
 className="h-10 w-full sm:w-auto px-4 rounded-[var(--admin-radius-lg)] bg-[var(--admin-bg)]/80 hover:bg-[var(--admin-bg)] text-[var(--admin-text-main)] font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
 >
 <Send className="w-4 h-4"/>
 {sending ?"Enviando...":"Enviar mensagem de teste"}
 </button>
 </div>
 </section>
 </div>
 )}
 </div>
 );
};
