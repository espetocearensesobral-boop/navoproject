import { addDaysBRT, getDayOfWeekKey, getTodayStringBRT } from '../utils/datetime.js';

export type NavoBotIntent =
  | 'menu'
  | 'appointments'
  | 'availability'
  | 'book'
  | 'confirm'
  | 'reschedule'
  | 'cancel'
  | 'cancel_all'
  | 'complaint'
  | 'human'
  | 'shop_info'
  | 'next_slot'
  | 'last_slot'
  | 'barbers'
  | 'service_info'
  | 'gratitude'
  | 'unknown';

export type ExtractedEvolutionAudio = {
  base64?: string;
  url?: string;
  mimetype?: string;
  seconds?: number;
  rawMessage?: any;
};

export type ExtractedEvolutionMessage = {
  instanceName: string;
  messageId: string;
  phone: string;
  text: string;
  pushName?: string;
  audio?: ExtractedEvolutionAudio;
  rawPayload?: any;
};

const WEEKDAY_ALIASES: Record<string, keyof typeof WEEKDAY_OFFSETS> = {
  domingo: 'sunday',
  segunda: 'monday',
  'segunda-feira': 'monday',
  terca: 'tuesday',
  terça: 'tuesday',
  'terca-feira': 'tuesday',
  'terça-feira': 'tuesday',
  quarta: 'wednesday',
  'quarta-feira': 'wednesday',
  quinta: 'thursday',
  'quinta-feira': 'thursday',
  sexta: 'friday',
  'sexta-feira': 'friday',
  sabado: 'saturday',
  sábado: 'saturday',
};

const WEEKDAY_OFFSETS = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
} as const;

