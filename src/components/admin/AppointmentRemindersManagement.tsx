import React, { useEffect, useMemo, useState } from "react";
import {
  Bell,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  Filter,
  History,
  MessageSquare,
  Phone,
  RefreshCw,
  Send,
  Sparkles,
  User,
  Users,
  Wifi,
  WifiOff,
  Zap,
} from "lucide-react";
import { AdminPageHeader } from "./shared/AdminPageHeader";
import { AdminTabs } from "./shared/AdminTabs";
import {
  fetchAppointmentsFromSupabase,
} from "../../services/supabaseDataService";
import { type Appointment } from "../../types";
import {
  fetchEvolutionApiSettings,
  fetchEvolutionApiStatus,
  type EvolutionApiSettings,
  type EvolutionApiStatus,
} from "../../services/evolutionApiService";
import { authFetch } from "../../lib/api";

type ReminderCategory = "2h" | "today" | "tomorrow" | "followup";

interface ReminderItem {
  id: string;
  clientName: string;
  clientPhone: string;
  professionalName: string;
  serviceTitle: string;
  date: string;
  timeSlot: string;
  category: ReminderCategory;
  minutesUntil: number;
  status: "pending" | "sent";
  sentAt?: string;
  messageText: string;
}

const formatPhoneClean = (phone: string) => phone.replace(/\D/g, "");

