const fs = require('fs');
let css = fs.readFileSync('src/admin-theme.css', 'utf8');

const lightSidebarOverrides = `
  --admin-sidebar-bg: #0f1115;
  --admin-sidebar-border: #2e303d;
  --admin-sidebar-text: #ffffff;
  --admin-sidebar-text-muted: #8a8f98;
`;

css = css.replace(
  /--admin-sidebar-bg: #f9f9fb;\s*--admin-sidebar-border: #e6e8eb;\s*--admin-sidebar-text: #111111;\s*--admin-sidebar-text-muted: #6b7280;/g,
  lightSidebarOverrides.trim()
);

fs.writeFileSync('src/admin-theme.css', css);
