import React from 'react';
import { Bot, Clock, Wrench } from 'lucide-react';

export const OmnichannelBot: React.FC = () => {
  return (
    <div className="space-y-4 animate-fade-in text-content-base min-w-0">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 bg-surface-card p-4 rounded-md border border-border-subtle">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-base sm:text-xl font-serif text-content-base font-bold tracking-tight truncate">
              Assistente Virtual & Automações
            </h1>
            <span className="text-[10px] bg-gold-base/10 text-gold-base border border-gold-base/30 px-2 py-0.5 rounded uppercase font-bold tracking-wider whitespace-nowrap shrink-0">
              Em breve
            </span>
          </div>
          <p className="text-xs text-content-muted mt-0.5 truncate">
            Módulo de atendimento automatizado 24/7 e disparo de lembretes pelo WhatsApp.
          </p>
        </div>
      </div>

      {/* Main card */}
      <div className="bg-surface-card border border-border-subtle rounded-md p-6 sm:p-10 text-center space-y-4 min-w-0">
        <div className="w-12 h-12 rounded bg-surface-base border border-border-subtle text-gold-base flex items-center justify-center mx-auto shrink-0">
          <Bot className="w-6 h-6" />
        </div>

        <div className="space-y-1 max-w-md mx-auto">
          <h2 className="text-sm font-serif font-bold text-content-base">
            Módulo de Atendimento Inteligente
          </h2>
          <p className="text-xs text-content-muted leading-relaxed">
            Estamos finalizando a integração do assistente virtual para confirmação automática de horários, re-engajamento via WhatsApp e suporte aos clientes.
          </p>
        </div>

        <div className="pt-2 max-w-sm mx-auto">
          <div className="bg-surface-base border border-border-subtle p-3 rounded-md text-left flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-surface-card text-gold-base flex items-center justify-center shrink-0 border border-border-subtle">
              <Wrench className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-xs font-bold text-content-base block truncate">Desenvolvimento em Andamento</span>
              <span className="text-[11px] text-content-muted block truncate">Novidades disponíveis na próxima atualização.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
