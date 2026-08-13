import { authFetch } from '../lib/api';
import { ServiceItem, Professional, Appointment, WaitingQueueItem, ProductItem } from '../types';

export interface ScheduleBlock {
  id: string;
  professional_id: string;
  date: string;
  start_time: string;
  end_time: string;
  reason: string;
}

const API_BASE = '/api';

let servicesFetchPromise: Promise<ServiceItem[]> | null = null;
let cachedServices: ServiceItem[] | null = null;
let servicesCachedAt = 0;
const SERVICES_CACHE_TTL_MS = 5 * 60 * 1000;

export async function fetchServicesFromSupabase(forceRefresh = false): Promise<ServiceItem[]> {
  if (!forceRefresh && cachedServices && Date.now() - servicesCachedAt < SERVICES_CACHE_TTL_MS) {
    return cachedServices;
  }
  if (servicesFetchPromise && !forceRefresh) {
    return servicesFetchPromise;
  }
  servicesFetchPromise = (async () => {
    try {
      const res = await authFetch(`${API_BASE}/services`);
      if (!res.ok) throw new Error('Falha ao buscar serviços');
      const data = await res.json();
      if (!Array.isArray(data)) {
        throw new Error('Resposta inválida do banco de dados para serviços');
      }
      const mapped = data.map((s: any) => {
        const rawSlug = s.categorySlug || 'cabelo';
        const cleanSlug = rawSlug.startsWith('cat_') ? rawSlug.slice(4) : rawSlug;
        return {
          id: s.id,
          category_id: `cat_${cleanSlug}`,
          title: s.title,
          description: s.description,
          price: Number(s.price),
          duration_minutes: s.durationMinutes,
          is_combo: s.isCombo,
          original_price: s.originalPrice ? Number(s.originalPrice) : undefined,
          discount_percentage: s.discountPercentage,
          popular: s.isPopular,
          image_url: s.imageUrl,
          gallery_urls: Array.isArray(s.galleryUrls) && s.galleryUrls.length > 0 ? s.galleryUrls : (s.imageUrl ? [s.imageUrl] : [])
        };
      });
      cachedServices = mapped;
      servicesCachedAt = Date.now();
      return cachedServices;
    } catch (err) {
      console.warn('Aviso ao carregar serviços do servidor, usando fallback local:', err);
      cachedServices = [];
      servicesCachedAt = Date.now();
      return cachedServices;
    } finally {
      servicesFetchPromise = null;
    }
  })();
  return servicesFetchPromise;
}

export async function deleteAllServicesInSupabase(): Promise<boolean> {
  try {
    const res = await authFetch(`${API_BASE}/services/all`, { method: 'DELETE' });
    if (res.ok) {
    }
    return res.ok;
  } catch (err) {
    console.error('Erro ao apagar todos os serviços:', err);
    return false;
  }
}

let professionalsFetchPromise: Promise<Professional[]> | null = null;
let cachedProfessionals: Professional[] | null = null;
let professionalsCachedAt = 0;
const PROFESSIONALS_CACHE_TTL_MS = 5 * 60 * 1000;

export async function fetchProfessionalsFromSupabase(forceRefresh = false): Promise<Professional[]> {
  if (!forceRefresh && cachedProfessionals && Date.now() - professionalsCachedAt < PROFESSIONALS_CACHE_TTL_MS) {
    return cachedProfessionals;
  }
  if (professionalsFetchPromise && !forceRefresh) {
    return professionalsFetchPromise;
  }
  professionalsFetchPromise = (async () => {
    try {
      const res = await authFetch(`${API_BASE}/professionals`);
      if (!res.ok) throw new Error('Falha ao buscar profissionais do Supabase');
      const data = await res.json();
      if (!Array.isArray(data)) {
        throw new Error('Resposta inválida do banco de dados para profissionais');
      }
      const mapped = data.map((p: any) => ({
        id: p.id,
        name: p.name,
        nickname: p.nickname,
        role: p.roleTitle,
        rating: Number(p.rating),
        reviews_count: p.reviewsCount,
        photo_url: p.photoUrl,
        specialties: p.specialties || [],
        commission_rate: Number(p.commissionRate),
        working_hours: p.workingHours,
        is_active: p.isActive ?? true
      }));
      cachedProfessionals = mapped;
      professionalsCachedAt = Date.now();
      return cachedProfessionals;
    } catch (err) {
      console.error('Erro ao carregar profissionais do Supabase:', err);
      cachedProfessionals = [];
      professionalsCachedAt = Date.now();
      return cachedProfessionals;
    } finally {
      professionalsFetchPromise = null;
    }
  })();
  return professionalsFetchPromise;
}

