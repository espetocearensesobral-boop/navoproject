import assert from 'node:assert/strict';
import test from 'node:test';
import {
  classifyDeterministicIntent,
  humanHandoffMessage,
  extractBookingCode,
  extractEvolutionMessage,
  findServiceMatches,
  isNegativeConfirmation,
  isPositiveConfirmation,
  parseDateFromText,
  parseTimeFromText,
} from '../backend/services/navobot-intent.ts';

test('classifies core NavoBot intents deterministically', () => {
  assert.equal(classifyDeterministicIntent('1'), 'book');
  assert.equal(classifyDeterministicIntent('2 - consultar'), 'appointments');
  assert.equal(classifyDeterministicIntent('3'), 'reschedule');
  assert.equal(classifyDeterministicIntent('4. Cancelar'), 'cancel');
  assert.equal(classifyDeterministicIntent('5'), 'human');
  assert.equal(classifyDeterministicIntent('quero agendar um corte'), 'book');
  assert.equal(classifyDeterministicIntent('Gostaria de ver os serviços'), 'book');
  assert.equal(classifyDeterministicIntent('quero agendar um horário para amanhã'), 'book');
  assert.equal(classifyDeterministicIntent('quais os horários disponíveis hoje?'), 'availability');
  assert.equal(classifyDeterministicIntent('Queria ver se tem algum horário bom para cortar o cabelo amanhã.'), 'availability');
  assert.equal(classifyDeterministicIntent('tem vaga amanhã?'), 'availability');
  assert.equal(classifyDeterministicIntent('quais os serviços disponíveis?'), 'book');
  assert.equal(classifyDeterministicIntent('quais serviços vocês oferecem?'), 'book');
  assert.equal(classifyDeterministicIntent('gostaria de consultar meu agendamento'), 'appointments');
  assert.equal(classifyDeterministicIntent('não vou conseguir ir, pode desmarcar?'), 'cancel');
  assert.equal(classifyDeterministicIntent('quero mudar minha reserva para outro dia'), 'reschedule');
  assert.equal(classifyDeterministicIntent('preciso remarcar meu horário'), 'reschedule');
  assert.equal(classifyDeterministicIntent('pode cancelar'), 'cancel');
  assert.equal(classifyDeterministicIntent('preciso que cancele todos os agendamentos'), 'cancel_all');
  assert.equal(classifyDeterministicIntent('pode cancelar tudo'), 'cancel_all');
  assert.equal(classifyDeterministicIntent('cancele todos'), 'cancel_all');
  assert.equal(classifyDeterministicIntent('o atendimento foi péssimo'), 'complaint');
  assert.equal(classifyDeterministicIntent('quero reclamar da cobrança'), 'complaint');
  assert.equal(classifyDeterministicIntent('isso é um absurdo'), 'complaint');
  assert.equal(classifyDeterministicIntent('cobraram errado no meu atendimento'), 'complaint');
  assert.equal(classifyDeterministicIntent('ninguém me atendeu'), 'complaint');
  assert.equal(classifyDeterministicIntent('ainda estou esperando'), 'complaint');
  assert.equal(classifyDeterministicIntent('quero falar com atendente'), 'human');
  assert.equal(classifyDeterministicIntent('meu agendamento'), 'appointments');
});

test('contextualiza mensagens repetidas após o handoff humano', () => {
  const firstFollowUp = humanHandoffMessage(0);
  const laterFollowUp = humanHandoffMessage(1);
  assert.match(firstFollowUp, /caso já está encaminhado/);
  assert.match(firstFollowUp, /Aguarde a análise da equipe/);
  assert.match(laterFollowUp, /Recebi sua nova mensagem/);
  assert.notEqual(firstFollowUp, laterFollowUp);
});

