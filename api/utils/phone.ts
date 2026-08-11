export const sanitizePhone = (phone: string | undefined | null): string => {
  if (!phone) return '';
  // 1. Remove tudo que não for dígito
  let clean = phone.replace(/\D/g, '');
  // 2. Se for um número brasileiro válido (10 ou 11 dígitos), adiciona o 55
  if (clean.length === 10 || clean.length === 11) {
    clean = '55' + clean;
  }
  return clean;
};

export function normalizePhone(phone: string | undefined | null): string {
  if (!phone) return '';
  let digits = phone.replace(/\D/g, '');
  if (digits.length >= 12 && digits.startsWith('55')) {
    digits = digits.slice(2);
  }
  return digits;
}

export function matchPhoneNumbers(phone1: string | undefined | null, phone2: string | undefined | null): boolean {
  if (!phone1 || !phone2) return false;
  const norm1 = normalizePhone(phone1);
  const norm2 = normalizePhone(phone2);
  if (!norm1 || !norm2) return false;
  if (norm1 === norm2) return true;

  // Se ambos possuem DDD (pelo menos 10 dígitos)
  if (norm1.length >= 10 && norm2.length >= 10) {
    const ddd1 = norm1.slice(0, 2);
    const ddd2 = norm2.slice(0, 2);
    // Se o DDD for diferente, NUNCA correspondem
    if (ddd1 !== ddd2) return false;

    const rest1 = norm1.slice(2);
    const rest2 = norm2.slice(2);
    if (rest1 === rest2) return true;

    // Trata variação do 9º dígito (ex: 988887777 vs 88887777)
    if (rest1.slice(-8) === rest2.slice(-8)) {
      return true;
    }
    return false;
  }

  // Se um dos dois não possui DDD (ex: número digitado sem DDD)
  if (norm1.length >= 8 && norm2.length >= 8) {
    return norm1.slice(-8) === norm2.slice(-8);
  }

  return false;
}