export async function fetchAppointmentsFromSupabase(phone?: string, options?: { strict?: boolean }): Promise<Appointment[]> {
  try {
    const url = phone ? `${API_BASE}/appointments?phone=${encodeURIComponent(phone)}` : `${API_BASE}/appointments`;
    const res = await authFetch(url);
    if (!res.ok) {
      const err: any = new Error(`Request failed with status ${res.status}`);
      err.status = res.status;
      throw err;
    }
    const data = await res.json();
    if (!Array.isArray(data)) {
      return [];
    }
    return data.map((a: any) => ({
      id: a.id,
      client_id: a.clientId || a.client_id || '',
      client_name: a.clientName || a.client_name || '',
      client_phone: a.clientPhone || a.client_phone || '',
      professional_id: a.professionalId || a.professional_id || '',
      professional_name: a.professionalName || a.professional_name || '',
      date: a.date,
      time_slot: a.timeSlot || a.time_slot,
      status: a.status || 'confirmed',
      total_duration_minutes: Number(a.totalDurationMinutes || a.total_duration_minutes || 0),
      original_amount: Number(a.originalAmount || a.original_amount || 0),
      discount_amount: Number(a.discountAmount || a.discount_amount || 0),
      final_amount: Number(a.finalAmount || a.final_amount || 0),
      payment_method: a.paymentMethod || a.payment_method || 'PIX',
      loyalty_points_used: Number(a.loyaltyPointsUsed || a.loyalty_points_used || 0),
      booking_code: a.bookingCode || a.booking_code || a.id?.replace('apt_', '').substring(0, 8).toUpperCase() || '',
      created_at: a.createdAt || a.created_at || new Date().toISOString(),
      services: a.services || []
    }));
    } catch (err) {
    if (options?.strict) throw err;
    return [];
  }
}
export async function createAppointmentInSupabase(
  apt: Appointment,
  options?: { adminManual?: boolean }
): Promise<Appointment> {
  const res = await authFetch(`${API_BASE}/appointments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: apt.id,
      clientId: apt.client_id,
      clientName: apt.client_name,
      clientPhone: apt.client_phone,
      professionalId: apt.professional_id,
      professionalName: apt.professional_name,
      date: apt.date,
      timeSlot: apt.time_slot,
      status: apt.status,
      totalDurationMinutes: apt.total_duration_minutes,
      originalAmount: (apt.original_amount ?? 0).toString(),
      discountAmount: (apt.discount_amount ?? 0).toString(),
      finalAmount: (apt.final_amount ?? 0).toString(),
      paymentMethod: apt.payment_method,
      bookingCode: apt.booking_code,
      services: apt.services,
      ...(options?.adminManual ? { adminManual: true } : {})
    })
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Falha ao criar agendamento no Supabase');
  }
  const created = await res.json();
  return {
    ...apt,
    id: created.id || apt.id,
    booking_code: created.bookingCode || created.booking_code || apt.booking_code || '',
    status: created.status || apt.status
  };
}

export async function cancelAppointmentInSupabase(
  appointmentId: string,
  fullApt?: Appointment
): Promise<{ success: boolean; appointment?: Appointment; error?: string }> {
  try {
    const res = await authFetch(`${API_BASE}/appointments/${appointmentId}/cancel`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fullApt || {})
    });
    
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Falha ao cancelar agendamento no servidor Supabase');
    }
    
    const data = await res.json();
    const serverApt = data.appointment || data;
    
    const updatedAppointment: Appointment = {
      id: serverApt.id || appointmentId,
      client_id: serverApt.clientId || serverApt.client_id || fullApt?.client_id || '',
      client_name: serverApt.clientName || serverApt.client_name || fullApt?.client_name || '',
      client_phone: serverApt.clientPhone || serverApt.client_phone || fullApt?.client_phone || '',
      professional_id: serverApt.professionalId || serverApt.professional_id || fullApt?.professional_id || '',
      professional_name: serverApt.professionalName || serverApt.professional_name || fullApt?.professional_name || '',
      date: serverApt.date || fullApt?.date || '',
      time_slot: serverApt.timeSlot || serverApt.time_slot || fullApt?.time_slot || '',
      status: 'cancelled',
      total_duration_minutes: Number(serverApt.totalDurationMinutes || fullApt?.total_duration_minutes || 0),
      original_amount: Number(serverApt.originalAmount || fullApt?.original_amount || 0),
      discount_amount: Number(serverApt.discountAmount || fullApt?.discount_amount || 0),
      final_amount: Number(serverApt.finalAmount || fullApt?.final_amount || 0),
      loyalty_points_used: Number(serverApt.loyalty_points_used || fullApt?.loyalty_points_used || 0),
      payment_method: serverApt.paymentMethod || serverApt.payment_method || fullApt?.payment_method || 'pix',
      services: serverApt.services || fullApt?.services || [],
      created_at: serverApt.createdAt || serverApt.created_at || fullApt?.created_at || new Date().toISOString()
    };

    return { success: true, appointment: updatedAppointment };
  } catch (err: any) {
    console.error('Erro ao cancelar agendamento no Supabase:', err);
    return { success: false, error: err.message || 'Erro de conexão ao cancelar no Supabase.' };
  }
}

export async function getQueueFromSupabase(): Promise<WaitingQueueItem[]> {
  try {
    const res = await authFetch(`${API_BASE}/queue`);
    if (!res.ok) throw new Error('Falha ao obter fila de espera do Supabase');
    const data = await res.json();
    if (!Array.isArray(data)) {
      return [];
    }
    return data.map((q: any) => ({
      id: q.id,
      client_name: q.clientName || 'Cliente Avulso',
      client_phone: q.clientPhone || '',
      service_title: q.serviceTitle || 'Atendimento Geral',
      service_price: q.servicePrice ? Number(q.servicePrice) : undefined,
      professional_id: q.professionalId,
      professional_name: q.professionalName || '',
      scheduled_time: q.scheduledTime || '',
      estimated_wait_minutes: q.estimatedWaitMinutes || 0,
      status: q.status || 'waiting',
      arrived_at: q.arrivedAt || '',
      notes: q.notes || '',
      started_at: q.startedAt,
      completed_at: q.completedAt
    }));
  } catch (err) {
    console.error('Erro ao obter fila do Supabase:', err);
    return [];
  }
}

export async function addToQueueInSupabase(newItem: Partial<WaitingQueueItem>): Promise<WaitingQueueItem[]> {
  const itemToSave = {
    id: newItem.id || `q_${Date.now()}`,
    clientId: (newItem as any).client_id || 'usr_guest',
    clientName: newItem.client_name || 'Cliente Walk-in',
    clientPhone: newItem.client_phone || '',
    serviceTitle: newItem.service_title || 'Corte & Barba',
    servicePrice: newItem.service_price?.toString() || '85',
    professionalId: newItem.professional_id || null,
    professionalName: newItem.professional_name || null,
    scheduledTime: newItem.scheduled_time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    estimatedWaitMinutes: newItem.estimated_wait_minutes || 15,
    status: newItem.status || 'waiting',
    arrivedAt: newItem.arrived_at || 'Chegou agora',
    notes: newItem.notes || ''
  };

  const res = await authFetch(`${API_BASE}/queue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(itemToSave)
  });
  if (!res.ok) {
    throw new Error('Falha ao adicionar item à fila no Supabase');
  }

  return getQueueFromSupabase();
}

