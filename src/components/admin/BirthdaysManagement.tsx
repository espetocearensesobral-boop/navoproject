import React, { useEffect, useState } from"react";
import {
 Cake,
 Mail,
 Phone,
 Search,
 RefreshCw,
 CalendarDays,
 Gift,
} from"lucide-react";
import { authFetch } from"../../lib/api";
import { AdminPageHeader } from"./shared/AdminPageHeader";

interface BirthdayClient {
 id: string;
 name: string;
 email: string;
 phone: string;
 birthday: string;
 month: number;
 day: number;
 daysUntil: number;
 age: number | null;
 lastVisit: string | null;
 hasEmail: boolean;
 hasPhone: boolean;
 loyaltyTier: string;
}

interface BirthdayResponse {
 summary: {
 totalWithBirthday: number;
 shown: number;
 currentMonth: number;
 next7Days: number;
 next30Days: number;
 withoutEmail: number;
 };
 monthlyDistribution: { month: number; count: number }[];
 clients: BirthdayClient[];
}

const monthLabels = [
"Jan",
"Fev",
"Mar",
"Abr",
"Mai",
"Jun",
"Jul",
"Ago",
"Set",
"Out",
"Nov",
"Dez",
];
const fullMonthLabels = [
"Janeiro",
"Fevereiro",
"Março",
"Abril",
"Maio",
"Junho",
"Julho",
"Agosto",
"Setembro",
"Outubro",
"Novembro",
"Dezembro",
];
const formatDate = (value: string) =>
 new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR");
const whatsappUrl = (phone: string) =>
 `https://wa.me/55${phone.replace(/\D/g,"")}`;

