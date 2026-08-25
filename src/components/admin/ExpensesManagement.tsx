import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight,
  Edit3,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { AdminPageHeader } from "./shared/AdminPageHeader";
import { AdminFab } from "./shared/AdminFab";
import { handleEnterAsTab } from "../../utils/formUtils";
import {
  deleteCashTransactionInSupabase,
  fetchCashTransactionsFromSupabase,
  saveCashTransactionInSupabase,
  type CashTransactionItem,
} from "../../services/supabaseDataService";
import { getTodayStringBRT } from "../../utils/dateUtils";

const categories = [
  "Fornecedores",
  "Aluguel",
  "Utilidades",
  "Produtos e estoque",
  "Marketing",
  "Comissões",
  "Manutenção",
  "Impostos",
  "Outros",
];
const paymentMethods = [
  { id: "pix", label: "PIX" },
  { id: "credit_card", label: "Cartão de crédito" },
  { id: "debit_card", label: "Cartão de débito" },
  { id: "cash", label: "Dinheiro" },
  { id: "other", label: "Outro" },
];

const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    value || 0,
  );

const createEmptyExpense = (): CashTransactionItem => ({
  id: "",
  type: "expense",
  description: "",
  amount: 0,
  category: "Fornecedores",
  paymentMethod: "pix",
  date: getTodayStringBRT(),
  status: "completed",
  notes: "",
});

