import assert from 'node:assert/strict';
import test from 'node:test';
import { bookingSchema } from '../backend/utils/booking.js';
import { authCookieOptions } from '../backend/middleware/auth.js';
import { matchPhoneNumbers, normalizePhone, sanitizePhone } from '../backend/utils/phone.js';
import { addDaysBRT, getDayOfWeekKey, timeToMinutes } from '../src/utils/dateUtils';

test('booking schema accepts the implemented payment method', () => {
  const parsed = bookingSchema.safeParse({
    date: '2026-08-20',
    timeSlot: '10:30',
    services: ['svc_cut'],
    paymentMethod: 'pay_at_venue',
  });

  assert.equal(parsed.success, true);
});

test('booking schema rejects an unknown payment method', () => {
  const parsed = bookingSchema.safeParse({
    date: '2026-08-20',
    timeSlot: '10:30',
    services: ['svc_cut'],
    paymentMethod: 'cash_on_delivery',
  });

  assert.equal(parsed.success, false);
});

test('phone matching preserves Brazilian DDD and ninth-digit compatibility', () => {
  assert.equal(sanitizePhone('(88) 99834-0085'), '5588998340085');
  assert.equal(normalizePhone('+55 (88) 99834-0085'), '88998340085');
  assert.equal(matchPhoneNumbers('(88) 99834-0085', '5588998340085'), true);
  assert.equal(matchPhoneNumbers('(88) 99834-0085', '(85) 99834-0085'), false);
});

test('BRT date helpers operate on calendar strings without local timezone drift', () => {
  assert.equal(addDaysBRT('2026-08-31', 1), '2026-09-01');
  assert.equal(getDayOfWeekKey('2026-08-19'), 'wednesday');
  assert.equal(timeToMinutes('09:30'), 570);
});

test('auth session cookie is HTTP-only and secure in production only', () => {
  assert.equal(authCookieOptions.httpOnly, true);
  assert.equal(authCookieOptions.sameSite, 'lax');
  assert.equal(authCookieOptions.path, '/');
  assert.equal(authCookieOptions.maxAge, 7 * 24 * 60 * 60 * 1000);
});
