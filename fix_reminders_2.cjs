const fs = require('fs');
let code = fs.readFileSync('src/components/admin/AppointmentRemindersManagement.tsx', 'utf8');

code = code.replace(
  /const markAsSent = \(id: string\) => \{[\s\S]*?\}\s*catch\s*\{\}\s*\};/,
  `const markAsSent = async (id: string, apt?: any) => {
    const ts = new Date().toISOString();
    setSentReminders(prev => ({ ...prev, [id]: ts }));
    if (!apt) return;
    try {
      await fetch('/api/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointmentId: id,
          clientName: apt.clientName || 'Cliente',
          clientPhone: apt.clientPhone || '000',
          serviceTitle: apt.serviceTitle || 'Serviço',
          professionalName: apt.professionalName || 'Profissional',
          date: apt.date || '',
          timeSlot: apt.timeSlot || '',
          sentAt: ts,
          status: 'sent'
        })
      });
    } catch(e) {}
  };`
);

fs.writeFileSync('src/components/admin/AppointmentRemindersManagement.tsx', code);
