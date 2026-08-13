const KNOWN_BROKEN_IMAGE_IDS = ['photo-1517832606589-715006d319a2'];

export function optimizeImageUrl(url?: string | null, width = 400, quality = 75): string {
  if (!url) return '';
  if (KNOWN_BROKEN_IMAGE_IDS.some((id) => url.includes(id))) {
    return '/placeholder-service.svg';
  }
  if (url.includes('images.unsplash.com')) {
    try {
      const parsed = new URL(url);
      parsed.searchParams.set('w', width.toString());
      parsed.searchParams.set('q', quality.toString());
      parsed.searchParams.set('auto', 'format');
      parsed.searchParams.set('fit', 'crop');
      return parsed.toString();
    } catch {
      return url;
    }
  }
  return url;
}
