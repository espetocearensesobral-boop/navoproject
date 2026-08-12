const fs = require('fs');

const content = `import { authFetch } from '../lib/api';
import { getDayOfWeekKey, timeToMinutes, minutesToTime, getTodayStringBRT } from '../utils/dateUtils';

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
  openTime: string;
  closeTime: string;
  operatingDays: number[];
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
  facebookUrl?: string;
  landline?: string;
  email?: string;
  logoUrl?: string;
  description: string;
  allowOutsideHoursApproval: boolean;
}

export const defaultShopProfile: ShopProfile = {
  name: 'Navo Barber & Club',
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
  mapsUrl: 'https://maps.app.goo.gl/2uCakwEHwA6bbXq97',
  instagram: '@barbearianavo',
  facebookUrl: 'https://facebook.com/barbearianavo',
  logoUrl: '',
  description: 'Barbearia premium com foco em experiência do cliente, cortes modernos e tradicionais.',
  allowOutsideHoursApproval: false
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
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.message || errData?.error || 'Falha ao buscar perfil da barbearia do banco de dados');
      }
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
      throw new Error('Dados inválidos do perfil da barbearia retornados pelo banco de dados');
    } finally {
      profileFetchPromise = null;
    }
  })();
  return profileFetchPromise;
}

export async function saveShopProfile(data: Partial<ShopProfile>): Promise<ShopProfile> {
  const updated = {
    ...cachedProfile,
    ...data
  };
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

  let errorMsg = 'Erro ao salvar perfil da barbearia.';
  try {
    const errData = await res.json();
    if (errData?.error) errorMsg = errData.error;
  } catch (e) {}
  throw new Error(errorMsg);
}

export const daysOfWeekMap: { key: keyof ShopProfile['operatingSchedule']; label: string; short: string; dayIndex: number }[] = [
  { key: 'sunday', label: 'Domingo', short: 'Dom', dayIndex: 0 },
  { key: 'monday', label: 'Segunda-feira', short: 'Seg', dayIndex: 1 },
  { key: 'tuesday', label: 'Terça-feira', short: 'Ter', dayIndex: 2 },  { key: 'wednesday', label: 'Quarta-feira', short: 'Qua', dayIndex: 3 },
  { key: 'thursday', label: 'Quinta-feira', short: 'Qui', dayIndex: 4 },
  { key: 'friday', label: 'Sexta-feira', short: 'Sex', dayIndex: 5 },
  { key: 'saturday', label: 'Sábado', short: 'Sáb', dayIndex: 6 }
];

export function isDateOpenInProfile(profile: ShopProfile, dateStr: string | Date): boolean {
  const str = typeof dateStr === 'string' ? dateStr : getTodayStringBRT();
  const dayKey = getDayOfWeekKey(str);
  
  const scheduleForDay = profile.operatingSchedule?.[dayKey];
  if (scheduleForDay) {
    return scheduleForDay.active;
  }
  const dayItem = daysOfWeekMap.find(item => item.key === dayKey);
  const dayIndex = dayItem ? dayItem.dayIndex : 1;
  return profile.operatingDays ? profile.operatingDays.includes(dayIndex) : true;
}

export function generateTimeSlotsFromProfile(
  profile: ShopProfile, 
  dateStr?: string, 
  serviceDurationMinutes: number = 30
): string[] {
  let open = profile.openTime || '09:00';
  let close = profile.closeTime || '21:00';
  if (dateStr) {
    const dayKey = getDayOfWeekKey(dateStr);
    if (profile.operatingSchedule?.[dayKey]) {
      const sch = profile.operatingSchedule[dayKey];
      if (!sch.active) return []; // Fechado
      open = sch.open || open;
      close = sch.close || close;
    }
  }

  const openMinutes = timeToMinutes(open);
  const closeMinutes = timeToMinutes(close);
  const allowOutsideHours = !!profile.allowOutsideHoursApproval;
  const duration = serviceDurationMinutes > 0 ? serviceDurationMinutes : 30;

  const candidateCutoff = allowOutsideHours ? closeMinutes + 90 : closeMinutes;
  const slots: string[] = [];
  for (let m = openMinutes; m < candidateCutoff; m += 30) {
    if (!allowOutsideHours && m + duration > closeMinutes) {
      continue;
    }
    slots.push(minutesToTime(m));
  }
  return slots;
}
`;

fs.writeFileSync('src/services/shopProfileService.ts', content);
console.log('Fixed shopProfileService.ts');
