const fs = require('fs');

// 1. Update backend/index.ts to mount rewardsRouter and reviewsRouter
let indexCode = fs.readFileSync('backend/index.ts', 'utf8');

if (!indexCode.includes("import { rewardsRouter }")) {
  indexCode = indexCode.replace(
    "import { appointmentsRouter } from './routers/appointments.router.js';",
    "import { appointmentsRouter } from './routers/appointments.router.js';\nimport { rewardsRouter } from './routers/rewards.router.js';\nimport { reviewsRouter } from './routers/reviews.router.js';"
  );

  indexCode = indexCode.replace(
    "app.use('/api/appointments', appointmentsRouter);",
    "app.use('/api/appointments', appointmentsRouter);\napp.use('/api/rewards', rewardsRouter);\napp.use('/api/reviews', reviewsRouter);"
  );

  fs.writeFileSync('backend/index.ts', indexCode);
  console.log('Successfully mounted rewardsRouter and reviewsRouter in backend/index.ts');
}

// 2. Update appointments.router.ts lookup handlers
let aptsCode = fs.readFileSync('backend/routers/appointments.router.ts', 'utf8');

// Update lookup/step1 catch and db check
const oldStep1 = `appointmentsRouter.get("/lookup/step1", sensitiveOpsLimiter, async (req: any, res) => {
  try {
    const { phone } = req.query;`;

const newStep1 = `appointmentsRouter.get("/lookup/step1", sensitiveOpsLimiter, async (req: any, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: userErrors.dbDisconnected });
    }
    const { phone } = req.query;`;

aptsCode = aptsCode.replace(oldStep1, newStep1);

// Update step1 catch
const oldStep1Catch = `  } catch (e: any) {
    console.error('[API] Erro em lookup/step1:', e);
    return res.status(500).json({ error: 'Erro ao buscar. Tente novamente.' });
  }`;

const newStep1Catch = `  } catch (e: any) {
    return handleError(res, e, 'GET /api/appointments/lookup/step1');
  }`;

aptsCode = aptsCode.replace(oldStep1Catch, newStep1Catch);

// Update lookup/verify db check
const oldVerify = `appointmentsRouter.post("/lookup/verify", sensitiveOpsLimiter, async (req: any, res) => {
  try {
    const { phone, code } = req.body;`;

const newVerify = `appointmentsRouter.post("/lookup/verify", sensitiveOpsLimiter, async (req: any, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: userErrors.dbDisconnected });
    }
    const { phone, code } = req.body;`;

aptsCode = aptsCode.replace(oldVerify, newVerify);

// Update verify catch
const oldVerifyCatch = `  } catch (e: any) {
    console.error('[API] Erro em lookup/verify:', e);
    return res.status(500).json({ error: 'Erro ao validar código. Tente novamente.' });
  }`;

const newVerifyCatch = `  } catch (e: any) {
    return handleError(res, e, 'POST /api/appointments/lookup/verify');
  }`;

aptsCode = aptsCode.replace(oldVerifyCatch, newVerifyCatch);

fs.writeFileSync('backend/routers/appointments.router.ts', aptsCode);
console.log('Successfully updated appointments.router.ts handlers');