export async function updateQueueStatusInSupabase(id: string, status: 'waiting' | 'in_chair' | 'completed'): Promise<WaitingQueueItem[]> {
  const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const res = await authFetch(`${API_BASE}/queue/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status,
      ...(status === 'in_chair' ? { startedAt: now } : {}),
      ...(status === 'completed' ? { completedAt: now } : {})
    })
  });
  if (!res.ok) {
    throw new Error('Falha ao atualizar status da fila no Supabase');
  }

  return getQueueFromSupabase();
}

export async function removeFromQueueInSupabase(id: string): Promise<WaitingQueueItem[]> {
  const res = await authFetch(`${API_BASE}/queue/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    throw new Error('Falha ao remover item da fila no Supabase');
  }

  return getQueueFromSupabase();
}

export function subscribeToAppointmentsRealtime(onUpdate: (appointments: Appointment[]) => void) { return () => {}; }
export async function seedSupabaseDatabase(): Promise<{ success: boolean; message: string }> { return { success: true, message: 'Seeded in server' }; }

export async function fetchProductsFromSupabase(options?: { strict?: boolean }): Promise<ProductItem[]> {
  try {
    const res = await authFetch(`${API_BASE}/products`);
    if (!res.ok) {
      const error = new Error(`Falha ao carregar produtos (${res.status}).`);
      if (options?.strict) throw error;
      return [];
    }
    const data = await res.json();
    if (!Array.isArray(data)) {
      return [];
    }
    return data.map((p: any) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      brand: p.brand,
      price: Number(p.price),
      cost_price: Number(p.costPrice),
      stock_quantity: p.stockQuantity,
      min_stock_alert: p.minStockAlert,
      commission_percentage: p.commissionPercentage,
      image_url: p.imageUrl
    }));
  } catch (err) {
    console.error('Erro ao buscar produtos do Supabase:', err);
    if (options?.strict) throw err;
    return [];
  }
}

