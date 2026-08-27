const fs = require('fs');
const path = require('path');

const filePath = path.join('src', 'components', 'admin', 'FollowUpActionModal.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const importsToAdd = `import { AdminModalV2 } from "./shared/AdminModalV2";\n`;
if (!content.includes('AdminModalV2')) {
  content = content.replace(/import \{ authFetch \} from "\.\.\/\.\.\/lib\/api";/, `import { authFetch } from "../../lib/api";\n${importsToAdd}`);
}

const replacement = `return (
    <AdminModalV2
      icon={Bot}
      eyebrow="Follow-up"
      title={\`Recuperar \${client.name.split(" ")[0]}\`}
      subtitle={\`Ausente há \${client.daysSinceLastVisit || "?"} dias\`}
      onClose={onClose}
      size="md"
      accent="whatsapp"
      footer={
        !success && (
          <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-2 sm:gap-3 w-full">
            <button
              type="button"
              onClick={onClose}
              disabled={sending}
              className="px-4 h-11 sm:h-10 rounded-[var(--admin-radius-lg)] font-bold text-sm text-[var(--admin-text-muted)] hover:bg-[var(--admin-border)] transition-colors disabled:opacity-50 w-full sm:w-auto"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={!message.trim() || sending || !client.hasPhone}
              className="px-5 h-11 sm:h-10 rounded-[var(--admin-radius-lg)] bg-[var(--admin-accent)] text-[var(--admin-accent-text)] font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 transition-opacity w-full sm:w-auto"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Enviar via Bot
            </button>
          </div>
        )
      }
    >
      <div className="p-4 sm:p-5 space-y-4">
        {success ? (
          <div className="py-10 flex flex-col items-center justify-center text-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-status-success/20 flex items-center justify-center text-status-success">
              <MessageSquare className="w-8 h-8" />
            </div>
            <p className="text-lg font-bold text-[var(--admin-text-main)]">Mensagem enviada!</p>
            <p className="text-sm text-[var(--admin-text-muted)]">
              A conversa foi iniciada pelo bot.
            </p>
          </div>
        ) : (
          <>
            {error && (
              <div className="p-3 rounded-[var(--admin-radius-lg)] bg-status-error/10 border border-status-error/30 text-status-error text-sm font-semibold">
                {error}
              </div>
            )}
            
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-bold text-[var(--admin-text-main)] block">
                  Mensagem de Follow-up
                </label>
                <button
                  type="button"
                  onClick={generateWithAI}
                  disabled={loadingAI}
                  className="text-xs flex items-center gap-1 font-semibold text-[var(--admin-accent)] hover:opacity-80 disabled:opacity-50"
                >
                  {loadingAI ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  Gerar com IA
                </button>
              </div>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Escreva a mensagem ou gere com IA..."
                className="w-full h-32 p-3 bg-[var(--admin-bg)] border border-[var(--admin-border)] rounded-[var(--admin-radius-lg)] text-sm text-[var(--admin-text-main)] focus:outline-none focus:border-[var(--admin-accent)] resize-none"
              />
            </div>

            {!client.hasPhone && (
              <p className="text-xs text-status-warning flex items-center gap-1">
                <Phone className="w-3 h-3" />
                Este cliente não possui telefone válido.
              </p>
            )}
          </>
        )}
      </div>
    </AdminModalV2>
  );
};
`;

const replaceRegex = /return createPortal\([\s\S]*\}\;/;
if (replaceRegex.test(content)) {
  content = content.replace(replaceRegex, replacement);
}

fs.writeFileSync(filePath, content);
console.log('Fixed FollowUpActionModal to AdminModalV2');
