# Changelog

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
