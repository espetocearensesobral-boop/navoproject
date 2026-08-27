import React, { useEffect, useState } from"react";
import {
 DollarSign,
 ArrowUpRight,
 ArrowDownRight,
 Download,
 Search,
 Filter,
 Calendar,
 FileText,
 CheckCircle2,
 Clock,
 PieChart,
} from"lucide-react";
import { AdminPageHeader } from"./shared/AdminPageHeader";
import { AdminListSkeleton, AdminSkeleton } from"./shared/AdminSkeleton";
import { fetchCashTransactionsFromSupabase } from"../../services/supabaseDataService";
import { getTodayStringBRT } from"../../utils/dateUtils";

export interface FinancialTransaction {
 id: string;
 type:"income"|"expense";
 category: string;
 description: string;
 amount: number;
 paymentMethod: string;
 date: string;
 operatorName: string;
 status?:"completed"|"pending"|"cancelled";
}

export const FinancialStatementManagement: React.FC = () => {
 const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);

 const loadTransactions = async () => {
 setLoading(true);
 setError(null);
 try {
 const data = await fetchCashTransactionsFromSupabase({ strict: true });
 setTransactions(
 data.map((transaction) => ({
 id: transaction.id,
 type: transaction.type,
 category: transaction.category,
 description: transaction.description,
 amount: Number(transaction.amount || 0),
 paymentMethod: transaction.paymentMethod,
 date: transaction.date,
 operatorName: transaction.professionalName ||"Sistema",
 status: transaction.status,
 })),
 );
 } catch (err: any) {
 setTransactions([]);
 setError(err?.message ||"Não foi possível carregar o extrato real.");
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 loadTransactions();
 const handleRefresh = () => loadTransactions();
 window.addEventListener("adminRefresh", handleRefresh);
 return () => window.removeEventListener("adminRefresh", handleRefresh);
 }, []);

 const formatTransactionDate = (value: string) => {
 if (/^\d{4}-\d{2}-\d{2}$/.test(value))
 return value.split("-").reverse().join("/");
 return new Date(value).toLocaleString("pt-BR");
 };

 const [filterType, setFilterType] = useState<"all"|"income"|"expense">(
"all",
 );
 const [filterStatus, setFilterStatus] = useState<
"all"|"completed"|"pending"
 >("all");
 const [periodFilter, setPeriodFilter] = useState<
