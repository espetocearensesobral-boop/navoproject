const fs = require('fs');
let css = fs.readFileSync('src/admin-theme.css', 'utf8');

// Remove everything after the previous fix script to start fresh
css = css.replace(/@media \(max-width: 1024px\) \{[\s\S]*\}\s*$/g, '');

const finalOverrides = `
@media (max-width: 1024px) {
  /* No mobile, painéis e tabelas encostam nas laterais (edge-to-edge).
     Isso ganha área útil pois elimina o espaçamento duplo (padding do shell + padding do card).
  */
  
  .admin-shell .admin-content-wrapper .admin-table-container,
  .admin-shell .admin-content-wrapper div.rounded-\\[var\\(--admin-radius-lg\\)\\].bg-\\[var\\(--admin-surface\\)\\],
  .admin-shell .admin-content-wrapper section.rounded-\\[var\\(--admin-radius-lg\\)\\].bg-\\[var\\(--admin-surface\\)\\],
  .admin-shell .admin-content-wrapper form.rounded-\\[var\\(--admin-radius-lg\\)\\].bg-\\[var\\(--admin-surface\\)\\] {
    margin-left: -12px !important;
    margin-right: -12px !important;
    border-radius: 0 !important;
    border-left: none !important;
    border-right: none !important;
    width: auto !important;
  }

  /* Listas que não possuem o rounded explicitamente */
  .admin-shell .admin-content-wrapper .divide-y > article.bg-\\[var\\(--admin-surface\\)\\],
  .admin-shell .admin-content-wrapper .divide-y > div.bg-\\[var\\(--admin-surface\\)\\] {
    margin-left: -12px !important;
    margin-right: -12px !important;
    border-left: none !important;
    border-right: none !important;
    border-radius: 0 !important;
    width: auto !important;
  }
}
`;

css += '\n' + finalOverrides;
fs.writeFileSync('src/admin-theme.css', css);
