import express from 'express';
import { requireAuth, requireAdmin } from '../middleware/index.js';
import { db } from '../index.js';
import { getTodayStringBRT, handleError } from '../utils/index.js';
import { JWT_SECRET } from '../config/env.js';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import * as schema from '../../src/db/schema.js';

export const seedRouter = express.Router();

async function seedDatabase() {
  // Evita senhas padrão previsíveis (admin123/client123) em bancos que rodam
  // o auto-seed em produção. Permite definir via env; caso contrário gera uma
  // senha aleatória segura e a exibe uma única vez no log do servidor.
  const seedClientPassword = process.env.SEED_CLIENT_PASSWORD || crypto.randomBytes(9).toString('base64url');
  const seedAdminPassword = process.env.SEED_ADMIN_PASSWORD || crypto.randomBytes(9).toString('base64url');
  if (!process.env.SEED_CLIENT_PASSWORD || !process.env.SEED_ADMIN_PASSWORD) {
    console.warn('[API] ⚠️  SEED_ADMIN_PASSWORD/SEED_CLIENT_PASSWORD não definidas. Senhas geradas automaticamente para os usuários de seed:');
    if (!process.env.SEED_ADMIN_PASSWORD) console.warn(`[API]   admin@barberx.app -> ${seedAdminPassword}`);
    if (!process.env.SEED_CLIENT_PASSWORD) console.warn(`[API]   cliente de teste -> ${seedClientPassword}`);
    console.warn('[API]   Troque essas senhas imediatamente se este ambiente for produção.');
  }
  const defaultPasswordHash = await bcrypt.hash(seedClientPassword, 10);
  const adminPasswordHash = await bcrypt.hash(seedAdminPassword, 10);
  const todayStr = getTodayStringBRT();

  const seedProfiles = [
    {
      id: 'admin_1',
      name: 'Admin Sistema',
      email: 'admin@barberx.app',
      password: adminPasswordHash,
      role: 'admin',
      phone: '5511999999999',
    },
    {
      id: 'prof_1',
      name: 'Carlos Silva',
      email: 'carlos@barberx.app',
      password: defaultPasswordHash,
      role: 'professional',
      phone: '5511988888888',
      avatar: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?q=80&w=200&auto=format&fit=crop',
    },
    {
      id: 'prof_2',
      name: 'Roberto Souza',
      email: 'roberto@barberx.app',
      password: defaultPasswordHash,
      role: 'professional',
      phone: '5511977777777',
      avatar: 'https://images.unsplash.com/photo-1605406575497-015ab0d21b9b?q=80&w=200&auto=format&fit=crop',
    },
    {
      id: 'prof_3',
      name: 'André Santos',
      email: 'andre@barberx.app',
      password: defaultPasswordHash,
      role: 'professional',
      phone: '5511966666666',
      avatar: 'https://images.unsplash.com/photo-1543610892-0b1f7e6d8ac1?q=80&w=200&auto=format&fit=crop',
    },
    {
      id: 'client_1',
      name: 'João Pedro',
      email: 'joao@cliente.app',
      password: defaultPasswordHash,
      role: 'client',
      phone: '5511955555555',
    },
    {
      id: 'client_2',
      name: 'Marcos Felipe',
      email: 'marcos@cliente.app',
      password: defaultPasswordHash,
      role: 'client',
      phone: '5511944444444',
    }
  ];

  for (const p of seedProfiles) {
    await db.insert(schema.profiles).values(p).onConflictDoNothing();
  }

  const seedServices = [
    {
      id: 'svc_1',
      name: 'Corte Clássico',
      description: 'Corte tradicional com tesoura ou máquina.',
      price: '50.00',
      duration: 30,
      image: 'https://images.unsplash.com/photo-1593980313883-9cbacfa8bc27?q=80&w=800&auto=format&fit=crop',
      popular: true,
    },
    {
      id: 'svc_2',
      name: 'Barba Terapia',
      description: 'Barba com toalha quente e massagem facial.',
      price: '40.00',
      duration: 30,
      image: 'https://images.unsplash.com/photo-1534015843468-d621531c3fc8?q=80&w=800&auto=format&fit=crop',
      popular: true,
    },
    {
      id: 'svc_3',
      name: 'Corte + Barba',
      description: 'Pacote completo: corte clássico e barba terapia.',
      price: '85.00',
      duration: 60,
      image: 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?q=80&w=800&auto=format&fit=crop',
      popular: true,
    },
    {
      id: 'svc_4',
      name: 'Platinado',
      description: 'Descoloração global até o tom platinado (necessário avaliação).',
      price: '150.00',
      duration: 120,
      image: 'https://images.unsplash.com/photo-1600948836101-f9ff5a0eb3f8?q=80&w=800&auto=format&fit=crop',
    },
    {
      id: 'svc_5',
      name: 'Sobrancelha',
      description: 'Alinhamento na navalha ou pinça.',
      price: '15.00',
      duration: 15,
      image: 'https://images.unsplash.com/photo-1593980313883-9cbacfa8bc27?q=80&w=800&auto=format&fit=crop',
    }
  ];

  for (const s of seedServices) {
    await db.insert(schema.services).values(s).onConflictDoNothing();
  }

  const seedProducts = [
    {
      id: 'prod_1',
      name: 'Pomada Efeito Matte (120g)',
      description: 'Pomada modeladora com fixação forte e efeito seco natural.',
      price: '45.90',
      stock: 12,
      category: 'Cabelo',
      image: 'https://images.unsplash.com/photo-1599305090598-fe179d501227?q=80&w=600&auto=format&fit=crop',
    },
    {
      id: 'prod_2',
      name: 'Óleo para Barba Wood (30ml)',
      description: 'Óleo hidratante com aroma amadeirado. Previne coceira.',
      price: '38.50',
      stock: 8,
      category: 'Barba',
      image: 'https://images.unsplash.com/photo-1626081467554-1b327b7fce2f?q=80&w=600&auto=format&fit=crop',
    },
    {
      id: 'prod_3',
      name: 'Shampoo Refrescante Ice',
      description: 'Limpeza profunda com mentol. Controle de oleosidade.',
      price: '32.00',
      stock: 15,
      category: 'Cabelo',
      image: 'https://images.unsplash.com/photo-1631729371254-42c2892f0e6e?q=80&w=600&auto=format&fit=crop',
    },
    {
      id: 'prod_4',
      name: 'Balm Pós-barba Suave',
      description: 'Acalma a pele e reduz a irritação após o uso da navalha.',
      price: '28.90',
      stock: 5,
      category: 'Pele',
      image: 'https://images.unsplash.com/photo-1556228578-8d89f8eb76e1?q=80&w=600&auto=format&fit=crop',
    }
  ];

  for (const p of seedProducts) {
    await db.insert(schema.products).values(p).onConflictDoNothing();
  }

  const seedRewards = [
    {
      id: 'rwd_1',
      title: 'Desconto em Produto',
      pointsRequired: 150,
      rewardType: 'discount',
      valueDescription: '10%',
      icon: 'Tag',
      isActive: true
    },
    {
      id: 'rwd_2',
      title: 'Sobrancelha Grátis',
      pointsRequired: 250,
      rewardType: 'service',
      valueDescription: 'Sobrancelha',
      icon: 'Scissors',
      isActive: true
    },
    {
      id: 'rwd_3',
      title: 'Corte Grátis',
      pointsRequired: 600,
      rewardType: 'service',
      valueDescription: 'Corte Clássico',
      icon: 'Scissors',
      isActive: true
    },
    {
      id: 'rwd_4',
      title: 'Combo Premium (Corte + Barba)',
      pointsRequired: 1000,
      rewardType: 'service',
      valueDescription: 'Combo Premium',
      icon: 'Star',
      isActive: true
    }
  ];
  
  for (const r of seedRewards) {
    try {
      await db.insert(schema.rewards).values(r).onConflictDoNothing();
    } catch(e) {}
  }


  const seedTransactions = [
    {
      id: 'tx_1',
      type: 'income',
      description: 'Corte + Barba',
      amount: '85.00',
      category: 'Serviço',
      paymentMethod: 'Pix',
      date: todayStr,
      status: 'completed',
      professionalName: 'Carlos Silva',
    },
    {
      id: 'tx_2',
      type: 'income',
      description: 'Venda: Pomada Matte',
      amount: '45.90',
      category: 'Produto',
      paymentMethod: 'Crédito',
      date: todayStr,
      status: 'completed',
      professionalName: 'Recepção',
    },
    {
      id: 'tx_3',
      type: 'expense',
      description: 'Compra Insumos (Lâminas)',
      amount: '120.00',
      category: 'Suprimentos',
      paymentMethod: 'Débito',
      date: todayStr,
      status: 'completed',
      notes: 'Nota fiscal anexada'
    }
  ];

  for (const tx of seedTransactions) {
    try {
      await db.insert(schema.cashTransactions).values(tx).onConflictDoNothing();
    } catch(e) {}
  }

  const defaultShopSettings = {
    id: 'default',
    name: 'Navo Barber & Club',
    unitName: 'Unidade Expectativa',
    slogan: 'Estilo, Tradição e Excelência na Medida Certa',
    address: 'Rua Fortaleza, 1420 - Expectativa, Sobral - CE',
    phone: '(11) 99999-8888',
    whatsapp: '5511999998888',
    openTime: '09:00',
    closeTime: '20:00',
    operatingDays: [1, 2, 3, 4, 5, 6],
    operatingSchedule: {
      "sunday": { "active": false, "open": "10:00", "close": "16:00" },
      "monday": { "active": true, "open": "09:00", "close": "20:00" },
      "tuesday": { "active": true, "open": "09:00", "close": "20:00" },
      "wednesday": { "active": true, "open": "09:00", "close": "20:00" },
      "thursday": { "active": true, "open": "09:00", "close": "20:00" },
      "friday": { "active": true, "open": "09:00", "close": "21:00" },
      "saturday": { "active": true, "open": "09:00", "close": "20:00" }
    },
    mapsUrl: 'https://maps.google.com/?q=Rua+Fortaleza+1420+Expectativa+Sobral+CE',
    instagram: '@barbearianavo',
    logoUrl: null,
    description: 'Barbearia premium com foco em experiência do cliente, cortes modernos e tradicionais.',
  };

  try {
    await db.insert(schema.shopSettings).values(defaultShopSettings).onConflictDoNothing();
  } catch(e) {}


  return {
    profiles: seedProfiles.length,
    services: seedServices.length,
    products: seedProducts.length,
    rewards: seedRewards.length,
    transactions: seedTransactions.length,
  };
}

seedRouter.post("/", requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const result = await seedDatabase();
    res.json({ success: true, seeded: result });
  } catch (e: any) {
    return handleError(res, e, 'POST /api/seed');
  }
});
