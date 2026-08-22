# Estratégia de provedor do NavoBot

## Padrão atual

A integração em produção permanece na **Evolution API via QR Code**, com a instância `navo-bot`. O NavoBot continua usando os métodos de texto, botões e listas oferecidos pelo módulo Evolution, com o modo somente texto como fallback seguro.

O perfil `evolution_qr` representa o canal ativo. A configuração de conta `personal_qr` ou `business_qr` descreve o tipo de conta conectada por QR Code, mas não transforma a conexão em WhatsApp Business Cloud API.

## Contrato comum

O arquivo `backend/services/whatsapp-provider.ts` define o contrato `WhatsAppMessagingProvider`, com operações para enviar texto, botões e listas. O NavoBot depende desse contrato e não conhece detalhes de URLs, headers, tokens ou payloads específicos da Evolution.

A implementação atual é criada por `createEvolutionMessagingProvider`. Um futuro adaptador da Meta Cloud API poderá implementar o mesmo contrato, mantendo intactos os fluxos de agendamento, consulta, confirmação, cancelamento, reagendamento e histórico de conversas.

## Regras para a futura migração

A opção Cloud API não deve ser ativada apenas pela seleção de um campo no painel. Ela só poderá ser disponibilizada após a implementação e validação de um adaptador específico com `WABA`, `phone_number_id`, token permanente, webhook e tratamento de status da Meta.

Até essa implementação, a Evolution API via QR Code continua sendo o único provedor operacional. A adição do contrato comum é preparatória e não altera o número conectado, o webhook atual, o monitor de inatividade ou o fallback somente texto.
