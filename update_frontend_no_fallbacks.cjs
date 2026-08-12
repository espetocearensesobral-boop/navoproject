const fs = require('fs');

// 1. Update src/services/supabaseDataService.ts
let dataService = fs.readFileSync('src/services/supabaseDataService.ts', 'utf8');

// Replace fetchServicesFromSupabase
const oldServicesFuncRegex = /const DEFAULT_SERVICES_FALLBACK: ServiceItem\[\] = [\s\S]*?let servicesFetchPromise: Promise<ServiceItem\[\]> \| null = null;\s*export async function fetchServicesFromSupabase[\s\S]*?return servicesFetchPromise;\s*\}\)\(\);\s*return servicesFetchPromise;\s*\}/g;

const newServicesFunc = `let servicesFetchPromise: Promise<ServiceItem[]> | null = null;
export async function fetchServicesFromSupabase(forceRefresh = false): Promise<ServiceItem[]> {
  if (servicesFetchPromise && !forceRefresh) {
    return servicesFetchPromise;
  }
  servicesFetchPromise = (async () => {
    try {
      const res = await authFetch(\`\${API_BASE}/services?_t=\${Date.now()}\`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.message || errData?.error || 'Falha ao conectar com o banco de dados.');
      }
      const data = await res.json();
      if (!Array.isArray(data)) {
        throw new Error('Resposta inválida do banco de dados para serviços.');
      }
      return data.map((s: any) => {
        const rawSlug = s.categorySlug || 'cabelo';
        const cleanSlug = rawSlug.startsWith('cat_') ? rawSlug.slice(4) : rawSlug;
        return {
          id: s.id,
          category_id: \`cat_\${cleanSlug}\`,
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
    } finally {
      servicesFetchPromise = null;
    }
  })();
  return servicesFetchPromise;
}`;

dataService = dataService.replace(oldServicesFuncRegex, newServicesFunc);

// Replace fetchRewardsFromSupabase mock fallback
const oldRewardsRegex = /export async function fetchRewardsFromSupabase\(\) \{[\s\S]*?return \[\s*\{[\s\S]*?\}\s*\];\s*\}\s*\}/g;

const newRewardsFunc = `export async function fetchRewardsFromSupabase() {
  const res = await authFetch(\`\${API_BASE}/rewards\`);
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData?.message || errData?.error || 'Falha ao carregar catálogo de prêmios do banco de dados');
  }
  return await res.json();
}`;

dataService = dataService.replace(oldRewardsRegex, newRewardsFunc);

fs.writeFileSync('src/services/supabaseDataService.ts', dataService);
console.log('Updated src/services/supabaseDataService.ts');

// 2. Update src/services/shopProfileService.ts
let shopService = fs.readFileSync('src/services/shopProfileService.ts', 'utf8');

const oldFetchShopProfileRegex = /export async function fetchShopProfile\(forceRefresh = false\): Promise<ShopProfile> \{[\s\S]*?return profileFetchPromise;\s*\}/g;

const newFetchShopProfile = `export async function fetchShopProfile(forceRefresh = false): Promise<ShopProfile> {
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
}`;

shopService = shopService.replace(oldFetchShopProfileRegex, newFetchShopProfile);
fs.writeFileSync('src/services/shopProfileService.ts', shopService);
console.log('Updated src/services/shopProfileService.ts');

