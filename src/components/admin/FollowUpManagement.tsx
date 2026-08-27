import React, { useEffect, useState } from "react";
import {
  History,
  Mail,
  Phone,
  Search,
  RefreshCw,
  UsersRound,
  Clock3,
} from "lucide-react";
import { authFetch } from "../../lib/api";
import { AdminPageHeader } from "./shared/AdminPageHeader";

interface FollowUpClient {
  id: string;
  name: string;
  email: string;
  phone: string;
  lastVisit: string | null;
  daysSinceLastVisit: number | null;
  appointmentCount: number;
  hasEmail: boolean;
  hasPhone: boolean;
  loyaltyTier: string;
}

interface FollowUpResponse {
  thresholdDays: number;
  summary: {
    totalClients: number;
    inactiveClients: number;
    withEmail: number;
    withPhone: number;
  };
  clients: FollowUpClient[];
}

const formatDate = (value: string | null) =>
  value
    ? new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR")
    : "Sem visita registrada";
const whatsappUrl = (phone: string) =>
  `https://wa.me/55${phone.replace(/\D/g, "")}`;

export const FollowUpManagement: React.FC = () => {
  const [thresholdDays, setThresholdDays] = useState(60);
  const [search, setSearch] = useState("");
  const [data, setData] = useState<FollowUpResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ days: String(thresholdDays) });
      if (search.trim()) params.set("search", search.trim());
      const res = await authFetch(
        `/api/relationship/follow-up?${params.toString()}`,
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(body.error || "Não foi possível carregar o Follow-up.");
      setData(body);
    } catch (err: any) {
      setError(err.message || "Não foi possível carregar o Follow-up.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [thresholdDays]);

  const summary = data?.summary || {
    totalClients: 0,
    inactiveClients: 0,
    withEmail: 0,
    withPhone: 0,
  };
  const clients = data?.clients || [];

  return (
    <div className="space-y-4 animate-in fade-in duration-300 min-w-0">
      <AdminPageHeader
        icon={History}
        title="Follow-up"
        stats={[
          {
            label: "ausentes",
            value: summary.inactiveClients,
            tone: "warning",
          },
          { label: "WhatsApp", value: summary.withPhone, tone: "success" },
          { label: "e-mail", value: summary.withEmail, tone: "info" },
        ]}
        action={{ label: "Atualizar", onClick: load }}
      />

      <div className="bg-status-warning/10 border border-status-warning/30 rounded-[var(--admin-radius-lg)] p-3 text-xs text-[var(--admin-text-muted)] flex items-start gap-2">
        <Clock3 className="w-4 h-4 text-status-warning shrink-0 mt-0.5" />
        <p>
          Clientes sem retorno. O módulo não envia mensagens; use os canais do
          cliente.
        </p>
      </div>

      <div className="bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-[var(--admin-radius-lg)] p-3 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--admin-text-muted)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load()}
              placeholder="Buscar cliente..."
              className="w-full h-11 bg-[var(--admin-bg)] border border-[var(--admin-border)] rounded-[var(--admin-radius-lg)] pl-9 pr-3 text-sm text-[var(--admin-text-main)] focus:outline-none focus:border-[var(--admin-accent)]"
            />
          </div>
          <button
            type="button"
            onClick={load}
            className="h-11 px-4 rounded-[var(--admin-radius-lg)] bg-[var(--admin-accent)] text-[var(--admin-accent-text)] text-xs font-bold flex items-center justify-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />{" "}
            Atualizar
          </button>
        </div>
        <div
          data-gesture-scroll="horizontal"
          className="flex gap-2 overflow-x-auto no-scrollbar py-1"
        >
          {[30, 60, 90, 120].map((days) => (
            <button
              key={days}
              type="button"
              onClick={() => setThresholdDays(days)}
              className={`shrink-0 min-h-10 px-4 rounded-[var(--admin-radius-lg)] border text-sm font-semibold ${thresholdDays === days ? "bg-[var(--admin-accent)] text-[var(--admin-accent-text)] border-[var(--admin-accent)]" : "bg-[var(--admin-bg)] text-[var(--admin-text-muted)] border-[var(--admin-border)]"}`}
            >
              {days} dias sem retorno
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-[var(--admin-radius-lg)] bg-status-error/10 border border-status-error/30 text-status-error text-sm font-semibold">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-16 flex justify-center">
          <div className="w-7 h-7 border-2 border-[var(--admin-accent)] border-t-transparent rounded-[var(--admin-radius-full)] animate-spin" />
        </div>
      ) : clients.length === 0 ? (
        <div className="bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-[var(--admin-radius-xl)] p-10 text-center space-y-2">
          <UsersRound className="w-10 h-10 text-[var(--admin-text-muted)] mx-auto" />
          <h3 className="text-base font-bold text-[var(--admin-text-main)]">
            Nenhum cliente nesta faixa
          </h3>
          <p className="text-sm text-[var(--admin-text-muted)]">
            Ajuste o período ou a busca.
          </p>
        </div>
      ) : (
        <div className="bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-[var(--admin-radius-lg)] overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--admin-border)] flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-[var(--admin-text-main)]">
                Clientes a recuperar
              </p>
              <p className="text-xs text-[var(--admin-text-muted)]">
                Maior tempo sem retorno
              </p>
            </div>
            <span className="text-xs font-bold text-status-warning">
              {clients.length} encontrados
            </span>
          </div>
          <div className="divide-y divide-[var(--admin-border)]">
            {clients.map((client) => (
              <article
                key={client.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4"
              >
                <div className="w-11 h-11 rounded-[var(--admin-radius-full)] bg-[var(--admin-accent)]/10 text-[var(--admin-accent)] flex items-center justify-center font-bold shrink-0">
                  {client.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-bold text-[var(--admin-text-main)] truncate">
                      {client.name}
                    </h3>
                    <span className="px-2 py-1 rounded-[var(--admin-radius-sm)] bg-[var(--admin-bg)] border border-[var(--admin-border)] text-xs text-[var(--admin-text-muted)]">
                      {client.loyaltyTier}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--admin-text-muted)]">
                    Última visita: {formatDate(client.lastVisit)} ·{" "}
                    {client.appointmentCount} atend.
                  </p>
                </div>
                <div className="sm:text-right shrink-0">
                  <p className="text-xs uppercase tracking-wider text-[var(--admin-text-muted)]">
                    Ausente há
                  </p>
                  <p className="text-sm font-black text-status-warning">
                    {client.daysSinceLastVisit === null
                      ? "Sem histórico"
                      : `${client.daysSinceLastVisit} dias`}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {client.hasPhone && (
                    <a
                      href={whatsappUrl(client.phone)}
                      target="_blank"
                      rel="noreferrer"
                      title="Abrir WhatsApp"
                      className="w-10 h-10 rounded-[var(--admin-radius-lg)] border border-status-success/30 text-status-success flex items-center justify-center"
                    >
                      <Phone className="w-4 h-4" />
                    </a>
                  )}
                  {client.hasEmail && (
                    <a
                      href={`mailto:${client.email}`}
                      title="Enviar e-mail"
                      className="w-10 h-10 rounded-[var(--admin-radius-lg)] border border-[var(--admin-accent)]/30 text-[var(--admin-accent)] flex items-center justify-center"
                    >
                      <Mail className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
