# Pesquisa de integração Meta Ads

Atualizada em 22/08/2026.

## Fontes oficiais consultadas

- Marketing API: https://developers.facebook.com/documentation/ads-commerce/marketing-api
- Início da Marketing API: https://developers.facebook.com/documentation/ads-commerce/marketing-api/get-started
- Autorização e permissões: https://developers.facebook.com/documentation/ads-commerce/marketing-api/get-started/authorization
- Criação básica de anúncios: https://developers.facebook.com/documentation/ads-commerce/marketing-api/get-started/basic-ad-creation
- Criar campanha: https://developers.facebook.com/documentation/ads-commerce/marketing-api/get-started/basic-ad-creation/create-an-ad-campaign
- Criar conjunto: https://developers.facebook.com/documentation/ads-commerce/marketing-api/get-started/basic-ad-creation/create-an-ad-set
- Criar criativo: https://developers.facebook.com/documentation/ads-commerce/marketing-api/get-started/basic-ad-creation/create-an-ad-creative
- Criar anúncio: https://developers.facebook.com/documentation/ads-commerce/marketing-api/get-started/basic-ad-creation/create-an-ad
- Referência de permissões: https://developers.facebook.com/docs/permissions/

## Fatos e decisões

A Marketing API permite criar, editar, pausar, reativar e consultar campanhas. A Meta exige uma conta de anúncios ativa para executar campanhas e gerenciar faturamento.

A hierarquia mínima de criação é campanha, conjunto de anúncios, criativo e anúncio. O conjunto concentra orçamento, lance e segmentação. O criativo concentra texto, imagem ou vídeo, chamada para ação e destino. O anúncio vincula o criativo ao conjunto.

Campanhas e anúncios devem ser criados inicialmente como PAUSED. O painel deve mostrar um resumo com orçamento, período, público e destino e exigir confirmação explícita antes de ativar qualquer campanha, pois a ativação pode gerar cobrança.

Para uma integração que gerencia a própria conta de anúncios, as permissões principais são ads_management para criar e gerenciar e ads_read para relatórios e métricas. O acesso a contas de outras empresas exige permissões e revisão mais rigorosas. A Meta também diferencia o acesso de desenvolvimento limitado do acesso completo para produção.

O fluxo OAuth deve ser usado para o administrador conceder acesso à conta de anúncios. Tokens e IDs devem ser armazenados somente no backend, com criptografia ou proteção equivalente, nunca no frontend, logs ou repositório. A integração deve limitar o escopo à conta, Página, Instagram e ativos selecionados pelo cliente.

## Escopo inicial do Navo

A primeira versão deve atender a conta própria da Navo no painel administrativo, mas estruturar as tabelas com ownerId para isolamento futuro por empresa. O fluxo simplificado deve oferecer objetivo, nome, orçamento diário, período, cidade/região, texto, imagem ou destino do anúncio. O backend deve continuar responsável por validar orçamento, status e permissões.

O sistema deve permitir listar campanhas, consultar insights, pausar e reativar. A captura de leads deve ser tratada separadamente: métricas de campanha não equivalem automaticamente a leads. Para leads reais, o anúncio precisa de formulário/objetivo compatível e o Navo precisará de uma integração de leads ou webhook da Meta, com consentimento e proteção de dados.

## Segurança e operação

Criar campanha pausada não é o mesmo que publicar. A ativação é uma operação crítica e exige confirmação explícita. Falhas da Meta, conta restrita, orçamento inválido, criativo reprovado e permissão insuficiente devem ser exibidos sem mascarar a mensagem retornada pela API.

A implementação deve usar uma versão configurável da Graph API, timeout e tratamento de rate limit. Deve registrar apenas IDs, status, timestamps e mensagens técnicas sanitizadas; nunca registrar access tokens. O cliente deve poder revogar a conexão e o sistema deve marcar a conta como desconectada sem apagar o histórico local de métricas.

## Referência de comportamento

A integração oficial suporta anúncios para Facebook e Instagram e, conforme o objetivo e a disponibilidade da conta, destinos que podem incluir site ou conversas. A disponibilidade de objetivos e formatos deve ser consultada na conta e não presumida pelo frontend.
