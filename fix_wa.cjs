const fs = require('fs');
let code = fs.readFileSync('backend/whatsapp.ts', 'utf8');

code = code.replace(
/router\.get\('\/status', \(req, res\) => \{/g,
`import { requireAuth, requireAdmin } from './middleware/auth.js';\n\nrouter.get('/status', requireAuth, requireAdmin, (req, res) => {`
);

fs.writeFileSync('backend/whatsapp.ts', code);
