import React, { useState } from "react";
import {
  FileText,
  Search,
  Filter,
  ShieldCheck,
  User,
  Clock,
  Calendar,
  Download,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Info,
  Lock,
  Receipt,
  Scissors,
  Settings,
  Package,
} from "lucide-react";
import { AdminPageHeader } from "./shared/AdminPageHeader";

export interface AuditLogItem {
  id: string;
  timestamp: string;
  operatorName: string;
  category:
    | "agendamentos"
    | "caixa"
    | "comandas"
    | "estoque"
    | "clientes"
    | "configuracoes"
    | "autenticacao";
  action: string;
  details: string;
  ipAddress: string;
  status: "success" | "warning" | "error";
}

export const AuditLogsManagement: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await fetch('/api/audit', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          // Map DB structure to AuditLogItem
          const mapped = data.map((d: any) => ({
            id: d.id,
            timestamp: d.createdAt,
            operatorName: d.user,
            category: d.type,
            action: d.action,
            details: d.details,
            status: 'success',
            ipAddress: '127.0.0.1'
          }));
          setLogs(mapped);
        }
      } catch (e) {}
    };
    fetchLogs();
  }, []);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.operatorName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat =
      selectedCategory === "all" || log.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case "agendamentos":
        return Scissors;
      case "caixa":
        return ShieldCheck;
      case "comandas":
        return Receipt;
      case "estoque":
        return Package;
      case "configuracoes":
        return Settings;
      default:
        return Info;
    }
  };

  const handleExportLogs = () => {
    const json = JSON.stringify(logs, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit_logs_${new Date().toISOString().split("T")[0]}.json`;
    a.click();
  };

  return (
    <div className="space-y-4 animate-fade-in text-[var(--admin-text-main)] min-w-0">
      {/* Header (desktop) */}
      <AdminPageHeader
        icon={ShieldCheck}
        title="Auditoria"
        stats={[{ label: "registros", value: logs.length }]}
        action={{
          label: "Exportar",
          onClick: handleExportLogs,
          icon: Download,
        }}
      />

      {/* Ação (mobile) */}
      <button
        onClick={handleExportLogs}
        className="md:hidden w-full bg-[var(--admin-surface)] hover:bg-surface-elevated text-[var(--admin-text-main)] px-3 py-2.5 rounded-[var(--admin-radius-lg)] text-xs font-bold flex items-center justify-center gap-2 transition-all shrink-0"
      >
        <Download className="w-4 h-4 text-[var(--admin-accent)]" />
        <span>Exportar logs</span>
      </button>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[var(--admin-text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Operador, ação ou detalhe..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[var(--admin-surface)] rounded-[var(--admin-radius-lg)] pl-10 pr-4 py-2.5 text-xs text-[var(--admin-text-main)] focus:outline-none focus:ring-1 focus:ring-[var(--admin-accent)]/50"
          />
        </div>

        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="bg-[var(--admin-surface)] rounded-[var(--admin-radius-lg)] px-3 py-2.5 text-xs text-[var(--admin-text-main)] focus:outline-none focus:ring-1 focus:ring-[var(--admin-accent)]/50 shrink-0"
        >
          <option value="all">Todas</option>
          <option value="comandas">Comandas</option>
          <option value="caixa">Caixa</option>
          <option value="agendamentos">Agendamentos</option>
          <option value="estoque">Estoque</option>
          <option value="autenticacao">Autenticação</option>
        </select>
      </div>

      {/* Logs Table / List */}
      <div className="admin-table-container">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Data / Hora</th>
              <th>Operador</th>
              <th>Categoria</th>
              <th>Ação</th>
              <th>Detalhes</th>
              <th>IP Origem</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.map((item) => {
              const Icon = getCategoryIcon(item.category);
              return (
                <tr key={item.id}>
                    <td className="whitespace-nowrap font-mono text-[var(--admin-text-muted)]">
                      {new Date(item.timestamp).toLocaleString("pt-BR")}
                    </td>
                    <td className="font-semibold">
                      <div className="flex items-start gap-1.5 min-w-0">
                        <User className="w-3.5 h-3.5 text-[var(--admin-accent)] shrink-0" />
                        <span className="admin-safe-wrap">
                          {item.operatorName}
                        </span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap">
                      <span className="bg-[var(--admin-bg)]/80 text-[var(--admin-text-muted)] font-bold text-xs px-2.5 py-1 rounded-[var(--admin-radius-lg)] capitalize inline-flex items-center gap-1.5">
                        <Icon className="w-3 h-3 text-[var(--admin-accent)]" />
                        {item.category}
                      </span>
                    </td>
                    <td className="font-bold text-[var(--admin-text-main)] admin-safe-wrap">
                      {item.action}
                    </td>
                    <td className="text-[var(--admin-text-muted)] max-w-md admin-safe-wrap">
                      {item.details}
                    </td>
                    <td className="font-mono text-[var(--admin-text-muted)] whitespace-nowrap">
                      {item.ipAddress}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
    </div>
  );
};
