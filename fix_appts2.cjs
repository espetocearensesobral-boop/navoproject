const fs = require('fs');
let code = fs.readFileSync('backend/routers/appointments.router.ts', 'utf8');

// In GET /, restrict guest token to only return their specific appointment
code = code.replace(
/if \(guestDecoded\.phone && matchPhoneNumbers\(guestDecoded\.phone, searchPhone\)\) \{\n\s*isAuthorized = true;\n\s*\}/g,
`if (guestDecoded.phone && matchPhoneNumbers(guestDecoded.phone, searchPhone)) {
            isAuthorized = true;
            // Restrict search to only the appointment authorized by this guest token
            req.user = { ...req.user, guestAppointmentId: guestDecoded.appointmentId };
          }`
);

code = code.replace(
/const filtered = dbApts\.filter\(a => matchPhoneNumbers\(a\.clientPhone, searchPhone\)\);/g,
`let filtered = dbApts.filter(a => matchPhoneNumbers(a.clientPhone, searchPhone));
      if (!isAdmin && !(req.user?.phone && matchPhoneNumbers(req.user.phone, searchPhone)) && req.user?.guestAppointmentId) {
        filtered = filtered.filter(a => a.id === req.user.guestAppointmentId);
      }`
);

// In PATCH /:id/cancel, check guest token properly
code = code.replace(
/if \(guestDecoded\.phone && dbApt\.clientPhone && matchPhoneNumbers\(guestDecoded\.phone, dbApt\.clientPhone\)\) \{\n\s*isGuestTokenMatch = true;\n\s*\}/g,
`if (guestDecoded.phone && dbApt.clientPhone && matchPhoneNumbers(guestDecoded.phone, dbApt.clientPhone)) {
            if (guestDecoded.appointmentId === dbApt.id) {
              isGuestTokenMatch = true;
            }
          }`
);

fs.writeFileSync('backend/routers/appointments.router.ts', code);
console.log('Fixed GET / and PATCH /:id/cancel guest auth');
