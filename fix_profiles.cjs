const fs = require('fs');
let code = fs.readFileSync('backend/routers/profiles.router.ts', 'utf8');

code = code.replace(
  /const \{ name, email, phone, birthday, password, role, id, avatar_url, avatarUrl, lgpdConsent, lgpdConsentDate, \.\.\.rest \} = req\.body;/,
  `const { name, email, phone, birthday, password, role, id, avatar_url, avatarUrl, lgpdConsent, lgpdConsentDate, turnstileToken, ...rest } = req.body;\n\n    if (!(await verifyTurnstileToken(turnstileToken))) {\n      return res.status(403).json({ error: 'Validação de segurança (Cloudflare) falhou. Tente novamente.' });\n    }`
);

fs.writeFileSync('backend/routers/profiles.router.ts', code);
