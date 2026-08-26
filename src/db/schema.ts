import { pgTable, text, timestamp, boolean, integer, numeric, jsonb, uniqueIndex, primaryKey } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { index } from 'drizzle-orm/pg-core';

export const profiles = pgTable('profiles', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  password: text('password'),
  phone: text('phone'),
  role: text('role').notNull().default('client'),
  avatarUrl: text('avatar_url'),
  loyaltyPoints: integer('loyalty_points').notNull().default(0),
  loyaltyTier: text('loyalty_tier').notNull().default('Bronze'),
  referralCode: text('referral_code').unique(),
  referredBy: text('referred_by'),
  birthday: text('birthday'),
  themePalette: text('theme_palette').notNull().default('heritage'),
  resetCodeHash: text('reset_code_hash'),
  resetCodeExpiresAt: timestamp('reset_code_expires_at'),
  lgpdConsent: boolean('lgpd_consent').notNull().default(false),
  lgpdConsentDate: timestamp('lgpd_consent_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const professionals = pgTable('professionals', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => profiles.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  nickname: text('nickname'),
  roleTitle: text('role_title').notNull().default('Master Barber'),
  phone: text('phone'),
  pixKey: text('pix_key'),
  rating: numeric('rating', { precision: 3, scale: 2 }).notNull().default('5.00'),
  reviewsCount: integer('reviews_count').notNull().default(0),
  photoUrl: text('photo_url'),
  specialties: jsonb('specialties').default([]),
  commissionRate: numeric('commission_rate', { precision: 4, scale: 2 }).notNull().default('0.40'),
  isActive: boolean('is_active').notNull().default(true),
  workingHours: jsonb('working_hours').notNull().default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const services = pgTable('services', {
  id: text('id').primaryKey(),
  categorySlug: text('category_slug').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  price: numeric('price', { precision: 10, scale: 2 }).notNull(),
  durationMinutes: integer('duration_minutes').notNull(),
  isCombo: boolean('is_combo').notNull().default(false),
  originalPrice: numeric('original_price', { precision: 10, scale: 2 }),
  discountPercentage: integer('discount_percentage').default(0),
  isPopular: boolean('is_popular').notNull().default(false),
  imageUrl: text('image_url'),
  galleryUrls: jsonb('gallery_urls').default([]),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const appointments = pgTable('appointments', {
  id: text('id').primaryKey(),
  clientId: text('client_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  clientName: text('client_name').notNull(),
  clientPhone: text('client_phone'),
  clientEmail: text('client_email'),
  professionalId: text('professional_id').notNull().references(() => professionals.id, { onDelete: 'restrict' }),
  professionalName: text('professional_name').notNull(),
  date: text('appointment_date').notNull(),
  timeSlot: text('time_slot').notNull(),
  status: text('status').notNull().default('confirmed'),
  totalDurationMinutes: integer('total_duration_minutes').notNull(),
  originalAmount: numeric('original_amount', { precision: 10, scale: 2 }).notNull(),
  discountAmount: numeric('discount_amount', { precision: 10, scale: 2 }).notNull().default('0.00'),
  finalAmount: numeric('final_amount', { precision: 10, scale: 2 }).notNull(),
  paymentMethod: text('payment_method').notNull(),
  bookingCode: text('booking_code').unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  services: jsonb('services').notNull().default([]),
  cancellationReason: text('cancellation_reason'),
  isReviewed: boolean('is_reviewed').notNull().default(false),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => {
  return {
    bookingConflictIdx: uniqueIndex('booking_conflict_idx')
      .on(table.professionalId, table.date, table.timeSlot)
      .where(sql`status != 'cancelled'`),
  };
});

export const products = pgTable('products', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  category: text('category').notNull(),
  brand: text('brand').notNull(),
  price: numeric('price', { precision: 10, scale: 2 }).notNull(),
  costPrice: numeric('cost_price', { precision: 10, scale: 2 }),
  stockQuantity: integer('stock_quantity').notNull().default(0),
  minStockAlert: integer('min_stock_alert').notNull().default(5),
  commissionPercentage: integer('commission_percentage').default(0),
  imageUrl: text('image_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const waitingQueue = pgTable('waiting_queue', {
  id: text('id').primaryKey(),
  appointmentId: text('appointment_id').references(() => appointments.id, { onDelete: 'cascade' }),
  clientId: text('client_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  clientName: text('client_name').notNull(),
  clientPhone: text('client_phone'),
  professionalId: text('professional_id').references(() => professionals.id, { onDelete: 'set null' }),
  professionalName: text('professional_name'),
  serviceTitle: text('service_title').notNull(),
  servicePrice: numeric('service_price', { precision: 10, scale: 2 }),
  scheduledTime: text('scheduled_time'),
  arrivedAt: text('arrived_at'),
  notes: text('notes'),
  startedAt: text('started_at'),
  completedAt: text('completed_at'),
  status: text('status').notNull().default('waiting'),
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
  estimatedWaitMinutes: integer('estimated_wait_minutes').notNull().default(0),
  queuePosition: integer('queue_position').notNull().default(0),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});


export const reviews = pgTable('reviews', {
  id: text('id').primaryKey(),
  appointmentId: text('appointment_id').references(() => appointments.id, { onDelete: 'cascade' }),
  clientId: text('client_id').references(() => profiles.id, { onDelete: 'cascade' }),
  serviceId: text('service_id').references(() => services.id, { onDelete: 'set null' }),
  serviceTitle: text('service_title'),
  professionalId: text('professional_id').notNull().references(() => professionals.id, { onDelete: 'cascade' }),
  rating: integer('rating').notNull(),
  understoodRequest: text('understood_request'),
  waitTimeAcceptable: text('wait_time_acceptable'),
  serviceExperience: text('service_experience'),
  wouldRecommend: text('would_recommend'),
  comment: text('comment'),
  hasPhoto: boolean('has_photo').default(false),
  photoUrl: text('photo_url'),
  pointsAwarded: integer('points_awarded').default(0),
  adminResponse: text('admin_response'),
  managementStatus: text('management_status').notNull().default('new'),
  priority: text('priority').notNull().default('normal'),
  internalNotes: text('internal_notes'),
  handledAt: timestamp('handled_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  appointmentUniqueIdx: uniqueIndex('reviews_appointment_id_unique')
    .on(table.appointmentId)
    .where(sql`${table.appointmentId} IS NOT NULL`),
}));

export const reviewFollowupEvents = pgTable('review_followup_events', {
  id: text('id').primaryKey(),
  reviewId: text('review_id').notNull().references(() => reviews.id, { onDelete: 'cascade' }),
  adminId: text('admin_id').references(() => profiles.id, { onDelete: 'set null' }),
  action: text('action').notNull(),
  fromStatus: text('from_status'),
  toStatus: text('to_status'),
  fromPriority: text('from_priority'),
  toPriority: text('to_priority'),
  note: text('note'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  reviewCreatedIdx: index('review_followup_events_review_created_idx').on(table.reviewId, table.createdAt),
}));

export const pointTransactions = pgTable('point_transactions', {
  id: text('id').primaryKey(),
  clientId: text('client_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  amount: integer('amount').notNull(),
  type: text('type').notNull(),
  sourceType: text('source_type').notNull().default('legacy'),
  sourceId: text('source_id'),
  description: text('description').notNull(),
  sourceKey: text('source_key'),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  sourceKeyUniqueIdx: uniqueIndex('point_transactions_source_key_unique')
    .on(table.sourceKey)
    .where(sql`${table.sourceKey} IS NOT NULL`),
  clientExpiresIdx: index('point_transactions_client_expires_idx')
    .on(table.clientId, table.expiresAt)
    .where(sql`${table.expiresAt} IS NOT NULL`),
  sourceIdx: index('point_transactions_source_idx').on(table.sourceType, table.sourceId),
}));

export const loyaltyTiers = pgTable('loyalty_tiers', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  minimumPoints: integer('minimum_points').notNull().default(0),
  multiplier: numeric('multiplier', { precision: 8, scale: 2 }).notNull().default('1.00'),
  displayOrder: integer('display_order').notNull().default(0),
  color: text('color'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  displayOrderIdx: index('loyalty_tiers_order_idx').on(table.displayOrder, table.minimumPoints),
}));

export const referrals = pgTable('referrals', {
  id: text('id').primaryKey(),
  referrerId: text('referrer_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  referredId: text('referred_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('pending'),
  pointsAwarded: integer('points_awarded').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  referredUniqueIdx: uniqueIndex('referrals_referred_id_unique').on(table.referredId),
}));

export const loyaltyRedemptions = pgTable('loyalty_redemptions', {
  id: text('id').primaryKey(),
  clientId: text('client_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  rewardId: text('reward_id').notNull().references(() => rewards.id, { onDelete: 'restrict' }),
  points: integer('points').notNull(),
  status: text('status').notNull().default('completed'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const notificationDeliveries = pgTable('notification_deliveries', {
  id: text('id').primaryKey(),
  appointmentId: text('appointment_id').references(() => appointments.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(),
  channel: text('channel').notNull(),
  deliveryKey: text('delivery_key').notNull().unique(),
  sentAt: timestamp('sent_at').defaultNow().notNull(),
});

export const adminPushSubscriptions = pgTable('admin_push_subscriptions', {
  id: text('id').primaryKey(),
  adminId: text('admin_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  endpoint: text('endpoint').notNull().unique(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  userAgent: text('user_agent'),
  enabled: boolean('enabled').notNull().default(true),
  lastSeenAt: timestamp('last_seen_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const loyaltyBenefits = pgTable('loyalty_benefits', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  benefitType: text('benefit_type').notNull().default('custom'),
  valueAmount: numeric('value_amount', { precision: 10, scale: 2 }),
  valueText: text('value_text'),
  serviceId: text('service_id').references(() => services.id, { onDelete: 'set null' }),
  productId: text('product_id').references(() => products.id, { onDelete: 'set null' }),
  usageLimit: integer('usage_limit'),
  validityDays: integer('validity_days'),
  isActive: boolean('is_active').notNull().default(true),
  displayOrder: integer('display_order').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  activeOrderIdx: index('loyalty_benefits_active_order_idx').on(table.isActive, table.displayOrder, table.name),
}));

export const loyaltyTierBenefits = pgTable('loyalty_tier_benefits', {
  tierId: text('tier_id').notNull().references(() => loyaltyTiers.id, { onDelete: 'cascade' }),
  benefitId: text('benefit_id').notNull().references(() => loyaltyBenefits.id, { onDelete: 'cascade' }),
  displayOrder: integer('display_order').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  primaryKey: primaryKey({ columns: [table.tierId, table.benefitId] }),
  benefitIdx: index('loyalty_tier_benefits_benefit_idx').on(table.benefitId, table.displayOrder),
}));

export const loyaltyPlans = pgTable('loyalty_plans', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description').notNull(),
  price: numeric('price', { precision: 10, scale: 2 }).notNull().default('0'),
  billingPeriod: text('billing_period').notNull().default('none'),
  pointsBonus: integer('points_bonus').notNull().default(0),
  status: text('status').notNull().default('draft'),
  displayOrder: integer('display_order').notNull().default(0),
  isFeatured: boolean('is_featured').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  statusOrderIdx: index('loyalty_plans_status_order_idx').on(table.status, table.displayOrder, table.name),
}));

export const loyaltyPlanBenefits = pgTable('loyalty_plan_benefits', {
  planId: text('plan_id').notNull().references(() => loyaltyPlans.id, { onDelete: 'cascade' }),
  benefitId: text('benefit_id').notNull().references(() => loyaltyBenefits.id, { onDelete: 'cascade' }),
  displayOrder: integer('display_order').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  primaryKey: primaryKey({ columns: [table.planId, table.benefitId] }),
  benefitIdx: index('loyalty_plan_benefits_benefit_idx').on(table.benefitId, table.displayOrder),
}));

export const loyaltySettings = pgTable('loyalty_settings', {
  id: text('id').primaryKey().default('default'),
  config: jsonb('config').notNull().default({}),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const rewards = pgTable('rewards', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  pointsRequired: integer('points_required').notNull(),
  rewardType: text('reward_type').notNull(),
  valueDescription: text('value_description').notNull(),
  icon: text('icon'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const scheduleBlocks = pgTable('schedule_blocks', {
  id: text('id').primaryKey(),
  professionalId: text('professional_id').notNull().references(() => professionals.id, { onDelete: 'cascade' }),
  date: text('date').notNull(),
  startTime: text('start_time').notNull(),
  endTime: text('end_time').notNull(),
  reason: text('reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const cashTransactions = pgTable('cash_transactions', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  description: text('description').notNull(),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  category: text('category').notNull(),
  paymentMethod: text('payment_method').notNull(),
  date: text('date').notNull(),
  status: text('status').notNull().default('completed'),
  professionalName: text('professional_name'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const receipts = pgTable('receipts', {
  id: text('id').primaryKey(),
  appointmentId: text('appointment_id').references(() => appointments.id, { onDelete: 'set null' }),
  clientId: text('client_id').references(() => profiles.id, { onDelete: 'set null' }),
  clientName: text('client_name').notNull(),
  clientPhone: text('client_phone'),
  professionalId: text('professional_id').references(() => professionals.id, { onDelete: 'set null' }),
  professionalName: text('professional_name'),
  serviceTitle: text('service_title').notNull(),
  originalAmount: numeric('original_amount', { precision: 10, scale: 2 }).notNull(),
  enteredAmount: numeric('entered_amount', { precision: 10, scale: 2 }).notNull(),
  discountPercent: numeric('discount_percent', { precision: 5, scale: 2 }).notNull().default('0.00'),
  discountAmount: numeric('discount_amount', { precision: 10, scale: 2 }).notNull().default('0.00'),
  surchargePercent: numeric('surcharge_percent', { precision: 5, scale: 2 }).notNull().default('0.00'),
  surchargeAmount: numeric('surcharge_amount', { precision: 10, scale: 2 }).notNull().default('0.00'),
  totalAmount: numeric('total_amount', { precision: 10, scale: 2 }).notNull(),
  paymentMethod: text('payment_method'),
  amountReceived: numeric('amount_received', { precision: 10, scale: 2 }).notNull().default('0.00'),
  changeAmount: numeric('change_amount', { precision: 10, scale: 2 }).notNull().default('0.00'),
  observations: text('observations'),
  status: text('status').notNull().default('pending'),
  receivedAt: timestamp('received_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  appointmentUniqueIdx: uniqueIndex('receipts_appointment_id_unique')
    .on(table.appointmentId)
    .where(sql`${table.appointmentId} IS NOT NULL`),
}));

export const receiptsRelations = relations(receipts, ({ one }) => ({
  appointment: one(appointments, {
    fields: [receipts.appointmentId],
    references: [appointments.id],
  }),
  client: one(profiles, {
    fields: [receipts.clientId],
    references: [profiles.id],
  }),
  professional: one(professionals, {
    fields: [receipts.professionalId],
    references: [professionals.id],
  }),
}));

// Relationships
export const scheduleBlocksRelations = relations(scheduleBlocks, ({ one }) => ({
  professional: one(professionals, {
    fields: [scheduleBlocks.professionalId],
    references: [professionals.id],
  }),
}));
export const profilesRelations = relations(profiles, ({ many }) => ({
  appointments: many(appointments),
  adminPushSubscriptions: many(adminPushSubscriptions),
}));

export const professionalsRelations = relations(professionals, ({ many, one }) => ({
  userProfile: one(profiles, {
    fields: [professionals.userId],
    references: [profiles.id],
  }),
  appointments: many(appointments),
  waitingQueue: many(waitingQueue),
  reviews: many(reviews),
}));

export const appointmentsRelations = relations(appointments, ({ one }) => ({
  clientProfile: one(profiles, {
    fields: [appointments.clientId],
    references: [profiles.id],
  }),
  professional: one(professionals, {
    fields: [appointments.professionalId],
    references: [professionals.id],
  }),
  review: one(reviews, {
    fields: [appointments.id],
    references: [reviews.appointmentId],
  }),
}));


export const reviewsRelations = relations(reviews, ({ one, many }) => ({
  appointment: one(appointments, {
    fields: [reviews.appointmentId],
    references: [appointments.id],
  }),
  professional: one(professionals, {
    fields: [reviews.professionalId],
    references: [professionals.id],
  }),
  followupEvents: many(reviewFollowupEvents),
}));

export const reviewFollowupEventsRelations = relations(reviewFollowupEvents, ({ one }) => ({
  review: one(reviews, {
    fields: [reviewFollowupEvents.reviewId],
    references: [reviews.id],
  }),
  admin: one(profiles, {
    fields: [reviewFollowupEvents.adminId],
    references: [profiles.id],
  }),
}));

export const waitingQueueRelations = relations(waitingQueue, ({ one }) => ({
  appointment: one(appointments, {
    fields: [waitingQueue.appointmentId],
    references: [appointments.id],
  }),
  professional: one(professionals, {
    fields: [waitingQueue.professionalId],
    references: [professionals.id],
  }),
  clientProfile: one(profiles, {
    fields: [waitingQueue.clientId],
    references: [profiles.id],
  }),
}));

export const loyaltyRedemptionsRelations = relations(loyaltyRedemptions, ({ one }) => ({
  client: one(profiles, {
    fields: [loyaltyRedemptions.clientId],
    references: [profiles.id],
  }),
  reward: one(rewards, {
    fields: [loyaltyRedemptions.rewardId],
    references: [rewards.id],
  }),
}));

export const notificationDeliveriesRelations = relations(notificationDeliveries, ({ one }) => ({
  appointment: one(appointments, {
    fields: [notificationDeliveries.appointmentId],
    references: [appointments.id],
  }),
}));
export const adminPushSubscriptionsRelations = relations(adminPushSubscriptions, ({ one }) => ({
  admin: one(profiles, {
    fields: [adminPushSubscriptions.adminId],
    references: [profiles.id],
  }),
}));

export const shopSettings = pgTable('shop_settings', {
  id: text('id').primaryKey().default('default'),
  name: text('name').notNull().default('Navo Barber & Club'),
  unitName: text('unit_name').notNull().default('Unidade Expectativa'),
  slogan: text('slogan').notNull().default('Estilo, Tradição e Excelência na Medida Certa'),
  address: text('address').notNull().default('Rua Fortaleza, 1420 - Expectativa, Sobral - CE'),
  phone: text('phone').notNull().default('(11) 99999-8888'),
  whatsapp: text('whatsapp').notNull().default('5511999998888'),
  openTime: text('open_time').notNull().default('09:00'),
  closeTime: text('close_time').notNull().default('20:00'),
  operatingDays: jsonb('operating_days').notNull().default([1, 2, 3, 4, 5, 6]),
  operatingSchedule: jsonb('operating_schedule').notNull().default({
    monday: { active: true, open: '09:00', close: '20:00' },
    tuesday: { active: true, open: '09:00', close: '20:00' },
    wednesday: { active: true, open: '09:00', close: '20:00' },
    thursday: { active: true, open: '09:00', close: '20:00' },
    friday: { active: true, open: '09:00', close: '21:00' },
    saturday: { active: true, open: '09:00', close: '20:00' },
    sunday: { active: false, open: '10:00', close: '16:00' },
  }),
  mapsUrl: text('maps_url').default('https://maps.google.com/?q=Rua+Fortaleza+1420+Expectativa+Sobral+CE'),
  instagram: text('instagram').default('@barbearianavo'),
  logoUrl: text('logo_url'),
  description: text('description').default('Barbearia premium com foco em experiência do cliente, cortes modernos e tradicionais.'),
  // Controla se o cliente pode solicitar um horário que ultrapassa o fechamento
  // (fica pendente de aprovação do barbeiro) ou se esses horários simplesmente
  // não são oferecidos. Desativado por padrão.
  allowOutsideHoursApproval: boolean('allow_outside_hours_approval').notNull().default(false),
  themePalette: text('theme_palette').notNull().default('heritage'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Configuração de envio de e-mails (SMTP) — singleton, id fixo 'default'.
// Guardado em tabela separada (não em shop_settings) porque contém uma
// credencial sensível (smtpPassword) e shop_settings é lido publicamente
// pelo endpoint GET /api/shop-profile (sem auth).
export const operationSettings = pgTable('operation_settings', {
  id: text('id').primaryKey().default('default'),
  slotIntervalMinutes: integer('slot_interval_minutes').notNull().default(30),
  minimumBookingLeadMinutes: integer('minimum_booking_lead_minutes').notNull().default(0),
  maximumBookingHorizonDays: integer('maximum_booking_horizon_days').notNull().default(90),
  sameDayBookingCutoffMinutes: integer('same_day_booking_cutoff_minutes').notNull().default(0),
  bufferBetweenAppointmentsMinutes: integer('buffer_between_appointments_minutes').notNull().default(0),
  availabilityCacheTtlSeconds: integer('availability_cache_ttl_seconds').notNull().default(20),
  queueRefreshSeconds: integer('queue_refresh_seconds').notNull().default(15),
  queueBaseWaitMinutes: integer('queue_base_wait_minutes').notNull().default(15),
  allowWalkIn: boolean('allow_walk_in').notNull().default(true),
  requireProfessionalForWalkIn: boolean('require_professional_for_walk_in').notNull().default(false),
  queueVisibleLimit: integer('queue_visible_limit').notNull().default(5),
  reportsDayStartTime: text('reports_day_start_time').notNull().default('00:00'),
  reportsIncludeCancelled: boolean('reports_include_cancelled').notNull().default(false),
  reportsIncludeNoShow: boolean('reports_include_no_show').notNull().default(false),
  reportsComparisonWindow: text('reports_comparison_window').notNull().default('previous_period'),
  reportsRefreshSeconds: integer('reports_refresh_seconds').notNull().default(30),
  reportsShowPendingValues: boolean('reports_show_pending_values').notNull().default(true),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const emailSettings = pgTable('email_settings', {
  id: text('id').primaryKey().default('default'),
  enabled: boolean('enabled').notNull().default(false),
  smtpHost: text('smtp_host').default(''),
  smtpPort: integer('smtp_port').notNull().default(587),
  // true = conexão TLS implícita (porta 465). false = STARTTLS (porta 587/25).
  smtpSecure: boolean('smtp_secure').notNull().default(false),
  smtpUser: text('smtp_user').default(''),
  smtpPassword: text('smtp_password').default(''),
  fromName: text('from_name').notNull().default('Navo Barber & Club'),
  fromEmail: text('from_email').default(''),
  replyTo: text('reply_to').default(''),
  notificationEmail: text('notification_email').default(''),
  notifyOnBooking: boolean('notify_on_booking').notNull().default(true),
  notifyOnReschedule: boolean('notify_on_reschedule').notNull().default(true),
  notifyOnCancel: boolean('notify_on_cancel').notNull().default(false),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const printSettings = pgTable('print_settings', {
  id: text('id').primaryKey().default('default'),
  receiptFormat: text('receipt_format').notNull().default('thermal'),
  reportFormat: text('report_format').notNull().default('a4'),
  qrFormat: text('qr_format').notNull().default('a4'),
  thermalWidthMm: integer('thermal_width_mm').notNull().default(80),
  a4Orientation: text('a4_orientation').notNull().default('portrait'),
  fontSize: integer('font_size').notNull().default(11),
  density: text('density').notNull().default('comfortable'),
  marginMm: integer('margin_mm').notNull().default(8),
  showLogo: boolean('show_logo').notNull().default(true),
  showClientData: boolean('show_client_data').notNull().default(true),
  showProfessional: boolean('show_professional').notNull().default(true),
  showService: boolean('show_service').notNull().default(true),
  showPayment: boolean('show_payment').notNull().default(true),
  showObservations: boolean('show_observations').notNull().default(true),
  showQr: boolean('show_qr').notNull().default(true),
  showFooter: boolean('show_footer').notNull().default(true),
  footerText: text('footer_text').notNull().default('Obrigado pela preferência.'),
  reportIncludeCharts: boolean('report_include_charts').notNull().default(true),
  reportIncludeDetails: boolean('report_include_details').notNull().default(true),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Credenciais e comportamento da Evolution API. Nunca é lida pelo endpoint público de perfil.
export const evolutionApiSettings = pgTable('evolution_api_settings', {
  id: text('id').primaryKey().default('default'),
  enabled: boolean('enabled').notNull().default(false),
  baseUrl: text('base_url').notNull().default(''),
  instanceName: text('instance_name').notNull().default(''),
  apiKey: text('api_key').notNull().default(''),
  webhookEnabled: boolean('webhook_enabled').notNull().default(false),
  webhookUrl: text('webhook_url').notNull().default(''),
  webhookSecret: text('webhook_secret').notNull().default(''),
  navoBotEnabled: boolean('navobot_enabled').notNull().default(false),
  whatsappAccountType: text('whatsapp_account_type').notNull().default('personal_qr'),
  useInteractiveMessages: boolean('use_interactive_messages').notNull().default(false),
  managerNotificationPhone: text('manager_notification_phone').default(''),
  notifyBarberOnHandoff: boolean('notify_barber_on_handoff').notNull().default(true),
  notifyManagerOnHandoff: boolean('notify_manager_on_handoff').notNull().default(true),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});



// Estado conversacional e auditoria mínima do agente híbrido de WhatsApp.
export const navoBotConversations = pgTable('navobot_conversations', {
  id: text('id').primaryKey(),
  phone: text('phone').notNull(),
  instanceName: text('instance_name').notNull().default(''),
  state: text('state').notNull().default('idle'),
  context: jsonb('context').notNull().default({}),
  lastInboundMessageId: text('last_inbound_message_id'),
  lastInboundAt: timestamp('last_inbound_at'),
  lastOutboundAt: timestamp('last_outbound_at'),
  handoffRequested: boolean('handoff_requested').notNull().default(false),
  handoffReason: text('handoff_reason'),
  assignedProfessionalId: text('assigned_professional_id'),
  assignedProfessionalName: text('assigned_professional_name'),
  resolvedAt: timestamp('resolved_at'),
  resolvedBy: text('resolved_by'),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  phoneInstanceIdx: uniqueIndex('navobot_conversations_phone_instance_idx').on(table.phone, table.instanceName),
}));

export const navoBotMessages = pgTable('navobot_messages', {
  id: text('id').primaryKey(),
  conversationId: text('conversation_id').notNull().references(() => navoBotConversations.id, { onDelete: 'cascade' }),
  messageId: text('message_id').notNull().unique(),
  phone: text('phone').notNull(),
  direction: text('direction').notNull(),
  text: text('text').notNull().default(''),
  intent: text('intent'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const navoBotConversationsRelations = relations(navoBotConversations, ({ many }) => ({
  messages: many(navoBotMessages),
}));

export const navoBotMessagesRelations = relations(navoBotMessages, ({ one }) => ({
  conversation: one(navoBotConversations, {
    fields: [navoBotMessages.conversationId],
    references: [navoBotConversations.id],
  }),
}));

// Integração Meta Ads: tokens ficam somente no backend e as campanhas são isoladas pelo proprietário.
export const metaAdsConnections = pgTable('meta_ads_connections', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  metaUserId: text('meta_user_id'),
  metaUserName: text('meta_user_name'),
  accessToken: text('access_token').notNull().default(''),
  tokenExpiresAt: timestamp('token_expires_at'),
  adAccountId: text('ad_account_id'),
  adAccountName: text('ad_account_name'),
  currency: text('currency').default('BRL'),
  pageId: text('page_id'),
  pageName: text('page_name'),
  status: text('status').notNull().default('connected'),
  lastSyncedAt: timestamp('last_synced_at'),
  lastError: text('last_error'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  ownerUniqueIdx: uniqueIndex('meta_ads_connections_owner_unique_idx').on(table.ownerId),
}));

export const metaAdsCampaigns = pgTable('meta_ads_campaigns', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  connectionId: text('connection_id').notNull().references(() => metaAdsConnections.id, { onDelete: 'cascade' }),
  metaCampaignId: text('meta_campaign_id').notNull().unique(),
  metaAdSetId: text('meta_ad_set_id'),
  metaCreativeId: text('meta_creative_id'),
  metaAdId: text('meta_ad_id'),
  name: text('name').notNull(),
  objective: text('objective').notNull(),
  status: text('status').notNull().default('PAUSED'),
  dailyBudgetCents: integer('daily_budget_cents').notNull().default(0),
  startDate: text('start_date'),
  endDate: text('end_date'),
  locationLabel: text('location_label'),
  locationKey: text('location_key'),
  destinationUrl: text('destination_url'),
  adText: text('ad_text'),
  headline: text('headline'),
  imageUrl: text('image_url'),
  impressions: integer('impressions').notNull().default(0),
  reach: integer('reach').notNull().default(0),
  clicks: integer('clicks').notNull().default(0),
  leads: integer('leads').notNull().default(0),
  spendCents: integer('spend_cents').notNull().default(0),
  lastInsightAt: timestamp('last_insight_at'),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  ownerIdx: index('meta_ads_campaigns_owner_idx').on(table.ownerId),
  connectionIdx: index('meta_ads_campaigns_connection_idx').on(table.connectionId),
}));

export const metaAdsLeads = pgTable('meta_ads_leads', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  connectionId: text('connection_id').notNull().references(() => metaAdsConnections.id, { onDelete: 'cascade' }),
  campaignId: text('campaign_id').references(() => metaAdsCampaigns.id, { onDelete: 'set null' }),
  metaLeadId: text('meta_lead_id').notNull().unique(),
  fullName: text('full_name'),
  phone: text('phone'),
  email: text('email'),
  payload: jsonb('payload').notNull().default({}),
  receivedAt: timestamp('received_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  ownerIdx: index('meta_ads_leads_owner_idx').on(table.ownerId),
  campaignIdx: index('meta_ads_leads_campaign_idx').on(table.campaignId),
}));

// Integração Google Ads: credenciais ficam somente no backend e os dados são isolados pelo proprietário.
export const googleAdsConnections = pgTable('google_ads_connections', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  googleUserId: text('google_user_id'),
  googleUserName: text('google_user_name'),
  refreshToken: text('refresh_token').notNull().default(''),
  tokenExpiresAt: timestamp('token_expires_at'),
  customerId: text('customer_id'),
  customerName: text('customer_name'),
  managerCustomerId: text('manager_customer_id'),
  currency: text('currency').default('BRL'),
  status: text('status').notNull().default('connected'),
  lastSyncedAt: timestamp('last_synced_at'),
  lastError: text('last_error'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  ownerUniqueIdx: uniqueIndex('google_ads_connections_owner_unique_idx').on(table.ownerId),
}));

export const googleAdsCampaigns = pgTable('google_ads_campaigns', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  connectionId: text('connection_id').notNull().references(() => googleAdsConnections.id, { onDelete: 'cascade' }),
  customerId: text('customer_id').notNull(),
  googleCampaignId: text('google_campaign_id').notNull(),
  googleAdGroupId: text('google_ad_group_id'),
  googleAdId: text('google_ad_id'),
  name: text('name').notNull(),
  objective: text('objective').notNull().default('WEBSITE_TRAFFIC'),
  status: text('status').notNull().default('PAUSED'),
  dailyBudgetCents: integer('daily_budget_cents').notNull().default(0),
  startDate: text('start_date'),
  endDate: text('end_date'),
  locationLabel: text('location_label'),
  locationResourceName: text('location_resource_name'),
  destinationUrl: text('destination_url'),
  adText: text('ad_text'),
  headline: text('headline'),
  keywords: jsonb('keywords').notNull().default([]),
  impressions: integer('impressions').notNull().default(0),
  reach: integer('reach').notNull().default(0),
  clicks: integer('clicks').notNull().default(0),
  leads: integer('leads').notNull().default(0),
  spendCents: integer('spend_cents').notNull().default(0),
  conversions: numeric('conversions').notNull().default('0'),
  lastInsightAt: timestamp('last_insight_at'),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  ownerIdx: index('google_ads_campaigns_owner_idx').on(table.ownerId),
  connectionIdx: index('google_ads_campaigns_connection_idx').on(table.connectionId),
  remoteUniqueIdx: uniqueIndex('google_ads_campaigns_remote_unique_idx').on(table.customerId, table.googleCampaignId),
}));

export const googleAdsLeads = pgTable('google_ads_leads', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  connectionId: text('connection_id').notNull().references(() => googleAdsConnections.id, { onDelete: 'cascade' }),
  campaignId: text('campaign_id').references(() => googleAdsCampaigns.id, { onDelete: 'set null' }),
  googleLeadId: text('google_lead_id').notNull().unique(),
  fullName: text('full_name'),
  phone: text('phone'),
  email: text('email'),
  payload: jsonb('payload').notNull().default({}),
  receivedAt: timestamp('received_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  ownerIdx: index('google_ads_leads_owner_idx').on(table.ownerId),
  campaignIdx: index('google_ads_leads_campaign_idx').on(table.campaignId),
}));
