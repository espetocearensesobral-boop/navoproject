const fs = require('fs');
let code = fs.readFileSync('src/lib/api.ts', 'utf8');

code = code.replace(
  /const response = await fetch\(`\$\{API_BASE\}\$\{endpoint\}`/g,
  `const url = endpoint.startsWith('http') ? endpoint : \`\$\{API_BASE\}\$\{endpoint\}\`;\n  const response = await fetch(url`
);

const patchJson = `  // Intercept HTML responses from proxy/auth failures
  const originalJson = response.json.bind(response);
  response.json = async () => {
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/html') || response.url.includes('__cookie_check')) {
      throw new Error('Erro de conexão: O navegador bloqueou o acesso ou a sessão expirou. Se estiver no modo de visualização, tente abrir o app em uma nova guia.');
    }
    return originalJson();
  };

  if (response.status === 401`;

code = code.replace(/if \(response\.status === 401/, patchJson);

fs.writeFileSync('src/lib/api.ts', code);
