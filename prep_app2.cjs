const fs = require('fs');
let content = fs.readFileSync('api/routers/appointments.router.ts', 'utf-8');

// replace the stubs with actual imports
content = content.replace(/\/\/ Mocks\/stubs for things that were in index\.ts[\s\S]*?\} \}/, `
import { sendWhatsAppMessage, processAppointmentCompletion, notifyClientByEmail } from '../index.js';
`);

fs.writeFileSync('api/routers/appointments.router.ts', content);
