with open('src/components/client/BookingStep3DateTime.tsx', 'r') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if "const fetchAvailability = async () => {" in line:
        start_idx = i
    if "fetchAvailability();" in line:
        end_idx = i
        break

new_func = """    const fetchAvailability = async () => {
      if (!selectedDate) return;
      setIsLoadingSlots(true);
      try {
        const profId = selectedBarber?.id || 'prof_any';
        const response = await authFetch(`/api/availability?professionalId=${profId}&date=${selectedDate}&duration=${totalDurationMinutes}`);
        if (response.ok) {
          const resData = await response.json();
          let newBusySlots: string[] = [];
          
          if (resData.statusCode === 'PROFESSIONAL_UNAVAILABLE') {
            if (isMounted) setUnavailabilityReason('Nenhum profissional disponível para o serviço e duração selecionados.');
          } else {
            if (isMounted) setUnavailabilityReason(null);
          }
          
          if (Array.isArray(resData)) {
            newBusySlots = resData.map((apt: any) => apt?.timeSlot || apt).filter(Boolean);
            if (isMounted) {
              setBusySlots(newBusySlots);
              setRequiresApprovalSlots([]);
            }
          } else {
            newBusySlots = resData.busySlots || [];
            if (isMounted) {
              setBusySlots(newBusySlots);
              setRequiresApprovalSlots(resData.requiresApprovalSlots || []);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching availability:', error);
      } finally {
        if (isMounted) setIsLoadingSlots(false);
      }
    };
"""

lines = lines[:start_idx] + [new_func] + lines[end_idx:]

with open('src/components/client/BookingStep3DateTime.tsx', 'w') as f:
    f.writelines(lines)

