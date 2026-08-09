import React from 'react';

export const handleEnterAsTab = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    const form = e.currentTarget.form;
    if (form) {
      const elements = Array.from(
        form.querySelectorAll<HTMLElement>(
          'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])[type="submit"]'
        )
      );
      const index = elements.indexOf(e.currentTarget);
      if (index > -1 && index < elements.length - 1) {
        elements[index + 1].focus();
      } else if (index === elements.length - 1) {
        // Last element, maybe a button, let's trigger it or blur
        elements[index].click();
      }
    }
  }
};
