import type { PrintFormat, PrintSettings } from '../services/printSettingsService';

export function escapePrintHtml(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function printDocumentCss(settings: PrintSettings, format: PrintFormat) {
  const width = format === 'thermal' ? `${settings.thermalWidthMm}mm` : '210mm';
  const pageSize = format === 'thermal' ? `${settings.thermalWidthMm}mm auto` : `A4 ${settings.a4Orientation}`;
  const spacing = settings.density === 'compact' ? '3px' : settings.density === 'spacious' ? '12px' : '7px';
  return `@page{size:${pageSize};margin:${settings.marginMm}mm}*{box-sizing:border-box}html,body{margin:0;padding:0}body{width:${width};max-width:100%;margin:0 auto;padding:${settings.marginMm}mm;font-family:Arial,sans-serif;color:#111;background:#fff;font-size:${settings.fontSize}px;line-height:1.35}h1{font-size:${settings.fontSize + 6}px;margin:0 0 ${spacing} 0}h2{font-size:${settings.fontSize + 2}px;margin:${spacing} 0}p{margin:${spacing} 0}.print-divider{border:0;border-top:1px dashed #777;margin:${Number.parseInt(spacing, 10) * 2}px 0}.print-row{display:flex;justify-content:space-between;gap:12px;padding:${spacing} 0}.print-total{font-size:${settings.fontSize + 3}px;font-weight:700;border-top:2px solid #111;padding-top:${spacing}}.print-center{text-align:center}.print-muted{color:#555}.print-footer{text-align:center;margin-top:24px;color:#555;font-size:${Math.max(9, settings.fontSize - 1)}px}@media print{button{display:none!important}body{box-shadow:none!important}}`;
}

export function openPrintWindow(options: { title: string; settings: PrintSettings; format: PrintFormat; bodyHtml: string; autoPrint?: boolean }) {
  const popup = window.open('', '_blank', 'width=760,height=900');
  if (!popup) return false;
  popup.opener = null;
  const footer = options.settings.showFooter ? `<footer class="print-footer">${escapePrintHtml(options.settings.footerText)}</footer>` : '';
  popup.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escapePrintHtml(options.title)}</title><style>${printDocumentCss(options.settings, options.format)}</style></head><body>${options.bodyHtml}${footer}${options.autoPrint === false ? '' : '<script>window.addEventListener("load",()=>window.print());</script>'}</body></html>`);
  popup.document.close();
  return true;
}
