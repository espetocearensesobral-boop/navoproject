const fs = require('fs');
let code = fs.readFileSync('backend/index.ts', 'utf8');

// Add DEFAULT_SHOP_PROFILE definition
const shopProfileCode = `
const DEFAULT_SHOP_PROFILE = {
  id: 'default',
  name: 'Navo Barber & Club',
  unitName: 'Unidade Jardins',
  slogan: 'Estilo, Tradição e Excelência na Medida Certa',
  address: 'Rua Augusta, 1420 - Jardins, São Paulo - SP',
  phone: '(11) 99999-8888',
  whatsapp: '5511999998888',
  openTime: '09:00',
  closeTime: '20:00',
  operatingDays: [1, 2, 3, 4, 5, 6],
  operatingSchedule: {
    monday: { active: true, open: '09:00', close: '20:00' },
    tuesday: { active: true, open: '09:00', close: '20:00' },
    wednesday: { active: true, open: '09:00', close: '20:00' },
    thursday: { active: true, open: '09:00', close: '20:00' },
    friday: { active: true, open: '09:00', close: '21:00' },
    saturday: { active: true, open: '09:00', close: '20:00' },
    sunday: { active: false, open: '10:00', close: '16:00' }
  },
  mapsUrl: 'https://maps.google.com/?q=Rua+Augusta+1420+Jardins+Sao+Paulo',
  instagram: '@barbearianavo',
  logoUrl: '',
  description: 'Barbearia premium com foco em experiência do cliente, cortes modernos e tradicionais.',
  allowOutsideHoursApproval: false
};

app.get("/api/shop-profile", async (req: any, res: any) => {
  try {
    if (isDbConnected && db) {
      const rows = await db.select().from(schema.shopSettings).where(eq(schema.shopSettings.id, 'default'));
      if (rows.length) {
        const row = rows[0];
        return res.json({
          id: row.id, name: row.name, unitName: row.unitName, slogan: row.slogan,
          address: row.address, phone: row.phone, whatsapp: row.whatsapp,
          openTime: row.openTime, closeTime: row.closeTime,
          operatingDays: row.operatingDays, operatingSchedule: row.operatingSchedule,
          mapsUrl: row.mapsUrl, instagram: row.instagram, logoUrl: row.logoUrl || '',
          description: row.description, allowOutsideHoursApproval: !!row.allowOutsideHoursApproval
        });
      }
    }
    return res.json(DEFAULT_SHOP_PROFILE);
  } catch (e: any) {
    return res.json(DEFAULT_SHOP_PROFILE);
  }
});`;

code = code.replace(/app\.get\("\/api\/shop-profile",[\s\S]*?\}\);\n\}\);\n/g, shopProfileCode + "\n\n");

// Fix reviews public endpoint
const reviewsCode = `app.get("/api/reviews/public", async (req: any, res: any) => {
  try {
    if (!isDbConnected || !db) {
      return res.json([]);
    }
    const list = await db.query.reviews.findMany({
      where: eq(schema.reviews.rating, 5),
      orderBy: [desc(schema.reviews.createdAt)],
      limit: 10
    });

    const populated = await Promise.all(list.map(async (r: any) => {
      let clientName = 'Cliente Navo';
      let clientAvatar = null;
      let barberName = 'Barbeiro Navo';

      if (r.clientId) {
        const p = await db.query.profiles.findFirst({ where: eq(schema.profiles.id, r.clientId) });
        if (p) {
          clientName = p.name || clientName;
          clientAvatar = p.avatarUrl;
        }
      }
      if (r.professionalId) {
        const prof = await db.query.professionals.findFirst({ where: eq(schema.professionals.id, r.professionalId) });
        if (prof) barberName = prof.name;
      }

      return {
        id: r.id,
        clientName,
        clientAvatar,
        barberName,
        rating: r.rating,
        comment: r.comment || 'Atendimento impecável, corte e barba perfeitos!',
        photoUrl: r.photoUrl,
        createdAt: r.createdAt
      };
    }));

    res.json(populated);
  } catch (e: any) {
    res.json([]);
  }
});`;

code = code.replace(/app\.get\("\/api\/reviews\/public",[\s\S]*?\}\);\n\}\);\n/g, reviewsCode + "\n\n");

fs.writeFileSync('backend/index.ts', code);
console.log('Fallbacks applied to backend/index.ts');
