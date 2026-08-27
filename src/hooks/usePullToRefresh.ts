import React, { useCallback, useRef, useState } from 'react';
import { hapticSuccess } from '../lib/haptics';

interface UsePullToRefreshOptions {
  /** Distância (px, já com resistência aplicada) necessária para disparar o refresh. */
  threshold?: number;
  /** Distância máxima de puxada permitida (px). */
  maxPull?: number;
  /** Fator de resistência aplicado ao movimento do dedo (0-1). */
  resistance?: number;
  /** Tempo mínimo (ms) que o indicador de "atualizando" fica visível. */
  minRefreshDuration?: number;
  /** Callback assíncrono disparado quando o usuário solta após ultrapassar o threshold. */
  onRefresh: () => Promise<void> | void;
  /** Se false, desativa o gesto (ex: enquanto um modal está aberto). */
  enabled?: boolean;
}

interface UsePullToRefreshResult {
  pullDistance: number;
  isRefreshing: boolean;
  handlers: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: () => void;
  };
}

/**
 * Hook genérico de "puxar para atualizar" (pull-to-refresh) para containers touch.
 * Só ativa a puxada quando o container (ou a janela) já está no topo do scroll,
 * evitando conflito com o scroll normal do conteúdo.
 */
export function usePullToRefresh(
  containerRef: React.RefObject<HTMLElement>,
  {
    threshold = 60,
    maxPull = 120,
    resistance = 0.45,
    minRefreshDuration = 400,
    onRefresh,
    enabled = true,
  }: UsePullToRefreshOptions
): UsePullToRefreshResult {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartY = useRef<number | null>(null);
  const touchStartX = useRef<number | null>(null);
  const gestureDirection = useRef<'vertical' | 'horizontal' | null>(null);
  const touchStartedInHorizontalScroller = useRef(false);

  const isAtTop = useCallback(() => {
    const el = containerRef.current;
    if (el && el.scrollTop > 0) return false;
    return window.scrollY <= 0;
  }, [containerRef]);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled || isRefreshing || !isAtTop()) return;
      touchStartY.current = e.touches[0].clientY;
      touchStartX.current = e.touches[0].clientX;
      gestureDirection.current = null;
      touchStartedInHorizontalScroller.current = e.target instanceof Element
        && Boolean(e.target.closest('[data-gesture-scroll="horizontal"]'));
    },
    [enabled, isRefreshing, isAtTop]
  );

    const onTouchMove = useCallback(
      (e: React.TouchEvent) => {
        if (!enabled || isRefreshing || touchStartY.current === null || touchStartX.current === null) return;
        if (touchStartedInHorizontalScroller.current) {
          gestureDirection.current = 'horizontal';
          setPullDistance(0);
          return;
        }
        if (!isAtTop()) {
          touchStartY.current = null;
          touchStartX.current = null;
          gestureDirection.current = null;
          setPullDistance(0);
          return;
        }

        const currentY = e.touches[0].clientY;
        const currentX = e.touches[0].clientX;
        const deltaY = currentY - touchStartY.current;
        const deltaX = currentX - touchStartX.current;

        // Decide a direção uma única vez. Gestos horizontais (incluindo filtros
        // roláveis) não podem virar pull-to-refresh por causa de um pequeno
        // deslocamento diagonal. Aumentamos a área neutra (deadzone) para 15px.
        if (!gestureDirection.current && (Math.abs(deltaX) > 15 || Math.abs(deltaY) > 15)) {
          gestureDirection.current = Math.abs(deltaX) > Math.abs(deltaY) ? 'horizontal' : 'vertical';
        }

        if (gestureDirection.current !== 'vertical' || deltaY <= 0) {
          setPullDistance(0);
          return;
        }

        // Aplica um deadzone no movimento Y para não iniciar visualmente o pull
        // imediatamente com toques leves/segurados.
        const activeDelta = Math.max(0, deltaY - 20);
        const distance = Math.min(maxPull, activeDelta * resistance);
        setPullDistance(distance);
      },
      [enabled, isRefreshing, isAtTop, resistance, maxPull]
    );

  const onTouchEnd = useCallback(() => {
    if (!enabled) return;
    const shouldRefresh = gestureDirection.current === 'vertical' && pullDistance >= threshold;
    if (shouldRefresh) {
      setIsRefreshing(true);
      const start = Date.now();
      Promise.resolve(onRefresh()).finally(() => {
        const elapsed = Date.now() - start;
        const wait = Math.max(0, minRefreshDuration - elapsed);
        setTimeout(() => {
          setIsRefreshing(false);
          hapticSuccess();
        }, wait);
      });
    }
    touchStartY.current = null;
    touchStartX.current = null;
    gestureDirection.current = null;
    touchStartedInHorizontalScroller.current = false;
    setPullDistance(0);
  }, [enabled, pullDistance, threshold, onRefresh, minRefreshDuration]);

  return {
    pullDistance,
    isRefreshing,
    handlers: { onTouchStart, onTouchMove, onTouchEnd },
  };
}
