const fs = require('fs');
let code = fs.readFileSync('backend/routers/auth.router.ts', 'utf8');

code = code.replace(
  /const { loginId, password } = req\.body;/g,
  `const { loginId, password, turnstileToken } = req.body;\n\n    if (!(await verifyTurnstileToken(turnstileToken))) {\n      return res.status(403).json({ error: 'Validação de segurança (Cloudflare) falhou. Tente novamente.' });\n    }`
);

code = code.replace(
  /const { loginId } = req\.body;/g,
  `const { loginId, turnstileToken } = req.body;\n\n    if (!(await verifyTurnstileToken(turnstileToken))) {\n      return res.status(403).json({ error: 'Validação de segurança (Cloudflare) falhou. Tente novamente.' });\n    }`
);

code = code.replace(
  /const { loginId, code, newPassword } = req\.body;/g,
  `const { loginId, code, newPassword, turnstileToken } = req.body;\n\n    if (!(await verifyTurnstileToken(turnstileToken))) {\n      return res.status(403).json({ error: 'Validação de segurança (Cloudflare) falhou. Tente novamente.' });\n    }`
);

fs.writeFileSync('backend/routers/auth.router.ts', code);
