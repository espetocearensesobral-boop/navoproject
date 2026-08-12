const fs = require('fs');
let code = fs.readFileSync('backend/whatsapp.ts', 'utf8');

code = code.replace(
/router\.post\('\/reconnect', \(req, res\) => \{/g,
`router.post('/reconnect', requireAuth, requireAdmin, (req, res) => {`
);

code = code.replace(
/router\.post\('\/logout', \(req, res\) => \{/g,
`router.post('/logout', requireAuth, requireAdmin, (req, res) => {`
);

fs.writeFileSync('backend/whatsapp.ts', code);
console.log('Protected whatsapp reconnect and logout routes');
