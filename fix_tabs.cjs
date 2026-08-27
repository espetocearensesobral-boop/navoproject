const fs = require('fs');
const path = require('path');

const filePath = path.join('src', 'components', 'admin', 'NavoRewardsAdmin.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// I will extract everything between TAB 2 and TAB 3, and between TAB 4 and TAB 5, and rewrite them.

// ---------------- TAB 2 ----------------
const tab2Regex = /\{\/\* TAB 2: CLUBE DE FIDELIDADE & NÍVEIS \*\/\}([\s\S]*?)\{\/\* TAB 3: CATÁLOGO DE PRÊMIOS & CUPONS \*\/\}/;
const tab2New = `{/* TAB 2: CLUBE DE FIDELIDADE & NÍVEIS */}
      {activeTab === "loyalty" && (
        <div className="space-y-6 min-w-0">
          <form
            onKeyDown={handleEnterAsTab}
            onSubmit={handleSaveConfig}
            className="space-y-6"
          >
            <div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-[var(--admin-border)]">
                <div>
                  <h3 className="text-sm font-serif font-bold text-[var(--admin-text-main)] flex items-center gap-2">
                    <Crown className="w-4 h-4 text-[var(--admin-accent)]" />
                    <span>Pontos e validade</span>
                  </h3>
                  <p className="text-xs text-[var(--admin-text-muted)] mt-0.5">
                    Ajuste a taxa de conversão, multiplicadores e expiração.
                  </p>
                </div>
                <button
                  type="submit"
                  disabled={savingConfig}
                  className="h-9 px-4 rounded-[var(--admin-radius-lg)] bg-[var(--admin-accent)] text-[var(--admin-accent-text)] font-bold text-xs flex items-center gap-2 hover:bg-[var(--admin-accent)]/90 active:scale-95 disabled:opacity-50 whitespace-nowrap"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingConfig ? "Salvando..." : "Salvar Regras"}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[var(--admin-accent)] uppercase tracking-wider flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5" />
                    Razão de Conversão
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-[var(--admin-text-muted)] font-bold">
                      R$
                    </span>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      value={config.currencyPerPoint}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          currencyPerPoint: Number(e.target.value),
                        })
                      }
                      className="w-full bg-[var(--admin-bg)] border-b border-transparent focus:border-[var(--admin-accent)] rounded-none p-2 text-[var(--admin-text-main)] text-sm sm:text-xs font-bold focus:outline-none num-tabular"
                    />
                    <span className="text-[var(--admin-text-muted)] font-bold whitespace-nowrap">
                      = 1 Pts
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-[var(--admin-accent)] uppercase tracking-wider flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    Validade (Dias)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      value={config.expirationDays}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          expirationDays: Number(e.target.value),
                        })
                      }
                      className="w-full bg-[var(--admin-bg)] border-b border-transparent focus:border-[var(--admin-accent)] rounded-none p-2 text-[var(--admin-text-main)] text-sm sm:text-xs font-bold focus:outline-none num-tabular"
                    />
                    <span className="text-[var(--admin-text-muted)] font-bold">
                      dias
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-[var(--admin-accent)] uppercase tracking-wider flex items-center gap-1">
                    <Gift className="w-3.5 h-3.5" />
                    Bônus Aniversário
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      value={config.birthdayBonus}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          birthdayBonus: Number(e.target.value),
                        })
                      }
                      className="w-full bg-[var(--admin-bg)] border-b border-transparent focus:border-[var(--admin-accent)] rounded-none p-2 text-[var(--admin-text-main)] text-sm sm:text-xs font-bold focus:outline-none num-tabular"
                    />
                    <span className="text-[var(--admin-text-muted)] font-bold">
                      pts
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-3 text-xs text-[var(--admin-text-muted)]">
                As alterações afetam novos créditos. Saldos antigos não são recalculados.
              </div>
            </div>
          </form>

          <div className="space-y-4 pt-4 border-t border-[var(--admin-border)]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-[var(--admin-text-main)] flex items-center gap-2">
                  <Crown className="w-4 h-4 text-[var(--admin-accent)]" /> Níveis VIP
                </h3>
                <p className="text-xs text-[var(--admin-text-muted)] mt-0.5">
                  Mínimo de pontos e multiplicador aplicados no checkout.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setTiers((current) => [
                      ...current,
                      {
                        name: "Novo nível",
                        minimumPoints: 0,
                        multiplier: 1,
                        displayOrder: current.length,
                        color: "#D4AF5A",
                        isActive: true,
                      },
                    ])
                  }
                  className="admin-btn admin-btn-sm admin-btn-secondary font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Novo nível
                </button>
                <button
                  type="button"
                  onClick={handleSaveTiers}
                  disabled={savingTiers || tiers.length === 0}
                  className="admin-btn admin-btn-sm admin-btn-primary font-bold text-xs disabled:opacity-50 cursor-pointer"
                >
                  {savingTiers ? "Salvando..." : "Salvar níveis"}
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {tiers.map((tier, index) => (
                <div
                  key={tier.id || index}
                  className="flex flex-col sm:grid sm:grid-cols-[minmax(0,1fr)_120px_100px_82px_70px_auto] gap-3 sm:gap-4 items-center bg-[var(--admin-surface)] border-l-2 border-transparent hover:border-[var(--admin-accent)] p-3 transition-colors"
                >
                  <div className="w-full sm:w-auto">
                    <label className="block sm:hidden text-[10px] font-bold uppercase text-[var(--admin-text-muted)] mb-1">Nome do nível</label>
                    <input
                      value={tier.name}
                      onChange={(e) =>
                        setTiers((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, name: e.target.value }
                              : item,
                          ),
                        )
                      }
                      className="w-full sm:min-w-0 bg-transparent border-b border-[var(--admin-border)] rounded-none p-2 text-sm sm:text-xs font-bold text-[var(--admin-text-main)] focus:outline-none focus:border-[var(--admin-accent)]"
                      aria-label={\`Nome do nível \${index + 1}\`}
                    />
                  </div>

                  <div className="w-full sm:w-auto">
                    <label className="block sm:hidden text-[10px] font-bold uppercase text-[var(--admin-text-muted)] mb-1">Pts Mínimos</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={tier.minimumPoints}
                      onChange={(e) =>
                        setTiers((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, minimumPoints: Number(e.target.value) }
                              : item,
                          ),
                        )
                      }
                      className="w-full bg-[var(--admin-surface)] sm:bg-transparent border-b border-[var(--admin-border)] rounded-none p-2 text-sm sm:text-xs text-[var(--admin-text-main)] num-tabular focus:outline-none focus:border-[var(--admin-accent)]"
                    />
                  </div>

                  <div className="w-full sm:w-auto">
                    <label className="block sm:hidden text-[10px] font-bold uppercase text-[var(--admin-text-muted)] mb-1">Multiplicador</label>
                    <div className="relative w-full">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-bold text-[var(--admin-text-muted)]">
                        x
                      </span>
                      <input
                        type="number"
                        min="0.1"
                        step="0.1"
                        value={tier.multiplier}
                        onChange={(e) =>
                          setTiers((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, multiplier: Number(e.target.value) }
                                : item,
                            ),
                          )
                        }
                        className="w-full pl-6 bg-[var(--admin-surface)] sm:bg-transparent border-b border-[var(--admin-border)] rounded-none p-2 text-sm sm:text-xs text-[var(--admin-text-main)] num-tabular focus:outline-none focus:border-[var(--admin-accent)]"
                      />
                    </div>
                  </div>

                  <div className="w-full sm:w-auto">
                    <label className="block sm:hidden text-[10px] font-bold uppercase text-[var(--admin-text-muted)] mb-1">Cor</label>
                    <input
                      type="color"
                      value={tier.color}
                      onChange={(e) =>
                        setTiers((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, color: e.target.value }
                              : item,
                          ),
                        )
                      }
                      className="w-full h-8 sm:h-9 cursor-pointer rounded bg-transparent border-none p-0 focus:outline-none"
                    />
                  </div>

                  <div className="w-full sm:w-auto flex items-center justify-between sm:justify-center">
                    <label className="block sm:hidden text-[10px] font-bold uppercase text-[var(--admin-text-muted)] mb-1">Ativo</label>
                    <button
                      type="button"
                      onClick={() =>
                        setTiers((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, isActive: !item.isActive }
                              : item,
                          ),
                        )
                      }
                      className={\`w-10 h-5 rounded-full relative transition-colors focus:outline-none \${
                        tier.isActive ? "bg-status-success" : "bg-[var(--admin-border)]"
                      }\`}
                    >
                      <div
                        className={\`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform \${
                          tier.isActive ? "translate-x-5" : "translate-x-0"
                        }\`}
                      />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setTiers((current) =>
                        current.filter((_, itemIndex) => itemIndex !== index),
                      )
                    }
                    className="w-full sm:w-auto sm:p-2 flex items-center justify-center text-[var(--admin-text-muted)] hover:text-status-error focus:outline-none sm:opacity-50 sm:hover:opacity-100"
                    aria-label="Remover nível"
                  >
                    <Trash2 className="w-4 h-4 hidden sm:block" />
                    <span className="sm:hidden text-xs font-bold text-status-error flex items-center gap-1"><Trash2 className="w-3.5 h-3.5"/> Remover nível</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {/* TAB 3: CATÁLOGO DE PRÊMIOS & CUPONS */}`;

content = content.replace(tab2Regex, tab2New);

// ---------------- TAB 4 ----------------
const tab4Regex = /\{\/\* TAB 4: MOTOR DE INDICAÇÕES \*\/\}([\s\S]*?)\{\/\* TAB 5: AVALIAÇÕES & NPS \*\/\}/;
const tab4New = `{/* TAB 4: MOTOR DE INDICAÇÕES */}
      {activeTab === "referrals" && (
        <div className="space-y-8 min-w-0">
          <form
            onKeyDown={handleEnterAsTab}
            onSubmit={handleSaveConfig}
            className="space-y-6"
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-[var(--admin-border)]">
              <div>
                <h3 className="text-sm font-serif font-bold text-[var(--admin-text-main)] flex items-center gap-2">
                  <Users className="w-4 h-4 text-[var(--admin-accent)]" />
                  <span>Configuração do Motor</span>
                </h3>
                <p className="text-xs text-[var(--admin-text-muted)] mt-0.5">
                  Defina os bônus para indicações.
                </p>
              </div>
              <button
                type="submit"
                disabled={savingConfig}
                className="h-9 px-4 rounded-[var(--admin-radius-lg)] bg-[var(--admin-accent)] text-[var(--admin-accent-text)] font-bold text-xs flex items-center gap-2 hover:bg-[var(--admin-accent)]/90 active:scale-95 disabled:opacity-50 whitespace-nowrap"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{savingConfig ? "Salvando..." : "Salvar Regras"}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 pt-2">
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase text-[var(--admin-accent)] block">
                  Bônus de Quem Indica
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={config.referralPoints?.referrerBonus || 100}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        referralPoints: {
                          ...config.referralPoints,
                          referrerBonus: Number(e.target.value),
                        },
                      })
                    }
                    className="w-full bg-[var(--admin-bg)] border-b border-transparent focus:border-[var(--admin-accent)] rounded-none p-2 text-[var(--admin-text-main)] font-bold text-sm sm:text-xs num-tabular focus:outline-none"
                  />
                  <span className="text-[var(--admin-text-muted)] font-bold">
                    pts
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-xs font-bold uppercase text-[var(--admin-accent)] block">
                  Bônus do Amigo Indicado
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={config.referralPoints?.referredBonus || 50}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        referralPoints: {
                          ...config.referralPoints,
                          referredBonus: Number(e.target.value),
                        },
                      })
                    }
                    className="w-full bg-[var(--admin-bg)] border-b border-transparent focus:border-[var(--admin-accent)] rounded-none p-2 text-[var(--admin-text-main)] font-bold text-sm sm:text-xs num-tabular focus:outline-none"
                  />
                  <span className="text-[var(--admin-text-muted)] font-bold">
                    pts
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-xs font-bold uppercase text-[var(--admin-accent)] block">
                  Meta Amigos (Milestone)
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={config.referralPoints?.milestoneCount || 5}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        referralPoints: {
                          ...config.referralPoints,
                          milestoneCount: Number(e.target.value),
                        },
                      })
                    }
                    className="w-full bg-[var(--admin-bg)] border-b border-transparent focus:border-[var(--admin-accent)] rounded-none p-2 text-[var(--admin-text-main)] font-bold text-sm sm:text-xs num-tabular focus:outline-none"
                  />
                  <span className="text-[var(--admin-text-muted)] font-bold">
                    amigos
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-xs font-bold uppercase text-[var(--admin-accent)] block">
                  Bônus Extra (Milestone)
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={config.referralPoints?.milestoneBonus || 500}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        referralPoints: {
                          ...config.referralPoints,
                          milestoneBonus: Number(e.target.value),
                        },
                      })
                    }
                    className="w-full bg-[var(--admin-bg)] border-b border-transparent focus:border-[var(--admin-accent)] rounded-none p-2 text-[var(--admin-text-main)] font-bold text-sm sm:text-xs num-tabular focus:outline-none"
                  />
                  <span className="text-[var(--admin-text-muted)] font-bold">
                    pts
                  </span>
                </div>
              </div>
            </div>
          </form>

          {/* Gerador de Link de Indicação */}
          <div className="pt-6 border-t border-[var(--admin-border)] space-y-4">
            <h3 className="text-sm font-bold text-[var(--admin-text-main)] flex items-center gap-2">
              <Share2 className="w-4 h-4 text-[var(--admin-accent)]" />
              <span>Link de indicação (Gerador)</span>
            </h3>
            
            <div className="space-y-4 w-full">
              <div>
                <label className="block text-xs font-bold text-[var(--admin-text-muted)] uppercase tracking-wider mb-2">
                  Cliente remetente
                </label>
                <select
                  value={refClient?.id || ""}
                  onChange={(e) => {
                    const found = clients.find((c) => c.id === e.target.value);
                    if (found) setRefClient(found);
                  }}
                  className="w-full bg-[var(--admin-surface)] border-b border-[var(--admin-border)] p-2 text-[var(--admin-text-main)] focus:outline-none focus:border-[var(--admin-accent)]"
                >
                  <option value="">Selecione um cliente...</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} - Código: {c.referralCode || "Sem código"}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--admin-text-muted)] uppercase tracking-wider mb-2">
                  Mensagem do WhatsApp
                </label>
                <textarea
                  value={customRefMsg}
                  onChange={(e) => setCustomRefMsg(e.target.value)}
                  className="w-full bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-md p-3 text-sm sm:text-xs text-[var(--admin-text-main)] focus:outline-none focus:border-[var(--admin-accent)] min-h-[80px]"
                />
              </div>

              <div className="space-y-2 pt-2">
                <span className="text-[10px] font-bold uppercase text-[var(--admin-text-muted)] block">
                  Link Único
                </span>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    readOnly
                    value={generatedRefUrl}
                    className="flex-1 bg-[var(--admin-bg)] border-b border-[var(--admin-border)] p-2 text-xs font-mono text-[var(--admin-accent)] min-w-0"
                  />
                  <button
                    onClick={() => copyToClipboard(generatedRefUrl)}
                    className="h-10 sm:h-9 w-full sm:w-auto px-4 bg-[var(--admin-accent)] text-[var(--admin-accent-text)] font-bold text-xs rounded-md hover:bg-[var(--admin-accent)]/90 flex items-center justify-center gap-1"
                  >
                    {copiedLink ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedLink ? "Copiado!" : "Copiar"}</span>
                  </button>
                  {generatedRefUrl && (
                    <a
                      href={\`https://wa.me/?text=\${encodeURIComponent(
                        customRefMsg.replace("{link}", generatedRefUrl),
                      )}\`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="h-10 sm:h-9 w-full sm:w-auto px-4 border border-[#25D366] text-[#25D366] font-bold text-xs rounded-md hover:bg-[#25D366]/10 flex items-center justify-center gap-1"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Enviar Zap</span>
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* TAB 5: AVALIAÇÕES & NPS */}`;

content = content.replace(tab4Regex, tab4New);

fs.writeFileSync(filePath, content);
console.log('Fixed tabs 2 and 4');
