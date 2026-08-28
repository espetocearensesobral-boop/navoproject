const fs = require('fs');
let css = fs.readFileSync('src/admin-theme.css', 'utf8');

const mobileOverrides = `
@media (max-width: 767px) {
  /* Remover espaços laterais no mobile para melhor aproveitamento de tela */
  .admin-shell .admin-content-wrapper {
    padding-left: 0 !important;
    padding-right: 0 !important;
  }

  /* Remover bordas e arredondamentos dos painéis principais no mobile */
  .admin-shell .admin-content-wrapper .rounded-\\[var\\(--admin-radius-lg\\)\\] {
    border-radius: 0 !important;
    border-left: none !important;
    border-right: none !important;
    border-top: none !important; /* Opicional, mas ajuda a criar divisões limpas */
  }

  /* Garantir que as listas no mobile (que muitas vezes usam space-y-2) tenham uma linha separadora simples */
  .admin-shell .admin-content-wrapper .space-y-2 > .rounded-\\[var\\(--admin-radius-lg\\)\\] {
    border-top: 1px solid var(--admin-border) !important;
    border-bottom: 1px solid var(--admin-border) !important;
    margin-bottom: -1px;
  }
}
`;

css += '\n' + mobileOverrides;
fs.writeFileSync('src/admin-theme.css', css);
