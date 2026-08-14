import { useState, useEffect, useCallback, useRef } from 'react';

export type InstallOutcome = 'accepted' | 'dismissed' | 'unavailable';

export interface PWAState {
  isInstalled: boolean;
  canInstall: boolean;
  isOffline: boolean;
  installApp: (customName?: string) => Promise<InstallOutcome>;
  registerServiceWorker: () => void;
  syncOfflineData: () => Promise<boolean>;
}

export function usePWA(): PWAState {
  const deferredPromptRef = useRef<any>(null);
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  const registerServiceWorker = useCallback(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('[PWA] Falha ao registrar o service worker:', err);
    });
  }, []);

  useEffect(() => {
    // Um service worker registrado é pré-requisito para o Chrome/Edge
    // considerar o app "instalável" e disparar o beforeinstallprompt.
    registerServiceWorker();

    // 1. Online/Offline status listeners
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // 2. BeforeInstallPrompt listener
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      deferredPromptRef.current = e;
      setCanInstall(true);
    };

    // 3. AppInstalled listener
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setCanInstall(false);
      deferredPromptRef.current = null;
      console.log('[PWA] App instalado como aplicativo nativo!');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Check if running standalone
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [registerServiceWorker]);

  // Troca temporariamente o manifest da página por uma versão com o nome
  // customizado, para que o atalho criado pelo navegador use esse nome.
  // Restaura o manifest original logo em seguida.
  const withCustomManifestName = useCallback(async (customName: string | undefined, run: () => Promise<void>) => {
    if (!customName || !customName.trim()) {
      await run();
      return;
    }

    const linkEl = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    const originalHref = linkEl?.href;

    try {
      const manifestUrl = linkEl?.href || '/manifest.json';
      const res = await fetch(manifestUrl);
      const manifest = await res.json();
      const renamed = {
        ...manifest,
        name: customName.trim(),
        short_name: customName.trim().slice(0, 12),
      };
      const blob = new Blob([JSON.stringify(renamed)], { type: 'application/json' });
      const blobUrl = URL.createObjectURL(blob);

      if (linkEl) linkEl.href = blobUrl;

      await run();

      // Restaura o manifest original (o atalho já foi criado com o nome customizado)
      if (linkEl && originalHref) linkEl.href = originalHref;
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.warn('[PWA] Não foi possível customizar o nome do atalho, instalando com o nome padrão:', err);
      await run();
    }
  }, []);

  const installApp = useCallback(async (customName?: string): Promise<InstallOutcome> => {
    const deferredPrompt = deferredPromptRef.current;

    if (!deferredPrompt) {
      // Não há prompt nativo disponível (iOS Safari, navegador sem suporte,
      // critérios de instalabilidade ainda não atendidos, etc). Não há como
      // reportar sucesso aqui — quem chamou deve mostrar as instruções manuais.
      return 'unavailable';
    }

    const result: { outcome: 'accepted' | 'dismissed' } = { outcome: 'dismissed' };

    await withCustomManifestName(customName, async () => {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      result.outcome = choice.outcome;
    });

    deferredPromptRef.current = null;
    setCanInstall(false);

    if (result.outcome === 'accepted') {
      setIsInstalled(true);
    }

    return result.outcome;
  }, [withCustomManifestName]);

  const syncOfflineData = async (): Promise<boolean> => false;

  return {
    isInstalled,
    canInstall,
    isOffline,
    installApp,
    registerServiceWorker,
    syncOfflineData,
  };
}
