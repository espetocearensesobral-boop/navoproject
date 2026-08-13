import re

with open('src/components/client/ClientApp.tsx', 'r') as f:
    content = f.read()

# We need to replace `const handleTabChange = ...` up to `setActiveTab(tabId as any);\n  };`

old_handle_tab_pattern = re.compile(r"const handleTabChange = async.*?setActiveTab\(tabId as any\);\n  };", re.DOTALL)

new_handle_tab = """const confirmAndExecuteTabChange = async (targetTab: string) => {
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

content = old_handle_tab_pattern.sub(new_handle_tab, content)

with open('src/components/client/ClientApp.tsx', 'w') as f:
    f.write(content)