export const AppointmentRemindersManagement: React.FC = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<ReminderCategory>("2h");
  const [search, setSearch] = useState("");
  const [sentReminders, setSentReminders] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchRem = async () => {
      try {
        const res = await fetch('/api/reminders');
        if (res.ok) {
          const data = await res.json();
          const mapped: Record<string, string> = {};
          data.forEach((r: any) => {
            mapped[r.appointmentId] = r.sentAt;
          });
          setSentReminders(mapped);
        }
      } catch(e){}
    };
    fetchRem();
  }, []);
  const [evolutionSettings, setEvolutionSettings] = useState<EvolutionApiSettings | null>(null);
  const [evolutionStatus, setEvolutionStatus] = useState<EvolutionApiStatus | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadData = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const [apts, settings, status] = await Promise.all([
        fetchAppointmentsFromSupabase(undefined, { strict: false }),
        fetchEvolutionApiSettings().catch(() => null),
        fetchEvolutionApiStatus().catch(() => null),
      ]);
      setAppointments(apts || []);
      setEvolutionSettings(settings);
      setEvolutionStatus(status);
    } catch (err: any) {
      setFeedback({
        type: "error",
        text: err?.message || "Não foi possível carregar os agendamentos.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);

  const reminders = useMemo<ReminderItem[]>(() => {
    const list: ReminderItem[] = [];

    appointments.forEach((apt) => {
      if (apt.status === "cancelled" || apt.status === "no_show") return;
      if (!apt.client_phone) return;

      const serviceName = apt.services?.[0]?.title || "Atendimento";
      const barber = apt.professional_name || "Seu Barbeiro";
      const [hourStr, minStr] = (apt.time_slot || "00:00").split(":");
      const aptDate = new Date(`${apt.date}T${hourStr || "00"}:${minStr || "00"}:00`);
      const diffMinutes = Math.round((aptDate.getTime() - now.getTime()) / (60 * 1000));

      let cat: ReminderCategory | null = null;
      let msg = "";

      if (apt.date === todayStr) {
        if (diffMinutes >= 0 && diffMinutes <= 180) {
          cat = "2h";
          msg = `*Lembrete de Agendamento - Navo Barber & Club*\n\nOlá, *${apt.client_name}*!\nLembramos que seu atendimento para *${serviceName}* com *${barber}* é hoje às *${apt.time_slot}*.\n\n📍 Nosso endereço: Rua dos Barbeiros, 120\nEsperamos você!`;
        } else {
          cat = "today";
          msg = `*Lembrete de Horário Hoje - Navo Barber & Club*\n\nOlá, *${apt.client_name}*!\nConfirmando seu horário de *${serviceName}* hoje às *${apt.time_slot}* com *${barber}*.\n\nCaso precise de algum ajuste, nos avise por aqui!`;
        }
      } else if (apt.date === tomorrowStr) {
        cat = "tomorrow";
        msg = `*Confirmação de Agendamento Amanhã - Navo Barber & Club*\n\nOlá, *${apt.client_name}*!\nSeu horário para *${serviceName}* com *${barber}* está confirmado para amanhã (${new Date(`${tomorrowStr}T12:00:00`).toLocaleDateString("pt-BR")}) às *${apt.time_slot}*.\n\nAté breve!`;
      }

      if (cat) {
        const isSent = !!sentReminders[apt.id];
        list.push({
          id: apt.id,
          clientName: apt.client_name,
          clientPhone: apt.client_phone,
          professionalName: barber,
          serviceTitle: serviceName,
          date: apt.date,
          timeSlot: apt.time_slot,
          category: cat,
          minutesUntil: diffMinutes,
          status: isSent ? "sent" : "pending",
          sentAt: sentReminders[apt.id],
          messageText: msg,
        });
      }
    });

    return list.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.timeSlot.localeCompare(b.timeSlot);
    });
  }, [appointments, now, sentReminders, todayStr, tomorrowStr]);

  const filteredReminders = useMemo(() => {
    return reminders.filter((item) => {
      if (activeCategory === "2h" && item.category !== "2h") return false;
      if (activeCategory === "today" && item.category !== "today" && item.category !== "2h") return false;
      if (activeCategory === "tomorrow" && item.category !== "tomorrow") return false;

      if (search.trim()) {
        const query = search.toLowerCase();
        return (
          item.clientName.toLowerCase().includes(query) ||
          item.clientPhone.includes(query) ||
          item.professionalName.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [reminders, activeCategory, search]);

  const markAsSent = async (id: string, apt?: any) => {
    const ts = new Date().toISOString();
    setSentReminders(prev => ({ ...prev, [id]: ts }));
    if (!apt) return;
    try {
      await fetch('/api/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointmentId: id,
          clientName: apt.clientName || 'Cliente',
          clientPhone: apt.clientPhone || '000',
          serviceTitle: apt.serviceTitle || 'Serviço',
          professionalName: apt.professionalName || 'Profissional',
          date: apt.date || '',
          timeSlot: apt.timeSlot || '',
          sentAt: ts,
          status: 'sent'
        })
      });
    } catch(e) {}
  };

  const handleSendDirectWhatsApp = (item: ReminderItem) => {
    const cleanPhone = formatPhoneClean(item.clientPhone);
    const targetUrl = `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(item.messageText)}`;
    markAsSent(item.id);
    window.open(targetUrl, "_blank");
  };

  const handleSendViaEvolution = async (item: ReminderItem) => {
    const cleanPhone = formatPhoneClean(item.clientPhone);
    if (!cleanPhone) {
      setFeedback({ type: "error", text: "Telefone do cliente inválido." });
      return;
    }

    setSendingId(item.id);
    setFeedback(null);
    try {
      const res = await authFetch("/api/evolution/send-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          number: `55${cleanPhone}`,
          text: item.messageText,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Falha no envio via Evolution API.");
      }
      markAsSent(item.id);
      setFeedback({
        type: "success",
        text: `Lembrete enviado com sucesso para ${item.clientName}!`,
      });
    } catch (err: any) {
      // Fallback para wa.me caso a API não esteja ativa
      handleSendDirectWhatsApp(item);
    } finally {
      setSendingId(null);
    }
  };

  const count2h = reminders.filter((r) => r.category === "2h" && r.status === "pending").length;
  const countToday = reminders.filter((r) => (r.category === "today" || r.category === "2h") && r.status === "pending").length;
  const countTomorrow = reminders.filter((r) => r.category === "tomorrow" && r.status === "pending").length;

  const isEvolutionConnected =
    evolutionStatus?.configured &&
    (evolutionStatus?.instanceStatus === "open" || evolutionStatus?.instanceStatus === "connected");

  return (
    <div className="space-y-4 animate-fade-in text-[var(--admin-text-main)] min-w-0">
      <AdminPageHeader
        icon={Zap}
        title="Lembretes & Automações"
        stats={[
          { label: "próximas 2h", value: count2h, tone: count2h > 0 ? "gold" : "default" },
          { label: "hoje pendentes", value: countToday, tone: "info" },
          { label: "amanhã", value: countTomorrow },
        ]}
        action={{
          label: "Atualizar",
          onClick: loadData,
          icon: RefreshCw,
        }}
      />

      {/* Status da Conexão */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-2xl">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
              isEvolutionConnected
                ? "bg-status-success/15 text-status-success"
                : "bg-status-warning/15 text-status-warning"
            }`}
          >
            {isEvolutionConnected ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
          </div>
          <div>
            <p className="text-xs font-bold text-[var(--admin-text-main)]">
              {isEvolutionConnected
                ? "Evolution API Conectada (Envio Automático 1-Clique)"
                : "Modo Envio Direto (wa.me com mensagem pronta)"}
            </p>
            <p className="text-[11px] text-[var(--admin-text-muted)]">
              {isEvolutionConnected
                ? "Disparos instantâneos sem precisar abrir abas."
                : "Clique em 'Enviar WhatsApp' para abrir a conversa com mensagem preenchida."}
            </p>
          </div>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
            feedback.type === "success"
              ? "bg-status-success/10 border-status-success/30 text-status-success"
              : "bg-status-error/10 border-status-error/30 text-status-error"
          }`}
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Filtros de Categorias */}
      <AdminTabs
        tabs={[
          { id: "2h", label: `Próximas 2 Horas (${count2h})`, icon: Clock },
          { id: "today", label: `Agendamentos de Hoje (${countToday})`, icon: Calendar },
          { id: "tomorrow", label: `Agendamentos de Amanhã (${countTomorrow})`, icon: MessageSquare },
        ]}
        activeId={activeCategory}
        onChange={(id) => setActiveCategory(id as ReminderCategory)}
      />

      {/* Barra de Pesquisa */}
      <div className="flex gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por cliente, telefone ou barbeiro..."
          className="flex-1 h-10 px-3 rounded-xl bg-[var(--admin-surface)] border border-[var(--admin-border)] text-xs text-[var(--admin-text-main)] placeholder:text-[var(--admin-text-muted)] focus:outline-none focus:border-[var(--admin-accent)]"
        />
      </div>

      {/* Lista de Lembretes */}
      {loading ? (
        <div className="p-8 text-center text-xs text-[var(--admin-text-muted)] flex items-center justify-center gap-2 bg-[var(--admin-surface)] rounded-2xl border border-[var(--admin-border)]">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span>Carregando agenda e preparando mensagens...</span>
        </div>
      ) : filteredReminders.length === 0 ? (
        <div className="p-8 text-center space-y-2 bg-[var(--admin-surface)] rounded-2xl border border-[var(--admin-border)]">
          <CheckCircle2 className="w-8 h-8 text-status-success mx-auto" />
          <p className="text-sm font-bold text-[var(--admin-text-main)]">
            Nenhum lembrete pendente nesta categoria!
          </p>
          <p className="text-xs text-[var(--admin-text-muted)] max-w-sm mx-auto">
            Todos os clientes do período selecionado já foram notificados ou não há horários agendados.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredReminders.map((item) => (
            <div
              key={item.id}
              className={`p-4 rounded-2xl border transition-all ${
                item.status === "sent"
                  ? "bg-[var(--admin-surface)]/60 border-[var(--admin-border)]/60 opacity-80"
                  : "bg-[var(--admin-surface)] border-[var(--admin-border)] shadow-xs hover:border-[var(--admin-accent)]/40"
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-[var(--admin-text-main)]">
                      {item.clientName}
                    </span>
                    <span className="text-xs text-[var(--admin-text-muted)] font-mono">
                      {item.clientPhone}
                    </span>
                    {item.status === "sent" && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-status-success/15 text-status-success">
                        Enviado hoje
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--admin-text-muted)]">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-[var(--admin-accent)]" />
                      <strong className="text-[var(--admin-text-main)]">{item.timeSlot}</strong>
                      {item.category === "2h" && item.minutesUntil > 0 && (
                        <span className="text-[var(--admin-accent)] font-semibold">
                          (em {item.minutesUntil} min)
                        </span>
                      )}
                    </span>
                    <span>•</span>
                    <span>{item.serviceTitle}</span>
                    <span>•</span>
                    <span className="font-medium text-[var(--admin-text-main)]">
                      {item.professionalName}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      isEvolutionConnected
                        ? handleSendViaEvolution(item)
                        : handleSendDirectWhatsApp(item)
                    }
                    disabled={sendingId === item.id}
                    className="min-h-[38px] px-4 rounded-xl bg-[var(--admin-accent)] text-[var(--admin-accent-text)] text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-gold-hover transition-all active:scale-95 shadow-xs cursor-pointer"
                  >
                    {sendingId === item.id ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    <span>{item.status === "sent" ? "Reenviar WhatsApp" : "Enviar Lembrete"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSendDirectWhatsApp(item)}
                    title="Abrir no WhatsApp Web/App"
                    className="min-h-[38px] w-9 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-bg)] text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] flex items-center justify-center transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Prévia da Mensagem */}
              <div className="mt-3 pt-2.5 border-t border-[var(--admin-border)] text-[11px] text-[var(--admin-text-muted)] bg-[var(--admin-bg)]/60 p-2.5 rounded-xl font-mono whitespace-pre-line leading-relaxed">
                {item.messageText}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
