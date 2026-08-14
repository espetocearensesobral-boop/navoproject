import React from 'react';

export const handleEnterAsTab = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | HTMLButtonElement | HTMLFormElement>) => {
  if (e.key === 'Enter') {
    if (e.target instanceof HTMLButtonElement && (e.target.type === 'submit' || e.target.dataset.enterAction === 'true')) {
      return; // Preserve explicit button actions, including opening a picker.
    }
    
    e.preventDefault();
    const target = e.target as HTMLElement;
    const form = target.closest('form');
    
    if (form) {
      const elements = Array.from(
        form.querySelectorAll(
          'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])[type="submit"], button:not([disabled])[data-enter-tab="true"]'
        )
      ) as HTMLElement[];
      const index = elements.indexOf(target);
      if (index > -1 && index < elements.length - 1) {
        elements[index + 1].focus();
      } else if (index === elements.length - 1) {
        elements[index].click();
      }
    }
  }
};