export async function saveProductInSupabase(product: ProductItem, isUpdate?: boolean): Promise<ProductItem[]> {
  const method = isUpdate ? 'PUT' : 'POST';
  const url = isUpdate ? `${API_BASE}/products/${product.id}` : `${API_BASE}/products`;
  
  const res = await authFetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: product.id,
      name: product.name,
      category: product.category,
      brand: product.brand,
      price: product.price.toString(),
      costPrice: product.cost_price.toString(),
      stockQuantity: product.stock_quantity,
      minStockAlert: product.min_stock_alert,
      commissionPercentage: product.commission_percentage,
      imageUrl: product.image_url
    })
  });
  if (!res.ok) {
    throw new Error('Falha ao salvar produto no Supabase');
  }
  return fetchProductsFromSupabase();
}

export async function deleteProductInSupabase(id: string): Promise<ProductItem[]> {
  const res = await authFetch(`${API_BASE}/products/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    throw new Error('Falha ao deletar produto no Supabase');
  }
  return fetchProductsFromSupabase();
}

export async function saveProfessionalInSupabase(barber: Professional, isUpdate?: boolean): Promise<Professional[]> {
  const method = isUpdate ? 'PUT' : 'POST';
  const url = isUpdate ? `${API_BASE}/professionals/${barber.id}` : `${API_BASE}/professionals`;
  
  const res = await authFetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: barber.id,
      name: barber.name,
      nickname: barber.nickname,
      roleTitle: barber.role,
      rating: barber.rating.toString(),
      reviewsCount: barber.reviews_count,
      photoUrl: barber.photo_url,
      specialties: barber.specialties,
      commissionRate: barber.commission_rate.toString(),
      workingHours: barber.working_hours,
      isActive: barber.is_active ?? true
    })
  });
  if (!res.ok) {
    throw new Error('Falha ao salvar profissional no Supabase');
  }
  return fetchProfessionalsFromSupabase(true);
}

export async function deleteProfessionalInSupabase(id: string): Promise<Professional[]> {
  const res = await authFetch(`${API_BASE}/professionals/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    throw new Error('Falha ao deletar profissional no Supabase');
  }
  return fetchProfessionalsFromSupabase(true);
}

