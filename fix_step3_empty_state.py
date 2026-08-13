import re

with open('src/components/client/BookingStep3DateTime.tsx', 'r') as f:
    content = f.read()

# Let's find the section where it renders morningSlots and afternoonSlots
# and add a check for unavailabilityReason before it.
# `        ) : (` around line 300

empty_state_check_old = """        ) : (
          <div className="space-y-6">"""
          
empty_state_check_new = """        ) : unavailabilityReason ? (
          <div className="p-6 bg-surface-card border border-border-subtle rounded-card text-center flex flex-col items-center justify-center space-y-4 animate-fade-in shadow-sm">
            <div className="w-12 h-12 rounded-full bg-status-warning/10 flex items-center justify-center mb-1">
              <CalendarOff className="w-6 h-6 text-status-warning" />
            </div>
            <div>
              <h4 className="font-bold text-content-base text-lg">Sem horários</h4>
              <p className="text-sm text-content-muted mt-1 max-w-[250px] mx-auto leading-relaxed">{unavailabilityReason}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">"""

content = content.replace(empty_state_check_old, empty_state_check_new)

# Add CalendarOff import if not present
if "CalendarOff" not in content:
    content = content.replace("import { ChevronLeft, ChevronRight, Sun, Sunset, AlertTriangle, Trash2, Clock } from 'lucide-react';", "import { ChevronLeft, ChevronRight, Sun, Sunset, AlertTriangle, Trash2, Clock, CalendarOff } from 'lucide-react';")

with open('src/components/client/BookingStep3DateTime.tsx', 'w') as f:
    f.write(content)

