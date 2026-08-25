import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  CreditCard,
  Filter,
  Layers,
  Percent,
  Plus,
  RefreshCw,
  Search,
  Scissors,
  User,
  Wallet,
  X,
} from "lucide-react";
import { AdminPageHeader } from "./shared/AdminPageHeader";
import { AdminTabs } from "./shared/AdminTabs";
import { AdminListSkeleton } from "./shared/AdminSkeleton";
import { ReceiptCheckoutModal } from "./ReceiptCheckoutModal";
import { AdminModalV2 } from "./shared/AdminModalV2";
import {
  fetchReceiptsFromSupabase,
  type ReceiptItem,
  type ReceiptPaymentMethod,
} from "../../services/supabaseDataService";

type ReceiptFilter = "all" | "pending" | "received";
type PeriodFilter = "all" | "today" | "7days" | "month";

const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number.isFinite(value) ? value : 0);

const paymentLabel: Record<ReceiptPaymentMethod, string> = {
  pix: "PIX",
  credit_card: "Crédito",
  debit_card: "Débito",
  cash: "Dinheiro",
  other: "Outro",
};

const getReceiptDate = (receipt: ReceiptItem) =>
  receipt.receivedAt || receipt.createdAt || new Date().toISOString();

export const ReceiptsManagement: React.FC = () => {
  const [receipts, setReceipts] = useState<ReceiptItem[]>([]);
  const [filter, setFilter] = useState<ReceiptFilter>("all");
  const [period, setPeriod] = useState<PeriodFilter>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptItem | null>(null);
  const [checkoutReceipt, setCheckoutReceipt] = useState<ReceiptItem | null>(null);

  const loadReceipts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setReceipts(await fetchReceiptsFromSupabase({ strict: true }));
    } catch (requestError) {
      console.error("Não foi possível carregar recebimentos:", requestError);
      setReceipts([]);
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Não foi possível carregar os recebimentos.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReceipts();
    const listener = () => loadReceipts();
    window.addEventListener("adminRefresh", listener);
    return () => window.removeEventListener("adminRefresh", listener);
  }, [loadReceipts]);

  // Comprehensive analytics summary
  const summary = useMemo(() => {
    const pending = receipts.filter((item) => item.status === "pending");
    const received = receipts.filter((item) => item.status === "received");
    
    const pendingAmount = pending.reduce((sum, i) => sum + (i.totalAmount || 0), 0);
    const receivedAmount = received.reduce((sum, i) => sum + (i.totalAmount || 0), 0);
    const totalAmount = receipts.reduce((sum, i) => sum + (i.totalAmount || 0), 0);
    
    const avgTicket = received.length > 0 ? receivedAmount / received.length : 0;

    // Payment method distribution
    const methodCounts: Record<string, number> = {};
    received.forEach((item) => {
      const m = item.paymentMethod || "other";
      methodCounts[m] = (methodCounts[m] || 0) + 1;
    });

    return {
      pending,
      received,
      pendingAmount,
      receivedAmount,
      totalAmount,
      avgTicket,
      methodCounts,
    };
  }, [receipts]);

  // Filtering based on tab, search, and period
  const visibleReceipts = useMemo(() => {
    const query = search.trim().toLowerCase();
    const now = new Date();
    
    return receipts.filter((item) => {
      // Status match
      const statusMatch = filter === "all" || item.status === filter;
      
      // Query match
      const queryMatch =
        !query ||
        [
          item.clientName,
          item.serviceTitle,
          item.professionalName,
          item.clientPhone,
          item.paymentMethod ? paymentLabel[item.paymentMethod] : "",
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));

      // Period match
      let periodMatch = true;
      if (period !== "all") {
        const itemDateStr = getReceiptDate(item);
        const itemDate = new Date(itemDateStr);
        if (period === "today") {
          periodMatch = itemDate.toDateString() === now.toDateString();
        } else if (period === "7days") {
          const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          periodMatch = itemDate >= sevenDaysAgo;
        } else if (period === "month") {
          periodMatch =
            itemDate.getMonth() === now.getMonth() &&
            itemDate.getFullYear() === now.getFullYear();
        }
      }

      return statusMatch && queryMatch && periodMatch;
    });
  }, [filter, receipts, search, period]);

  const pendingVisible = useMemo(
    () => visibleReceipts.filter((item) => item.status === "pending"),
    [visibleReceipts]
  );
  const historyVisible = useMemo(
    () => visibleReceipts.filter((item) => item.status !== "pending"),
    [visibleReceipts]
  );

  const updateReceiptInList = (updated: ReceiptItem) => {
    setReceipts((current) =>
      current.map((item) => (item.id === updated.id ? updated : item)),
    );
  };

  const openCheckout = (receipt: ReceiptItem) => {
    setSelectedReceipt(null);
    setCheckoutReceipt(receipt);
  };

  const renderDesktopRow = (item: ReceiptItem) => {
    const isPending = item.status === "pending";
    const receiptDate = new Date(getReceiptDate(item)).toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    });

    return (
      <tr
        key={item.id}
        className="hover:bg-[var(--admin-bg)]/40 transition-colors group cursor-pointer"
        onClick={() => (isPending ? openCheckout(item) : setSelectedReceipt(item))}
      >
        {/* Cliente & Contato */}
        <td>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[var(--admin-surface)] border border-[var(--admin-border)] flex items-center justify-center shrink-0 text-xs font-bold text-[var(--admin-accent)]">
              {item.clientName?.charAt(0)?.toUpperCase() || "C"}
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-[var(--admin-text-main)] truncate text-xs sm:text-sm">
                {item.clientName}
              </div>
              <div className="text-[11px] text-[var(--admin-text-muted)] flex items-center gap-1.5 mt-0.5">
                <span>{receiptDate}</span>
                {item.clientPhone && (
                  <>
                    <span>·</span>
                    <span className="truncate">{item.clientPhone}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </td>

        {/* Serviço & Profissional */}
        <td>
          <div className="min-w-0">
            <div className="text-xs font-medium text-[var(--admin-text-main)] truncate flex items-center gap-1.5">
              <Scissors className="w-3 h-3 text-[var(--admin-accent)] shrink-0" />
              <span>{item.serviceTitle}</span>
            </div>
            <div className="text-[11px] text-[var(--admin-text-muted)] mt-0.5 flex items-center gap-1">
              <User className="w-2.5 h-2.5 shrink-0" />
              <span className="truncate">{item.professionalName || "Profissional não informado"}</span>
            </div>
          </div>
        </td>

        {/* Forma de Pagamento */}
        <td>
          {isPending ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20 font-medium">
              <Clock3 className="w-3 h-3" /> Aguardando
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] text-[var(--admin-text-main)] bg-[var(--admin-surface)] px-2 py-0.5 rounded-md border border-[var(--admin-border)] font-medium">
              <CreditCard className="w-3 h-3 text-[var(--admin-accent)]" />
              {paymentLabel[item.paymentMethod || "other"]}
            </span>
          )}
        </td>

        {/* Valor Total & Status */}
        <td>
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5">
              <span
                className={`font-mono font-bold text-xs sm:text-sm ${
                  isPending ? "text-[var(--admin-text-main)]" : "text-status-success font-semibold"
                }`}
              >
                {money(item.totalAmount)}
              </span>
              {item.discountAmount > 0 && (
                <span className="text-[10px] bg-emerald-500/10 text-emerald-500 px-1 py-0.2 rounded font-mono">
                  -desc
                </span>
              )}
              {item.surchargeAmount > 0 && (
                <span className="text-[10px] bg-amber-500/10 text-amber-500 px-1 py-0.2 rounded font-mono">
                  +acrés
                </span>
              )}
            </div>
            <div className="flex">
              <StatusBadge status={item.status} />
            </div>
          </div>
        </td>

        {/* Ação */}
        <td className="text-right" onClick={(e) => e.stopPropagation()}>
          {isPending ? (
            <button
              type="button"
              onClick={() => openCheckout(item)}
              className="admin-btn-sm admin-btn-primary whitespace-nowrap shadow-xs hover:scale-[1.02] transition-transform"
            >
              <CreditCard className="w-3.5 h-3.5 mr-1" />
              Registrar
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setSelectedReceipt(item)}
              className="admin-btn-sm admin-btn-secondary whitespace-nowrap"
            >
              Detalhes
            </button>
          )}
        </td>
      </tr>
    );
  };

  const renderMobileCard = (item: ReceiptItem) => {
    const isPending = item.status === "pending";
    const receiptDate = new Date(getReceiptDate(item)).toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    });

    return (
      <div
        key={item.id}
        className="p-3.5 bg-[var(--admin-surface)] hover:bg-[var(--admin-bg)]/50 transition-colors border-b border-[var(--admin-border)] last:border-b-0 space-y-3"
      >
        <div className="flex items-start justify-between gap-3">
          {/* Avatar e Dados do Cliente */}
          <div className="flex items-start gap-2.5 min-w-0 flex-1">
            <div
              className={`w-9 h-9 rounded-xl shrink-0 flex items-center justify-center border ${
                isPending
                  ? "bg-amber-500/10 text-amber-500 border-amber-500/30"
                  : "bg-status-success/10 text-status-success border-status-success/30"
              }`}
            >
              {isPending ? <Clock3 className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs sm:text-sm text-[var(--admin-text-main)] truncate">
                  {item.clientName}
                </span>
                <StatusBadge status={item.status} />
              </div>
              <p className="text-xs text-[var(--admin-accent)] font-medium truncate mt-0.5">
                {item.serviceTitle}
              </p>
              <p className="text-[11px] text-[var(--admin-text-muted)] truncate mt-0.5">
                {item.professionalName || "Profissional não informado"} · {receiptDate}
              </p>
            </div>
          </div>

          {/* Valor */}
          <div className="text-right shrink-0">
            <p
              className={`font-mono font-bold text-sm ${
                isPending ? "text-[var(--admin-text-main)]" : "text-status-success"
              }`}
            >
              {money(item.totalAmount)}
            </p>
            {!isPending && item.paymentMethod && (
              <span className="text-[10px] text-[var(--admin-text-muted)] block mt-0.5">
                {paymentLabel[item.paymentMethod]}
              </span>
            )}
          </div>
        </div>

        {/* Ação rápida no Mobile */}
        <div className="flex items-center justify-between pt-1 border-t border-[var(--admin-border)]/60 text-xs">
          <span className="text-[11px] text-[var(--admin-text-muted)]">
            {isPending ? "Aguardando liquidação" : `Concluído em ${receiptDate}`}
          </span>
          {isPending ? (
            <button
              type="button"
              onClick={() => openCheckout(item)}
              className="admin-btn-sm admin-btn-primary text-xs"
            >
              <CreditCard className="w-3.5 h-3.5 mr-1" />
              Registrar Caixa
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setSelectedReceipt(item)}
              className="admin-btn-sm admin-btn-secondary text-xs"
            >
              Ver Detalhes
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 animate-fade-in min-w-0 w-full">
      {/* Header Principal */}
      <AdminPageHeader
        icon={CircleDollarSign}
        title="Recebimentos & Caixa"
        stats={[
          {
            label: "A Receber",
            value: money(summary.pendingAmount),
            tone: summary.pendingAmount > 0 ? "warning" : "neutral",
          },
          {
            label: "Total Recebido",
            value: money(summary.receivedAmount),
            tone: "gold",
          },
          {
            label: "Registros",
            value: `${receipts.length}`,
            tone: "muted",
          },
        ]}
        action={{
          label: "Atualizar",
          onClick: loadReceipts,
          icon: RefreshCw,
          disabled: loading,
        }}
      />

      {/* KPI CARDS ANALÍTICOS (Layout limpo, sem caixas aninhadas redundantes) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Pendentes */}
        <div className="admin-card p-3.5 sm:p-4 relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] uppercase font-bold tracking-wider text-[var(--admin-text-muted)]">
              Pendentes
            </span>
            <div className="w-6 h-6 rounded-md bg-amber-500/10 text-amber-500 flex items-center justify-center text-xs font-bold">
              {summary.pending.length}
            </div>
          </div>
          <div className="mt-2">
            <div className="text-base sm:text-xl font-bold font-mono text-amber-500">
              {money(summary.pendingAmount)}
            </div>
            <p className="text-[10px] text-[var(--admin-text-muted)] mt-0.5 truncate">
              {summary.pending.length === 1
                ? "1 atendimento para receber"
                : `${summary.pending.length} atendimentos para receber`}
            </p>
          </div>
        </div>

        {/* Card 2: Recebidos */}
        <div className="admin-card p-3.5 sm:p-4 relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] uppercase font-bold tracking-wider text-[var(--admin-text-muted)]">
              Total Liquidado
            </span>
            <div className="w-6 h-6 rounded-md bg-status-success/10 text-status-success flex items-center justify-center text-xs font-bold">
              {summary.received.length}
            </div>
          </div>
          <div className="mt-2">
            <div className="text-base sm:text-xl font-bold font-mono text-status-success">
              {money(summary.receivedAmount)}
            </div>
            <p className="text-[10px] text-[var(--admin-text-muted)] mt-0.5 truncate">
              Recebido no período
            </p>
          </div>
        </div>

        {/* Card 3: Ticket Médio */}
        <div className="admin-card p-3.5 sm:p-4 relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] uppercase font-bold tracking-wider text-[var(--admin-text-muted)]">
              Ticket Médio
            </span>
            <CircleDollarSign className="w-4 h-4 text-[var(--admin-accent)]" />
          </div>
          <div className="mt-2">
            <div className="text-base sm:text-xl font-bold font-mono text-[var(--admin-text-main)]">
              {money(summary.avgTicket)}
            </div>
            <p className="text-[10px] text-[var(--admin-text-muted)] mt-0.5 truncate">
              Média por recebimento
            </p>
          </div>
        </div>

        {/* Card 4: Métodos de Pagamento */}
        <div className="admin-card p-3.5 sm:p-4 relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] uppercase font-bold tracking-wider text-[var(--admin-text-muted)]">
              Formas de Pagamento
            </span>
            <CreditCard className="w-4 h-4 text-[var(--admin-accent)]" />
          </div>
          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
            {Object.keys(summary.methodCounts).length > 0 ? (
              Object.entries(summary.methodCounts).map(([method, count]) => (
                <span
                  key={method}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--admin-bg)] border border-[var(--admin-border)] text-[var(--admin-text-muted)] font-medium"
                >
                  {paymentLabel[method as ReceiptPaymentMethod] || method}:{" "}
                  <strong className="text-[var(--admin-text-main)]">{count}</strong>
                </span>
              ))
            ) : (
              <span className="text-[11px] text-[var(--admin-text-muted)]">Nenhum pagamento registrado</span>
            )}
          </div>
        </div>
      </div>

      {/* Alerta de Erro */}
      {error && (
        <div className="rounded-xl border border-status-error/30 bg-status-error/10 p-3.5 flex items-center justify-between gap-3 text-sm font-semibold text-status-error">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="admin-safe-wrap">{error}</span>
          </div>
          <button
            type="button"
            onClick={loadReceipts}
            className="shrink-0 min-h-8 px-2.5 rounded-lg border border-status-error/30 text-xs font-bold hover:bg-status-error/10"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* BARRA DE CONTROLE, FILTROS & BUSCA (Unificada em uma única caixa com divisores limpos) */}
      <div className="admin-card p-3 sm:p-4 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          {/* Abas Rápidas */}
          <AdminTabs
            tabs={[
              { id: "all", label: `Todos (${receipts.length})` },
              {
                id: "pending",
                label: `Pendentes (${summary.pending.length})`,
              },
              {
                id: "received",
                label: `Recebidos (${summary.received.length})`,
              },
            ]}
            activeId={filter}
            onChange={(id) => setFilter(id as ReceiptFilter)}
          />

          {/* Campo de Busca & Filtro de Período */}
          <div className="flex items-center gap-2 w-full lg:w-auto">
            {/* Seletor de Período */}
            <div className="relative shrink-0">
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value as PeriodFilter)}
                className="admin-input h-9 text-xs font-semibold px-2.5 pr-7 bg-[var(--admin-bg)] border border-[var(--admin-border)] rounded-lg text-[var(--admin-text-main)] appearance-none cursor-pointer"
                aria-label="Filtrar por período"
              >
                <option value="all">Todo o período</option>
                <option value="today">Hoje</option>
                <option value="7days">Últimos 7 dias</option>
                <option value="month">Este mês</option>
              </select>
              <Calendar className="w-3.5 h-3.5 text-[var(--admin-text-muted)] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Input de Busca */}
            <div className="relative flex-1 lg:w-64">
              <Search className="w-3.5 h-3.5 text-[var(--admin-text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar cliente, serviço..."
                aria-label="Buscar recebimentos"
                className="w-full h-9 rounded-lg bg-[var(--admin-bg)] border border-[var(--admin-border)] pl-8 pr-7 text-xs text-[var(--admin-text-main)] placeholder:text-[var(--admin-text-muted)] focus:outline-none focus:border-[var(--admin-accent)] transition-colors"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* LISTAGEM DE RECEBIMENTOS */}
        {loading ? (
          <AdminListSkeleton rows={5} className="py-4" />
        ) : visibleReceipts.length === 0 ? (
          <div className="py-12 px-4 text-center border-t border-[var(--admin-border)] mt-2">
            <CircleDollarSign className="w-10 h-10 mx-auto text-[var(--admin-text-muted)]/40" />
            <h3 className="mt-3 text-sm font-bold text-[var(--admin-text-main)]">
              Nenhum registro encontrado
            </h3>
            <p className="mt-1 text-xs text-[var(--admin-text-muted)] max-w-sm mx-auto">
              Nenhum recebimento corresponde aos filtros selecionados. Tente alterar a busca ou o período.
            </p>
          </div>
        ) : (
          <div className="space-y-4 pt-1">
            {/* Se houver registros pendentes e o filtro permitir, exibe em destaque */}
            {filter === "all" ? (
              <>
                {pendingVisible.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-2 text-xs font-bold text-amber-500 uppercase tracking-wider">
                        <Clock3 className="w-3.5 h-3.5" />
                        <span>Aguardando Registro ({pendingVisible.length})</span>
                      </div>
                      <span className="text-xs font-mono font-bold text-amber-500">
                        Total: {money(pendingVisible.reduce((s, i) => s + (i.totalAmount || 0), 0))}
                      </span>
                    </div>

                    <div className="admin-table-container">
                      <div className="hidden md:block">
                        <table className="admin-table">
                          <thead>
                            <tr>
                              <th>Cliente</th>
                              <th>Serviço & Barbeiro</th>
                              <th>Forma de Pagto</th>
                              <th>Valor / Status</th>
                              <th className="text-right">Ação</th>
                            </tr>
                          </thead>
                          <tbody>{pendingVisible.map(renderDesktopRow)}</tbody>
                        </table>
                      </div>
                      <div className="md:hidden">{pendingVisible.map(renderMobileCard)}</div>
                    </div>
                  </div>
                )}

                {historyVisible.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-2 text-xs font-bold text-status-success uppercase tracking-wider">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Histórico de Recebimentos ({historyVisible.length})</span>
                      </div>
                      <span className="text-xs font-mono font-bold text-status-success">
                        Total: {money(historyVisible.reduce((s, i) => s + (i.totalAmount || 0), 0))}
                      </span>
                    </div>

                    <div className="admin-table-container">
                      <div className="hidden md:block">
                        <table className="admin-table">
                          <thead>
                            <tr>
                              <th>Cliente</th>
                              <th>Serviço & Barbeiro</th>
                              <th>Forma de Pagto</th>
                              <th>Valor / Status</th>
                              <th className="text-right">Ação</th>
                            </tr>
                          </thead>
                          <tbody>{historyVisible.map(renderDesktopRow)}</tbody>
                        </table>
                      </div>
                      <div className="md:hidden">{historyVisible.map(renderMobileCard)}</div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              /* Visualização direta quando filtrado por Pendentes ou Recebidos */
              <div className="admin-table-container">
                <div className="hidden md:block">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Cliente</th>
                        <th>Serviço & Barbeiro</th>
                        <th>Forma de Pagto</th>
                        <th>Valor / Status</th>
                        <th className="text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody>{visibleReceipts.map(renderDesktopRow)}</tbody>
                  </table>
                </div>
                <div className="md:hidden">{visibleReceipts.map(renderMobileCard)}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal de Detalhes (Sem alterar o Checkout!) */}
      {selectedReceipt && (
        <ReceiptDetailsModal
          receipt={selectedReceipt}
          onClose={() => setSelectedReceipt(null)}
          onRegister={() => openCheckout(selectedReceipt)}
        />
      )}

      {/* Checkout Modal existente mantido 100% intacto */}
      {checkoutReceipt && (
        <ReceiptCheckoutModal
          source={{
            appointmentId: checkoutReceipt.appointmentId || undefined,
            clientId: checkoutReceipt.clientId || undefined,
            clientName: checkoutReceipt.clientName,
            clientPhone: checkoutReceipt.clientPhone || undefined,
            professionalId: checkoutReceipt.professionalId || undefined,
            professionalName: checkoutReceipt.professionalName || undefined,
            serviceTitle: checkoutReceipt.serviceTitle,
            servicePrice: checkoutReceipt.originalAmount,
          }}
          initialReceipt={checkoutReceipt}
          onClose={() => {
            setCheckoutReceipt(null);
            loadReceipts();
          }}
          onPending={updateReceiptInList}
          onReceived={updateReceiptInList}
        />
      )}
    </div>
  );
};

const StatusBadge: React.FC<{ status: ReceiptItem["status"] }> = ({ status }) => {
  const received = status === "received";
  const cancelled = status === "cancelled";
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${
        received
          ? "bg-status-success/15 text-status-success border border-status-success/30"
          : cancelled
          ? "bg-status-error/15 text-status-error border border-status-error/30"
          : "bg-amber-500/15 text-amber-500 border border-amber-500/30"
      }`}
    >
      {received ? "Recebido" : cancelled ? "Cancelado" : "Pendente"}
    </span>
  );
};

const ReceiptDetailsModal: React.FC<{
  receipt: ReceiptItem;
  onClose: () => void;
  onRegister: () => void;
}> = ({ receipt, onClose, onRegister }) => {
  const received = receipt.status === "received";
  const pending = receipt.status === "pending";

  return (
    <AdminModalV2
      icon={CreditCard}
      eyebrow="Comprovante de Caixa"
      title={receipt.clientName}
      subtitle={receipt.serviceTitle}
      onClose={onClose}
      size="md"
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          <button
            type="button"
            onClick={onClose}
            className="admin-btn-sm admin-btn-secondary"
          >
            Fechar
          </button>
          {pending && (
            <button
              type="button"
              onClick={onRegister}
              className="admin-btn-sm admin-btn-primary"
            >
              <CreditCard className="w-3.5 h-3.5 mr-1" />
              Registrar Pagamento
            </button>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        {/* Cabeçalho do Card de Detalhe */}
        <div className="admin-subcard flex items-center justify-between gap-3">
          <div>
            <span className="text-[10px] font-bold uppercase text-[var(--admin-text-muted)] block tracking-wider">
              Profissional
            </span>
            <p className="text-xs font-semibold text-[var(--admin-text-main)] mt-0.5">
              {receipt.professionalName || "Profissional não informado"}
            </p>
          </div>
          <StatusBadge status={receipt.status} />
        </div>

        {/* Resumo Financeiro Estruturado */}
        <div className="admin-subcard space-y-2.5">
          <AmountRow label="Valor original" value={money(receipt.originalAmount)} />
          {receipt.enteredAmount !== receipt.originalAmount && (
            <AmountRow label="Valor revisado" value={money(receipt.enteredAmount)} />
          )}
          {receipt.discountAmount > 0 && (
            <AmountRow
              label={`Desconto${receipt.discountPercent ? ` (${receipt.discountPercent.toFixed(2)}%)` : ""}`}
              value={`− ${money(receipt.discountAmount)}`}
              tone="negative"
            />
          )}
          {receipt.surchargeAmount > 0 && (
            <AmountRow
              label={`Acréscimo${receipt.surchargePercent ? ` (${receipt.surchargePercent.toFixed(2)}%)` : ""}`}
              value={`+ ${money(receipt.surchargeAmount)}`}
              tone="positive"
            />
          )}

          <div className="pt-2 border-t border-[var(--admin-border)]">
            <AmountRow
              label="Valor Total Final"
              value={money(receipt.totalAmount)}
              strong
              tone={received ? "positive" : undefined}
            />
          </div>
        </div>

        {/* Dados da Liquidação quando recebido */}
        {received && (
          <div className="admin-subcard space-y-2.5">
            <AmountRow
              label="Forma de Pagamento"
              value={paymentLabel[receipt.paymentMethod || "other"]}
            />
            <AmountRow label="Valor Recebido" value={money(receipt.amountReceived)} />
            {receipt.paymentMethod === "cash" && receipt.changeAmount > 0 && (
              <AmountRow
                label="Troco Entregue"
                value={money(receipt.changeAmount)}
                tone="positive"
              />
            )}
            <AmountRow
              label="Data de Liquidação"
              value={
                receipt.receivedAt
                  ? new Date(receipt.receivedAt).toLocaleString("pt-BR")
                  : "—"
              }
            />
          </div>
        )}

        {/* Observações */}
        {receipt.observations && (
          <div className="admin-subcard">
            <span className="text-[10px] font-bold uppercase text-[var(--admin-text-muted)] block tracking-wider mb-1">
              Observações
            </span>
            <p className="text-xs text-[var(--admin-text-main)] leading-relaxed">
              {receipt.observations}
            </p>
          </div>
        )}
      </div>
    </AdminModalV2>
  );
};

const AmountRow: React.FC<{
  label: string;
  value: string;
  tone?: "positive" | "negative";
  strong?: boolean;
}> = ({ label, value, tone, strong }) => (
  <div className="flex justify-between items-center gap-3 text-xs">
    <span className="text-[var(--admin-text-muted)] admin-safe-wrap">{label}</span>
    <strong
      className={`font-mono text-right ${
        strong ? "text-sm font-bold" : "font-semibold"
      } ${
        tone === "positive"
          ? "text-status-success"
          : tone === "negative"
          ? "text-status-error"
          : "text-[var(--admin-text-main)]"
      }`}
    >
      {value}
    </strong>
  </div>
);
