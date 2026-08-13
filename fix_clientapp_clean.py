with open('src/components/client/ClientApp.tsx', 'r') as f:
    content = f.read()

# Let's see if confirmAndExecuteTabChange exists anywhere.
print("confirmAndExecuteTabChange exists:", "confirmAndExecuteTabChange" in content)

# I will replace handleTabChange by finding the function body using indices.
lines = content.split('\n')
for i, line in enumerate(lines):
    if "const handleTabChange" in line:
        start_idx = i
        break
for i, line in enumerate(lines[start_idx:]):
    if "setActiveTab(tabId as any);" in line:
        end_idx = start_idx + i + 2
        break

new_block = """  const confirmAndExecuteTabChange = async (targetTab: string) => {
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

lines = lines[:start_idx] + new_block.split('\n') + lines[end_idx:]

with open('src/components/client/ClientApp.tsx', 'w') as f:
    f.write('\n'.join(lines))

