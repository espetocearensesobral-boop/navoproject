import React, { useState } from 'react';
import { 
  MessageSquare, 
  Send, 
  CheckCircle2, 
  Smartphone, 
  Wifi, 
  CreditCard, 
  Plus, 
  Clock, 
  RefreshCw, 
  DollarSign, 
  Sparkles, 
  AlertCircle 
} from 'lucide-react';
import { AdminPageHeader } from './shared/AdminPageHeader';

export const WhatsAppManagement: React.FC = () => {
  const [balance, setBalance] = useState<number>(45.50);
  const [isConnected] = useState<boolean>(true);
  const [autoReminder, setAutoReminder] = useState<boolean>(true);

  return (
    <div className="space-y-4 animate-fade-in text-content-base min-w-0">
      {/* Header (desktop) */}
      <AdminPageHeader
        icon={MessageSquare}
        title="WhatsApp"
        stats={isConnected ? [{ label: 'conectado', value: '', tone: 'success' }] : [{ label: 'desconectado', value: '', tone: 'error' }]}
        action={{ label: 'Recarregar saldo', onClick: () => setBalance(prev => prev + 50), icon: CreditCard }}
      />

      {/* Ação (mobile) */}
      <button
        onClick={() => setBalance(prev => prev + 50)}
        className="md:hidden w-full bg-gold-base hover:bg-gold-hover text-surface-base px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-md transition-all shrink-0"
      >
        <CreditCard className="w-4 h-4" />
        <span>Recarregar saldo</span>
      </button>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="p-3 bg-surface-card border border-border-subtle rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-content-muted mb-1">
            <span className="text-xs font-bold uppercase tracking-wider truncate">Saldo</span>
            <div className="w-6 h-6 rounded-lg bg-gold-base/10 text-gold-base flex items-center justify-center shrink-0">
              <DollarSign className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-lg font-black finance-positive tabular-nums truncate">R$ {balance.toFixed(2)}</p>
          <p className="text-xs text-content-muted mt-1 font-medium admin-safe-wrap">~{Math.floor(balance / 0.10)} mensagens</p>
        </div>

        <div className="p-3 bg-surface-card border border-border-subtle rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-content-muted mb-1">
            <span className="text-xs font-bold uppercase tracking-wider truncate">Enviadas</span>
            <div className="w-6 h-6 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0">
              <Send className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-lg font-black text-content-base tabular-nums">412</p>
          <p className="text-xs text-status-success mt-1 font-medium admin-safe-wrap">98.5% entregues</p>
        </div>

        <div className="p-3 bg-surface-card border border-border-subtle rounded-2xl flex flex-col justify-between col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-content-muted mb-1">
            <span className="text-xs font-bold uppercase tracking-wider truncate">Menos Faltas</span>
            <div className="w-6 h-6 rounded-lg bg-status-success/10 text-status-success flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-lg font-black text-status-success tabular-nums">- 82%</p>
          <p className="text-xs text-content-muted mt-1 font-medium admin-safe-wrap">Lembretes automáticos</p>
        </div>
      </div>

      {/* Configuration & Controls */}
      <div className="bg-surface-card border border-border-subtle rounded-2xl p-5 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-content-base flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-gold-base" />
          <span>Notificações automáticas</span>
        </h3>

        <div className="space-y-3 text-xs">
          <div className="flex justify-between items-center bg-surface-base p-3.5 rounded-xl border border-border-subtle">
            <div className="min-w-0">
              <span className="font-bold text-content-base block admin-safe-wrap">Lembrete pré-agendamento · 2h</span>
              <span className="text-content-muted text-xs admin-safe-wrap block">Confirmação ou reagendamento pelo WhatsApp.</span>
            </div>
            <input
              type="checkbox"
              checked={autoReminder}
              onChange={(e) => setAutoReminder(e.target.checked)}
              className="w-4 h-4 accent-gold-base"
            />
          </div>

          <div className="flex justify-between items-center bg-surface-base p-3.5 rounded-xl border border-border-subtle">
            <div className="min-w-0">
              <span className="font-bold text-content-base block admin-safe-wrap">Boas-vindas e confirmação</span>
              <span className="text-content-muted text-xs admin-safe-wrap block">Envia comprovante e link após a reserva.</span>
            </div>
            <input
              type="checkbox"
              defaultChecked
              className="w-4 h-4 accent-gold-base"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