export const ExpensesManagement: React.FC = () => {
  const [expenses, setExpenses] = useState<CashTransactionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] =
    useState<CashTransactionItem | null>(null);
  const [form, setForm] = useState<CashTransactionItem>(createEmptyExpense);
  const [amountInput, setAmountInput] = useState<string>("");
  const [modalError, setModalError] = useState<string | null>(null);

  const loadExpenses = async () => {
    setLoading(true);
    setError(null);
    try {
      const transactions = await fetchCashTransactionsFromSupabase({
        strict: true,
      });
      setExpenses(
        transactions.filter(
          (transaction) =>
            transaction.type === "expense" &&
            transaction.status !== "cancelled",
        ),
      );
    } catch (requestError) {
      setExpenses([]);
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Não foi possível carregar as saídas reais.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExpenses();
    const refresh = () => loadExpenses();
    window.addEventListener("adminRefresh", refresh);
    return () => window.removeEventListener("adminRefresh", refresh);
  }, []);

  // Handle ESC key for modal
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isModalOpen) {
        closeModal();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isModalOpen]);

  const visibleExpenses = useMemo(() => {
    const query = search.trim().toLowerCase();
    return expenses.filter(
      (item) =>
        !query ||
        [item.description, item.category, item.paymentMethod, item.notes]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [expenses, search]);

  const totalExpenses = expenses.reduce(
    (total, item) => total + Number(item.amount || 0),
    0,
  );
  const currentMonth = getTodayStringBRT().slice(0, 7);
  const monthlyExpenses = expenses
    .filter((item) => item.date.startsWith(currentMonth))
    .reduce((total, item) => total + Number(item.amount || 0), 0);

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingExpense(null);
    setForm(createEmptyExpense());
    setAmountInput("");
    setModalError(null);
  };

  const openCreate = () => {
    setEditingExpense(null);
    setForm(createEmptyExpense());
    setAmountInput("");
    setModalError(null);
    setIsModalOpen(true);
  };

  const openEdit = (expense: CashTransactionItem) => {
    setEditingExpense(expense);
    setForm({ ...expense, notes: expense.notes || "" });
    setAmountInput(expense.amount ? String(expense.amount) : "");
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setModalError(null);

    const parsedAmount = parseFloat(amountInput.replace(",", "."));

    if (!form.description.trim()) {
      setModalError("Informe a descrição da saída.");
      return;
    }
    if (!form.category.trim()) {
      setModalError("Selecione ou informe uma categoria.");
      return;
    }
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setModalError("Informe um valor válido maior que zero (ex: 45,90).");
      return;
    }

    setSaving(true);
    try {
      const updated = await saveCashTransactionInSupabase(
        {
          ...form,
          id: editingExpense?.id || `tx_expense_${Date.now()}`,
          type: "expense",
          amount: Number(parsedAmount.toFixed(2)),
          description: form.description.trim(),
          category: form.category.trim(),
          paymentMethod: form.paymentMethod || "other",
          date: form.date || getTodayStringBRT(),
          status: "completed",
          notes: form.notes?.trim() || undefined,
        },
        Boolean(editingExpense),
      );
      setExpenses(
        updated.filter(
          (transaction) =>
            transaction.type === "expense" &&
            transaction.status !== "cancelled",
        ),
      );
      window.dispatchEvent(new Event("adminRefresh"));
      closeModal();
    } catch (requestError) {
      setModalError(
        requestError instanceof Error
          ? requestError.message
          : "Não foi possível salvar a saída financeira.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (expense: CashTransactionItem) => {
    if (
      !window.confirm(
        `Excluir a saída “${expense.description}”? Ela será removida do Extrato real.`,
      )
    )
      return;
    try {
      const updated = await deleteCashTransactionInSupabase(expense.id);
      setExpenses(
        updated.filter(
          (transaction) =>
            transaction.type === "expense" &&
            transaction.status !== "cancelled",
        ),
      );
      window.dispatchEvent(new Event("adminRefresh"));
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Não foi possível remover a saída financeira.",
      );
    }
  };

  return (
    <div className="space-y-4 animate-fade-in text-[var(--admin-text-main)] min-w-0">
      <AdminPageHeader
        icon={ArrowDownRight}
        title="Saídas"
        stats={[
          {
            label: "mês atual",
            value: money(monthlyExpenses),
            tone: monthlyExpenses > 0 ? "finance-negative" : "muted",
          },
          { label: "lançamentos", value: expenses.length, tone: "neutral" },
        ]}
      />

      {error && (
        <div className="rounded-xl border border-status-error/30 bg-status-error/10 px-3.5 py-3 text-sm font-semibold text-status-error flex items-center justify-between gap-3">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            aria-label="Fechar aviso"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-xl overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-[var(--admin-border)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-base font-serif font-bold text-[var(--admin-text-main)]">
              Saídas
            </h2>
            <p className="mt-0.5 text-sm text-[var(--admin-text-muted)]">
              Toda saída entra no Extrato e nos Relatórios.
            </p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--admin-text-muted)]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Descrição ou categoria"
              className="w-full h-11 rounded-xl bg-[var(--admin-bg)] border border-[var(--admin-border)] pl-9 pr-3 text-sm text-[var(--admin-text-main)] placeholder:text-[var(--admin-text-muted)] focus:outline-none focus:border-[var(--admin-accent)] transition-colors"
            />
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm text-[var(--admin-text-muted)]">
            <RefreshCw className="w-4 h-4 inline animate-spin mr-2" />
            Carregando saídas…
          </div>
        ) : visibleExpenses.length === 0 ? (
          <div className="py-16 px-5 text-center">
            <ArrowDownRight className="w-10 h-10 mx-auto text-[var(--admin-text-muted)]/50" />
            <h3 className="mt-3 text-base font-bold text-[var(--admin-text-main)]">
              Nenhuma saída registrada
            </h3>
            <p className="mt-1 text-sm text-[var(--admin-text-muted)]">
              Use “Nova saída” para registrar uma despesa.
            </p>
          </div>
        ) : (
          <>
            {/* DESKTOP TABLE VIEW */}
            <div className="hidden md:block admin-table-container border-0 rounded-none border-t border-[var(--admin-border)]">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Descrição</th>
                    <th>Categoria</th>
                    <th>Método</th>
                    <th className="text-right">Valor</th>
                    <th className="text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleExpenses.map((expense) => (
                    <tr key={expense.id}>
                      <td className="whitespace-nowrap text-[var(--admin-text-muted)]">
                        {expense.date.split("-").reverse().join("/")}
                      </td>
                      <td>
                        <div className="flex items-center gap-3">
                           <span className="w-8 h-8 shrink-0 rounded-lg bg-status-error/10 text-status-error flex items-center justify-center">
                             <ArrowDownRight className="w-4 h-4" />
                           </span>
                           <div>
                             <p className="font-bold text-[var(--admin-text-main)] truncate max-w-[200px]" title={expense.description}>
                               {expense.description}
                             </p>
                             {expense.notes && (
                               <p className="text-[10px] text-[var(--admin-text-muted)] truncate max-w-[200px]" title={expense.notes}>
                                 {expense.notes}
                               </p>
                             )}
                           </div>
                        </div>
                      </td>
                      <td>
                        <span className="px-2 py-0.5 rounded text-xs font-bold bg-[var(--admin-bg)] border border-[var(--admin-border)] text-[var(--admin-text-muted)]">
                          {expense.category}
                        </span>
                      </td>
                      <td className="text-[var(--admin-text-muted)]">
                        {paymentMethods.find(m => m.id === expense.paymentMethod)?.label || expense.paymentMethod}
                      </td>
                      <td className="text-right font-mono font-bold finance-negative whitespace-nowrap">
                        - {money(Number(expense.amount))}
                      </td>
                      <td>
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(expense)}
                            className="admin-btn-icon-sm rounded text-[var(--admin-text-muted)] hover:text-[var(--admin-accent)] hover:bg-[var(--admin-accent)]/10"
                            aria-label={`Editar ${expense.description}`}
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(expense)}
                            className="admin-btn-icon-sm rounded text-[var(--admin-text-muted)] hover:text-status-error hover:bg-status-error/10"
                            aria-label={`Excluir ${expense.description}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* MOBILE LIST VIEW */}
            <div className="md:hidden divide-y divide-[var(--admin-border)]">
              {visibleExpenses.map((expense) => (
                <article
                  key={expense.id}
                  className="p-4 sm:px-5 flex items-start gap-3"
                >
                  <span className="w-10 h-10 shrink-0 rounded-xl bg-status-error/10 text-status-error flex items-center justify-center">
                    <ArrowDownRight className="w-5 h-5" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <h3 className="text-sm font-bold text-[var(--admin-text-main)] admin-clamp-2">
                        {expense.description}
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[var(--admin-surface)] border border-[var(--admin-border)] text-[var(--admin-text-muted)] admin-safe-wrap">
                        {expense.category}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[var(--admin-text-muted)]">
                      {expense.date.split("-").reverse().join("/")} ·{" "}
                      {paymentMethods.find(
                        (method) => method.id === expense.paymentMethod,
                      )?.label || expense.paymentMethod}
                    </p>
                    {expense.notes && (
                      <p className="mt-1 text-xs text-[var(--admin-text-muted)] admin-clamp-2">
                        {expense.notes}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-mono font-bold finance-negative">
                      - {money(Number(expense.amount))}
                    </p>
                    <div className="mt-2 flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(expense)}
                        className="w-8 h-8 rounded-lg border border-[var(--admin-border)] text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] flex items-center justify-center"
                        aria-label={`Editar ${expense.description}`}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(expense)}
                        className="w-8 h-8 rounded-lg border border-status-error/25 text-status-error flex items-center justify-center"
                        aria-label={`Excluir ${expense.description}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </div>

      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="expense-modal-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto"
        >
          <div className="w-full sm:max-w-lg max-h-[92dvh] flex flex-col rounded-t-3xl sm:rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-2xl overflow-hidden pb-[calc(0.5rem+env(safe-area-inset-bottom))] animate-modal-enter">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-[var(--admin-border)] flex items-center justify-between gap-3 shrink-0 bg-[var(--admin-surface)]">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--admin-accent)]">
                  Livro-caixa / Despesas
                </p>
                <h2
                  id="expense-modal-title"
                  className="mt-0.5 text-base font-serif font-bold text-[var(--admin-text-main)] sm:text-lg"
                >
                  {editingExpense ? "Editar saída" : "Nova saída"}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="w-9 h-9 rounded-xl text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] hover:bg-[var(--admin-bg)] flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Fechar formulário"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
              {modalError && (
                <div className="rounded-xl border border-status-error/30 bg-status-error/10 p-3 text-xs sm:text-sm font-semibold text-status-error flex items-start justify-between gap-2 animate-fade-in">
                  <span>{modalError}</span>
                  <button
                    type="button"
                    onClick={() => setModalError(null)}
                    className="text-status-error/80 hover:text-status-error shrink-0"
                    aria-label="Fechar mensagem de erro"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              <form
                id="expense-form"
                onSubmit={handleSave}
                onKeyDown={handleEnterAsTab}
                className="space-y-3.5"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="sm:col-span-2 block">
                    <span className="text-xs font-semibold text-[var(--admin-text-muted)] block mb-1">
                      Descrição *
                    </span>
                    <input
                      required
                      autoFocus
                      value={form.description}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          description: event.target.value,
                        }))
                      }
                      placeholder="Ex.: Produtos para revenda, Aluguel, Conta de luz"
                      className="w-full h-10 rounded-xl bg-[var(--admin-bg)] border border-[var(--admin-border)] px-3 text-xs sm:text-sm text-[var(--admin-text-main)] placeholder:text-[var(--admin-text-muted)] focus:outline-none focus:border-[var(--admin-accent)] transition-colors"
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs font-semibold text-[var(--admin-text-muted)] block mb-1">
                      Categoria *
                    </span>
                    <select
                      value={form.category}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          category: event.target.value,
                        }))
                      }
                      className="w-full h-10 rounded-xl bg-[var(--admin-bg)] border border-[var(--admin-border)] px-3 text-xs sm:text-sm text-[var(--admin-text-main)] focus:outline-none focus:border-[var(--admin-accent)] transition-colors"
                    >
                      {categories.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="text-xs font-semibold text-[var(--admin-text-muted)] block mb-1">
                      Data do lançamento *
                    </span>
                    <input
                      required
                      type="date"
                      value={form.date}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          date: event.target.value,
                        }))
                      }
                      className="w-full h-10 rounded-xl bg-[var(--admin-bg)] border border-[var(--admin-border)] px-3 text-xs sm:text-sm text-[var(--admin-text-main)] focus:outline-none focus:border-[var(--admin-accent)] transition-colors"
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs font-semibold text-[var(--admin-text-muted)] block mb-1">
                      Valor (R$) *
                    </span>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[var(--admin-text-muted)]">
                        R$
                      </span>
                      <input
                        required
                        type="text"
                        inputMode="decimal"
                        value={amountInput}
                        onChange={(event) => setAmountInput(event.target.value)}
                        placeholder="0,00"
                        className="w-full h-10 rounded-xl bg-[var(--admin-bg)] border border-[var(--admin-border)] pl-9 pr-3 text-xs sm:text-sm font-mono font-bold text-status-error placeholder:text-[var(--admin-text-muted)] focus:outline-none focus:border-[var(--admin-accent)] transition-colors"
                      />
                    </div>
                  </label>

                  <label className="block">
                    <span className="text-xs font-semibold text-[var(--admin-text-muted)] block mb-1">
                      Forma de pagamento
                    </span>
                    <select
                      value={form.paymentMethod}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          paymentMethod: event.target.value,
                        }))
                      }
                      className="w-full h-10 rounded-xl bg-[var(--admin-bg)] border border-[var(--admin-border)] px-3 text-xs sm:text-sm text-[var(--admin-text-main)] focus:outline-none focus:border-[var(--admin-accent)] transition-colors"
                    >
                      {paymentMethods.map((method) => (
                        <option key={method.id} value={method.id}>
                          {method.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="sm:col-span-2 block">
                    <span className="text-xs font-semibold text-[var(--admin-text-muted)] block mb-1">
                      Observações / Justificativa
                    </span>
                    <textarea
                      rows={2}
                      value={form.notes || ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          notes: event.target.value,
                        }))
                      }
                      placeholder="Observações complementares (opcional)"
                      className="w-full rounded-xl bg-[var(--admin-bg)] border border-[var(--admin-border)] px-3 py-2 text-xs sm:text-sm text-[var(--admin-text-main)] placeholder:text-[var(--admin-text-muted)] resize-none focus:outline-none focus:border-[var(--admin-accent)] transition-colors"
                    />
                  </label>
                </div>
              </form>
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 border-t border-[var(--admin-border)] flex flex-col-reverse sm:flex-row sm:justify-end gap-2 bg-[var(--admin-surface)] shrink-0">
              <button
                type="button"
                onClick={closeModal}
                className="admin-btn admin-btn-secondary w-full sm:w-auto h-10 px-4 text-xs font-bold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="expense-form"
                disabled={saving}
                className="admin-btn admin-btn-primary w-full sm:w-auto h-10 px-5 text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                {saving ? "Salvando..." : "Salvar saída"}
              </button>
            </div>
          </div>
        </div>
      )}

      <AdminFab
        onClick={openCreate}
        label="Nova Saída"
        icon={Plus}
      />
    </div>
  );
};
