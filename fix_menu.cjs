const fs = require('fs');
const path = require('path');

const filePath = path.join('src', 'components', 'admin', 'AdminLayout.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Move 'lembretes' into the Clientes e CRM group
content = content.replace(
  /"relacionamento_birthdays",\n\s*\],\n\s*\},/g,
  `"relacionamento_birthdays",\n      "lembretes",\n    ],\n  },`
);

// Remove 'lembretes' from Configuração
content = content.replace(
  /\{ label: "Configuração", tabs: \["lembretes", "sistema"\] \},/g,
  `{ label: "Configuração", tabs: ["sistema"] },`
);

// Change the label for relacionamento_birthdays
content = content.replace(
  /id: "relacionamento_birthdays" as AdminTab,\n\s*label: "Aniversariantes",/g,
  `id: "relacionamento_birthdays" as AdminTab,\n    label: "Lembrete de aniversário",`
);

// We should also replace the bottom bar if needed? No, bottom bar is just Dashboard, Agenda, Queue
fs.writeFileSync(filePath, content);
console.log('Fixed menu');
