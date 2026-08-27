const fs = require('fs');
const path = require('path');

const filePath = path.join('src', 'components', 'admin', 'AdminLayout.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const regex = /const navGroups: \{ label: string; tabs: AdminTab\[\] \}\[\] = \[\s*\{ label:"Operação", tabs: \["dashboard","agenda","queue","atendimento"\] \},[\s\S]*?\{ label:"Configuração", tabs: \["sistema"\] \},\s*\];/;

const newNavGroups = `const navGroups: { label: string; tabs: AdminTab[] }[] = [
  { label: "Operação", tabs: ["dashboard", "agenda", "queue", "atendimento"] },
  {
    label: "Clientes & CRM",
    tabs: [
      "clientes",
      "relacionamento_overview",
      "relacionamento_followup",
      "relacionamento_reviews",
      "relacionamento_birthdays",
    ],
  },
  {
    label: "Financeiro",
    tabs: [
      "financeiro_recebimentos",
      "financeiro_extrato",
      "financeiro_saidas",
    ],
  },
  {
    label: "Gestão",
    tabs: ["relatorios", "catalogo"],
  },
  {
    label: "Marketing & Retenção",
    tabs: ["campanhas", "fidelidade", "premios", "assinaturas", "indicacoes"],
  },
  { label: "Configuração", tabs: ["lembretes", "sistema"] },
];`;

content = content.replace(regex, newNavGroups);
fs.writeFileSync(filePath, content);
console.log('Fixed nav groups');
