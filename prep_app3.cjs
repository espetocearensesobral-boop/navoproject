const fs = require('fs');
let content = fs.readFileSync('api/routers/appointments.router.ts', 'utf-8');

const startIdx = content.indexOf('// Mocks/stubs');
const endIdx = content.indexOf('// =====================================\n// Guest Appointments');

const newHeader = `
import { sendWhatsAppMessage, processAppointmentCompletion, notifyClientByEmail } from '../index.js';

export const appointmentsRouter = express.Router();

`;

content = content.substring(0, startIdx) + newHeader + content.substring(endIdx);
fs.writeFileSync('api/routers/appointments.router.ts', content);
