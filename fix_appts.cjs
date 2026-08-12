const fs = require('fs');
let code = fs.readFileSync('backend/routers/appointments.router.ts', 'utf8');

// Fix 1: lookup/verify
code = code.replace(
/const isMatch = candidates\.some\(\(apt: any\) => \{\n\s*const aptCode = \(apt\.bookingCode \|\| apt\.id \|\| ''\)\.toUpperCase\(\);\n\s*return aptCode === cleanCode \|\| aptCode\.endsWith\(cleanCode\) \|\| cleanCode\.endsWith\(aptCode\) \|\| apt\.id\.toUpperCase\(\)\.includes\(cleanCode\);\n\s*\}\);\n\n\s*if \(!isMatch\) \{/g,
`const matchedApt = candidates.find((apt: any) => {
      const aptCode = (apt.bookingCode || apt.id || '').toUpperCase();
      return aptCode === cleanCode;
    });

    if (!matchedApt) {`
);

code = code.replace(
/const token = jwt\.sign\(\n\s*\{ role: 'guest_auth', phone: inputPhone, id: \`guest_\$\{Date\.now\(\)\}\` \},\n\s*JWT_SECRET/g,
`const token = jwt.sign(
      { role: 'guest_auth', phone: inputPhone, appointmentId: matchedApt.id, id: \`guest_\${Date.now()}\` },
      JWT_SECRET`
);

// Fix 2: lookup/step2
code = code.replace(
/if \(guestDecoded\.phone && matchPhoneNumbers\(guestDecoded\.phone, inputPhone\)\) \{\n\s*isAuthorized = true;\n\s*\}/g,
`if (guestDecoded.phone && matchPhoneNumbers(guestDecoded.phone, inputPhone)) {
          // Extra security: ensure the guest token is bound to this specific appointment
          // We will verify this further down when we find the appointment
          req.user = { ...req.user, guestAppointmentId: guestDecoded.appointmentId };
          isAuthorized = true;
        }`
);

code = code.replace(
/const appointment = candidates\.find\(\(apt: any\) => \{\n\s*const aptCode = \(apt\.bookingCode \|\| apt\.id \|\| ''\)\.toUpperCase\(\);\n\s*return aptCode === cleanCode \|\| aptCode\.endsWith\(cleanCode\) \|\| cleanCode\.endsWith\(aptCode\) \|\| apt\.id\.toUpperCase\(\)\.includes\(cleanCode\);\n\s*\}\);/g,
`const appointment = candidates.find((apt: any) => {
      const aptCode = (apt.bookingCode || apt.id || '').toUpperCase();
      return aptCode === cleanCode;
    });

    // Validar também o vínculo exato do token com o agendamento
    if (appointment && !isAdmin && req.cookies?.guest_token) {
      if (req.user?.guestAppointmentId && req.user.guestAppointmentId !== appointment.id) {
        return res.status(403).json({ error: 'Acesso negado: Sessão não autorizada para este agendamento.' });
      }
    }`
);

// Fix 3: lookup/cancel
code = code.replace(
/const appointmentToCancel = candidates\.find\(\(apt: any\) => \{\n\s*const aptCode = \(apt\.bookingCode \|\| apt\.id \|\| ''\)\.toUpperCase\(\);\n\s*return aptCode === cleanCode \|\| aptCode\.endsWith\(cleanCode\) \|\| cleanCode\.endsWith\(aptCode\) \|\| apt\.id\.toUpperCase\(\)\.includes\(cleanCode\);\n\s*\}\);/g,
`const appointmentToCancel = candidates.find((apt: any) => {
      const aptCode = (apt.bookingCode || apt.id || '').toUpperCase();
      return aptCode === cleanCode;
    });

    if (appointmentToCancel && !isAdmin && req.cookies?.guest_token) {
      if (req.user?.guestAppointmentId && req.user.guestAppointmentId !== appointmentToCancel.id) {
        return res.status(403).json({ error: 'Acesso negado: Sessão não autorizada para cancelar este agendamento.' });
      }
    }`
);

fs.writeFileSync('backend/routers/appointments.router.ts', code);
console.log('Fixed appointments router');
