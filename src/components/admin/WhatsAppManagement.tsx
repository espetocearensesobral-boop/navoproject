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
        title="Painel WhatsApp & Notificações"
        stats={isConnected ? [{ label: 'conectado', value: '', tone: 'success' }] : [{ label: 'desconectado', value: '', tone: 'error' }]}
        action={{ label: 'Recarregar Saldo (+ R$ 50)', onClick: () => setBalance(prev => prev + 50), icon: CreditCard }}
      />

      {/* Ação (mobile) */}
      <button
        onClick={() => setBalance(prev => prev + 50)}
        className="md:hidden w-full bg-gold-base hover:bg-gold-hover text-surface-base px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-md transition-all shrink-0"
      >
        <CreditCard className="w-4 h-4" />
        <span>Recarregar Saldo (+ R$ 50)</span>
      </button>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-surface-card border border-border-subtle rounded-xl p-4 shadow-xs">
          <span className="text-[10px] font-bold uppercase text-content-muted block">Saldo para Disparos</span>
          <span className="text-2xl font-bold text-gold-base mt-1 block tabular-nums">
            R$ {balance.toFixed(2)}
          </span>
          <span className="text-[10px] text-content-muted font-semibold mt-1 block">
            Aproximadamente {Math.floor(balance / 0.10)} mensagens
          </span>
        </div>

        <div className="bg-surface-card border border-border-subtle rounded-xl p-4 shadow-xs">
          <span className="text-[10px] font-bold uppercase text-content-muted block">Mensagens Enviadas este Mês</span>
          <span className="text-2xl font-bold text-content-base mt-1 block tabular-nums">
            412
          </span>
          <span className="text-[10px] text-status-success font-semibold mt-1 block">
            98.5% entregues com sucesso
          </span>
        </div>

        <div className="bg-surface-card border border-border-subtle rounded-xl p-4 shadow-xs">
          <span className="text-[10px] font-bold uppercase text-content-muted block">Redução do No-Show (Faltas)</span>
          <span className="text-2xl font-bold text-status-success mt-1 block tabular-nums">
            - 82%
          </span>
          <span className="text-[10px] text-content-muted font-semibold mt-1 block">
            Devido aos lembretes automáticos
          </span>
        </div>
      </div>

      {/* Configuration & Controls */}
      <div className="bg-surface-card border border-border-subtle rounded-2xl p-5 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-content-base flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-gold-base" />
          <span>Regras de Notificações Automáticas</span>
        </h3>

        <div className="space-y-3 text-xs">
          <div className="flex justify-between items-center bg-surface-base p-3.5 rounded-xl border border-border-subtle">
            <div>
              <span className="font-bold text-content-base block">Lembrete Pré-Agendamento (2h antes)</span>
              <span className="text-content-muted text-[11px]">Envia mensagem com botão de confirmação ou reagendamento no WhatsApp do cliente.</span>
            </div>
            <input
              type="checkbox"
              checked={autoReminder}
              onChange={(e) => setAutoReminder(e.target.checked)}
              className="w-4 h-4 accent-gold-base"
            />
          </div>

          <div className="flex justify-between items-center bg-surface-base p-3.5 rounded-xl border border-border-subtle">
            <div>
              <span className="font-bold text-content-base block">Mensagem de Boas-Vindas & Confirmação Instantânea</span>
              <span className="text-content-muted text-[11px]">Dispara o comprovante e link do agendamento imediatamente após a reserva.</span>
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
