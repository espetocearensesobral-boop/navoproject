import { authFetch } from '../lib/api';
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
  facebookUrl?: string;
  landline?: string;
  email?: string;
  logoUrl?: string;
  description: string;
  // Se true, um horário que ultrapassa o fechamento pode ser solicitado e fica
  // pendente de aprovação do barbeiro. Se false (padrão), esses horários
  // simplesmente não são oferecidos ao cliente.
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

  // Erro (ex.: 400 de validação de horário abre>fecha) — propaga em vez de
  // mascarar como sucesso; antes, uma resposta não-ok fazia a função retornar
  // silenciosamente o objeto local `updated`, dando falsa impressão de que salvou.
  let errorMsg = 'Erro ao salvar perfil da barbearia.';
  try {
    const errData = await res.json();
    if (errData?.error) errorMsg = errData.error;
  } catch (e) {}
  throw new Error(errorMsg);
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

/**
 * Gera horários de 30 em 30 min com base no perfil, data e duração do serviço.
 *
 * Se `allowOutsideHoursApproval` estiver desativado no perfil (padrão), só gera
 * horários cujo término (início + duração) caiba dentro do expediente — ou seja,
 * um horário que estouraria o fechamento simplesmente não é oferecido.
 *
 * Se estiver ativado, mantém o comportamento anterior: gera candidatos até 90min
 * após o fechamento, permitindo que o cliente solicite um horário fora do
 * expediente (fica pendente de aprovação do barbeiro — ver checkSlotAvailability
 * no backend, que é quem decide/valida isso de fato).
 */
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

  // Limite até onde vale a pena gerar candidatos: com aprovação de horário fora
  // do expediente ativada, mantém a margem de 90min pós-fechamento; desativada,
  // não passa do fechamento (nenhum horário que ultrapasse o fechamento é útil).
  const candidateCutoff = allowOutsideHours ? closeMinutes + 90 : closeMinutes;

  const slots: string[] = [];
  for (let m = openMinutes; m < candidateCutoff; m += 30) {
    if (!allowOutsideHours && m + duration > closeMinutes) {
      // Esse horário terminaria depois do fechamento — não oferece.
      continue;
    }
    slots.push(minutesToTime(m));
  }

  return slots;
}

