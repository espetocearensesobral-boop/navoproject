const fs = require('fs');
let code = fs.readFileSync('src/components/client/ClientAppointments.tsx', 'utf8');

code = code.replace(/credentials: 'include',\n\s*method: 'POST',/g, "method: 'POST',");
fs.writeFileSync('src/components/client/ClientAppointments.tsx', code);
