# Pesquisa de integração Google Ads API

Atualizada em 22/08/2026.

## Fontes oficiais

- Quick start: https://developers.google.com/google-ads/api/docs/get-started/make-first-call
- OAuth 2.0: https://developers.google.com/google-ads/api/docs/oauth/overview
- Onboarding: https://developers.google.com/google-ads/api/docs/get-started/onboarding
- Orçamento de campanhas: https://developers.google.com/google-ads/api/docs/campaigns/budgets/overview
- Introdução: https://developers.google.com/google-ads/api/docs/get-started/introduction

## Requisitos confirmados

A Google Ads API utiliza OAuth 2.0 e também exige um developer token. OAuth autoriza a aplicação a acessar uma conta Google Ads sem manipular a senha do usuário. Para gerenciar contas próprias, a documentação descreve fluxos de conta de administrador/manager; para uma aplicação que permite que vários clientes conectem as próprias contas, o fluxo adequado é autenticação multiusuário.

É necessário um Google Ads Manager Account para solicitar o developer token. O token possui níveis de acesso. Um token pendente pode ser usado com contas de teste, mas não com contas de produção. Basic Access permite até 15.000 operações de API por dia; Standard Access não impõe esse limite diário quando os requisitos da Google são atendidos.

Além do developer token, a API usa um projeto Google Cloud com a Google Ads API habilitada e credenciais OAuth. A conta-alvo é identificada pelo customer ID de 10 dígitos, sem hífens. Se o acesso ocorrer por uma conta de administrador, o login customer ID da conta manager deve ser enviado.

A Google informa que a API em si não possui taxa de uso. Isso não elimina o orçamento dos anúncios, os custos de mídia, os requisitos de faturamento da conta Google Ads ou custos de outros serviços Google Cloud usados para hospedar a integração.

Para testar com segurança, a documentação recomenda contas de teste. Test accounts não veiculam anúncios reais e não exigem faturamento real. A aplicação não deve criar ou ativar campanhas de produção sem confirmação explícita do cliente.

## Modelo de criação

O fluxo básico deve criar recursos na hierarquia de conta, orçamento, campanha, grupo de anúncios e anúncio. O orçamento médio diário usa amount_micros. A Google explica que o orçamento diário é uma média: em alguns dias o gasto pode variar, mas a referência mensal usa aproximadamente 30,4 vezes o orçamento diário. Campanhas com período fechado também podem usar orçamento total em formatos compatíveis.

O painel do Navo deve criar recursos inicialmente pausados, mostrar orçamento diário, período, localização, rede, texto, destino e confirmação antes de habilitar. A ativação é uma ação crítica porque pode causar gasto real.

## Escopo recomendado para o Navo

A primeira versão deve permitir conectar uma conta Google Ads, selecionar customer ID, listar campanhas e consultar métricas por GAQL através do GoogleAdsService. Para criação simplificada, o primeiro objetivo pode ser tráfego para o site/catálogo, com campanha de pesquisa local ou campanha compatível com os recursos da conta. A disponibilidade de tipos, objetivos e campos deve ser validada pela API, não presumida no frontend.

Métricas agregadas como impressões, cliques, custo, conversões e custo por conversão podem ser exibidas. Conversões não são sinônimo automático de leads. Para leads detalhados, é necessário configurar uma ação de conversão/formulário compatível e uma rotina específica de importação ou webhook; a primeira versão deve separar métrica agregada de cadastro individual.

## Segurança

Developer token, client secret, refresh token e demais credenciais devem permanecer no backend, armazenados criptografados e nunca enviados ao frontend, registrados em logs ou commitados. A conexão deve ser isolada pelo ownerId e permitir revogação. A aplicação deve registrar request ID e mensagens sanitizadas para suporte, tratar limites de operação e mostrar ao cliente erros de permissão, conta restrita, política, orçamento ou aprovação.

## Impacto na arquitetura atual

Google Ads deve entrar como provedor adicional ao lado de Meta Ads, mantendo uma experiência unificada em Campanhas e separando Configurações por provedor. O módulo atual do Navo usa Express, Drizzle e autenticação por cookie; a implementação deve seguir esses padrões. As tabelas precisam guardar ownerId, customer ID, nome da conta, credenciais criptografadas, estado da conexão, campanhas sincronizadas e métricas locais.

A conexão Google não depende da Evolution API, QR Code ou WhatsApp. O destino de uma campanha pode ser o catálogo do Navo ou a página de agendamento; uma campanha para conversas no WhatsApp exige configuração própria do canal e não deve ser inferida automaticamente.

## Criação e segmentação adicionais

A API oficial possui exemplos para criação de campanhas, grupos de anúncios e anúncios responsivos de pesquisa. A segmentação geográfica precisa usar recursos de localização válidos do Google Ads, não apenas um texto livre digitado pelo usuário. Por isso, a interface deve resolver a cidade/região via serviço de constantes geográficas ou limitar claramente a primeira versão a localizações previamente suportadas. O Navo não deve afirmar que uma campanha está segmentada em determinada região se a API não confirmar o critério aplicado.

Fonte adicional: https://developers.google.com/google-ads/api/docs/campaigns/create-campaigns
Fonte adicional: https://developers.google.com/google-ads/api/docs/responsive-search-ads/create-responsive-search-ads
Fonte adicional: https://developers.google.com/google-ads/api/docs/ads/mutate-ads

## Versão da API

As notas oficiais consultadas em 22/08/2026 listam o Google Ads API v25.1, publicado em 19/08/2026, com v25 como versão principal de 22/07/2026. A integração deve manter GOOGLE_ADS_API_VERSION configurável e usar v25 como padrão inicial, com possibilidade de ajuste quando a conta ou o projeto exigir outra versão compatível.

Fonte: https://developers.google.com/google-ads/api/docs/release-notes
Fonte: https://developers.google.com/google-ads/api/reference/rpc/v25/overview
