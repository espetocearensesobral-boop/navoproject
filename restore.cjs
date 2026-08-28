const fs = require('fs');
let css = fs.readFileSync('src/admin-theme.css', 'utf8');

css = css.replace(
  /\.admin-content-wrapper \{\s*max-width: 100%;\s*width: 100%;\s*margin: 0;\s*padding: 14px 16px 36px 16px;\s*box-sizing: border-box;\s*\}/g,
  ".admin-content-wrapper {\n  max-width: 100%;\n  width: 100%;\n  margin: 0;\n  padding: 14px 16px 36px 16px;\n  box-sizing: border-box;\n}\n\n@media (max-width: 1024px) {\n  .admin-content-wrapper {\n    padding: 10px 12px 72px 12px;\n  }\n}"
);

fs.writeFileSync('src/admin-theme.css', css);
