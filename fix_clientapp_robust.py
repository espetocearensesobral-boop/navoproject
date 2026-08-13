import re

with open('src/components/client/ClientApp.tsx', 'r') as f:
    content = f.read()

# Introduce ConfirmDialog state
state_addition = """  const [isPwaModalOpen, setIsPwaModalOpen] = useState(false);
  const [pendingTabChange, setPendingTabChange] = useState<string | null>(null);"""
content = content.replace("  const [isPwaModalOpen, setIsPwaModalOpen] = useState(false);", state_addition)

# Rewrite handleTabChange
old_func_pattern = re.compile(r"const handleTabChange = async.*?setActiveTab\(tabId\);\n    \}\n  \};", re.DOTALL)

new_func = """const confirmAndExecuteTabChange = async (targetTab: string) => {
    if (activeTab !== targetTab && isGuest) {
      try {
        await fetch('/api/appointments/lookup/logout', { method: 'POST', credentials: 'include' });
      } catch (error) {
        console.error('Erro ao limpar sessão:', error);
      }
    }
    
    if (activeTab === 'booking' && bookingStep >= 1 && bookingStep <= 4 && targetTab !== 'booking') {
      executeResetBooking();
    }

    if (targetTab === 'booking' && bookingStep > 4) {
      executeResetBooking();
    }

    if (targetTab === 'more') {
      setIsMoreDrawerOpen(true);
      return;
    }
    
    if (targetTab !== activeTab) {
      setActiveTab(targetTab as any);
      setBookingStep(1); // Ou resetar conforme a regra
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  };

  const handleTabChange = async (tabId: 'home' | 'booking' | 'appointments' | 'more' | 'subscriptions' | 'loyalty' | string) => {
    hapticLight();
    
    if (activeTab === 'booking' && bookingStep >= 1 && bookingStep <= 4 && tabId !== 'booking') {
      if (selectedServices.length > 0 || selectedBarber || selectedDate) {
        setPendingTabChange(tabId);
        return;
      }
    }
    
    await confirmAndExecuteTabChange(tabId);
  };"""
  
content = old_func_pattern.sub(new_func, content)

dialog_addition = """
      <ConfirmDialog
        isOpen={pendingTabChange !== null}
        onClose={() => setPendingTabChange(null)}
        onConfirm={() => {
          if (pendingTabChange) {
            confirmAndExecuteTabChange(pendingTabChange);
            setPendingTabChange(null);
          }
        }}
        title="Cancelar agendamento?"
        description="Você tem um agendamento em andamento. Se sair, perderá o progresso. Deseja continuar?"
        confirmText="Sim, sair"
        cancelText="Ficar"
      />
"""
content = content.replace("</Suspense>\n\n      <Suspense fallback={null}>\n      <ClientProfileModal", dialog_addition + "\n      </Suspense>\n\n      <Suspense fallback={null}>\n      <ClientProfileModal")

if "ConfirmDialog" not in content[:1500]:
    content = content.replace("import { LoadingSpinner } from '../ui/LoadingSpinner';", "import { LoadingSpinner } from '../ui/LoadingSpinner';\nimport { ConfirmDialog } from '../ui/ConfirmDialog';")


with open('src/components/client/ClientApp.tsx', 'w') as f:
    f.write(content)
