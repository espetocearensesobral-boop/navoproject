const fs = require('fs');
let css = fs.readFileSync('src/admin-theme.css', 'utf8');

// Replace everything inside @media (max-width: 1024px) related to edge-to-edge
css = css.replace(/@media \(max-width: 1024px\) \{[\s\S]*$/g, '');

const finalOverrides = `
@media (max-width: 1024px) {
  .admin-content-wrapper {
    padding: 10px 12px 72px 12px;
  }

  /* 
    Edge-to-Edge para Painéis e Tabelas no Mobile.
    Para otimizar o espaço, as "caixas" principais colam nas margens.
  */

  /* 1. Containers explícitos de tabelas */
  .admin-shell .admin-content-wrapper .admin-table-container,
  .admin-shell .admin-content-wrapper .admin-table-wrap,
  .admin-shell .admin-content-wrapper .admin-card {
    margin-left: -12px !important;
    margin-right: -12px !important;
    border-radius: 0 !important;
    border-left: none !important;
    border-right: none !important;
    width: auto !important;
  }

  /* 2. Painéis Principais (Cards de Settings, Configs, Blocos da Fila, Formulários Gerais) */
  /* Utilizamos a hierarquia para atingir as "caixas" estruturais de nível superior */
  .admin-shell .admin-content-wrapper .admin-content-transition > div > div[class*="rounded-"][class*="border"],
  .admin-shell .admin-content-wrapper .admin-content-transition > div > section[class*="rounded-"][class*="border"],
  .admin-shell .admin-content-wrapper .admin-content-transition > div > form[class*="rounded-"][class*="border"],
  
  /* Grids de layout de página (Fila de Espera) */
  .admin-shell .admin-content-wrapper .admin-content-transition > div > .grid > div > div[class*="rounded-"][class*="border"],
  .admin-shell .admin-content-wrapper .admin-content-transition > div > .grid > div > section[class*="rounded-"][class*="border"],
  .admin-shell .admin-content-wrapper .admin-content-transition > div > .grid > div > form[class*="rounded-"][class*="border"],
  
  /* Grids aninhados */
  .admin-shell .admin-content-wrapper .admin-content-transition > div > div > div > div[class*="rounded-"][class*="border"],
  .admin-shell .admin-content-wrapper .admin-content-transition > div > div > div > section[class*="rounded-"][class*="border"],
  .admin-shell .admin-content-wrapper .admin-content-transition > div > div > div > form[class*="rounded-"][class*="border"] {
    margin-left: -12px !important;
    margin-right: -12px !important;
    border-radius: 0 !important;
    border-left: none !important;
    border-right: none !important;
    width: auto !important;
  }

  /* 3. Evitar que elementos pequenos de UI "vazem" caso sejam pegos pela regra acima */
  .admin-shell .admin-content-wrapper .admin-content-transition [class*="h-9"],
  .admin-shell .admin-content-wrapper .admin-content-transition [class*="h-10"],
  .admin-shell .admin-content-wrapper .admin-content-transition [class*="h-8"],
  .admin-shell .admin-content-wrapper .admin-content-transition [class*="w-8"],
  .admin-shell .admin-content-wrapper .admin-content-transition [class*="w-9"],
  .admin-shell .admin-content-wrapper .admin-content-transition [class*="w-10"],
  .admin-shell .admin-content-wrapper .admin-content-transition [class*="min-h-11"],
  .admin-shell .admin-content-wrapper .admin-content-transition [class*="rounded-[var(--admin-radius-full)]"],
  .admin-shell .admin-content-wrapper .admin-content-transition [class*="inline-flex"],
  .admin-shell .admin-content-wrapper .admin-content-transition .admin-page-header-icon {
    margin-left: 0 !important;
    margin-right: 0 !important;
    border-radius: inherit !important;
    border: inherit !important;
  }

  /* 4. Listas contínuas (divide-y) */
  .admin-shell .admin-content-wrapper .divide-y > article[class*="rounded-"],
  .admin-shell .admin-content-wrapper .divide-y > div[class*="rounded-"] {
    margin-left: -12px !important;
    margin-right: -12px !important;
    border-left: none !important;
    border-right: none !important;
    border-radius: 0 !important;
    width: auto !important;
  }
}
`;

css += finalOverrides;
fs.writeFileSync('src/admin-theme.css', css);
