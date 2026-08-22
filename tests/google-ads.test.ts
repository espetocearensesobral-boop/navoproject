import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createGoogleOAuthState,
  decryptGoogleRefreshToken,
  encryptGoogleRefreshToken,
  normalizeCustomerId,
  normalizeGoogleCampaign,
  normalizeGoogleMetric,
  verifyGoogleOAuthState,
} from '../backend/services/google-ads.service.js';

test('validates Google OAuth state per user and rejects tampering', () => {
  const state = createGoogleOAuthState('admin-google-test');
  assert.equal(verifyGoogleOAuthState(state, 'admin-google-test'), true);
  assert.equal(verifyGoogleOAuthState(state, 'other-user'), false);
  assert.equal(verifyGoogleOAuthState(`${state}x`, 'admin-google-test'), false);
});

test('encrypts and decrypts Google refresh tokens', () => {
  const token = 'refresh-token-for-test';
  const encrypted = encryptGoogleRefreshToken(token);
  assert.notEqual(encrypted, token);
  assert.equal(decryptGoogleRefreshToken(encrypted), token);
});

test('normalizes Google customer identifiers', () => {
  assert.equal(normalizeCustomerId('123-456-7890'), '1234567890');
  assert.equal(normalizeCustomerId('customer-abc'), '');
});

test('normalizes Google Ads metrics into safe local values', () => {
  const metric = normalizeGoogleMetric({ metrics: { impressions: '12', clicks: '3', costMicros: '1000000', conversions: '2.5' } });
  assert.deepEqual(metric, { impressions: 12, reach: 0, clicks: 3, spendCents: 100, leads: 3, conversions: 2.5 });
  assert.equal(normalizeGoogleMetric({ metrics: { impressions: '-4', costMicros: '-1' } }).spendCents, 0);
});

test('normalizes a Google campaign row for the local panel', () => {
  const campaign = normalizeGoogleCampaign({
    campaign: { id: '987654321', name: 'Campanha teste', status: 'ENABLED', advertisingChannelType: 'SEARCH', startDate: '2026-08-22' },
    campaignBudget: { amountMicros: '2000000' },
    metrics: { impressions: '40', clicks: '4', costMicros: '1500000', conversions: '1' },
  });
  assert.equal(campaign.googleCampaignId, '987654321');
  assert.equal(campaign.status, 'ACTIVE');
  assert.equal(campaign.dailyBudgetCents, 200);
  assert.equal(campaign.spendCents, 150);
  assert.equal(campaign.leads, 1);
});
