export type WhatsAppProviderKind = 'evolution_qr' | 'meta_cloud';

export interface WhatsAppButton {
  type?: 'reply';
  id?: string;
  displayText?: string;
  buttonId?: string;
  buttonText?: { displayText?: string };
}

export interface WhatsAppButtonsPayload {
  title?: string;
  description?: string;
  text?: string;
  footerText?: string;
  buttons: WhatsAppButton[];
}

export interface WhatsAppListPayload {
  title: string;
  description: string;
  buttonText: string;
  footerText?: string;
  sections: Array<Record<string, unknown>>;
}

/**
 * Contrato comum para os canais de mensagens do NavoBot.
 *
 * A implementação ativa é a Evolution API via QR Code. Um futuro adaptador
 * da Meta Cloud API deve implementar este mesmo contrato, sem alterar os
 * fluxos determinísticos, o histórico ou as confirmações do NavoBot.
 */
export interface WhatsAppMessagingProvider {
  readonly kind: WhatsAppProviderKind;
  sendText(phone: string, text: string): Promise<boolean>;
  sendButtons(phone: string, payload: WhatsAppButtonsPayload): Promise<boolean>;
  sendList(phone: string, payload: WhatsAppListPayload): Promise<boolean>;
}

export function createEvolutionMessagingProvider(deps: Omit<WhatsAppMessagingProvider, 'kind'>): WhatsAppMessagingProvider {
  return { kind: 'evolution_qr', ...deps };
}
