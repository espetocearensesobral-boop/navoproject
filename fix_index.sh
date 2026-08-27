#!/bin/bash

# Keep the original up to the line where we need to close the function
sed -n '1,102p' backend/index.ts > backend/index_fixed.ts
echo "  }" >> backend/index_fixed.ts
echo "}" >> backend/index_fixed.ts
echo "" >> backend/index_fixed.ts
echo "dbReadyPromise = initializeDb().catch(console.error);" >> backend/index_fixed.ts
echo "" >> backend/index_fixed.ts

# Append imports
cat << 'IMPORTS' >> backend/index_fixed.ts
import { healthRouter } from './routers/health.router.js';
import { systemRouter } from './routers/system.router.js';
import { seedRouter } from './routers/seed.router.js';
import { authRouter } from './routers/auth.router.js';
import { profilesRouter } from './routers/profiles.router.js';
import { relationshipRouter } from './routers/relationship.router.js';
import { queueRouter } from './routers/queue.router.js';
import { productsRouter } from './routers/products.router.js';
import { servicesRouter } from './routers/services.router.js';
import { professionalsRouter } from './routers/professionals.router.js';
import { scheduleBlocksRouter } from './routers/schedule-blocks.router.js';
import { cashTransactionsRouter } from './routers/cash-transactions.router.js';
import { receiptsRouter } from './routers/receipts.router.js';
import { adminPushRouter } from './routers/admin-push.router.js';
import { financialReportsRouter } from './routers/financial-reports.router.js';
import { operationalReportsRouter } from './routers/operational-reports.router.js';
import { availabilityRouter } from './routers/availability.router.js';
import { operationSettingsRouter } from './routers/operation-settings.router.js';
import { printSettingsRouter } from './routers/print-settings.router.js';
import { appointmentsRouter } from './routers/appointments.router.js';
import { loyaltyRouter } from './routers/loyalty.router.js';
import { referralsRouter } from './routers/referrals.router.js';
import { rewardsRouter } from './routers/rewards.router.js';
import { reviewsRouter } from './routers/reviews.router.js';
import { metaAdsRouter } from './routers/meta-ads.router.js';
import { googleAdsRouter } from './routers/google-ads.router.js';
import { whatsappRouter } from './whatsapp.js';
import { emailRouter } from './email.js';
import { evolutionApiRouter } from './evolution-api.js';

import { subscriptionsRouter } from './routers/subscriptions.router.js';
import { auditRouter } from './routers/audit.router.js';
import { remindersRouter } from './routers/reminders.router.js';

app.use('/api/health', healthRouter);
app.use('/api/system', systemRouter);
app.use('/api/seed', seedRouter);
app.use('/api/auth', authRouter);
app.use('/api/profiles', profilesRouter);
app.use('/api/relationship', relationshipRouter);
app.use('/api/queue', queueRouter);
app.use('/api/products', productsRouter);
app.use('/api/services', servicesRouter);
app.use('/api/professionals', professionalsRouter);
app.use('/api/schedule-blocks', scheduleBlocksRouter);
app.use('/api/cash-transactions', cashTransactionsRouter);
app.use('/api/receipts', receiptsRouter);
app.use('/api/admin-push', adminPushRouter);
app.use('/api/financial-reports', financialReportsRouter);
app.use('/api/operational-reports', operationalReportsRouter);
app.use('/api/availability', availabilityRouter);
app.use('/api/operation-settings', operationSettingsRouter);
app.use('/api/print-settings', printSettingsRouter);
app.use('/api/appointments', appointmentsRouter);
app.use('/api/loyalty', loyaltyRouter);
app.use('/api/referrals', referralsRouter);
app.use('/api/rewards', rewardsRouter);
app.use('/api/reviews', reviewsRouter);
app.use('/api/meta-ads', metaAdsRouter);
app.use('/api/google-ads', googleAdsRouter);
app.use('/api/whatsapp/reconnect', requireAuth, requireAdmin);
app.use('/api/whatsapp/logout', requireAuth, requireAdmin);
app.use('/api/whatsapp', whatsappRouter);
app.use('/api/email/config', requireAuth, requireAdmin);
app.use('/api/email/test', requireAuth, requireAdmin);
app.use('/api/email', emailRouter);
app.use('/api/evolution', evolutionApiRouter);

app.use('/api/subscriptions', subscriptionsRouter);
app.use('/api/audit', auditRouter);
app.use('/api/reminders', remindersRouter);

export default app;
IMPORTS

mv backend/index_fixed.ts backend/index.ts
chmod +x fix_index.sh
./fix_index.sh
