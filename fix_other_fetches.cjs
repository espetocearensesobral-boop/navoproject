const fs = require('fs');

function replaceFile(path, regex, replacement) {
  if (fs.existsSync(path)) {
    let code = fs.readFileSync(path, 'utf8');
    code = code.replace(regex, replacement);
    fs.writeFileSync(path, code);
  }
}

replaceFile(
  'src/lib/supabase.ts',
  /const res = await fetch\('\/api\/services'\);/,
  `const res = await fetch('/api/services', { credentials: 'include' });`
);

replaceFile(
  'src/components/admin/SubscriptionsManagement.tsx',
  /fetch\('\/api\/subscriptions\/plans'\);/,
  `fetch('/api/subscriptions/plans', { credentials: 'include' });`
);

replaceFile(
  'src/components/admin/SubscriptionsManagement.tsx',
  /fetch\('\/api\/subscriptions\/members'\);/,
  `fetch('/api/subscriptions/members', { credentials: 'include' });`
);

replaceFile(
  'src/components/admin/AppointmentRemindersManagement.tsx',
  /fetch\('\/api\/reminders'\);/,
  `fetch('/api/reminders', { credentials: 'include' });`
);

replaceFile(
  'src/components/admin/AuditLogsManagement.tsx',
  /fetch\('\/api\/audit'\);/,
  `fetch('/api/audit', { credentials: 'include' });`
);

replaceFile(
  'src/components/client/ClientAppointments.tsx',
  /fetch\(`\/api\/appointments\/lookup\/step1\?phone=\$\{encodeURIComponent\(numbers\)\}`\),/,
  `fetch(\`/api/appointments/lookup/step1?phone=\$\{encodeURIComponent(numbers)}\`, { credentials: 'include' }),`
);

replaceFile(
  'src/components/client/ClientAppointments.tsx',
  /fetch\(`\/api\/appointments\/lookup\/verify`, \{/,
  `fetch(\`/api/appointments/lookup/verify\`, {\n        credentials: 'include',`
);

replaceFile(
  'src/components/client/ClientSubscriptions.tsx',
  /fetch\('\/api\/subscriptions\/plans'\);/,
  `fetch('/api/subscriptions/plans', { credentials: 'include' });`
);