"today"|"week"|"month"|"all"
 >("month");
 const [search, setSearch] = useState("");

 const today = getTodayStringBRT();
 const getPeriodStart = () => {
 if (periodFilter ==="all") return"";
 if (periodFilter ==="today") return today;
 const date = new Date(`${today}T12:00:00`);
 if (periodFilter ==="week") date.setDate(date.getDate() - 6);
 if (periodFilter ==="month") date.setDate(1);
 return date.toISOString().slice(0, 10);
 };
 const periodStart = getPeriodStart();
 const visibleTransactions = transactions.filter(
 (transaction) =>
 transaction.status !=="cancelled"&&
 (!periodStart || transaction.date >= periodStart),
 );
 const settledTransactions = visibleTransactions.filter(
 (transaction) => transaction.status ==="completed",
 );
 const pendingTransactions = visibleTransactions.filter(
 (transaction) => transaction.status ==="pending",
 );
 const totalIncomes = settledTransactions
 .filter((transaction) => transaction.type ==="income")
 .reduce((total, transaction) => total + transaction.amount, 0);
 const totalExpenses = settledTransactions
 .filter((transaction) => transaction.type ==="expense")
 .reduce((total, transaction) => total + transaction.amount, 0);
 const netBalance = totalIncomes - totalExpenses;

 const filtered = visibleTransactions.filter((transaction) => {
 const matchesType = filterType ==="all"|| transaction.type === filterType;
 const matchesStatus =
 filterStatus ==="all"|| transaction.status === filterStatus;
 const term = search.toLowerCase();
 const matchesSearch =
 transaction.description.toLowerCase().includes(term) ||
 transaction.category.toLowerCase().includes(term) ||
 transaction.paymentMethod.toLowerCase().includes(term);
 return matchesType && matchesStatus && matchesSearch;
 });

 const handleExportCsv = () => {
 const csv =
"Data,Status,Tipo,Categoria,Descrição,Valor,Forma Pagamento\n"+
 filtered
 .map(
 (t) =>
 `"${formatTransactionDate(t.date)}","${t.status ||"completed"}","${t.type}","${t.category}","${t.description}",${t.amount},"${t.paymentMethod}"`,
 )
 .join("\n");
 const blob = new Blob([csv], { type:"text/csv;charset=utf-8;"});
 const url = URL.createObjectURL(blob);
 const a = document.createElement("a");
 a.href = url;
 a.download = `extrato_financeiro_${getTodayStringBRT()}.csv`;
 a.click();
 };

 return (
 <div className="space-y-4 animate-fade-in text-[var(--admin-text-main)] min-w-0">
 {/* Header (desktop) */}
 <AdminPageHeader
 icon={DollarSign}
 title="Extrato financeiro"
 action={{
 label:"Baixar CSV",
 onClick: handleExportCsv,
 icon: Download,
 }}
 />

 {/* Ação (mobile) */}
 <button
 onClick={handleExportCsv}
 className="md:hidden w-full bg-[var(--admin-bg)] border border-[var(--admin-border)] hover:border-[var(--admin-accent)]/50 text-[var(--admin-text-main)] px-3 py-2.5 rounded-[var(--admin-radius-lg)] text-xs font-bold flex items-center justify-center gap-2 transition-all shrink-0"
 >
 <Download className="w-4 h-4 text-[var(--admin-accent)]"/>
 <span>Baixar CSV</span>
 </button>

 {loading && (
 <AdminSkeleton
 className="h-11 rounded-[var(--admin-radius-lg)]"
 label="Carregando lançamentos"
 />
 )}
 {error && (
 <div className="p-3 rounded-[var(--admin-radius-lg)] border border-status-error/30 bg-status-error/10 text-status-error text-xs font-semibold flex items-center justify-between gap-3">
 <span>{error}</span>
 <button
 type="button"
 onClick={loadTransactions}
 className="shrink-0 underline"
 >
 Tentar novamente
 </button>
 </div>
 )}

 {/* Metrics Cards */}
 <div
 className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
 aria-busy={loading}
 >
 <div className="p-3 bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-[var(--admin-radius-xl)] flex flex-col justify-between">
 <div className="flex items-center justify-between text-status-success mb-1">
 <span className="text-xs font-bold uppercase tracking-wider admin-safe-wrap">
 Entradas
 </span>
 <div className="w-6 h-6 rounded-[var(--admin-radius-md)] bg-status-success/10 flex items-center justify-center shrink-0">
 <ArrowUpRight className="w-3.5 h-3.5"/>
 </div>
 </div>
 <p className="text-lg font-black finance-positive tabular-nums truncate">
 + R$ {totalIncomes.toFixed(2)}
 </p>
 <p className="text-xs text-[var(--admin-text-muted)] mt-1 font-medium admin-safe-wrap">
 Lançamentos confirmados
 </p>
 </div>

 <div className="p-3 bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-[var(--admin-radius-xl)] flex flex-col justify-between">
 <div className="flex items-center justify-between text-status-error mb-1">
 <span className="text-xs font-bold uppercase tracking-wider admin-safe-wrap">
 Saídas
 </span>
 <div className="w-6 h-6 rounded-[var(--admin-radius-md)] bg-status-error/10 flex items-center justify-center shrink-0">
 <ArrowDownRight className="w-3.5 h-3.5"/>
 </div>
 </div>
 <p className="text-lg font-black finance-negative tabular-nums truncate">
 - R$ {totalExpenses.toFixed(2)}
 </p>
 <p className="text-xs text-[var(--admin-text-muted)] mt-1 font-medium admin-safe-wrap">
 Saídas confirmadas
 </p>
 </div>

 <div className="p-3 bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-[var(--admin-radius-xl)] flex flex-col justify-between">
 <div className="flex items-center justify-between text-[var(--admin-accent)] mb-1">
 <span className="text-xs font-bold uppercase tracking-wider admin-safe-wrap">
 Resultado
 </span>
 <div className="w-6 h-6 rounded-[var(--admin-radius-md)] bg-[var(--admin-accent)]/10 flex items-center justify-center shrink-0">
 <PieChart className="w-3.5 h-3.5"/>
 </div>
 </div>
 <p
 className={`text-lg font-black tabular-nums truncate ${netBalance >= 0 ?"finance-positive":"finance-negative"}`}
 >
 R$ {netBalance.toFixed(2)}
 </p>
 <p className="text-xs text-[var(--admin-text-muted)] mt-1 font-medium admin-safe-wrap">
 Saldo confirmado
 </p>
 </div>

 <div className="p-3 bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-[var(--admin-radius-xl)] flex flex-col justify-between">
 <div className="flex items-center justify-between text-amber-500 mb-1">
 <span className="text-xs font-bold uppercase tracking-wider admin-safe-wrap">
 Pendentes
 </span>
 <div className="w-6 h-6 rounded-[var(--admin-radius-md)] bg-status-warning/10 flex items-center justify-center shrink-0">
 <Clock className="w-3.5 h-3.5"/>
 </div>
 </div>
 <p className="text-lg font-black text-[var(--admin-text-main)] tabular-nums truncate">
 {pendingTransactions.length}
 </p>
 <p className="text-xs text-[var(--admin-text-muted)] mt-1 font-medium admin-safe-wrap">
 Não entram no resultado
 </p>
 </div>
 </div>

 {/* Busca e filtros do mesmo livro-caixa consultado pelos Relatórios */}
 <div className="space-y-2.5">
 <div className="flex flex-col sm:flex-row gap-3">
 <div className="relative flex-1">
 <Search className="w-4 h-4 text-[var(--admin-text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2"/>
 <input
 type="text"
 placeholder="Buscar lançamentos..."
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 className="w-full bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-[var(--admin-radius-lg)] pl-10 pr-4 py-2.5 text-xs text-[var(--admin-text-main)] focus:outline-none focus:ring-1 focus:ring-[var(--admin-accent)]/50 placeholder:text-[var(--admin-text-muted)]"
 />
 </div>
 <div
 data-gesture-scroll="horizontal"
 className="admin-category-scroll flex bg-[var(--admin-surface)] p-1 rounded-[var(--admin-radius-lg)] border border-[var(--admin-border)] shrink-0 overflow-x-auto no-scrollbar"
 >
 {[
 { id:"today", label:"Hoje"},
 { id:"week", label:"7 dias"},
 { id:"month", label:"Mês"},
 { id:"all", label:"Tudo"},
 ].map((item) => (
 <button
 key={item.id}
 onClick={() => setPeriodFilter(item.id as typeof periodFilter)}
 className={`shrink-0 px-3 py-1.5 rounded-[var(--admin-radius-md)] text-xs font-bold transition-all ${periodFilter === item.id ?"bg-[var(--admin-accent)] text-[var(--admin-accent-text)] shadow-xs":"text-[var(--admin-text-muted)]"}`}
 >
 {item.label}
 </button>
 ))}
 </div>
 </div>
 <div
 data-gesture-scroll="horizontal"
 className="admin-category-scroll flex gap-2 overflow-x-auto no-scrollbar pb-1"
 >
 {[
 { id:"all", label:"Todos"},
 { id:"income", label:"Entradas"},
 { id:"expense", label:"Saídas"},
 ].map((item) => (
 <button
 key={item.id}
 onClick={() => setFilterType(item.id as typeof filterType)}
 className={`shrink-0 h-9 px-3.5 rounded-[var(--admin-radius-full)] border text-xs font-bold transition-colors ${filterType === item.id ?"bg-[var(--admin-accent)] border-[var(--admin-accent)] text-[var(--admin-accent-text)]":"bg-[var(--admin-surface)] border-[var(--admin-border)] text-[var(--admin-text-muted)]"}`}
 >
 {item.label}
 </button>
 ))}
 {[
 { id:"completed", label:"Confirmados"},
 { id:"pending", label:"Pendentes"},
 ].map((item) => (
 <button
 key={item.id}
 onClick={() =>
 setFilterStatus(
 filterStatus === item.id
 ?"all"
 : (item.id as typeof filterStatus),
 )
 }
 className={`shrink-0 h-9 px-3.5 rounded-[var(--admin-radius-full)] border text-xs font-bold transition-colors ${filterStatus === item.id ?"bg-amber-500 border-amber-500 text-amber-950":"bg-[var(--admin-surface)] border-[var(--admin-border)] text-[var(--admin-text-muted)]"}`}
 >
 {item.label}
 </button>
 ))}
 </div>
 </div>

 {/* Transaction Table */}
 <div className="bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-[var(--admin-radius-xl)] overflow-hidden shadow-xs">
 {loading ? (
 <AdminListSkeleton rows={6} className="p-4 sm:p-5"/>
 ) : (
 <div className="admin-table-container">
 <table className="admin-table">
 <thead>
 <tr>
 <th>Data / Hora</th>
 <th>Status</th>
 <th>Tipo</th>
 <th>Categoria</th>
 <th>Descrição</th>
 <th>Forma Pagto</th>
 <th className="text-right">Valor R$</th>
 </tr>
 </thead>
 <tbody>
 {filtered.map((t) => (
 <tr key={t.id}>
 <td className="font-mono text-[var(--admin-text-muted)] whitespace-nowrap">
 {formatTransactionDate(t.date)}
 </td>
 <td className="whitespace-nowrap">
 <span
 className={`font-bold text-xs px-2 py-0.5 rounded-[var(--admin-radius-lg)] uppercase ${t.status ==="pending"?"bg-status-warning/10 text-amber-500":"bg-status-success/15 text-status-success"}`}
 >
 {t.status ==="pending"?"Pendente":"Confirmado"}
 </span>
 </td>
 <td className="whitespace-nowrap">
 {t.type ==="income"? (
 <span className="bg-status-success/15 text-status-success font-bold text-xs px-2 py-0.5 rounded-[var(--admin-radius-lg)] uppercase inline-flex items-center gap-1">
 <ArrowUpRight className="w-3 h-3"/>
 Entrada
 </span>
 ) : (
 <span className="bg-status-error/15 text-status-error font-bold text-xs px-2 py-0.5 rounded-[var(--admin-radius-lg)] uppercase inline-flex items-center gap-1">
 <ArrowDownRight className="w-3 h-3"/>
 Saída
 </span>
 )}
 </td>
 <td className="font-semibold text-[var(--admin-text-muted)] admin-safe-wrap">
 {t.category}
 </td>
 <td className="font-bold text-[var(--admin-text-main)] admin-safe-wrap">
 {t.description}
 </td>
 <td className="font-mono text-[var(--admin-text-muted)]">
 {t.paymentMethod}
 </td>
 <td
 className={`text-right font-bold tabular-nums whitespace-nowrap ${
 t.type ==="income"
 ?"finance-positive"
 :"finance-negative"
 }`}
 >
 {t.type ==="income"?"+":"-"} R$ {t.amount.toFixed(2)}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}
 </div>
 </div>
 );
};
