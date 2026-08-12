const fs = require('fs');
let code = fs.readFileSync('backend/index.ts', 'utf8');

// 1. Remove publicRoutes bypass for data endpoints so DB check runs for ALL data routes
const oldPublicRoutes = `  const publicRoutes = [
    '/whatsapp/status',
    '/services',
    '/professionals',
    '/shop-profile',
    '/products',
    '/rewards',
    '/availability',
    '/loyalty/config',
    '/reviews/public'
  ];`;

const newPublicRoutes = `  const publicRoutes = [
    '/whatsapp/status',
    '/health'
  ];`;

code = code.replace(oldPublicRoutes, newPublicRoutes);

// 2. Ensure DB error message is explicit and friendly
const oldDbErr = `    return res.status(503).json({
      error: 'Serviço temporariamente indisponível',
      message: 'Não foi possível comunicar com o banco de dados Supabase. Por favor, verifique sua conexão e tente novamente.',
      code: 'DATABASE_UNAVAILABLE'
    });`;

const newDbErr = `    return res.status(503).json({
      error: 'Serviço temporariamente indisponível',
      message: 'Não foi possível comunicar com o banco de dados. O sistema requer conexão com o banco de dados para operar.',
      code: 'DATABASE_UNAVAILABLE'
    });`;

code = code.replace(oldDbErr, newDbErr);

// 3. Remove DEFAULT_SHOP_PROFILE fallback in shop-profile GET route
const shopProfileRegex = /const DEFAULT_SHOP_PROFILE = \{[\s\S]*?\};\s*app\.get\("\/api\/shop-profile",[\s\S]*?\}\);\n\}\);/g;

const newShopProfileRoute = `app.get("/api/shop-profile", async (req: any, res: any) => {
  try {
    const rows = await db.select().from(schema.shopSettings).where(eq(schema.shopSettings.id, 'default'));
    if (!rows.length) {
      return res.status(404).json({ error: 'Perfil da barbearia não cadastrado no banco de dados.' });
    }
    const row = rows[0];
    res.json({
      id: row.id, name: row.name, unitName: row.unitName, slogan: row.slogan,
      address: row.address, phone: row.phone, whatsapp: row.whatsapp,
      openTime: row.openTime, closeTime: row.closeTime,
      operatingDays: row.operatingDays, operatingSchedule: row.operatingSchedule,
      mapsUrl: row.mapsUrl, instagram: row.instagram, logoUrl: row.logoUrl || '',
      description: row.description, allowOutsideHoursApproval: !!row.allowOutsideHoursApproval
    });
  } catch (e: any) {
    return handleError(res, e, req.path);
  }
});`;

code = code.replace(shopProfileRegex, newShopProfileRoute);

fs.writeFileSync('backend/index.ts', code);
console.log('Successfully updated backend/index.ts to strictly require DB connection.');
