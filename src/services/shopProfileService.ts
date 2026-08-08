import { authFetch } from '../lib/api';

export interface OperatingDaySchedule {
  active: boolean;
  open: string;
  close: string;
}

export interface ShopProfile {
  id?: string;
  name: string;
  unitName: string;
  slogan: string;
  address: string;
  phone: string;
  whatsapp: string;
  openTime: string; // e.g. "09:00"
  closeTime: string; // e.g. "20:00"
  operatingDays: number[]; // e.g. [1, 2, 3, 4, 5, 6] (0 = Sun, 1 = Mon...)
  operatingSchedule: {
    sunday: OperatingDaySchedule;
    monday: OperatingDaySchedule;
    tuesday: OperatingDaySchedule;
    wednesday: OperatingDaySchedule;
    thursday: OperatingDaySchedule;
    friday: OperatingDaySchedule;
    saturday: OperatingDaySchedule;
  };
  mapsUrl: string;
  instagram: string;
  logoUrl?: string;
  description: string;
}

export const defaultShopProfile: ShopProfile = {
  name: 'Navo Barber & Club',
  unitName: 'Unidade Expectativa',
  slogan: 'Estilo, Tradição e Excelência na Medida Certa',
  address: 'Rua Fortaleza, 1420 - Expectativa, Sobral - CE',
  phone: '(88) 99834-0085',
  whatsapp: '5588998340085',
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
  mapsUrl: 'https://maps.app.goo.gl/2uCakwEHwA6bbXq97',
  instagram: '@barbearianavo',
  logoUrl: '',
  description: 'Barbearia premium com foco em experiência do cliente, cortes modernos e tradicionais.'
};

let cachedProfile: ShopProfile = { ...defaultShopProfile };
let profileFetchPromise: Promise<ShopProfile> | null = null;

export function getCachedShopProfile(): ShopProfile {
  return cachedProfile;
}

export async function fetchShopProfile(forceRefresh = false): Promise<ShopProfile> {
  if (!forceRefresh && cachedProfile && cachedProfile.name !== 'Navo Barber & Club') {
    return cachedProfile;
  }

  if (profileFetchPromise && !forceRefresh) {
    return profileFetchPromise;
  }

  profileFetchPromise = (async () => {
    try {
      const res = await authFetch('/api/shop-profile');
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data === 'object') {
          cachedProfile = {
            ...defaultShopProfile,
            ...data,
            operatingSchedule: {
              ...defaultShopProfile.operatingSchedule,
              ...(data.operatingSchedule || {})
            }
          };
          return cachedProfile;
        }
      }
    } catch (err) {
      console.warn('Erro ao carregar perfil da barbearia do servidor:', err);
    } finally {
      profileFetchPromise = null;
    }
    return cachedProfile;
  })();

  return profileFetchPromise;
}

export async function saveShopProfile(data: Partial<ShopProfile>): Promise<ShopProfile> {
  const updated = {
    ...cachedProfile,
    ...data
  };

  try {
    const res = await authFetch('/api/shop-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated)
    });

    if (res.ok) {
      const resData = await res.json();
      if (resData.profile) {
        cachedProfile = { ...defaultShopProfile, ...resData.profile };
        return cachedProfile;
      }
    }
  } catch (err) {
    console.error('Erro ao salvar perfil da barbearia:', err);
  }

  cachedProfile = updated;
  return cachedProfile;
}

/**
 * Retorna os dias da semana em português mapeados para chave do schedule
 */

export const daysOfWeekMap: { key: keyof ShopProfile['operatingSchedule']; label: string; short: string; dayIndex: number }[] = [
  { key: 'sunday', label: 'Domingo', short: 'Dom', dayIndex: 0 },
  { key: 'monday', label: 'Segunda-feira', short: 'Seg', dayIndex: 1 },
  { key: 'tuesday', label: 'Terça-feira', short: 'Ter', dayIndex: 2 },
  { key: 'wednesday', label: 'Quarta-feira', short: 'Qua', dayIndex: 3 },
  { key: 'thursday', label: 'Quinta-feira', short: 'Qui', dayIndex: 4 },
  { key: 'friday', label: 'Sexta-feira', short: 'Sex', dayIndex: 5 },
  { key: 'saturday', label: 'Sábado', short: 'Sáb', dayIndex: 6 }
];

/**
 * Verifica se a data dada (YYYY-MM-DD ou Date) está aberta na barbearia
 */
export function isDateOpenInProfile(profile: ShopProfile, dateStr: string | Date): boolean {
  const d = typeof dateStr === 'string' ? new Date(dateStr + 'T00:00:00') : dateStr;
  const dayIndex = d.getDay(); // 0 = Dom
  const dayItem = daysOfWeekMap.find(item => item.dayIndex === dayIndex);
  
  if (!dayItem) return true;
  
  const scheduleForDay = profile.operatingSchedule?.[dayItem.key];
  if (scheduleForDay) {
    return scheduleForDay.active;
  }

  return profile.operatingDays ? profile.operatingDays.includes(dayIndex) : true;
}

/**
 * Gera horários de 30 em 30 min com base no perfil e na data
 */
export function generateTimeSlotsFromProfile(profile: ShopProfile, dateStr?: string): string[] {
  let open = profile.openTime || '09:00';
  let close = profile.closeTime || '20:00';

  if (dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    const dayIndex = d.getDay();
    const dayItem = daysOfWeekMap.find(item => item.dayIndex === dayIndex);
    if (dayItem && profile.operatingSchedule?.[dayItem.key]) {
      const sch = profile.operatingSchedule[dayItem.key];
      if (!sch.active) return []; // Fechado
      open = sch.open || open;
      close = sch.close || close;
    }
  }

  const [openH, openM] = open.split(':').map(Number);
  const [closeH, closeM] = close.split(':').map(Number);

  const openMinutes = openH * 60 + (openM || 0);
  const closeMinutes = closeH * 60 + (closeM || 0);

  const slots: string[] = [];
  for (let m = openMinutes; m < closeMinutes; m += 30) {
    const hh = String(Math.floor(m / 60)).padStart(2, '0');
    const mm = String(m % 60).padStart(2, '0');
    slots.push(`${hh}:${mm}`);
  }

  return slots;
}
