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
  .admin-shell .admin-content-wrapper .admin-content-transition > div > div[class*="rounded-"][class*="border"]:not([class*="h-"]):not([class*="w-"]):not([class*="inline-"]),
  .admin-shell .admin-content-wrapper .admin-content-transition > div > section[class*="rounded-"][class*="border"]:not([class*="h-"]):not([class*="w-"]):not([class*="inline-"]),
  .admin-shell .admin-content-wrapper .admin-content-transition > div > form[class*="rounded-"][class*="border"]:not([class*="h-"]):not([class*="w-"]):not([class*="inline-"]),
  
  /* Grids de layout de página (Fila de Espera) */
  .admin-shell .admin-content-wrapper .admin-content-transition > div > .grid > div > div[class*="rounded-"][class*="border"]:not([class*="h-"]):not([class*="w-"]):not([class*="inline-"]),
  .admin-shell .admin-content-wrapper .admin-content-transition > div > .grid > div > section[class*="rounded-"][class*="border"]:not([class*="h-"]):not([class*="w-"]):not([class*="inline-"]),
  .admin-shell .admin-content-wrapper .admin-content-transition > div > .grid > div > form[class*="rounded-"][class*="border"]:not([class*="h-"]):not([class*="w-"]):not([class*="inline-"]),
  
  /* Grids aninhados */
  .admin-shell .admin-content-wrapper .admin-content-transition > div > div > div > div[class*="rounded-"][class*="border"]:not([class*="h-"]):not([class*="w-"]):not([class*="inline-"]),
  .admin-shell .admin-content-wrapper .admin-content-transition > div > div > div > section[class*="rounded-"][class*="border"]:not([class*="h-"]):not([class*="w-"]):not([class*="inline-"]),
  .admin-shell .admin-content-wrapper .admin-content-transition > div > div > div > form[class*="rounded-"][class*="border"]:not([class*="h-"]):not([class*="w-"]):not([class*="inline-"]) {
    margin-left: -12px !important;
    margin-right: -12px !important;
    border-radius: 0 !important;
    border-left: none !important;
    border-right: none !important;
    width: auto !important;
  }

  /* 4. Listas contínuas (divide-y) */
  .admin-shell .admin-content-wrapper .divide-y > article,
  .admin-shell .admin-content-wrapper .divide-y > div {
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
