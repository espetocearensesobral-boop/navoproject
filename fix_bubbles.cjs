const fs = require('fs');
const path = require('path');

const filePath = path.join('src', 'components', 'admin', 'WhatsAppInboxManagement.tsx');
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(
  /className=\{`max-w-\[85%\] rounded-\[var\(--admin-radius-lg\)\] p-2\.5 text-xs \$\{\n\s*isInbound\n\s*\? "bg-\[var\(--admin-bg\)\] border border-\[var\(--admin-border\)\] text-\[var\(--admin-text-main\)\]"\n\s*: "bg-\[var\(--admin-accent\)\] text-\[var\(--admin-accent-text\)\] font-medium"\n\s*\}`\}/,
  \`className={\\\`max-w-[85%] rounded-[var(--admin-radius-lg)] p-2.5 text-xs \${
    isInbound
      ? "bg-[var(--admin-bg)] border border-[var(--admin-border)] text-[var(--admin-text-main)]"
      : "bg-[var(--admin-accent)]/10 border border-[var(--admin-accent)]/20 text-[var(--admin-text-main)]"
  }\\\`}\`
);

content = content.replace(
  /className=\{`text-\[9px\] mt-1 text-right \$\{\n\s*isInbound \? "text-\[var\(--admin-text-muted\)\]" : "opacity-70"\n\s*\}`\}/,
  \`className="text-[9px] mt-1 text-right text-[var(--admin-text-muted)]"\`
);

fs.writeFileSync(filePath, content);
console.log('Fixed bubbles in inbox');
