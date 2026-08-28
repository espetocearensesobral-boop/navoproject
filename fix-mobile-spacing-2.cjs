const fs = require('fs');
let css = fs.readFileSync('src/admin-theme.css', 'utf8');

css = css.replace(/@media \(max-width: 767px\) \{\s*\/\* Remover espaços laterais no mobile[^}]+\}\s*\}/g, '');
// Clean up previous addition (it was added to the end)
css = css.replace(/\@media \(max-width: 767px\) \{[\s\S]*\}\n$/g, '');
css = css.replace(/\@media \(max-width: 767px\) \{[\s\S]*\}\s*$/g, '');

const newOverrides = `
@media (max-width: 767px) {
  /* Remover espaços laterais no mobile para melhor aproveitamento de tela */
  .admin-shell .admin-content-wrapper {
    padding-left: 0 !important;
    padding-right: 0 !important;
  }

  /* Remover bordas e arredondamentos de painéis (div, section, article) e formulários no mobile, 
     mas ignorando inputs, selects, botões e labels */
  .admin-shell .admin-content-wrapper div.rounded-\\[var\\(--admin-radius-lg\\)\\],
  .admin-shell .admin-content-wrapper section.rounded-\\[var\\(--admin-radius-lg\\)\\],
  .admin-shell .admin-content-wrapper article.rounded-\\[var\\(--admin-radius-lg\\)\\],
  .admin-shell .admin-content-wrapper form.rounded-\\[var\\(--admin-radius-lg\\)\\] {
    border-radius: 0 !important;
    border-left: none !important;
    border-right: none !important;
  }

  /* Para elementos que usavam borda em tudo, garantir divisórias */
  .admin-shell .admin-content-wrapper .space-y-2 > div.rounded-\\[var\\(--admin-radius-lg\\)\\] {
    border-top: 1px solid var(--admin-border) !important;
    border-bottom: 1px solid var(--admin-border) !important;
    margin-bottom: -1px;
  }
  
  /* Para a página de configurações, manter uma pequena margem/padding e visual de painel?
     O usuário pediu para remover de tabela ou formulários.
     Muitos formulários ficam soltos.
     Vamos focar nos cards.
  */
}
`;

css += '\n' + newOverrides;
fs.writeFileSync('src/admin-theme.css', css);
