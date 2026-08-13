import re

with open('src/components/client/ClientApp.tsx', 'r') as f:
    content = f.read()

# Introduce a state for the pending tab
state_addition = """  const [isPwaModalOpen, setIsPwaModalOpen] = useState(false);
  const [pendingTabChange, setPendingTabChange] = useState<string | null>(null);"""

content = content.replace("  const [isPwaModalOpen, setIsPwaModalOpen] = useState(false);", state_addition)


old_handle_tab = """  const handleTabChange = async (tabId: 'home' | 'booking' | 'appointments' | 'more' | 'subscriptions' | 'loyalty' | string) => {
    hapticLight();
    
    // Se o usuário está saindo da aba atual e é um convidado
    if (activeTab !== tabId && isGuest) {
      try {
        // Limpa o cookie de convidado
        await fetch('/api/appointments/lookup/logout', {
          method: 'POST',
          credentials: 'include'
        });
        console.log('Sessão de convidado limpa ao mudar de aba');
      } catch (error) {
        console.error('Erro ao limpar sessão:', error);
      }
    }

    // Proteção: se está no meio do booking e vai sair
    if (activeTab === 'booking' && bookingStep >= 1 && bookingStep <= 4 && tabId !== 'booking') {
      if (selectedServices.length > 0 || selectedBarber || selectedDate) {
        const confirmLeave = window.confirm(
          'Você tem um agendamento em andamento. Se sair, perderá o progresso. Deseja continuar?'
        );
        if (!confirmLeave) return;
        executeResetBooking();
      }
    }

    // Se clica em "Agendar" e já confirmou, reseta para novo agendamento
    if (tabId === 'booking' && bookingStep > 4) {
      executeResetBooking();
    }

    // Se clicou em subscriptions ou loyalty e não está logado, mostra modal
    if ((tabId === 'subscriptions' || tabId === 'loyalty') && !currentUser && !isGuest) {
      setLoginModalView('login');
      setIsLoginModalOpen(true);
      return;
    }

    setActiveTab(tabId as any);
  };"""
  
new_handle_tab = """  const confirmAndExecuteTabChange = async (targetTab: string) => {
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

    if ((targetTab === 'subscriptions' || targetTab === 'loyalty') && !currentUser && !isGuest) {
      setLoginModalView('login');
      setIsLoginModalOpen(true);
      return;
    }

    setActiveTab(targetTab as any);
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

content = content.replace(old_handle_tab, new_handle_tab)

# Also need to add the ConfirmDialog somewhere
# e.g., below <ClientMoreDrawer ... />
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

with open('src/components/client/ClientApp.tsx', 'w') as f:
    f.write(content)

