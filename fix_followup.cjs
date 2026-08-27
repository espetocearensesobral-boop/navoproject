const fs = require('fs');
const path = require('path');

const filePath = path.join('src', 'components', 'admin', 'FollowUpManagement.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// replace the end of the return statement
content = content.replace(/<\/div>\s*<\/div>\s*\);\s*};\s*$/, 
`      </div>
      {selectedClient && (
        <FollowUpActionModal
          client={selectedClient}
          onClose={() => setSelectedClient(null)}
        />
      )}
    </div>
  );
};
`);

// Add Bot import if not there
if (!content.includes('Bot,')) {
  content = content.replace(/import \{([^}]+)\} from "lucide-react";/, 'import { $1, Bot } from "lucide-react";');
}

// add Action button
content = content.replace(
  /\{client\.hasEmail && \(\s*<a[\s\S]*?<\/a>\s*\)\}/,
  `$&
              {client.hasPhone && (
                <button
                  type="button"
                  onClick={() => setSelectedClient(client)}
                  title="Mensagem Inteligente"
                  className="w-10 h-10 rounded-[var(--admin-radius-lg)] border border-[var(--admin-accent)]/30 text-[var(--admin-accent)] flex items-center justify-center hover:bg-[var(--admin-accent)]/10 transition-colors"
                >
                  <Bot className="w-4 h-4" />
                </button>
              )}`
);

fs.writeFileSync(filePath, content);
console.log('Fixed followup');
