import React from 'react';

export const handleEnterAsTab = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | HTMLFormElement>) => {
  if (e.key === 'Enter') {
    if (e.target instanceof HTMLButtonElement && e.target.type === 'submit') {
      return; // Let submit buttons do their thing
    }
    
    e.preventDefault();
    const target = e.target as HTMLElement;
    const form = target.closest('form');
    
    if (form) {
      const elements = Array.from(
        form.querySelectorAll(
          'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])[type="submit"]'
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
