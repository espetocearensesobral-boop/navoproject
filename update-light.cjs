const fs = require('fs');
let css = fs.readFileSync('src/admin-theme.css', 'utf8');

const replacement = `
/* Light Theme Overrides (Proton-inspired) */
[data-theme="light"] .admin-shell {
  --admin-bg: #f6f6f8;
  --admin-surface: #ffffff;
  --admin-surface-subtle: #fafafa;
  --admin-surface-hover: #f1f1f4;
  --admin-surface-active: #e5e7eb;
  
  --admin-border: #e2e4e9;
  
  --admin-text-main: #0f1115;
  --admin-text-muted: #6b7280;
  
  --admin-sidebar-bg: #f6f6f8;
  --admin-sidebar-border: #e2e4e9;
  --admin-sidebar-text: #0f1115;
  --admin-sidebar-text-muted: #6b7280;
  
  --admin-radius-xs: 6px;
  --admin-radius-sm: 8px;
  --admin-radius-md: 10px;
  --admin-radius-lg: 16px;
  --admin-radius-xl: 24px;
  
  --text-display: 2rem;
  --text-h1: 1.5rem; /* 24px */
  --text-h2: 1.125rem; /* 18px */
  --text-h3: 0.9375rem; /* 15px */
  --text-body: 0.875rem; /* 14px */
  --text-body-sm: 0.8125rem; /* 13px */
  --text-caption: 0.75rem; /* 12px */
}
`;

css = css.replace(/\/\* Light Theme Overrides \(Proton-inspired\) \*\/[\s\S]*?(?=$)/, replacement.trim());
fs.writeFileSync('src/admin-theme.css', css);
