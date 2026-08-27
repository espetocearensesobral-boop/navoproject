const fs = require('fs');
let code = fs.readFileSync('src/components/admin/AdminAuthView.tsx', 'utf8');

// Imports
code = code.replace(
  /import \{ authFetch \} from "\.\.\/\.\.\/lib\/api";/,
  `import { authFetch } from "../../lib/api";\nimport { Turnstile } from '@marsidev/react-turnstile';`
);

// State
code = code.replace(
  /const \[showPassword, setShowPassword\] = useState\(false\);/,
  `const [showPassword, setShowPassword] = useState(false);\n  const [turnstileToken, setTurnstileToken] = useState<string>("");`
);

// Form submit
code = code.replace(
  /if \(!loginData\.password\) \{\n      setErrorMsg\("Informe a sua senha\."\);\n      return;\n    \}/,
  `if (!loginData.password) {\n      setErrorMsg("Informe a sua senha.");\n      return;\n    }\n    if (!turnstileToken) {\n      setErrorMsg("Por favor, confirme que você não é um robô.");\n      return;\n    }`
);

// Payload
code = code.replace(
  /password: loginData\.password,\n\s*\}\)/,
  `password: loginData.password,\n          turnstileToken,\n        })`
);

// Widget
code = code.replace(
  /<button\n\s*type="submit"/,
  `<div className="flex justify-center my-4">\n              <Turnstile\n                siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY || '1x00000000000000000000AA'}\n                onSuccess={(token) => setTurnstileToken(token)}\n                onError={() => setErrorMsg('Falha ao carregar o verificador de segurança. Atualize a página.')}\n              />\n            </div>\n            <button\n              type="submit"`
);

fs.writeFileSync('src/components/admin/AdminAuthView.tsx', code);