test('does not confuse greetings with service names and supports partial service names', () => {
  const services = [
    { id: 'svc-noivo', title: 'Combo Dia do Noivo / Evento VIP' },
    { id: 'svc-barba', title: 'Modelagem de Barba com Toalha Quente' },
  ];
  assert.deepEqual(findServiceMatches(services, 'oi'), []);
  assert.deepEqual(findServiceMatches(services, 'Modelagem de barba').map((service) => service.id), ['svc-barba']);

  const ambiguousServices = [
    { id: 'svc-pigmentacao', title: 'Pigmentação de Cabelo e Barba' },
    { id: 'svc-corte-moderno', title: 'Corte Moderno / Fade / Mid Fade' },
  ];
  assert.deepEqual(findServiceMatches(ambiguousServices, 'cortar o cabelo'), []);
  assert.deepEqual(findServiceMatches(ambiguousServices, 'corte moderno').map((service) => service.id), ['svc-corte-moderno']);
});

test('parses relative dates and WhatsApp time formats', () => {
  assert.equal(parseDateFromText('amanhã', '2026-08-21'), '2026-08-22');
  assert.equal(parseDateFromText('sábado', '2026-08-21'), '2026-08-22');
  assert.equal(parseDateFromText('dia 22', '2026-08-21'), '2026-08-22');
  assert.equal(parseDateFromText('dia 22 de agosto', '2026-08-21'), '2026-08-22');
  assert.equal(parseTimeFromText('às 15h'), '15:00');
  assert.equal(parseTimeFromText('15:30'), '15:30');
  assert.equal(parseTimeFromText('15', true), '15:00');
  assert.equal(parseDateFromText('dia 22 às 15h', '2026-08-21'), '2026-08-22');
  assert.equal(parseTimeFromText('dia 22 às 15h'), '15:00');
});

test('recognizes confirmations and booking codes', () => {
  assert.equal(isPositiveConfirmation('sim, pode confirmar'), true);
  assert.equal(isPositiveConfirmation('confirm:yes'), true);
  assert.equal(isNegativeConfirmation('confirm:no'), true);
  assert.equal(extractBookingCode('Meu voucher é NV123456'), 'NV123456');
  assert.equal(extractBookingCode('BRX-8Q4TD'), 'BRX-8Q4TD');
  assert.equal(extractBookingCode('voucher: BRX-8Q4TD'), 'BRX-8Q4TD');
});

test('extracts only direct incoming text messages', () => {
  const incoming = extractEvolutionMessage({
    event: 'MESSAGES_UPSERT',
    instance: 'navo-bot',
    data: {
      key: { remoteJid: '5588999999999@s.whatsapp.net', fromMe: false, id: 'msg-1' },
      pushName: 'Cliente',
      message: { conversation: 'quero agendar' },
    },
  });
  assert.deepEqual(incoming, {
    instanceName: 'navo-bot',
    messageId: 'msg-1',
    phone: '5588999999999',
    text: 'quero agendar',
    pushName: 'Cliente',
  });
  assert.equal(extractEvolutionMessage({ event: 'MESSAGES_UPSERT', data: { key: { fromMe: true, remoteJid: '5588999999999@s.whatsapp.net' }, message: { conversation: 'echo' } } }), null);
  assert.equal(extractEvolutionMessage({ event: 'MESSAGES_UPSERT', data: { key: { remoteJid: '123@g.us', fromMe: false }, message: { conversation: 'grupo' } } }), null);
});

test('extracts clickable service selections from WhatsApp list responses', () => {
  const incoming = extractEvolutionMessage({
    event: 'messages.upsert',
    instance: 'navo-bot',
    data: {
      key: { remoteJid: '5588999999999@s.whatsapp.net', fromMe: false, id: 'service-row-1' },
      message: { listResponseMessage: { singleSelectReply: { selectedRowId: 'service:svc-corte' } } },
    },
  });
  assert.equal(incoming?.phone, '5588999999999');
  assert.equal(incoming?.text, 'service:svc-corte');
});

test('resolves WhatsApp LID messages through the alternate phone JID', () => {
  const incoming = extractEvolutionMessage({
    event: 'messages.upsert',
    instance: 'navo-bot',
    sender: '5588999999999',
    data: {
      key: {
        remoteJid: '236425802952777@lid',
        remoteJidAlt: '5588999999999@s.whatsapp.net',
        fromMe: false,
        id: 'lid-msg-1',
      },
      message: { conversation: 'oi navobot' },
    },
  });
  assert.equal(incoming?.phone, '5588999999999');
  assert.equal(incoming?.text, 'oi navobot');
});
