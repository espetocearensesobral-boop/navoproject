import express from 'express';
import { eq } from 'drizzle-orm';
import { db, isDbConnected } from '../index.js';
import * as schema from '../../src/db/schema.js';
import { requireAuth, requireAdmin } from '../middleware/index.js';
import { handleError } from '../utils/index.js';

export const defaultShopProfileData = {
  name: 'NavoClub',
  unitName: 'Unidade Expectativa',
  slogan: 'Estilo, Tradição e Excelência na Medida Certa',
  address: 'Rua Fortaleza, 1420 - Expectativa, Sobral - CE',
  phone: '(88) 99834-0085',
  landline: '(88) 3611-0000',
  whatsapp: '5588998340085',
  email: 'contato@barbearianavo.com.br',
  openTime: '09:00',
  closeTime: '20:00',
  operatingDays: [1, 2, 3, 4, 5, 6],
  operatingSchedule: {
    sunday: { active: false, open: '10:00', close: '16:00' },
    monday: { active: true, open: '09:00', close: '20:00' },
    tuesday: { active: true, open: '09:00', close: '20:00' },
    wednesday: { active: true, open: '09:00', close: '20:00' },
    thursday: { active: true, open: '09:00', close: '20:00' },
    friday: { active: true, open: '09:00', close: '21:00' },
    saturday: { active: true, open: '09:00', close: '20:00' }
  },
  mapsUrl: 'https://maps.google.com/?q=Rua+Fortaleza+1420+Expectativa+Sobral+CE',
  instagram: 'barbearia.navo',
  facebookUrl: '',
  logoUrl: '',
  description: 'A NavoClub é referência em estética masculina e serviços de alto padrão.',
  allowOutsideHoursApproval: false,
  themePalette: 'heritage'
};

export const shopProfileRouter = express.Router();

// GET /api/shop-profile - Obter dados da unidade / perfil da loja
shopProfileRouter.get('/', async (_req, res) => {
  try {
    if (!isDbConnected || !db) {
      return res.json(defaultShopProfileData);
    }
    const shop = await db.query.shopSettings.findFirst({
      where: eq(schema.shopSettings.id, 'default')
    });
    if (!shop) {
      return res.json(defaultShopProfileData);
    }
    return res.json({
      ...defaultShopProfileData,
      ...shop,
      operatingSchedule: shop.operatingSchedule || defaultShopProfileData.operatingSchedule,
      operatingDays: shop.operatingDays || defaultShopProfileData.operatingDays,
    });
  } catch (error) {
    return handleError(res, error, 'GET /api/shop-profile');
  }
});

// POST /api/shop-profile - Atualizar dados da unidade / perfil
shopProfileRouter.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    if (!isDbConnected || !db) {
      return res.status(503).json({ error: 'Banco de dados indisponível.' });
    }
    const {
      name,
      unitName,
      slogan,
      address,
      phone,
      whatsapp,
      openTime,
      closeTime,
      operatingDays,
      operatingSchedule,
      mapsUrl,
      instagram,
      logoUrl,
      description,
      allowOutsideHoursApproval,
      themePalette
    } = req.body;

    const valuesToUpdate = {
      name: name !== undefined ? name : defaultShopProfileData.name,
      unitName: unitName !== undefined ? unitName : defaultShopProfileData.unitName,
      slogan: slogan !== undefined ? slogan : defaultShopProfileData.slogan,
      address: address !== undefined ? address : defaultShopProfileData.address,
      phone: phone !== undefined ? phone : defaultShopProfileData.phone,
      whatsapp: whatsapp !== undefined ? whatsapp : defaultShopProfileData.whatsapp,
      openTime: openTime !== undefined ? openTime : defaultShopProfileData.openTime,
      closeTime: closeTime !== undefined ? closeTime : defaultShopProfileData.closeTime,
      operatingDays: operatingDays !== undefined ? operatingDays : defaultShopProfileData.operatingDays,
      operatingSchedule: operatingSchedule !== undefined ? operatingSchedule : defaultShopProfileData.operatingSchedule,
      mapsUrl: mapsUrl !== undefined ? mapsUrl : defaultShopProfileData.mapsUrl,
      instagram: instagram !== undefined ? instagram : defaultShopProfileData.instagram,
      logoUrl: logoUrl !== undefined ? logoUrl : defaultShopProfileData.logoUrl,
      description: description !== undefined ? description : defaultShopProfileData.description,
      allowOutsideHoursApproval: Boolean(allowOutsideHoursApproval),
      themePalette: themePalette !== undefined ? themePalette : 'heritage',
      updatedAt: new Date()
    };

    const [updated] = await db.insert(schema.shopSettings)
      .values({ id: 'default', ...valuesToUpdate })
      .onConflictDoUpdate({
        target: schema.shopSettings.id,
        set: valuesToUpdate
      })
      .returning();

    return res.json({
      success: true,
      profile: {
        ...defaultShopProfileData,
        ...(updated || valuesToUpdate)
      }
    });
  } catch (error) {
    return handleError(res, error, 'POST /api/shop-profile');
  }
});

// PUT /api/shop-profile - Atualizar dados da unidade / perfil
shopProfileRouter.put('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    if (!isDbConnected || !db) {
      return res.status(503).json({ error: 'Banco de dados indisponível.' });
    }
    const {
      name,
      unitName,
      slogan,
      address,
      phone,
      whatsapp,
      openTime,
      closeTime,
      operatingDays,
      operatingSchedule,
      mapsUrl,
      instagram,
      logoUrl,
      description,
      allowOutsideHoursApproval,
      themePalette
    } = req.body;

    const valuesToUpdate = {
      name: name !== undefined ? name : defaultShopProfileData.name,
      unitName: unitName !== undefined ? unitName : defaultShopProfileData.unitName,
      slogan: slogan !== undefined ? slogan : defaultShopProfileData.slogan,
      address: address !== undefined ? address : defaultShopProfileData.address,
      phone: phone !== undefined ? phone : defaultShopProfileData.phone,
      whatsapp: whatsapp !== undefined ? whatsapp : defaultShopProfileData.whatsapp,
      openTime: openTime !== undefined ? openTime : defaultShopProfileData.openTime,
      closeTime: closeTime !== undefined ? closeTime : defaultShopProfileData.closeTime,
      operatingDays: operatingDays !== undefined ? operatingDays : defaultShopProfileData.operatingDays,
      operatingSchedule: operatingSchedule !== undefined ? operatingSchedule : defaultShopProfileData.operatingSchedule,
      mapsUrl: mapsUrl !== undefined ? mapsUrl : defaultShopProfileData.mapsUrl,
      instagram: instagram !== undefined ? instagram : defaultShopProfileData.instagram,
      logoUrl: logoUrl !== undefined ? logoUrl : defaultShopProfileData.logoUrl,
      description: description !== undefined ? description : defaultShopProfileData.description,
      allowOutsideHoursApproval: Boolean(allowOutsideHoursApproval),
      themePalette: themePalette !== undefined ? themePalette : 'heritage',
      updatedAt: new Date()
    };

    const [updated] = await db.insert(schema.shopSettings)
      .values({ id: 'default', ...valuesToUpdate })
      .onConflictDoUpdate({
        target: schema.shopSettings.id,
        set: valuesToUpdate
      })
      .returning();

    return res.json({
      success: true,
      profile: {
        ...defaultShopProfileData,
        ...(updated || valuesToUpdate)
      }
    });
  } catch (error) {
    return handleError(res, error, 'PUT /api/shop-profile');
  }
});
