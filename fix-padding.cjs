const fs = require('fs');
let css = fs.readFileSync('src/admin-theme.css', 'utf8');

css = css.replace(
  /@media \(max-width: 1024px\) \{/,
  `@media (max-width: 1024px) {
  .admin-content-wrapper {
    padding: 10px 12px 72px 12px;
  }
`
);

fs.writeFileSync('src/admin-theme.css', css);
