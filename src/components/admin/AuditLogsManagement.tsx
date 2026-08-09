import React, { useState } from 'react';
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
  Package 
} from 'lucide-react';
import { AdminPageHeader } from './shared/AdminPageHeader';

export interface AuditLogItem {
  id: string;
  timestamp: string;
  operatorName: string;
  category: 'agendamentos' | 'caixa' | 'comandas' | 'estoque' | 'clientes' | 'configuracoes' | 'autenticacao';
  action: string;
  details: string;
  ipAddress: string;
  status: 'success' | 'warning' | 'error';
}

export const AuditLogsManagement: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogItem[]>(() => {
    const saved = localStorage.getItem('navo_audit_logs_v1');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    return [
      {
        id: 'log_01',
        timestamp: new Date(Date.now() - 10 * 60000).toISOString(),
        operatorName: 'Gerente Carlos',
        category: 'comandas',
        action: 'Fechamento de Comanda CMD-001',
        details: 'Comanda do cliente Marcos Oliveira encerrada com sucesso no valor de R$ 100,00 via PIX.',
        ipAddress: '192.168.1.104',
        status: 'success'
      },
      {
        id: 'log_02',
        timestamp: new Date(Date.now() - 45 * 60000).toISOString(),
        operatorName: 'Gerente Carlos',
        category: 'caixa',
        action: 'Abertura de Caixa do Dia',
        details: 'Caixa aberto com fundo inicial de troco de R$ 200,00.',
        ipAddress: '192.168.1.104',
        status: 'success'
      },
      {
        id: 'log_03',
        timestamp: new Date(Date.now() - 2 * 3600000).toISOString(),
        operatorName: 'Lucas Silva (Barbeiro)',
        category: 'agendamentos',
        action: 'Horário de Agendamento Alterado',
        details: 'Agendamento #A-204 do cliente Rafael Costa alterado das 14:00 para as 14:30.',
        ipAddress: '192.168.1.112',
        status: 'warning'
      },
      {
        id: 'log_04',
        timestamp: new Date(Date.now() - 5 * 3600000).toISOString(),
        operatorName: 'Gerente Carlos',
        category: 'estoque',
        action: 'Ajuste de Estoque de Produto',
        details: 'Produto "Pomada Matte Clay 100g" teve estoque reajustado de 15 para 25 unidades.',
        ipAddress: '192.168.1.104',
        status: 'success'
      },
      {
        id: 'log_05',
        timestamp: new Date(Date.now() - 24 * 3600000).toISOString(),
        operatorName: 'Sistema (Automação)',
        category: 'autenticacao',
        action: 'Login Administrativo Realizado',
        details: 'Sessão administrativa iniciada com perfil de Admin.',
        ipAddress: '189.40.22.11',
        status: 'success'
      }
    ];
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          log.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          log.operatorName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = selectedCategory === 'all' || log.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'agendamentos': return Scissors;
      case 'caixa': return ShieldCheck;
      case 'comandas': return Receipt;
      case 'estoque': return Package;
      case 'configuracoes': return Settings;
      default: return Info;
    }
  };

  const handleExportLogs = () => {
    const json = JSON.stringify(logs, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit_logs_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  return (
    <div className="space-y-4 animate-fade-in text-content-base min-w-0">
      {/* Header (desktop) */}
      <AdminPageHeader
        icon={ShieldCheck}
        title="Logs de Atividades & Auditoria"
        stats={[{ label: 'registros', value: logs.length }]}
        action={{ label: 'Exportar', onClick: handleExportLogs, icon: Download }}
      />

      {/* Ação (mobile) */}
      <button
        onClick={handleExportLogs}
        className="md:hidden w-full bg-surface-base border border-border-subtle hover:border-gold-base/50 text-content-base px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shrink-0"
      >
        <Download className="w-4 h-4 text-gold-base" />
        <span>Exportar Logs</span>
      </button>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-content-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por operador, ação ou detalhes do evento..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-surface-card border border-border-subtle rounded-xl pl-10 pr-4 py-2.5 text-xs text-content-base focus:outline-none focus:ring-1 focus:ring-gold-base/50"
          />
        </div>

        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="bg-surface-card border border-border-subtle rounded-xl px-3 py-2.5 text-xs text-content-base focus:outline-none shrink-0"
        >
          <option value="all">Todas as Categorias</option>
          <option value="comandas">Comandas</option>
          <option value="caixa">Caixa</option>
          <option value="agendamentos">Agendamentos</option>
          <option value="estoque">Estoque</option>
          <option value="autenticacao">Autenticação</option>
        </select>
      </div>

      {/* Logs Table / List */}
      <div className="bg-surface-card border border-border-subtle rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-base border-b border-border-subtle text-content-muted uppercase font-bold text-[10px]">
              <tr>
                <th className="p-3">Data / Hora</th>
                <th className="p-3">Operador</th>
                <th className="p-3">Categoria</th>
                <th className="p-3">Ação Realizada</th>
                <th className="p-3">Detalhes</th>
                <th className="p-3">IP Origem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle/60 text-content-base">
              {filteredLogs.map((item) => {
                const Icon = getCategoryIcon(item.category);
                return (
                  <tr key={item.id} className="hover:bg-surface-base/50 transition-colors">
                    <td className="p-3 whitespace-nowrap font-mono text-[11px] text-content-muted">
                      {new Date(item.timestamp).toLocaleString('pt-BR')}
                    </td>
                    <td className="p-3 font-semibold whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-gold-base shrink-0" />
                        <span>{item.operatorName}</span>
                      </div>
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <span className="bg-surface-base border border-border-subtle text-content-muted font-bold text-[10px] px-2 py-0.5 rounded capitalize inline-flex items-center gap-1">
                        <Icon className="w-3 h-3 text-gold-base" />
                        {item.category}
                      </span>
                    </td>
                    <td className="p-3 font-bold text-content-base whitespace-nowrap">
                      {item.action}
                    </td>
                    <td className="p-3 text-content-muted max-w-md">
                      {item.details}
                    </td>
                    <td className="p-3 font-mono text-[10px] text-content-muted whitespace-nowrap">
                      {item.ipAddress}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
