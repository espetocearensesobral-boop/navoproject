const fs = require('fs');
let css = fs.readFileSync('src/admin-theme.css', 'utf8');

// Remover os overrides ruins do passo anterior
css = css.replace(/@media \(max-width: 767px\) \{[\s\S]*\}\s*$/g, '');

const perfectOverrides = `
@media (max-width: 1024px) {
  /* Painéis, formulários e tabelas aproveitam a tela inteira (edge-to-edge) 
     usando margem negativa para compensar o padding do admin-content-wrapper,
     mas apenas para elementos com bg-[var(--admin-surface)] e bordas arredondadas. */
  .admin-shell .admin-content-wrapper div.rounded-\\[var\\(--admin-radius-lg\\)\\].bg-\\[var\\(--admin-surface\\)\\],
  .admin-shell .admin-content-wrapper section.rounded-\\[var\\(--admin-radius-lg\\)\\].bg-\\[var\\(--admin-surface\\)\\],
  .admin-shell .admin-content-wrapper form.rounded-\\[var\\(--admin-radius-lg\\)\\].bg-\\[var\\(--admin-surface\\)\\] {
    margin-left: -12px !important;
    margin-right: -12px !important;
    border-radius: 0 !important;
    border-left: none !important;
    border-right: none !important;
  }

  /* Listas que também têm bg-surface mas podem não ter radius-lg explicitamente (como products management mobile) */
  .admin-shell .admin-content-wrapper .divide-y > article.bg-\\[var\\(--admin-surface\\)\\],
  .admin-shell .admin-content-wrapper .divide-y > div.bg-\\[var\\(--admin-surface\\)\\] {
    margin-left: -12px !important;
    margin-right: -12px !important;
    border-left: none !important;
    border-right: none !important;
    border-radius: 0 !important;
  }
}
`;

css += '\n' + perfectOverrides;
fs.writeFileSync('src/admin-theme.css', css);
