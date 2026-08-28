const fs = require('fs');
let css = fs.readFileSync('src/admin-theme.css', 'utf8');

const replacement = `
/* Light Theme Overrides (Proton-inspired) */
[data-theme="light"] .admin-shell {
  --admin-bg: #f9f9fb;
  --admin-surface: #ffffff;
  --admin-surface-subtle: #f4f5f7;
  --admin-surface-hover: #f4f5f7;
  --admin-surface-active: #e2e4e9;
  
  --admin-border: #e6e8eb;
  
  --admin-text-main: #111111;
  --admin-text-muted: #6b7280;
  
  --admin-sidebar-bg: #f9f9fb;
  --admin-sidebar-border: #e6e8eb;
  --admin-sidebar-text: #111111;
  --admin-sidebar-text-muted: #6b7280;
  
  --admin-radius-xs: 6px;
  --admin-radius-sm: 8px;
  --admin-radius-md: 10px;
  --admin-radius-lg: 16px;
  --admin-radius-xl: 24px;
  
  --text-display: 2.25rem;
  --text-h1: 1.75rem; /* 28px */
  --text-h2: 1.5rem; /* 24px */
  --text-h3: 1.125rem; /* 18px */
  --text-body: 0.875rem; /* 14px */
  --text-body-sm: 0.8125rem; /* 13px */
  --text-caption: 0.75rem; /* 12px */
  
  --font-sans: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}
`;

css = css.replace(/\/\* Light Theme Overrides \(Proton-inspired\) \*\/[\s\S]*?(?=$)/, replacement.trim());
fs.writeFileSync('src/admin-theme.css', css);
