const fs = require('fs');
let code = fs.readFileSync('backend/index.ts', 'utf8');

code = code.replace(
/return res\.status\(503\)\.json\(\{[\s\S]*?code: 'DATABASE_UNAVAILABLE'[\s\S]*?\}\);/g,
`return res.status(503).json({
      error: userErrors.dbDisconnected
    });`
);

fs.writeFileSync('backend/index.ts', code);