export const BirthdaysManagement: React.FC = () => {
 const [period, setPeriod] = useState("current");
 const [tier, setTier] = useState("all");
 const [search, setSearch] = useState("");
 const [data, setData] = useState<BirthdayResponse | null>(null);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);

 const load = async () => {
 setLoading(true);
 setError(null);
 try {
 const params = new URLSearchParams({ month: period, tier });
 if (search.trim()) params.set("search", search.trim());
 const res = await authFetch(
 `/api/relationship/birthdays?${params.toString()}`,
 );
 const body = await res.json().catch(() => ({}));
 if (!res.ok)
 throw new Error(
 body.error ||"Não foi possível carregar aniversariantes.",
 );
 setData(body);
 } catch (err: any) {
 setError(err.message ||"Não foi possível carregar aniversariantes.");
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 load();
 }, [period, tier]);

 const summary = data?.summary || {
 totalWithBirthday: 0,
 shown: 0,
 currentMonth: 0,
 next7Days: 0,
 next30Days: 0,
 withoutEmail: 0,
 };
 const clients = data?.clients || [];
 const distribution = data?.monthlyDistribution || [];

 return (
 <div className="space-y-4 animate-in fade-in duration-300 min-w-0">
 <AdminPageHeader
 icon={Cake}
 title="Aniversariantes"
 stats={[
 { label:"este mês", value: summary.currentMonth, tone:"gold"},
 {
 label:"próximos 7 dias",
 value: summary.next7Days,
 tone:"warning",
 },
 {
 label:"com aniversário",
 value: summary.totalWithBirthday,
 tone:"info",
 },
 ]}
 action={{ label:"Atualizar", onClick: load }}
 />

 <div className="bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-[var(--admin-radius-lg)] p-3 space-y-3">
 <div className="flex flex-col sm:flex-row gap-2">
 <div className="relative flex-1 min-w-0">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--admin-text-muted)]"/>
 <input
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 onKeyDown={(e) => e.key ==="Enter"&& load()}
 placeholder="Nome do cliente..."
 className="w-full h-11 bg-[var(--admin-bg)] border border-[var(--admin-border)] rounded-[var(--admin-radius-lg)] pl-9 pr-3 text-sm text-[var(--admin-text-main)] focus:outline-none focus:border-[var(--admin-accent)]"
 />
 </div>
 <button
 type="button"
 onClick={load}
 className="h-11 px-4 rounded-[var(--admin-radius-lg)] bg-[var(--admin-accent)] text-[var(--admin-accent-text)] text-xs font-bold flex items-center justify-center gap-2"
 >
 <RefreshCw className={`w-4 h-4 ${loading ?"animate-spin":""}`} />{""}
 Atualizar
 </button>
 </div>
 <div
 data-gesture-scroll="horizontal"
 className="flex gap-2 overflow-x-auto no-scrollbar py-1"
 >
 <button
 type="button"
 onClick={() => setPeriod("current")}
 className={`shrink-0 min-h-10 px-4 rounded-[var(--admin-radius-lg)] border text-sm font-semibold ${period ==="current"?"bg-[var(--admin-accent)] text-[var(--admin-accent-text)] border-[var(--admin-accent)]":"bg-[var(--admin-bg)] text-[var(--admin-text-muted)] border-[var(--admin-border)]"}`}
 >
 Este mês
 </button>
 <button
 type="button"
 onClick={() => setPeriod("upcoming")}
 className={`shrink-0 min-h-10 px-4 rounded-[var(--admin-radius-lg)] border text-sm font-semibold ${period ==="upcoming"?"bg-[var(--admin-accent)] text-[var(--admin-accent-text)] border-[var(--admin-accent)]":"bg-[var(--admin-bg)] text-[var(--admin-text-muted)] border-[var(--admin-border)]"}`}
 >
 30 dias
 </button>
 <button
 type="button"
 onClick={() => setPeriod("all")}
 className={`shrink-0 min-h-10 px-4 rounded-[var(--admin-radius-lg)] border text-sm font-semibold ${period ==="all"?"bg-[var(--admin-accent)] text-[var(--admin-accent-text)] border-[var(--admin-accent)]":"bg-[var(--admin-bg)] text-[var(--admin-text-muted)] border-[var(--admin-border)]"}`}
 >
 Ano inteiro
 </button>
 {fullMonthLabels.map((label, index) => (
 <button
 key={label}
 type="button"
 onClick={() => setPeriod(String(index + 1))}
 className={`shrink-0 min-h-10 px-3 rounded-[var(--admin-radius-lg)] border text-sm font-semibold ${period === String(index + 1) ?"bg-[var(--admin-accent)] text-[var(--admin-accent-text)] border-[var(--admin-accent)]":"bg-[var(--admin-bg)] text-[var(--admin-text-muted)] border-[var(--admin-border)]"}`}
 >
 {label}
 </button>
 ))}
 </div>
 <div
 data-gesture-scroll="horizontal"
 className="flex gap-2 overflow-x-auto no-scrollbar py-1"
 >
 {["all","Bronze","Prata","Ouro","Diamante"].map((value) => (
 <button
 key={value}
 type="button"
 onClick={() => setTier(value)}
 className={`shrink-0 min-h-9 px-3 rounded-[var(--admin-radius-lg)] border text-xs font-semibold ${tier === value ?"bg-[var(--admin-surface)] border-[var(--admin-accent)] text-[var(--admin-accent)]":"bg-[var(--admin-bg)] border-[var(--admin-border)] text-[var(--admin-text-muted)]"}`}
 >
 {value ==="all"?"Todos": value}
 </button>
 ))}
 </div>
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
 <div className="bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-[var(--admin-radius-lg)] p-3">
 <p className="text-xs uppercase tracking-wider text-[var(--admin-text-muted)]">
 30 dias
 </p>
 <p className="text-xl font-black text-[var(--admin-text-main)] mt-1">
 {summary.next30Days}
 </p>
 </div>
 <div className="bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-[var(--admin-radius-lg)] p-3">
 <p className="text-xs uppercase tracking-wider text-[var(--admin-text-muted)]">
 Sem e-mail
 </p>
 <p className="text-xl font-black text-status-warning mt-1">
 {summary.withoutEmail}
 </p>
 </div>
 <div className="bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-[var(--admin-radius-lg)] p-3">
 <p className="text-xs uppercase tracking-wider text-[var(--admin-text-muted)]">
 Exibidos
 </p>
 <p className="text-xl font-black text-[var(--admin-accent)] mt-1">
 {summary.shown}
 </p>
 </div>
 <div className="bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-[var(--admin-radius-lg)] p-3">
 <p className="text-xs uppercase tracking-wider text-[var(--admin-text-muted)]">
 Base
 </p>
 <p className="text-xl font-black text-[var(--admin-text-main)] mt-1">
 {summary.totalWithBirthday}
 </p>
 </div>
 </div>

 <div className="bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-[var(--admin-radius-lg)] p-4">
 <div className="flex items-center gap-2 mb-3">
 <CalendarDays className="w-4 h-4 text-[var(--admin-accent)]"/>
 <h2 className="text-sm font-bold text-[var(--admin-text-main)]">
 Distribuição anual
 </h2>
 </div>
 <div className="grid grid-cols-6 sm:grid-cols-12 gap-2 items-end">
 {distribution.map((item) => {
 const max = Math.max(
 1,
 ...distribution.map((month) => month.count),
 );
 return (
 <div key={item.month} className="text-center space-y-1">
 <div className="h-16 flex items-end justify-center">
 <div
 className="w-full max-w-6 rounded-t-[var(--admin-radius-sm)] bg-[var(--admin-accent)]/70"
 style={{
 height: `${Math.max(8, (item.count / max) * 100)}%`,
 }}
 />
 </div>
 <p className="text-xs text-[var(--admin-text-muted)]">
 {monthLabels[item.month - 1]}
 </p>
 <p className="text-xs font-bold text-[var(--admin-text-main)]">
 {item.count}
 </p>
 </div>
 );
 })}
 </div>
 </div>

 {error && (
 <div className="p-3 rounded-[var(--admin-radius-lg)] bg-status-error/10 border border-status-error/30 text-status-error text-sm font-semibold">
 {error}
 </div>
 )}
 {loading ? (
 <div className="py-16 flex justify-center">
 <div className="w-7 h-7 border-2 border-[var(--admin-accent)] border-t-transparent rounded-[var(--admin-radius-full)] animate-spin"/>
 </div>
 ) : clients.length === 0 ? (
 <div className="bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-[var(--admin-radius-xl)] p-10 text-center space-y-2">
 <Gift className="w-10 h-10 text-[var(--admin-text-muted)] mx-auto"/>
 <h3 className="text-base font-bold text-[var(--admin-text-main)]">
 Nenhum aniversariante
 </h3>
 <p className="text-sm text-[var(--admin-text-muted)]">
 Cadastre o aniversário do cliente.
 </p>
 </div>
 ) : (
 <div className="bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-[var(--admin-radius-lg)] overflow-hidden">
 <div className="px-4 py-3 border-b border-[var(--admin-border)] flex items-center justify-between gap-3">
 <div>
 <p className="text-sm font-bold text-[var(--admin-text-main)]">
 Aniversariantes
 </p>
 <p className="text-xs text-[var(--admin-text-muted)]">
 Use contato manual até ativar automações.
 </p>
 </div>
 <span className="text-xs font-bold text-[var(--admin-accent)]">
 {clients.length} encontrados
 </span>
 </div>
 <div className="divide-y divide-[var(--admin-border)]">
 {clients.map((client) => (
 <article
 key={client.id}
 className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4"
 >
 <div className="w-11 h-11 rounded-[var(--admin-radius-full)] bg-[var(--admin-accent)]/10 text-[var(--admin-accent)] flex items-center justify-center shrink-0">
 <Cake className="w-5 h-5"/>
 </div>
 <div className="min-w-0 flex-1">
 <div className="flex items-center gap-2 flex-wrap">
 <h3 className="text-sm font-bold text-[var(--admin-text-main)] admin-clamp-2">
 {client.name}
 </h3>
 <span className="px-2 py-1 rounded-[var(--admin-radius-sm)] bg-[var(--admin-bg)] border border-[var(--admin-border)] text-xs text-[var(--admin-text-muted)]">
 {client.loyaltyTier}
 </span>
 </div>
 <p className="text-xs text-[var(--admin-text-muted)]">
 {formatDate(client.birthday)}
 {client.age !== null ? ` · ${client.age} anos` :""} ·
 Última visita:{""}
 {client.lastVisit
 ? formatDate(client.lastVisit)
 :"sem registro"}
 </p>
 </div>
 <div className="sm:text-right shrink-0">
 <p className="text-xs uppercase tracking-wider text-[var(--admin-text-muted)]">
 Quando
 </p>
 <p
 className={`text-sm font-black ${client.daysUntil <= 7 ?"text-status-warning":"text-[var(--admin-accent)]"}`}
 >
 {client.daysUntil === 0
 ?"Hoje"
 : `em ${client.daysUntil} dias`}
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
 <Phone className="w-4 h-4"/>
 </a>
 )}
 {client.hasEmail && (
 <a
 href={`mailto:${client.email}`}
 title="Enviar e-mail"
 className="w-10 h-10 rounded-[var(--admin-radius-lg)] border border-[var(--admin-accent)]/30 text-[var(--admin-accent)] flex items-center justify-center"
 >
 <Mail className="w-4 h-4"/>
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
