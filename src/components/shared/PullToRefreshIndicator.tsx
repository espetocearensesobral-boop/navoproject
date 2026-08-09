import React from 'react';
import { RefreshCw } from 'lucide-react';

interface PullToRefreshIndicatorProps {
  pullDistance: number;
  isRefreshing: boolean;
  threshold?: number;
  refreshingLabel?: string;
  releaseLabel?: string;
  pullLabel?: string;
}

/**
 * Indicador visual de "puxar para atualizar". A cor segue a paleta ativa
 * (var(--color-gold-base), definida pelo ThemeContext via [data-palette]).
 */
export const PullToRefreshIndicator: React.FC<PullToRefreshIndicatorProps> = ({
  pullDistance,
  isRefreshing,
  threshold = 60,
  refreshingLabel = 'Atualizando...',
  releaseLabel = 'Solte para atualizar',
  pullLabel = 'Puxe para atualizar',
}) => {
  if (pullDistance <= 0 && !isRefreshing) return null;

  const isReady = isRefreshing || pullDistance >= threshold;

  return (
    <div className="flex items-center justify-center py-2 transition-all duration-200 shrink-0">
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gold-base/10 border border-gold-base/30 text-gold-base text-xs font-bold shadow-md">
        <RefreshCw className={`w-3.5 h-3.5 ${isReady ? 'animate-spin' : ''}`} />
        <span>{isRefreshing ? refreshingLabel : pullDistance >= threshold ? releaseLabel : pullLabel}</span>
      </div>
    </div>
  );
};