export async function saveServiceInSupabase(service: ServiceItem, isUpdate?: boolean): Promise<ServiceItem[]> {
  const method = isUpdate ? 'PUT' : 'POST';
  const url = isUpdate ? `${API_BASE}/services/${service.id}` : `${API_BASE}/services`;
  
  const res = await authFetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: service.id,
      categorySlug: service.category_id.replace('cat_', ''),
      title: service.title,
      description: service.description,
      price: service.price.toString(),
      durationMinutes: service.duration_minutes,
      isCombo: service.is_combo || false,
      originalPrice: service.original_price?.toString(),
      discountPercentage: service.discount_percentage,
      isPopular: service.popular || false,
      imageUrl: service.image_url,
      galleryUrls: service.gallery_urls || []
    })
  });
  if (!res.ok) {
    throw new Error('Falha ao salvar serviço no Supabase');
  }
  return fetchServicesFromSupabase(true);
}

export async function deleteServiceInSupabase(id: string): Promise<ServiceItem[]> {
  const res = await authFetch(`${API_BASE}/services/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    throw new Error('Falha ao deletar serviço no Supabase');
  }
  return fetchServicesFromSupabase(true);
}

export async function fetchScheduleBlocks(): Promise<ScheduleBlock[]> {
  try {
    const res = await authFetch(`${API_BASE}/schedule-blocks`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data.map((b: any) => ({
      id: b.id,
      professional_id: b.professionalId || b.professional_id,
      date: b.date,
      start_time: b.startTime || b.start_time,
      end_time: b.endTime || b.end_time,
      reason: b.reason || 'Bloqueio de Agenda'
    })) : [];
  } catch (err) {
    console.error('Erro ao buscar bloqueios:', err);
    return [];
  }
}

export async function addScheduleBlock(block: Omit<ScheduleBlock, 'id'>): Promise<ScheduleBlock[]> {
  const newBlock = {
    id: `blk_${Date.now()}`,
    professionalId: block.professional_id,
    date: block.date,
    startTime: block.start_time,
    endTime: block.end_time,
    reason: block.reason
  };
  const res = await authFetch(`${API_BASE}/schedule-blocks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newBlock)
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Falha ao criar bloqueio.');
  }
  return fetchScheduleBlocks();
}

