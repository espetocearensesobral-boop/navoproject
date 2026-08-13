import { pgTable, text, timestamp, boolean, integer, numeric, jsonb, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

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
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});


export const reviews = pgTable('reviews', {
  id: text('id').primaryKey(),
  appointmentId: text('appointment_id').references(() => appointments.id, { onDelete: 'cascade' }),
  clientId: text('client_id').references(() => profiles.id, { onDelete: 'cascade' }),
  professionalId: text('professional_id').notNull().references(() => professionals.id, { onDelete: 'cascade' }),
  rating: integer('rating').notNull(),
  understoodRequest: text('understood_request'),
  waitTimeAcceptable: text('wait_time_acceptable'),
  wouldRecommend: text('would_recommend'),
  comment: text('comment'),
  hasPhoto: boolean('has_photo').default(false),
  photoUrl: text('photo_url'),
  pointsAwarded: integer('points_awarded').default(0),
  adminResponse: text('admin_response'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  appointmentUniqueIdx: uniqueIndex('reviews_appointment_id_unique')
    .on(table.appointmentId)
    .where(sql`${table.appointmentId} IS NOT NULL`),
}));

export const pointTransactions = pgTable('point_transactions', {
  id: text('id').primaryKey(),
  clientId: text('client_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  amount: integer('amount').notNull(),
  type: text('type').notNull(),
  description: text('description').notNull(),
  sourceKey: text('source_key'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  sourceKeyUniqueIdx: uniqueIndex('point_transactions_source_key_unique')
    .on(table.sourceKey)
    .where(sql`${table.sourceKey} IS NOT NULL`),
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

// Relationships
export const scheduleBlocksRelations = relations(scheduleBlocks, ({ one }) => ({
  professional: one(professionals, {
    fields: [scheduleBlocks.professionalId],
    references: [professionals.id],
  }),
}));
export const profilesRelations = relations(profiles, ({ many }) => ({
  appointments: many(appointments),
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


export const reviewsRelations = relations(reviews, ({ one }) => ({
  appointment: one(appointments, {
    fields: [reviews.appointmentId],
    references: [appointments.id],
  }),
  professional: one(professionals, {
    fields: [reviews.professionalId],
    references: [professionals.id],
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
  notifyOnBooking: boolean('notify_on_booking').notNull().default(true),
  notifyOnCancel: boolean('notify_on_cancel').notNull().default(false),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

