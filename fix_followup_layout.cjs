const fs = require('fs');
const path = require('path');

const filePath = path.join('src', 'components', 'admin', 'FollowUpManagement.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const regexToReplace = /<article[\s\S]*?<\/article>/g;

let replaced = false;
content = content.replace(regexToReplace, (match) => {
  if (replaced) return match;
  if (!match.includes('key={client.id}')) return match;
  replaced = true;
  return `<article
                  key={client.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-4 transition-colors hover:bg-[var(--admin-bg)]"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-11 h-11 rounded-[var(--admin-radius-full)] bg-[var(--admin-accent)]/10 text-[var(--admin-accent)] flex items-center justify-center font-bold shrink-0">
                      {client.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-bold text-[var(--admin-text-main)] truncate">
                          {client.name}
                        </h3>
                        <span className="px-2 py-1 rounded-[var(--admin-radius-sm)] bg-[var(--admin-bg)] border border-[var(--admin-border)] text-xs text-[var(--admin-text-muted)]">
                          {client.loyaltyTier}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--admin-text-muted)] mt-0.5">
                        Última visita: {formatDate(client.lastVisit)} · {client.appointmentCount} atend.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 mt-2 sm:mt-0 pt-3 sm:pt-0 border-t border-[var(--admin-border)] sm:border-0">
                    <div className="sm:text-right shrink-0">
                      <p className="text-xs uppercase tracking-wider text-[var(--admin-text-muted)]">
                        Ausente há
                      </p>
                      <p className="text-sm font-black text-status-warning">
                        {client.daysSinceLastVisit === null
                          ? "Sem histórico"
                          : \`\${client.daysSinceLastVisit} dias\`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {client.hasPhone && (
                        <a
                          href={whatsappUrl(client.phone)}
                          target="_blank"
                          rel="noreferrer"
                          title="Abrir WhatsApp"
                          className="w-10 h-10 rounded-[var(--admin-radius-lg)] border border-status-success/30 text-status-success flex items-center justify-center"
                        >
                          <Phone className="w-4 h-4" />
                        </a>
                      )}
                      {client.hasEmail && (
                        <a
                          href={\`mailto:\${client.email}\`}
                          title="Enviar e-mail"
                          className="w-10 h-10 rounded-[var(--admin-radius-lg)] border border-[var(--admin-accent)]/30 text-[var(--admin-accent)] flex items-center justify-center"
                        >
                          <Mail className="w-4 h-4" />
                        </a>
                      )}
                      {client.hasPhone && (
                        <button
                          type="button"
                          onClick={() => setSelectedClient(client)}
                          title="Mensagem Inteligente"
                          className="w-10 h-10 rounded-[var(--admin-radius-lg)] border border-[var(--admin-accent)]/30 text-[var(--admin-accent)] flex items-center justify-center hover:bg-[var(--admin-accent)]/10 transition-colors"
                        >
                          <Bot className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </article>`;
});

fs.writeFileSync(filePath, content);
console.log('Fixed FollowUpManagement layouts');
