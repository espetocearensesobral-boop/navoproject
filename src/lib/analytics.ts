declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}

/**
 * Centralized funnel event tracker (GA4 via gtag).
 * Use consistent labels so the full booking funnel can be reconstructed:
 * hero_cta -> step1_service -> step2_barber -> step3_datetime -> step4_confirm -> payment_choice
 */
export const trackEvent = (action: string, category: string, label: string) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', action, {
      event_category: category,
      event_label: label
    });
  }
};
