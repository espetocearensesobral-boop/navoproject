const fs = require('fs');
let code = fs.readFileSync('backend/index.ts', 'utf8');

code = code.replace(
/await dbReadyPromise\.catch\(\(\) => \{\}\);\n\s*return next\(\);\n\s*\}/g,
`await dbReadyPromise.catch(() => {});\n  if (req.path === '/api/health' || req.path === '/api/whatsapp/status') {\n    return next();\n  }`
);

fs.writeFileSync('backend/index.ts', code);
