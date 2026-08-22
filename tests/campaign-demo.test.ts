import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CAMPAIGNS_DEMO_MODE,
  calculateGoogleCampaignTotals,
  calculateMetaCampaignTotals,
  demoGoogleCampaigns,
  demoGoogleConnection,
  demoMetaCampaigns,
  demoMetaConnection,
  demoMetaTotals,
  demoGoogleTotals,
} from '../src/services/campaignDemoData.ts';

test('mantém o modo demonstrativo e identificadores locais estáveis', () => {
  assert.equal(CAMPAIGNS_DEMO_MODE, true);
  assert.equal(demoMetaConnection.status, 'connected');
  assert.equal(demoGoogleConnection.status, 'connected');
  assert.ok(demoMetaCampaigns.length >= 2);
  assert.ok(demoGoogleCampaigns.length >= 2);
  assert.ok(demoMetaCampaigns.every((campaign) => campaign.metaCampaignId.startsWith('demo_')));
  assert.ok(demoGoogleCampaigns.every((campaign) => campaign.googleCampaignId.startsWith('demo_')));
  assert.equal(demoMetaCampaigns[0]?.metaCampaignId, 'demo_meta_001');
  assert.equal(demoGoogleCampaigns[0]?.googleCampaignId, 'demo_google_001');
});

test('calcula totais Meta e Google a partir das campanhas demonstrativas', () => {
  assert.deepEqual(calculateMetaCampaignTotals(demoMetaCampaigns), demoMetaTotals);
  assert.deepEqual(calculateGoogleCampaignTotals(demoGoogleCampaigns), demoGoogleTotals);
  assert.equal(demoMetaTotals.spendCents, 28070);
  assert.equal(demoMetaTotals.leads, 55);
  assert.equal(demoGoogleTotals.spendCents, 28980);
  assert.equal(demoGoogleTotals.conversions, 40);
});
