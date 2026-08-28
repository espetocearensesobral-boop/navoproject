const fs = require('fs');
let css = fs.readFileSync('src/admin-theme.css', 'utf8');

const replacement = `
/* Dark Theme Overrides (Proton-inspired) */
:root, [data-theme="dark"] .admin-shell {
  --admin-bg: #0f1115;
  --admin-surface: #191b23;
  --admin-surface-subtle: #1c1e26;
  --admin-surface-hover: #262833;
  --admin-surface-active: #323544;
  
  --admin-border: #2e303d;
  --admin-border-focus: #8b5cf6;
  
  --admin-text-main: #ffffff;
  --admin-text-muted: #8a8f98;
  
  --admin-accent: #8b5cf6;
  --admin-accent-hover: #a78bfa;
  --admin-accent-text: #ffffff;
  
  --admin-sidebar-bg: #0f1115;
  --admin-sidebar-border: #2e303d;
  --admin-sidebar-text: #ffffff;
  --admin-sidebar-text-muted: #8a8f98;
  
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

if (css.includes('/* Dark Theme Overrides (Proton-inspired) */')) {
  css = css.replace(/\/\* Dark Theme Overrides \(Proton-inspired\) \*\/[\s\S]*?(?=\/\* Light Theme Overrides|\n$)/, replacement.trim() + '\n\n');
} else {
  // Prepend it before Light Theme Overrides
  css = css.replace(/\/\* Light Theme Overrides \(Proton-inspired\) \*\//, replacement.trim() + '\n\n/* Light Theme Overrides (Proton-inspired) */');
}

fs.writeFileSync('src/admin-theme.css', css);
