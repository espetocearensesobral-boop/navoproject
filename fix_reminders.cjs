const fs = require('fs');
let code = fs.readFileSync('src/components/admin/AppointmentRemindersManagement.tsx', 'utf8');

code = code.replace(
  /const \[sentReminders, setSentReminders\] = useState<Record<string, string>>\(\(\) => \{[\s\S]*?\}\);/,
  `const [sentReminders, setSentReminders] = useState<Record<string, string>>({});\n\n  useEffect(() => {\n    const fetchRem = async () => {\n      try {\n        const res = await fetch('/api/reminders');\n        if (res.ok) {\n          const data = await res.json();\n          const mapped: Record<string, string> = {};\n          data.forEach((r: any) => {\n            mapped[r.appointmentId] = r.sentAt;\n          });\n          setSentReminders(mapped);\n        }\n      } catch(e){}\n    };\n    fetchRem();\n  }, []);`
);

code = code.replace(
  /const markAsSent = \(appointmentId: string\) => \{[\s\S]*?localStorage\.setItem\("navo_sent_reminders_v1", JSON\.stringify\(updated\)\);\n    \}\);\n  \};/,
  `const markAsSent = async (appointmentId: string, apt: any) => {
    const ts = new Date().toISOString();
    setSentReminders(prev => ({ ...prev, [appointmentId]: ts }));
    try {
      await fetch('/api/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointmentId,
          clientName: apt.client_name,
          clientPhone: apt.client_phone,
          serviceTitle: apt.service_title || 'Serviço',
          professionalName: apt.professional_name || 'Profissional',
          date: apt.date,
          timeSlot: apt.time_slot,
          sentAt: ts,
          status: 'sent'
        })
      });
    } catch(e) {}
  };`
);

// We need to fix the markAsSent call because it currently only passes appointmentId.
// We'll pass `item.appointmentId, item`
code = code.replace(
  /markAsSent\(item\.appointmentId\);/g,
  `markAsSent(item.appointmentId, item);`
);

fs.writeFileSync('src/components/admin/AppointmentRemindersManagement.tsx', code);
