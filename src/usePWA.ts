import { useState, useEffect } from 'react';

export interface PWAState {
  isInstalled: boolean;
  canInstall: boolean;
  isOffline: boolean;
  installApp: () => Promise<void>;
  registerServiceWorker: () => void;
  syncOfflineData: () => Promise<boolean>;
}

export function usePWA(): PWAState {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    // 1. Online/Offline status listeners
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // 2. BeforeInstallPrompt listener
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setCanInstall(true);
    };

    // 3. AppInstalled listener
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setCanInstall(false);
      setDeferredPrompt(null);
      console.log('[PWA] BarberX foi instalado como App Nativo!');
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
  }, []);

  // Mantido por compatibilidade com a interface, sem registrar armazenamento offline.
  const registerServiceWorker = () => undefined;

  const installApp = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      console.log('[PWA] Usuário aceitou a instalação do BarberX');
      setIsInstalled(true);
      setCanInstall(false);
    }
    setDeferredPrompt(null);
  };

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
