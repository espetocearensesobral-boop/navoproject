const fs = require('fs');
let code = fs.readFileSync('src/components/client/ClientLoginModal.tsx', 'utf8');

// Imports
code = code.replace(
  /import \{ authFetch, readApiJson \} from '\.\.\/\.\.\/lib\/api';/,
  `import { authFetch, readApiJson } from '../../lib/api';\nimport { Turnstile } from '@marsidev/react-turnstile';`
);

// State
code = code.replace(
  /const \[modalTab, setModalTab\] = useState\<'terms' \| 'privacy' \| null\>\(null\);/,
  `const [modalTab, setModalTab] = useState<'terms' | 'privacy' | null>(null);\n  const [turnstileToken, setTurnstileToken] = useState<string>('');`
);

// Submits
code = code.replace(
  /body: JSON\.stringify\(\{ loginId: formData\.loginId \|\| formData\.email \}\)/,
  `body: JSON.stringify({ loginId: formData.loginId || formData.email, turnstileToken })`
);

code = code.replace(
  /body: JSON\.stringify\(\{\n\s*loginId: formData\.loginId \|\| formData\.email,\n\s*code: cleanInput,\n\s*newPassword: resetNewPassword\n\s*\}\)/,
  `body: JSON.stringify({\n            loginId: formData.loginId || formData.email,\n            code: cleanInput,\n            newPassword: resetNewPassword,\n            turnstileToken\n          })`
);

code = code.replace(
  /lgpdConsent: formData\.lgpdConsent,\n\s*lgpdConsentDate: new Date\(\)\.toISOString\(\),\n\s*referralCode: pendingRef \|\| undefined\n\s*\}\)/,
  `lgpdConsent: formData.lgpdConsent,\n            lgpdConsentDate: new Date().toISOString(),\n            referralCode: pendingRef || undefined,\n            turnstileToken\n          })`
);

code = code.replace(
  /loginId: formData\.loginId,\n\s*password: formData\.password\n\s*\}\)/,
  `loginId: formData.loginId,\n            password: formData.password,\n            turnstileToken\n          })`
);

// Widget injection
// I'll put it right above the submit buttons for each form
const turnstileWidget = `\n            <div className="flex justify-center my-4">\n              <Turnstile\n                siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY || '1x00000000000000000000AA'}\n                onSuccess={(token) => setTurnstileToken(token)}\n                onError={() => setErrorMsg('Falha ao carregar o verificador de segurança. Atualize a página.')}\n              />\n            </div>\n`;

code = code.replace(
  /(<button\n\s*type="submit"[\s\S]*?>\n\s*\{isSubmittingReset \?)/g,
  turnstileWidget + "$1"
);

code = code.replace(
  /(<button\n\s*type="submit"\n\s*disabled=\{isSubmittingForgot\}\n\s*className="btn-primary w-full")/g,
  turnstileWidget + "$1"
);

code = code.replace(
  /(<button\n\s*type="submit"\n\s*disabled=\{isSubmitting \|\| \(mode === 'register' \? !isRegisterValid : !isLoginValid\)\}\n\s*className="btn-primary w-full")/g,
  turnstileWidget + "$1"
);


// Validations
code = code.replace(
  /if \(!isForgotValid\) \{\n\s*setIsSubmittingForgot\(false\);\n\s*return;\n\s*\}/,
  `if (!isForgotValid || !turnstileToken) {\n        setErrorMsg("Por favor, confirme que você não é um robô antes de prosseguir.");\n        setIsSubmittingForgot(false);\n        return;\n      }`
);

code = code.replace(
  /if \(!isRegisterValid\) \{\n\s*setIsSubmitting\(false\);\n\s*return;\n\s*\}/,
  `if (!isRegisterValid || !turnstileToken) {\n        setErrorMsg("Por favor, confirme que você não é um robô e preencha todos os campos.");\n        setIsSubmitting(false);\n        return;\n      }`
);

code = code.replace(
  /if \(!isLoginValid\) \{\n\s*setIsSubmitting\(false\);\n\s*return;\n\s*\}/,
  `if (!isLoginValid || !turnstileToken) {\n        setErrorMsg("Por favor, confirme que você não é um robô.");\n        setIsSubmitting(false);\n        return;\n      }`
);

code = code.replace(
  /if \(!isResetValid\) \{\n\s*return;\n\s*\}/,
  `if (!isResetValid || !turnstileToken) {\n      setErrorMsg("Por favor, confirme que você não é um robô.");\n      return;\n    }`
);

fs.writeFileSync('src/components/client/ClientLoginModal.tsx', code);
