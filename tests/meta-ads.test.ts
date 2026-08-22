import assert from 'node:assert/strict';
import test from 'node:test';
import { createOAuthState, normalizeInsight, verifyOAuthState } from '../backend/services/meta-ads.service.js';

test('cria e valida estado OAuth somente para o usuário esperado', () => {
  const state = createOAuthState('admin-test');
  assert.equal(verifyOAuthState(state, 'admin-test'), true);
  assert.equal(verifyOAuthState(state, 'outro-usuario'), false);
  assert.equal(verifyOAuthState(`${state}adulterado`, 'admin-test'), false);
});

test('normaliza insights da Meta incluindo ações de lead', () => {
  const insight = normalizeInsight({
    impressions: '1250',
    reach: '900',
    clicks: '48',
    spend: '31.75',
    actions: [
      { action_type: 'lead', value: '3' },
      { action_type: 'onsite_conversion.lead_grouped', value: '2' },
      { action_type: 'link_click', value: '48' },
    ],
  });
  assert.deepEqual(insight, { impressions: 1250, reach: 900, clicks: 48, spendCents: 3175, leads: 5 });
});

test('não gera métricas negativas ou inválidas quando a Meta omite campos', () => {
  const insight = normalizeInsight({ spend: 'invalid', actions: [{ action_type: 'lead', value: 'invalid' }] });
  assert.deepEqual(insight, { impressions: 0, reach: 0, clicks: 0, spendCents: 0, leads: 0 });
});
