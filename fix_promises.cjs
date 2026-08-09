const fs = require('fs');
let code = fs.readFileSync('src/services/supabaseDataService.ts', 'utf8');

code = code.replace(/throw err;\n\s*\} finally \{/g, 'return [];\n    } finally {');

fs.writeFileSync('src/services/supabaseDataService.ts', code);
console.log("Promises fixed.");
