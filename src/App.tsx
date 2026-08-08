import React, { useState, useEffect, Suspense, lazy } from 'react';
import { ToastProvider } from './components/ui/Toast';

const ClientApp = lazy(() => import('./components/client/ClientApp').then(m => ({ default: m.ClientApp })));
const AdminLayout = lazy(() => import('./components/admin/AdminLayout').then(m => ({ default: m.AdminLayout })));

export default function App() {
  const [route, setRoute] = useState<'client' | 'admin'>('client');

  useEffect(() => {
    const path = window.location.pathname;
    if (path.startsWith('/admin')) {
      setRoute('admin');
    } else {
      setRoute('client');
    }
  }, []);

  return (
    <ToastProvider>
      <div className="h-[100dvh] overflow-hidden bg-surface-base text-content-base flex flex-col font-sans relative">
        <Suspense fallback={
          <div className="flex-1 flex items-center justify-center h-full bg-surface-base">
            <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
          </div>
        }>
          {route === 'admin' ? <AdminLayout /> : <ClientApp />}
        </Suspense>
      </div>
    </ToastProvider>
  );
}
