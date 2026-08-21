# Pesquisa: preparação para WhatsApp Business

## Fontes verificadas

1. Meta Developers — Interactive list messages: https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/interactive-list-messages
2. Meta Developers — Sending Interactive Messages: https://developers.facebook.com/docs/whatsapp/guides/interactive-messages/
3. Evolution Foundation — Evolution API: https://github.com/evolution-foundation/evolution-api

## Achados

A WhatsApp Business Platform suporta listas interativas com até 10 linhas no total. Cada linha possui um `id`, um título e uma descrição; quando o cliente seleciona uma linha, a seleção é enviada ao webhook com o identificador da opção. Os títulos de linha possuem limite de 24 caracteres e o botão da lista possui limite de 20 caracteres.

As mensagens interativas da plataforma oficial são suportadas em iOS, Android e web, mas listas e botões não funcionam como notificações fora da janela de atendimento de 24 horas desde a última mensagem do usuário. A plataforma oficial usa o Cloud API da Meta, com número de telefone Business, phone number ID, token e webhook próprio.

A Evolution API atual suporta dois caminhos distintos: WhatsApp API via Baileys, que usa uma sessão baseada no WhatsApp Web conectada por QR Code e possui limitações próprias, e WhatsApp Cloud API oficial, que usa a infraestrutura e credenciais da Meta. Alterar a conta pessoal para o aplicativo WhatsApp Business, mantendo QR Code/Baileys, não é o mesmo que migrar para a Cloud API oficial.

## Implicação para o projeto

O NavoBot já possui payloads de lista, ids `service:<id>` e extração de `listResponseMessage`, portanto a seleção clicável está tecnicamente preparada. O campo `useInteractiveMessages` deve permanecer configurável e o fallback textual deve continuar disponível.

A preparação correta para o futuro é adicionar uma estratégia de provedor/conexão, mantendo a Evolution/Baileys atual sem interrupção e permitindo uma futura configuração Cloud API Business. Não é seguro apenas inverter o default do modo interativo antes de confirmar qual caminho Business será usado.