const MONTH_ALIASES: Record<string, number> = {
  janeiro: 1,
  fevereiro: 2,
  marco: 3,
  abril: 4,
  maio: 5,
  junho: 6,
  julho: 7,
  agosto: 8,
  setembro: 9,
  outubro: 10,
  novembro: 11,
  dezembro: 12,
};

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function classifyDeterministicIntent(text: string): NavoBotIntent | null {
  const normalized = normalizeText(text);
  if (!normalized) return null;
  if (/^1(?:\s*[-.)]|\s|$)/.test(normalized)) return 'book';
  if (/^2(?:\s*[-.)]|\s|$)/.test(normalized)) return 'appointments';
  if (/^3(?:\s*[-.)]|\s|$)/.test(normalized)) return 'reschedule';
  if (/^4(?:\s*[-.)]|\s|$)/.test(normalized)) return 'cancel';
  if (/^5(?:\s*[-.)]|\s|$)/.test(normalized)) return 'human';
  if (/^(oi|ola|olá|menu|inicio|início|ajuda|bom dia|boa tarde|boa noite)\b/.test(normalized)) return 'menu';
  if (/\b(atendente|humano|pessoa|equipe|falar com alguem|falar com alguém)\b/.test(normalized)) return 'human';
  if (/\b(reclamar|reclamacao|insatisfeito|insatisfacao|decepcionado|decepcao|indignado|absurdo|horrivel|pessimo|nao gostei|servico ruim|atendimento ruim|problema no atendimento|cobranca indevida|cobranca errada|cobraram errado|cobrou errado|atraso no atendimento|atendimento atrasado|demorou no atendimento|esperei demais|ainda estou esperando|estou esperando|ninguem me atendeu|sem retorno|nao tive retorno|desrespeito|desrespeitaram|maltratado|grosseiro|erro no atendimento|falha no atendimento|quero denunciar)\b/.test(normalized)) return 'complaint';
  if (/\b(cancelar|cancela|cancele|cancelamento|desmarcar|desmarque)\b/.test(normalized) && /\b(todos?|todas?|tudo|agendamentos?|reservas?|horarios?)\b/.test(normalized)) return 'cancel_all';
  if (/\b(cancelar|cancela|cancele|cancelamento|desmarcar|desmarque|nao vou conseguir ir|nao posso ir)\b/.test(normalized)) return 'cancel';
  if (/\b(reagendar|remarcar|mudar (o )?horario|trocar (o )?horario|alterar (o )?agendamento|mudar minha reserva|outro dia|outro horario|adiar)\b/.test(normalized)) return 'reschedule';
  if (/\b(meu|minha|minhas)\b.*\b(agendamento|agenda|reserva|horario|marcacao|voucher)\b/.test(normalized)) return 'appointments';

  // 1. Perguntas de Horário de Funcionamento / Aberto / Fechado / Localização
  if (
    /\b(que horas\s+(fecha|abre|encerra|comeca|inicia)|horario\s+de\s+(funcionamento|atendimento|abertura|fechamento)|ta\s+aberto|esta\s+aberto|abre\s+hoje|fecha\s+hoje|abrem\s+hoje|aberto\s+hoje|fechado\s+hoje|funcionam\s+hoje|abre\s+(aos?\s+)?(sabados?|domingos?)|onde\s+fica|qual\s+(o\s+)?endereco|localizacao|como\s+chego)\b/.test(normalized)
  ) {
    return 'shop_info';
  }

  // 2. Perguntas sobre Horário mais próximo / Primeiro horário / Vaga imediata
  if (
    /\b(horario\s+mais\s+(proximo|perto|cedo)|primeiro\s+horario|tem\s+vaga\s+(agora|hoje|pra hoje|mais cedo|pra daqui a pouco)|vaga\s+(agora|imediata|mais cedo)|encaixe|consegue\s+me\s+encaixar|tem\s+horario\s+(livre\s+)?(agora|hoje|mais cedo|pra hoje))\b/.test(normalized)
  ) {
    return 'next_slot';
  }

  // 3. Perguntas sobre Último horário do dia
  if (
    /\b(ultimo\s+horario|ultima\s+vaga|ate\s+que\s+horas\s+(atendem|posso\s+agendar|tem\s+horario|da\s+pra\s+(ir|cortar|marcar))|qual\s+o\s+ultimo)\b/.test(normalized)
  ) {
    return 'last_slot';
  }

  // 4. Perguntas sobre Barbeiros / Quem está atendendo / Barbeiro liberado
  if (
    /\b((qual|quais)\s+barbeiros?\s+(esta|tao|estao)?\s*(liberado|livre|atendendo|disponivel)|quem\s+(esta|ta)\s+(atendendo|trabalhando|escalado|livre|liberado)|barbeiro\s+(livre|liberado|disponivel))\b/.test(normalized)
  ) {
    return 'barbers';
  }

  // 5. Perguntas sobre Preço e Duração de Serviços
  if (
    /\b(quanto\s+(custa|e|sai|fica)|qual\s+(o\s+)?(preco|valor)|tabela\s+de\s+precos|valores\s+dos\s+servicos|quanto\s+tempo\s+(demora|dura|leva))\b/.test(normalized)
  ) {
    return 'service_info';
  }

  if (/\b(servicos?|precos?|catalogo|ver (os )?servicos?|mostrar (os )?servicos?|lista de servicos?)\b/.test(normalized)) return 'book';
  const asksAvailability = /\b(horarios?|horas?|disponiveis?|disponibilidade|vagas?|livres?)\b/.test(normalized);
  const asksPersonalAppointment = /\b(meu|minha|minhas|meus)\b.*\b(agendamento|agenda|reserva|horario|marcacao|voucher)\b/.test(normalized);
  const startsBooking = /\b(agendar|marcar|reservar|novo agendamento|fazer (um )?agendamento|quero (um )?horario|quero cortar|quero fazer)\b/.test(normalized);
  if (asksAvailability && !asksPersonalAppointment && !startsBooking && !/\b(servicos?|catalogo|precos?)\b/.test(normalized)) return 'availability';
  if (/\b(consultar|consulto|ver|checar|saber)\b.*\b(agendamento|horario|reserva|marcacao)\b|\b(meu agendamento|minha agenda|minhas reservas|minha reserva|meus horarios|minhas marcacoes|qual (e o )?meu horario|voucher)\b/.test(normalized)) return 'appointments';
  if (/\b(agendar|agenda[r]?|marcar|novo agendamento|fazer um agendamento|gostaria de agendar|quero reservar|quero cortar|quero fazer|tem (um )?horario|tem vaga|disponibilidade|marcar um horario|quero (um )?horario)\b/.test(normalized)) return 'book';
  if (/\b(confirmar|confirmo|confirma|confirmacao|confirmado|esta confirmado)\b/.test(normalized)) return 'confirm';
  return null;
}