export async function deleteScheduleBlock(id: string): Promise<ScheduleBlock[]> {
  const res = await authFetch(`${API_BASE}/schedule-blocks/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Falha ao remover bloqueio.');
  }
  return fetchScheduleBlocks();
}

export interface CashTransactionItem {
  id: string;
  type: 'income' | 'expense';
  description: string;
  amount: number;
  category: string;
  paymentMethod: 'pix' | 'credit_card' | 'debit_card' | 'cash';
  date: string;
  status: 'completed' | 'pending';
  professionalName?: string;
  notes?: string;
}

export async function fetchCashTransactionsFromSupabase(options?: { strict?: boolean }): Promise<CashTransactionItem[]> {
  try {
    const res = await authFetch(`${API_BASE}/cash-transactions`);
    if (!res.ok) {
      const error = new Error(`Falha ao carregar lançamentos financeiros (${res.status}).`);
      if (options?.strict) throw error;
      return [];
    }
    const data = await res.json();
    return Array.isArray(data) ? data.map((t: any) => ({
      id: t.id,
      type: t.type,
      description: t.description,
      amount: Number(t.amount),
      category: t.category,
      paymentMethod: t.paymentMethod || t.payment_method,
      date: t.date,
      status: t.status,
      professionalName: t.professionalName || t.professional_name,
      notes: t.notes
    })) : [];
  } catch (err) {
    console.error('Erro ao buscar lançamentos financeiros:', err);
    if (options?.strict) throw err;
    return [];
  }
}

export async function saveCashTransactionInSupabase(tx: CashTransactionItem, isUpdate?: boolean): Promise<CashTransactionItem[]> {
  const method = isUpdate ? 'PUT' : 'POST';
  const url = isUpdate ? `${API_BASE}/cash-transactions/${tx.id}` : `${API_BASE}/cash-transactions`;

  const res = await authFetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: tx.id,
      type: tx.type,
      description: tx.description,
      amount: tx.amount.toString(),
      category: tx.category,
      paymentMethod: tx.paymentMethod,
      date: tx.date,
      status: tx.status,
      professionalName: tx.professionalName,
      notes: tx.notes
    })
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Falha ao salvar lançamento financeiro.');
  }
  return fetchCashTransactionsFromSupabase();
}

export async function deleteCashTransactionInSupabase(id: string): Promise<CashTransactionItem[]> {
  await authFetch(`${API_BASE}/cash-transactions/${id}`, { method: 'DELETE' });
  return fetchCashTransactionsFromSupabase();
}

// =====================================
// NAVO REWARDS SERVICES
// =====================================

export interface LoyaltyInfo {
  loyaltyPoints: number;
  loyaltyTier: 'Bronze' | 'Prata' | 'Ouro' | 'Diamante';
  referralCode: string;
  birthday?: string | null;
  transactions: {
    id: string;
    amount: number;
    type: string;
    description: string;
    createdAt: string;
  }[];
  pendingReviews: Appointment[];
  referralStats: {
    totalInvited: number;
    completedCount: number;
    pointsEarned: number;
  };
}

export interface NavoRewardItem {
  id: string;
  title: string;
  pointsRequired: number;
  rewardType: 'upgrade' | 'product' | 'free_cut' | 'vip_status';
  valueDescription: string;
  icon?: string;
  isActive?: boolean;
}

export async function fetchLoyaltyInfo(): Promise<LoyaltyInfo> {
  try {
    const res = await authFetch(`${API_BASE}/loyalty/me`);
    if (!res.ok) throw new Error('Falha ao carregar dados de fidelidade');
    return await res.json();
  } catch (err) {
    console.error('Erro ao buscar fidelidade:', err);
    return {
      loyaltyPoints: 0,
      loyaltyTier: 'Bronze',
      referralCode: 'NAV-CLIENT',
      transactions: [],
      pendingReviews: [],
      referralStats: { totalInvited: 0, completedCount: 0, pointsEarned: 0 }
    };
  }
}

export async function fetchRewardsList(): Promise<NavoRewardItem[]> {
  try {
    const res = await authFetch(`${API_BASE}/rewards`);
    if (!res.ok) throw new Error('Falha ao carregar catálogo de prêmios');
    return await res.json();
  } catch (err) {
    console.error('Erro ao buscar catálogo de prêmios:', err);
    return [
      {
        id: 'rw_500',
        title: 'Upgrade VIP de Experiência',
        pointsRequired: 500,
        rewardType: 'upgrade',
        valueDescription: 'Corte + Barba ganham Hidratação Capilar e Toalha Quente grátis',
        icon: 'Sparkles'
      },
      {
        id: 'rw_1000',
        title: 'Produto Premium Grátis',
        pointsRequired: 1000,
        rewardType: 'product',
        valueDescription: 'Pomada Modeladora Efeito Matte Extra Forte (R$ 60,00)',
        icon: 'Package'
      },
      {
        id: 'rw_2000',
        title: 'Corte Tradicional Grátis',
        pointsRequired: 2000,
        rewardType: 'free_cut',
        valueDescription: '1 Corte de Cabelo Completo totalmente grátis (1x por mês)',
        icon: 'Scissors'
      },
      {
        id: 'rw_5000',
        title: 'Status Cliente VIP Navo',
        pointsRequired: 5000,
        rewardType: 'vip_status',
        valueDescription: 'Status permanente + Prioridade total na fila + 10% OFF em tudo',
        icon: 'Crown'
      }
    ];
  }
}

export async function redeemReward(rewardId: string) {
  const res = await authFetch(`${API_BASE}/loyalty/redeem`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rewardId })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Falha ao resgatar recompensa');
  return data;
}

export async function submitPostServiceReview(reviewData: {
  appointmentId?: string;
  professionalId: string;
  rating: number;
  understoodRequest?: string;
  waitTimeAcceptable?: string;
  wouldRecommend?: string;
  comment?: string;
  hasPhoto?: boolean;
  photoUrl?: string;
}) {
  const res = await authFetch(`${API_BASE}/reviews`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(reviewData)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Falha ao enviar avaliação');
  return data;
}

export async function fetchPublicReviews() {
  try {
    const res = await authFetch(`${API_BASE}/reviews/public`);
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    console.error('Erro ao buscar avaliações públicas:', err);
    return [];
  }
}

export async function fetchReferralInfo() {
  try {
    const res = await authFetch(`${API_BASE}/referrals/my-info`);
    if (!res.ok) throw new Error('Falha ao buscar dados de indicação');
    return await res.json();
  } catch (err) {
    console.error('Erro ao buscar dados de indicação:', err);
    return {
      referralCode: 'NAV-GUEST',
      referralUrl: 'https://navo.com.br/ref/NAV-GUEST',
      friends: [],
      totalPointsEarned: 0
    };
  }
}

export async function applyReferralCode(referralCode: string) {
  const res = await authFetch(`${API_BASE}/referrals/apply-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ referralCode })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Falha ao aplicar código');
  return data;
}

