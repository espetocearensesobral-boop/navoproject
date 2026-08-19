# Changelog

## [0.3.0] — 2026-08-19

### Evolução premium do painel administrativo

- Empty states reutilizáveis para Clientes, Serviços, Fila e atendimentos do dashboard, com ações contextuais e diferenciação entre lista vazia, filtro sem resultado e erro de carregamento.
- Toast global aprimorado para mobile, com safe area, semântica de status/erro e fechamento acessível.
- Validação Zod por campo no cadastro e edição de clientes, com feedback visual e atributos ARIA.
- Formulários de Clientes e Recebimentos refinados como drawers mobile, com foco controlado, alça visual e melhor ergonomia em telas estreitas.

### Operações e segurança

- Exclusão de clientes migrada de `window.confirm()` para `ConfirmDialog` acessível.
- Estado de exclusão com spinner, bloqueio contra cliques duplicados e feedback global de sucesso ou erro.
- Regras de backend e vínculos existentes preservados durante a exclusão.

### Busca e qualidade de interação

- Busca de Clientes com debounce e parâmetro server-side opcional por nome, e-mail ou telefone.
- Consultas administrativas com limite de 100 resultados quando há busca ativa.
- Cards da lista de Clientes com entrada suave, atraso escalonado limitado e respeito a `prefers-reduced-motion`.
- Versão do pacote, lockfile e documentação pública sincronizados em `0.3.0`.

## [0.2.0] — 2026-08-19

### Experiência mobile do painel administrativo

- Botão de alternância de tema reintroduzido na topbar mobile e disponibilizado também no drawer.
- Shell mobile ajustado com topbar e bottom bar respeitando áreas seguras de notch e indicador de gesto.
- Drawer mobile passou a usar entrada/saída por transform, overlay com fade, fechamento por toque externo e suporte a `inert` quando fechado.
- Navegação mobile recebeu alvos de toque maiores, estados pressed, feedback háptico leve e indicação semântica da página ativa.
- Conteúdo administrativo passou a usar transição curta de fade-through entre áreas, sem animações decorativas excessivas.
- Política de animações do admin deixou de bloquear todo movimento e passou a manter somente `pulse` e `ping` decorativos bloqueados, respeitando `prefers-reduced-motion`.

### Carregamento e leitura

- Criado `AdminSkeleton`, `AdminListSkeleton` e `AdminPageSkeleton` com shimmer discreto e estados `aria-busy`.
- Skeletons aplicados ao dashboard, agenda, fila, clientes, recebimentos e extrato financeiro.
- Feed de atendimentos recebeu placeholders estruturais e ações com feedback de toque mais responsivo.

## [0.1.0] — 2026-08-19

### Segurança e integridade

- Migração da sessão do cliente e do painel para cookie HTTP-only, removendo JWT do corpo de login/cadastro e o armazenamento de token em `localStorage`.
- Cookie de sessão com `secure` dependente do ambiente e logout centralizado.
- CSP de produção ativada com scripts inline extraídos para `public/bootstrap.js`.
- CORS e validação de origem restringidos a domínios configurados e localhost apenas em desenvolvimento.
- Vinculação da fila de visitantes limitada ao telefone correspondente.
- Cancelamento e reagendamento sem autorização por telefone isolado.
- Consultas por telefone substituídas por busca parametrizada, sem o limite artificial de 500 registros.
- Redefinição de senha alinhada à mesma política forte do cadastro.

### Booking e experiência

- Confirmação final distingue agendamento confirmado de solicitação pendente de aprovação.
- Voucher passou a ser exibido somente após retorno oficial do servidor.
- Método de pagamento alinhado ao fluxo implementado: pagamento no local.
- Estados de erro de catálogo e disponibilidade passaram a oferecer mensagens específicas e retry.
- Cartões de agendamento receberam navegação por teclado e semântica acessível.
- Modais principais receberam focus trap, títulos ARIA e botões de fechamento rotulados.
- Confirmação respeita `prefers-reduced-motion`.
- Histórico passa a ordenar por data e horário.

### Qualidade e documentação

- Adicionado script `pnpm test` com testes de contrato para booking, pagamentos, telefone, datas e cookie de sessão.
- README atualizado com a versão e o checklist de testes.
- Versão do pacote atualizada de `0.0.0` para `0.1.0`.