export function humanHandoffMessage(followUpCount: number): string {
  if (followUpCount <= 0) {
    return 'Sua mensagem adicional foi registrada. O caso já está encaminhado para a equipe responsável e o atendimento automático permanece pausado para evitar respostas desencontradas. Aguarde a análise da equipe. Para voltar ao menu automático, envie *MENU*.';
  }
  return 'Recebi sua nova mensagem. O caso continua encaminhado para a equipe responsável e o atendimento automático permanece pausado para evitar respostas desencontradas. Aguarde a análise da equipe. Para voltar ao menu automático, envie *MENU*.';
}

export function isPositiveConfirmation(text: string): boolean {
  const normalized = normalizeText(text);
  return /^(confirm:yes|confirm_yes|yes|sim|s|ok|okay|pode|confirmo|confirmar|isso|perfeito|fechar|fechado|vamos|pode ser|pode fazer)\b/.test(normalized);
}

export function isNegativeConfirmation(text: string): boolean {
  const normalized = normalizeText(text);
  return /^(confirm:no|confirm_no|no|nao|n|cancelar|cancela|desistir|voltar|sair)\b/.test(normalized);
}

export function parseTimeFromText(text: string, allowBareHour = false): string | null {
  const normalized = normalizeText(text);
  const explicitMatch = normalized.match(/(?:\b(?:as|a|horario|horas)\s*)(\d{1,2})(?:\s*[:h]\s*(\d{2}))?\s*(?:h|horas)?\b|\b(\d{1,2}):(\d{2})\b|\b(\d{1,2})h(?:\s*(\d{2}))?\b/);
  const bareMatch = allowBareHour && /^\d{1,2}$/.test(normalized) ? [normalized, normalized, '0'] : null;
  const match = explicitMatch || bareMatch;
  if (!match) return null;
  const hours = Number(match[1] || match[3] || match[5]);
  const minutes = Number(match[2] || match[4] || match[6] || 0);
  if (!Number.isInteger(hours) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function parseDateFromText(text: string, today = getTodayStringBRT()): string | null {
  const normalized = normalizeText(text);
  if (/\bhoje\b/.test(normalized)) return today;
  if (/\bamanha\b/.test(normalized)) return addDaysBRT(today, 1);
  if (/\bdepois de amanha\b/.test(normalized)) return addDaysBRT(today, 2);

  const isoMatch = normalized.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  const brMatch = normalized.match(/\b(\d{1,2})[\/]([01]?\d)[\/]?(20\d{2})?\b/);
  if (brMatch) {
    const day = Number(brMatch[1]);
    const month = Number(brMatch[2]);
    const year = Number(brMatch[3] || today.slice(0, 4));
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  const monthMatch = normalized.match(/\bdia\s+(\d{1,2})(?:\s+de)?\s+(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\b/);
  const dayOnlyMatch = normalized.match(/\bdia\s+(\d{1,2})\b/);
  if (monthMatch || dayOnlyMatch) {
    const day = Number((monthMatch || dayOnlyMatch)![1]);
    const explicitMonth = monthMatch ? MONTH_ALIASES[monthMatch[2]] : Number(today.slice(5, 7));
    const explicitYear = normalized.match(/\b(20\d{2})\b/)?.[1];
    let year = Number(explicitYear || today.slice(0, 4));
    let month = explicitMonth;
    const daysInMonth = (targetYear: number, targetMonth: number) => new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
    if (day < 1 || day > daysInMonth(year, month)) return null;
    let candidate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (!explicitYear && candidate < today) {
      if (!monthMatch) {
        month += 1;
        if (month === 13) { month = 1; year += 1; }
      } else {
        year += 1;
      }
      if (day > daysInMonth(year, month)) return null;
      candidate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    return candidate;
  }

  const weekday = Object.entries(WEEKDAY_ALIASES).find(([alias]) => normalized.includes(alias))?.[1];
  if (weekday) {
    const todayKey = getDayOfWeekKey(today);
    const todayOffset = WEEKDAY_OFFSETS[todayKey];
    const targetOffset = WEEKDAY_OFFSETS[weekday];
    const delta = (targetOffset - todayOffset + 7) % 7 || 7;
    return addDaysBRT(today, delta);
  }

  return null;
}

export function extractBookingCode(text: string): string | null {
  const normalized = text.toUpperCase();
  const labeled = normalized.match(/\b(?:VOUCHER|CÓDIGO|CODIGO|RESERVA)\b\s*(?:É|E|:|-)?\s*([A-Z0-9]+(?:-[A-Z0-9]+)*)\b/);
  if (labeled?.[1] && /\d/.test(labeled[1])) return labeled[1];
  const candidates = normalized.match(/\b[A-Z]{2,8}-?[A-Z0-9]{3,}\b/g) || [];
  return candidates.find((candidate) => /\d/.test(candidate)) || null;
}

function unwrapMessageContent(msg: any): any {
  if (!msg || typeof msg !== 'object') return {};
  if (msg.message && typeof msg.message === 'object') return unwrapMessageContent(msg.message);
  if (msg.ephemeralMessage?.message) return unwrapMessageContent(msg.ephemeralMessage.message);
  if (msg.viewOnceMessage?.message) return unwrapMessageContent(msg.viewOnceMessage.message);
  if (msg.viewOnceMessageV2?.message) return unwrapMessageContent(msg.viewOnceMessageV2.message);
  if (msg.documentWithCaptionMessage?.message) return unwrapMessageContent(msg.documentWithCaptionMessage.message);
  return msg;
}

function extractTextFromWhatsAppMessage(msg: any): string {
  if (!msg) return '';
  const unwrapped = unwrapMessageContent(msg);

  if (typeof unwrapped === 'string') return unwrapped.trim();

  // 1. Direct conversational text
  if (typeof unwrapped.conversation === 'string' && unwrapped.conversation.trim()) {
    return unwrapped.conversation.trim();
  }

  // 2. Extended text message
  if (typeof unwrapped.extendedTextMessage?.text === 'string' && unwrapped.extendedTextMessage.text.trim()) {
    return unwrapped.extendedTextMessage.text.trim();
  }

  // 3. Buttons reply
  const buttonId = unwrapped.buttonsResponseMessage?.selectedButtonId || unwrapped.buttonsResponseMessage?.selectedDisplayText;
  if (buttonId) return String(buttonId).trim();

  // 4. List reply
  const listId = unwrapped.listResponseMessage?.singleSelectReply?.selectedRowId || unwrapped.listResponseMessage?.title;
  if (listId) return String(listId).trim();

  // 5. Template reply
  const templateId = unwrapped.templateButtonReplyMessage?.selectedId || unwrapped.templateButtonReplyMessage?.selectedDisplayText;
  if (templateId) return String(templateId).trim();

  // 6. Interactive response (WhatsApp Cloud / Evolution native flow)
  if (unwrapped.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson) {
    try {
      const parsed = JSON.parse(unwrapped.interactiveResponseMessage.nativeFlowResponseMessage.paramsJson);
      const interactiveVal = parsed.id || parsed.selected_id || parsed.value || parsed.text;
      if (interactiveVal) return String(interactiveVal).trim();
    } catch {
      // Ignore JSON parse error and fallback
    }
  }
  if (unwrapped.interactiveResponseMessage?.body?.text) {
    return String(unwrapped.interactiveResponseMessage.body.text).trim();
  }

  // 7. Media captions
  if (typeof unwrapped.imageMessage?.caption === 'string' && unwrapped.imageMessage.caption.trim()) {
    return unwrapped.imageMessage.caption.trim();
  }
  if (typeof unwrapped.videoMessage?.caption === 'string' && unwrapped.videoMessage.caption.trim()) {
    return unwrapped.videoMessage.caption.trim();
  }
  if (typeof unwrapped.documentMessage?.caption === 'string' && unwrapped.documentMessage.caption.trim()) {
    return unwrapped.documentMessage.caption.trim();
  }

  // 8. Top-level text/body fallback
  if (typeof unwrapped.text === 'string' && unwrapped.text.trim()) return unwrapped.text.trim();
  if (typeof unwrapped.body === 'string' && unwrapped.body.trim()) return unwrapped.body.trim();

  return '';
}

function extractAudioFromWhatsAppMessage(msg: any, rawContext?: any): ExtractedEvolutionAudio | null {
  if (!msg && !rawContext) return null;
  const unwrapped = unwrapMessageContent(msg || rawContext);
  if (!unwrapped || typeof unwrapped !== 'object') return null;

  const audioObj = unwrapped.audioMessage || unwrapped.pttMessage || unwrapped.voiceMessage || unwrapped.audio || (rawContext?.messageType === 'audioMessage' ? unwrapped : null);
  if (!audioObj && rawContext?.messageType !== 'audioMessage') return null;

  const targetAudio = audioObj || unwrapped;

  const base64 = typeof targetAudio.base64 === 'string' && targetAudio.base64.trim()
    ? targetAudio.base64.trim()
    : typeof unwrapped.base64 === 'string' && unwrapped.base64.trim()
    ? unwrapped.base64.trim()
    : typeof rawContext?.base64 === 'string' && rawContext.base64.trim()
    ? rawContext.base64.trim()
    : undefined;

  const url = typeof targetAudio.url === 'string' && targetAudio.url.trim()
    ? targetAudio.url.trim()
    : typeof targetAudio.mediaUrl === 'string' && targetAudio.mediaUrl.trim()
    ? targetAudio.mediaUrl.trim()
    : typeof unwrapped.mediaUrl === 'string' && unwrapped.mediaUrl.trim()
    ? unwrapped.mediaUrl.trim()
    : undefined;

  const mimetype = typeof targetAudio.mimetype === 'string' && targetAudio.mimetype.trim()
    ? targetAudio.mimetype.trim()
    : typeof targetAudio.mimeType === 'string' && targetAudio.mimeType.trim()
    ? targetAudio.mimeType.trim()
    : 'audio/ogg; codecs=opus';

  const seconds = typeof targetAudio.seconds === 'number' ? targetAudio.seconds : undefined;

  return {
    base64,
    url,
    mimetype,
    seconds,
    rawMessage: msg || rawContext,
  };
}

export function extractEvolutionMessage(payload: any): ExtractedEvolutionMessage | null {
  if (!payload || typeof payload !== 'object') return null;

  const rawEvent = String(payload.event || payload.eventType || '').toLowerCase();
  // Se houver evento explícito, aceita variações de mensagens
  if (rawEvent) {
    const isMessageEvent =
      rawEvent.includes('messages.upsert') ||
      rawEvent.includes('messages_upsert') ||
      rawEvent.includes('messages-upsert') ||
      rawEvent.includes('send_message') ||
      rawEvent.includes('send.message') ||
      rawEvent.includes('messages.update') ||
      rawEvent.includes('message');
    if (!isMessageEvent) return null;
  }

  // Desempacota payloads que contêm arrays ou mensagens aninhadas
  let dataItem: any = payload.data || payload;
  if (Array.isArray(dataItem)) {
    // Procura o primeiro item que não seja fromMe
    dataItem = dataItem.find((item: any) => item?.key?.fromMe !== true && item?.fromMe !== true) || dataItem[0];
  } else if (Array.isArray(dataItem?.messages)) {
    dataItem = dataItem.messages.find((item: any) => item?.key?.fromMe !== true && item?.fromMe !== true) || dataItem.messages[0];
  } else if (Array.isArray(payload.messages)) {
    dataItem = payload.messages.find((item: any) => item?.key?.fromMe !== true && item?.fromMe !== true) || payload.messages[0];
  }

  if (!dataItem || typeof dataItem !== 'object') return null;

  const key = dataItem.key || {};
  if (key.fromMe === true || dataItem.fromMe === true) return null;

  const remoteJid = String(key.remoteJid || dataItem.remoteJid || dataItem.sender || dataItem.from || '').trim();
  if (!remoteJid || remoteJid.endsWith('@g.us') || remoteJid.endsWith('@broadcast') || remoteJid.endsWith('@newsletter')) {
    return null;
  }

  // Resolução de JID com privacidade (LID)
  const alternativeJid = String(
    key.remoteJidAlt ||
    key.senderPn ||
    key.participant ||
    dataItem.sender ||
    dataItem.senderPn ||
    dataItem.participant ||
    payload.sender ||
    ''
  ).trim();

  let resolvedJid = remoteJid;
  if (resolvedJid.endsWith('@lid')) {
    resolvedJid = alternativeJid && !alternativeJid.endsWith('@lid') ? alternativeJid : '';
  }
  if (!resolvedJid) return null;

  const digits = resolvedJid.replace(/\D/g, '');
  if (digits.length < 8) return null;

  // Extrai o áudio se presente
  const audio = extractAudioFromWhatsAppMessage(dataItem.message || dataItem, dataItem);

  // Extrai o texto da mensagem
  const text = extractTextFromWhatsAppMessage(dataItem.message || dataItem);
  if (!text && !audio) return null;

  // Extrai nome da instância de forma segura
  const rawInstance = payload.instance || dataItem.instance || payload.instanceName || dataItem.instanceName;
  const instanceName = typeof rawInstance === 'object' && rawInstance !== null
    ? String(rawInstance.instanceName || rawInstance.name || '')
    : String(rawInstance || '');

  const pushName = dataItem.pushName || payload.pushName || undefined;

  return {
    instanceName,
    messageId: String(key.id || dataItem.id || `${digits}:${dataItem.messageTimestamp || Date.now()}`),
    phone: digits,
    text: text || '',
    pushName: pushName ? String(pushName) : undefined,
    audio: audio || undefined,
    rawPayload: payload,
  };
}

export function normalizeIntentName(value: unknown): NavoBotIntent {
  const normalized = normalizeText(String(value || ''));
  if (['menu', 'inicio', 'ajuda'].includes(normalized)) return 'menu';
  if (['appointments', 'agendamentos', 'agenda'].includes(normalized)) return 'appointments';
  if (['availability', 'disponibilidade', 'horarios', 'horas', 'vagas'].includes(normalized)) return 'availability';
  if (['book', 'agendar', 'marcar'].includes(normalized)) return 'book';
  if (['confirm', 'confirmar'].includes(normalized)) return 'confirm';
  if (['reschedule', 'reagendar', 'remarcar'].includes(normalized)) return 'reschedule';
  if (['cancel', 'cancelar'].includes(normalized)) return 'cancel';
  if (['cancel_all', 'cancelar todos', 'cancelar tudo', 'desmarcar todos'].includes(normalized)) return 'cancel_all';
  if (['complaint', 'reclamacao', 'reclamar', 'queixa'].includes(normalized)) return 'complaint';
  if (['human', 'humano', 'atendente'].includes(normalized)) return 'human';
  if (['shop_info', 'horario_funcionamento', 'aberto', 'fechado', 'endereco', 'localizacao'].includes(normalized)) return 'shop_info';
  if (['next_slot', 'horario_proximo', 'proximo_horario', 'vaga_agora', 'primeiro_horario'].includes(normalized)) return 'next_slot';
  if (['last_slot', 'ultimo_horario', 'ultima_vaga'].includes(normalized)) return 'last_slot';
  if (['barbers', 'barbeiros', 'barbeiro_liberado', 'quem_atende'].includes(normalized)) return 'barbers';
  if (['service_info', 'precos', 'preco_servico', 'duracao_servico'].includes(normalized)) return 'service_info';
  return 'unknown';
}

export function findProfessionalMatches(professionals: Array<{ id: string; name: string; nickname?: string | null }>, text: string): Array<{ id: string; name: string; nickname?: string | null }> {
  const normalizedText = normalizeText(text);
  if (!normalizedText) return [];
  return professionals.filter((prof) => {
    const profName = normalizeText(prof.name);
    const profNickname = prof.nickname ? normalizeText(prof.nickname) : '';
    if (profName && normalizedText.includes(profName)) return true;
    if (profNickname && profNickname.length >= 3 && normalizedText.includes(profNickname)) return true;
    const firstName = profName.split(' ')[0];
    if (firstName && firstName.length >= 3) {
      const regex = new RegExp(`\\b${firstName}\\b`, 'i');
      if (regex.test(normalizedText)) return true;
    }
    return false;
  });
}

const SERVICE_STOP_WORDS = new Set(['a', 'as', 'o', 'os', 'um', 'uma', 'de', 'da', 'do', 'das', 'dos', 'e', 'com', 'para', 'por']);
const GENERIC_SERVICE_QUERY_WORDS = new Set([
  'algum', 'alguma', 'alguns', 'algumas', 'amanha', 'agendar', 'agendamento',
  'disponibilidade', 'disponivel', 'disponiveis', 'fazer',
  'horario', 'horarios', 'hora', 'horas', 'hoje', 'livre', 'livres', 'marcar',
  'reservar', 'tem', 'vaga', 'vagas', 'queria', 'quero',
  'gostaria',
]);

function serviceTokens(value: string): string[] {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 2 && !SERVICE_STOP_WORDS.has(token));
}

export function findServiceMatches(services: Array<{ id: string; title: string }>, text: string): Array<{ id: string; title: string }> {
  const queryTokens = serviceTokens(text);
  if (!queryTokens.length) return [];
  const semanticQueryTokens = queryTokens.filter((token) => !GENERIC_SERVICE_QUERY_WORDS.has(token));
  if (!semanticQueryTokens.length) return [];
  const exact = services.filter((service) => {
    const titleTokens = serviceTokens(String(service.title));
    return semanticQueryTokens.every((queryToken) => titleTokens.some((titleToken) => titleToken === queryToken || titleToken.startsWith(queryToken)));
  });
  if (exact.length) return exact;
  const scored = services.map((service) => {
    const titleTokens = serviceTokens(String(service.title));
    const matched = semanticQueryTokens.filter((queryToken) => titleTokens.some((titleToken) => titleToken === queryToken || titleToken.startsWith(queryToken))).length;
    return { service, matched, coverage: matched / semanticQueryTokens.length };
  }).filter((item) => item.matched > 0 && item.coverage >= 0.5);
  if (!scored.length) return [];
  const bestCoverage = Math.max(...scored.map((item) => item.coverage));
  const best = scored.filter((item) => item.coverage === bestCoverage).sort((a, b) => b.matched - a.matched);
  return best.map((item) => item.service);
}
