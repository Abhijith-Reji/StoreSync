import { useEffect } from 'react';

export interface ShortcutHandlers {
  onF2?: () => void; // Focus Barcode Search
  onF8?: () => void; // Complete Sale / Checkout
  onEscape?: () => void;
}

export function useKeyboardShortcuts({ onF2, onF8, onEscape }: ShortcutHandlers) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'F2') {
        event.preventDefault();
        onF2?.();
      } else if (event.key === 'F8') {
        event.preventDefault();
        onF8?.();
      } else if (event.key === 'Escape') {
        onEscape?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onF2, onF8, onEscape]);
}