export async function performInstagramCheckin() {
  const res = await authFetch(`${API_BASE}/loyalty/checkin-instagram`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Falha ao realizar check-in');
  return data;
}

export async function fetchNavoRewardsAdminDashboard() {
  const res = await authFetch(`${API_BASE}/loyalty/admin/dashboard`);
  if (!res.ok) throw new Error('Falha ao carregar dashboard de recompensas');
  return await res.json();
}

export async function fetchClientsFromSupabase() {
  try {
    const res = await authFetch(`${API_BASE}/profiles`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error('Erro ao buscar clientes:', err);
    return [];
  }
}

export async function triggerInactiveClientsCampaign() {
  const res = await authFetch(`${API_BASE}/loyalty/admin/campaign-inactives`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Falha ao disparar campanha');
  return data;
}

export async function createAdminReward(rewardData: {
  title: string;
  pointsRequired: number;
  rewardType: string;
  valueDescription: string;
  icon?: string;
}) {
  const res = await authFetch(`${API_BASE}/rewards/admin/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(rewardData)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Falha ao criar recompensa');
  return data;
}

export async function deleteAdminReward(id: string) {
  const res = await authFetch(`${API_BASE}/rewards/admin/${id}`, {
    method: 'DELETE'
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Falha ao remover recompensa');
  return data;
}

export async function manuallyAdjustPoints(clientId: string, points: number, description: string) {
  const res = await authFetch(`${API_BASE}/loyalty/admin/manual-points`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId, points, description })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Falha ao ajustar pontos');
  return data;
}

export async function fetchLoyaltyConfig() {
  const res = await authFetch(`${API_BASE}/loyalty/config`);
  if (!res.ok) throw new Error('Falha ao obter configurações de fidelidade');
  return await res.json();
}

export async function saveLoyaltyConfig(configData: any) {
  const res = await authFetch(`${API_BASE}/loyalty/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(configData)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Falha ao salvar configurações de fidelidade');
  return data;
}

