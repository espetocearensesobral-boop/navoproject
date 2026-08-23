import { useEffect } from 'react';

/**
 * Locks background scrolling (body, html and the admin shell's <main>) while
 * a modal is mounted. Extracted from ReceiptCheckoutModal so every admin
 * dialog shares the exact same behavior instead of re-implementing it.
 */
export function useModalScrollLock(isOpen: boolean) {
  useEffect(() => {
    if (!isOpen) return;

    const body = document.body;
    const html = document.documentElement;
    const adminMain = document.querySelector<HTMLElement>('.admin-shell main');
    const previous = {
      bodyOverflow: body.style.overflow,
      bodyOverscroll: body.style.overscrollBehavior,
      htmlOverflow: html.style.overflow,
      htmlOverscroll: html.style.overscrollBehavior,
      mainOverflow: adminMain?.style.overflow || '',
      mainOverscroll: adminMain?.style.overscrollBehavior || '',
      mainTouchAction: adminMain?.style.touchAction || '',
    };

    body.style.overflow = 'hidden';
    body.style.overscrollBehavior = 'none';
    html.style.overflow = 'hidden';
    html.style.overscrollBehavior = 'none';
    if (adminMain) {
      adminMain.style.overflow = 'hidden';
      adminMain.style.overscrollBehavior = 'none';
      adminMain.style.touchAction = 'none';
    }

    return () => {
      body.style.overflow = previous.bodyOverflow;
      body.style.overscrollBehavior = previous.bodyOverscroll;
      html.style.overflow = previous.htmlOverflow;
      html.style.overscrollBehavior = previous.htmlOverscroll;
      if (adminMain) {
        adminMain.style.overflow = previous.mainOverflow;
        adminMain.style.overscrollBehavior = previous.mainOverscroll;
        adminMain.style.touchAction = previous.mainTouchAction;
      }
    };
  }, [isOpen]);
}
