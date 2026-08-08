/**
 * Helper utility for browser haptic vibration feedback.
 * Provides sensory tactile responses for mobile and touch devices.
 */

export const isVibrationSupported = (): boolean => {
  return typeof window !== 'undefined' && 'navigator' in window && 'vibrate' in navigator;
};

export const vibrate = (pattern: number | number[] = 25): boolean => {
  if (isVibrationSupported()) {
    try {
      return navigator.vibrate(pattern);
    } catch {
      return false;
    }
  }
  return false;
};

/**
 * Light tap feedback for standard button clicks or card presses (12ms)
 */
export const hapticLight = () => vibrate(12);

/**
 * Medium tap feedback for toggle selection / active state (30ms)
 */
export const hapticMedium = () => vibrate(30);

/**
 * Heavy tap feedback for modal open, delete, or primary confirmation (50ms)
 */
export const hapticHeavy = () => vibrate(50);

/**
 * Double tap pattern for success / confirmation steps
 */
export const hapticSuccess = () => vibrate([25, 30, 25]);

/**
 * Double pulse pattern for warnings or removals
 */
export const hapticWarning = () => vibrate([40, 50, 30]);
