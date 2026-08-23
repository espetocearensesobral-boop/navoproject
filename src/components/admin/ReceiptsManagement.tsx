import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  CreditCard,
  RefreshCw,
  Search,
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
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptItem | null>(
    null,
  );
  const [checkoutReceipt, setCheckoutReceipt] = useState<ReceiptItem | null>(
    null,
  );

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

  const summary = useMemo(() => {
    const pending = receipts.filter((item) => item.status === "pending");
    const received = receipts.filter((item) => item.status === "received");
    return {
      pending,
      received,
      pendingAmount: pending.reduce(
        (total, item) => total + item.totalAmount,
        0,
      ),
    };
  }, [receipts]);

  const visibleReceipts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return receipts.filter((item) => {
      const statusMatch = filter === "all" || item.status === filter;
      const queryMatch =
        !query ||
        [
          item.clientName,
          item.serviceTitle,
          item.professionalName,
          item.clientPhone,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
      return statusMatch && queryMatch;
    });
  }, [filter, receipts, search]);

  const pendingVisible = visibleReceipts.filter(
    (item) => item.status === "pending",
  );
  const historyVisible = visibleReceipts.filter(
    (item) => item.status !== "pending",
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

  const renderReceiptRow = (item: ReceiptItem) => {
    const pending = item.status === "pending";
    const receiptDate = new Date(getReceiptDate(item)).toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    });
    return (
      <React.Fragment key={item.id}>
        {/* DESKTOP TR */}
        <tr className="hidden md:table-row">
          <td>
            <div className="font-bold text-[var(--admin-text-main)] mb-1">
              {item.clientName}
            </div>
            <div className="text-[11px] text-[var(--admin-text-muted)]">
              {receiptDate}
            </div>
          </td>
          <td className="text-[var(--admin-accent)] font-medium">
            {item.serviceTitle}
          </td>
          <td className="text-[var(--admin-text-main)]">
            {item.professionalName || "Profissional não informado"}
          </td>
          <td>
            <div className="flex flex-col gap-1.5">
              <span className={`font-mono font-bold ${pending ? "text-[var(--admin-text-main)]" : "finance-positive"}`}>
                {money(item.totalAmount)}
              </span>
              <div className="flex">
                <StatusBadge status={item.status} />
              </div>
            </div>
          </td>
          <td className="text-right">
            {pending ? (
              <button
                type="button"
                onClick={() => openCheckout(item)}
                className="admin-btn-sm admin-btn-primary whitespace-nowrap"
              >
                <CreditCard className="w-3.5 h-3.5 mr-1" />
                Registrar
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setSelectedReceipt(item)}
                className="text-xs font-bold text-[var(--admin-accent)] hover:underline whitespace-nowrap px-2 py-1"
              >
                Detalhes
              </button>
            )}
          </td>
        </tr>
        {/* MOBILE ARTICLE */}
        <article className="md:hidden p-3.5 sm:p-4 bg-[var(--admin-surface)] transition-colors hover:bg-[var(--admin-bg)]/60">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => setSelectedReceipt(item)}
              className="min-w-0 flex-1 text-left rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-accent)]/70"
              aria-label={`Abrir recebimento de ${item.clientName}`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`w-9 h-9 rounded-lg shrink-0 flex items-center justify-center ${pending ? "bg-amber-500/10 text-amber-500" : "bg-status-success/10 text-status-success"}`}
                >
                  {pending ? (
                    <Clock3 className="w-4 h-4" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-sm font-bold text-[var(--admin-text-main)] admin-clamp-2">
                      {item.clientName}
                    </span>
                    <StatusBadge status={item.status} />
                  </div>
                  <p className="mt-0.5 text-xs text-[var(--admin-text-muted)] admin-clamp-2">
                    {item.serviceTitle}
                  </p>
                  <p className="mt-1 text-[11px] text-[var(--admin-text-muted)] admin-safe-wrap">
                    {item.professionalName || "Profissional não informado"} ·{" "}
                    {receiptDate}
                  </p>
                </div>
              </div>
            </button>

            <div className="shrink-0 min-w-[5.25rem] flex flex-col items-end gap-2">
              <p
                className={`text-sm font-mono font-bold ${pending ? "text-[var(--admin-text-main)]" : "finance-positive"}`}
              >
                {money(item.totalAmount)}
              </p>
              {pending ? (
                <button
                  type="button"
                  onClick={() => openCheckout(item)}
                  className="min-h-9 px-2.5 rounded-lg bg-[var(--admin-accent)] text-[var(--admin-accent-text)] text-xs font-bold inline-flex items-center justify-center gap-1.5 hover:bg-[var(--admin-accent-hover)] active:scale-[0.98] transition-colors"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  Registrar
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setSelectedReceipt(item)}
                  className="min-h-8 px-2 text-xs text-[var(--admin-accent)] font-bold rounded-lg hover:bg-[var(--admin-accent)]/10"
                >
                  Abrir
                </button>
              )}
            </div>
          </div>
        </article>
      </React.Fragment>
    );
  };

  return (
    <div className="space-y-4 animate-fade-in min-w-0">
      <AdminPageHeader
        icon={CircleDollarSign}
        title="Recebimentos"
        stats={[
          {
            label: "Pendente",
            value: money(summary.pendingAmount),
            tone: summary.pendingAmount > 0 ? "warning" : "neutral",
          },
        ]}
        action={{
          label: "Atualizar",
          onClick: loadReceipts,
          icon: RefreshCw,
          disabled: loading,
        }}
      />

      <div className="md:hidden flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-[var(--admin-text-main)]">
            Financeiro
          </p>
          <p className="text-xs text-[var(--admin-text-muted)] admin-safe-wrap">
            {summary.pending.length
              ? `${summary.pending.length} pendência${summary.pending.length === 1 ? "" : "s"} para revisar`
              : "Nenhuma pendência aberta"}
          </p>
        </div>
        <button
          type="button"
          onClick={loadReceipts}
          disabled={loading}
          className="min-h-10 shrink-0 px-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] text-xs font-bold text-[var(--admin-text-muted)] inline-flex items-center gap-1.5 disabled:opacity-50"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
          />
          Atualizar
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-status-error/30 bg-status-error/10 p-3 flex items-center justify-between gap-3 text-sm font-semibold text-status-error">
          <span className="admin-safe-wrap">{error}</span>
          <button
            type="button"
            onClick={loadReceipts}
            className="shrink-0 min-h-9 px-2.5 rounded-lg border border-status-error/30 text-xs font-bold hover:bg-status-error/10"
          >
            Tentar novamente
          </button>
        </div>
      )}

      <div className="admin-card overflow-hidden rounded-xl">
        <div className="p-3.5 sm:p-4 border-b border-[var(--admin-border)] space-y-3">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-serif font-bold text-[var(--admin-text-main)]">
                Fila financeira
              </h2>
              <p className="mt-0.5 text-xs text-[var(--admin-text-muted)] admin-safe-wrap">
                Registre primeiro o que está pendente. O confirmado entra no
                Extrato.
              </p>
            </div>
            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 text-[var(--admin-text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cliente, serviço ou barbeiro"
                aria-label="Buscar recebimentos"
                className="w-full h-10 rounded-xl bg-[var(--admin-bg)] border border-[var(--admin-border)] pl-9 pr-3 text-sm text-[var(--admin-text-main)] placeholder:text-[var(--admin-text-muted)] focus:outline-none focus:border-[var(--admin-accent)] transition-colors"
              />
            </div>
          </div>
          <AdminTabs
            tabs={[
              { id: "all", label: `Todos (${receipts.length})` },
              { id: "pending", label: `Pendentes (${summary.pending.length})` },
              {
                id: "received",
                label: `Recebidos (${summary.received.length})`,
              },
            ]}
            activeId={filter}
            onChange={(id) => setFilter(id as ReceiptFilter)}
          />
        </div>

        {loading ? (
          <AdminListSkeleton rows={5} className="p-4 sm:p-5" />
        ) : visibleReceipts.length === 0 ? (
          <div className="py-12 px-5 text-center">
            <CircleDollarSign className="w-9 h-9 mx-auto text-[var(--admin-text-muted)]/50" />
            <h3 className="mt-3 text-sm font-bold text-[var(--admin-text-main)]">
              Nenhum registro encontrado
            </h3>
            <p className="mt-1 text-xs text-[var(--admin-text-muted)] admin-safe-wrap">
              Ajuste a busca ou troque o filtro para continuar.
            </p>
          </div>
        ) : (
          <div className="p-3 sm:p-4 space-y-3">
            {pendingVisible.length > 0 && (
              <ReceiptGroup
                title="Ação necessária"
                description="Atendimentos concluídos aguardando pagamento."
                count={pendingVisible.length}
                tone="warning"
              >
                {pendingVisible.map(renderReceiptRow)}
              </ReceiptGroup>
            )}
            {historyVisible.length > 0 && (
              <ReceiptGroup
                title="Histórico"
                description="Recebimentos confirmados e registros encerrados."
                count={historyVisible.length}
                tone="success"
              >
                {historyVisible.map(renderReceiptRow)}
              </ReceiptGroup>
            )}
          </div>
        )}
      </div>

      {selectedReceipt && (
        <ReceiptDetailsModal
          receipt={selectedReceipt}
          onClose={() => setSelectedReceipt(null)}
          onRegister={() => openCheckout(selectedReceipt)}
        />
      )}

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

const ReceiptGroup: React.FC<{
  title: string;
  description: string;
  count: number;
  tone: "warning" | "success";
  children: React.ReactNode;
}> = ({ title, description, count, tone, children }) => (
  <section className="mb-6 last:mb-0">
    <header className="flex items-center justify-between gap-3 mb-3 px-1">
      <div className="min-w-0 flex items-center gap-2">
        <span
          className={`h-2.5 w-2.5 rounded-full ${tone === "warning" ? "bg-amber-500" : "bg-status-success"}`}
          aria-hidden="true"
        />
        <h3 className="text-sm font-bold text-[var(--admin-text-main)]">
          {title}
        </h3>
        <span className="shrink-0 bg-[var(--admin-surface)] rounded-full border border-[var(--admin-border)] px-2 py-0.5 text-[10px] font-bold text-[var(--admin-text-muted)]">
          {count}
        </span>
      </div>
    </header>
    <div className="admin-table-container">
      {/* DESKTOP TABLE VIEW */}
      <div className="hidden md:block">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Serviço</th>
              <th>Profissional</th>
              <th>Valor / Status</th>
              <th className="text-right">Ação</th>
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
      {/* MOBILE LIST VIEW */}
      <div className="md:hidden divide-y divide-[var(--admin-border)]">
        {children}
      </div>
    </div>
  </section>
);

const StatusBadge: React.FC<{ status: ReceiptItem["status"] }> = ({
  status,
}) => {
  const received = status === "received";
  const cancelled = status === "cancelled";
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${received ? "bg-status-success/10 text-status-success" : cancelled ? "bg-status-error/10 text-status-error" : "bg-amber-500/10 text-amber-500"}`}
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
      eyebrow="Detalhes"
      title={receipt.clientName}
      subtitle={receipt.serviceTitle}
      onClose={onClose}
      size="md"
      footer={
        <div className="receipt-v2-actions">
          <button
            type="button"
            onClick={onClose}
            className="receipt-v2-secondary"
          >
            Fechar
          </button>
          {pending && (
            <button
              type="button"
              onClick={onRegister}
              className="receipt-v2-primary"
            >
              <CreditCard className="receipt-v2-button-icon" />
              Registrar pagamento
            </button>
          )}
        </div>
      }
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <p className="text-xs text-[var(--admin-text-muted)] admin-safe-wrap">
          {receipt.professionalName || "Profissional não informado"}
        </p>
        <StatusBadge status={receipt.status} />
      </div>

      <div className="receipt-v2-review">
        <AmountRow
          label="Valor original"
          value={money(receipt.originalAmount)}
        />
        <AmountRow
          label="Valor revisado"
          value={money(receipt.enteredAmount)}
        />
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
        <div className="receipt-v2-review-total">
          <AmountRow
            label="Valor total"
            value={money(receipt.totalAmount)}
            strong
            tone={received ? "positive" : undefined}
          />
        </div>
      </div>

      {received && (
        <div className="receipt-v2-review">
          <AmountRow
            label="Pagamento"
            value={paymentLabel[receipt.paymentMethod || "other"]}
          />
          <AmountRow label="Recebido" value={money(receipt.amountReceived)} />
          {receipt.paymentMethod === "cash" && (
            <AmountRow
              label="Troco"
              value={money(receipt.changeAmount)}
              tone="positive"
            />
          )}
          <AmountRow
            label="Confirmado em"
            value={
              receipt.receivedAt
                ? new Date(receipt.receivedAt).toLocaleString("pt-BR")
                : "—"
            }
          />
        </div>
      )}

      {receipt.observations && (
        <div className="receipt-v2-observations">
          <span>Observações</span>
          <p>{receipt.observations}</p>
        </div>
      )}
    </AdminModalV2>
  );
};

const AmountRow: React.FC<{
  label: string;
  value: string;
  tone?: "positive" | "negative";
  strong?: boolean;
}> = ({ label, value, tone, strong }) => (
  <div className="flex justify-between gap-3">
    <span className="text-[var(--admin-text-muted)] admin-safe-wrap">
      {label}
    </span>
    <strong
      className={`text-right ${strong ? "text-base" : ""} ${tone === "positive" ? "finance-positive" : tone === "negative" ? "finance-negative" : "text-[var(--admin-text-main)]"}`}
    >
      {value}
    </strong>
  </div>
);
