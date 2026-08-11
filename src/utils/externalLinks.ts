import { getTodayStringBRT, getCurrentTimeBRT, getDayOfWeekKey, timeToMinutes } from './dateUtils';

export function openWhatsAppDirect(phone?: string, text?: string) {
  const cleanPhone = phone ? phone.replace(/\D/g, '') : '5588998340085';
  const encodedText = encodeURIComponent(text || 'Olá! Gostaria de falar com a barbearia.');
  const appUrl = `whatsapp://send?phone=${cleanPhone}&text=${encodedText}`;
  const webUrl = `https://wa.me/${cleanPhone}?text=${encodedText}`;

  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (isMobile) {
    window.location.href = appUrl;
    setTimeout(() => {
      window.open(webUrl, '_blank', 'noopener,noreferrer');
    }, 450);
  } else {
    window.open(webUrl, '_blank', 'noopener,noreferrer');
  }
}

export function openMapsDirect(address?: string, mapsUrl?: string) {
  const query = encodeURIComponent(address || 'Rua Fortaleza, 1420 - Expectativa, Sobral - CE');
  const targetUrl = mapsUrl || `https://maps.google.com/?q=${query}`;
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const isAndroid = /Android/i.test(navigator.userAgent);

  if (isIOS) {
    window.location.href = `maps://?q=${query}`;
    setTimeout(() => {
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
    }, 450);
  } else if (isAndroid) {
    window.location.href = `geo:0,0?q=${query}`;
    setTimeout(() => {
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
    }, 450);
  } else {
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  }
}

export function openWazeDirect(address?: string) {
  const query = encodeURIComponent(address || 'Rua Fortaleza 1420 Expectativa Sobral CE');
  const appUrl = `waze://?q=${query}&navigate=yes`;
  const webUrl = `https://waze.com/ul?q=${query}&navigate=yes`;
  
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (isMobile) {
    window.location.href = appUrl;
    setTimeout(() => {
      window.open(webUrl, '_blank', 'noopener,noreferrer');
    }, 450);
  } else {
    window.open(webUrl, '_blank', 'noopener,noreferrer');
  }
}

export function openPhoneDirect(phone?: string) {
  const clean = phone ? phone.replace(/\D/g, '') : '88998340085';
  window.location.href = `tel:${clean}`;
}

export function openInstagramDirect(instagramHandle?: string) {
  const clean = instagramHandle ? instagramHandle.replace('@', '').trim() : 'barbearianavo';
  window.open(`https://instagram.com/${clean}`, '_blank', 'noopener,noreferrer');
}

export interface ShopStatusInfo {
  status: 'open' | 'closing_soon' | 'closed';
  label: string; // "Aberto", "Fechará em breve", "Fechado"
  detail: string; // "Aberto Agora", "Fechará em Breve", "Atendimento Fechado"
  todayHours: string; // "09:00 às 20:00" or "Fechado hoje"
}

export function getShopStatusInfo(shopProfile: any): ShopStatusInfo {
  const todayStr = getTodayStringBRT();
  const dayKey = getDayOfWeekKey(todayStr);
  const sch = shopProfile?.operatingSchedule?.[dayKey];

  if (!sch || !sch.active) {
    return {
      status: 'closed',
      label: 'Fechado',
      detail: 'Atendimento Fechado',
      todayHours: 'Fechado hoje'
    };
  }

  const openTime = sch.open || shopProfile?.openTime || '09:00';
  const closeTime = sch.close || shopProfile?.closeTime || '20:00';
  const todayHours = `${openTime} às ${closeTime}`;

  const openMins = timeToMinutes(openTime);
  const closeMins = timeToMinutes(closeTime);
  const currMins = getCurrentTimeBRT().totalMinutes;

  if (currMins < openMins || currMins >= closeMins) {
    return {
      status: 'closed',
      label: 'Fechado',
      detail: 'Atendimento Fechado',
      todayHours
    };
  } else if (closeMins - currMins <= 45) {
    return {
      status: 'closing_soon',
      label: 'Fechará em breve',
      detail: 'Fechará em Breve',
      todayHours
    };
  } else {
    return {
      status: 'open',
      label: 'Aberto',
      detail: 'Aberto Agora',
      todayHours
    };
  }
}
