# ADR 0005: Touch-Friendly POS UI with Angular and Tailwind CSS

## Status
Accepted

## Context
Supermarket cashiers operate touch-screen monitors or keyboard barcode scanners under high-speed conditions. The interface requires large hit targets, high contrast, rapid numpad entry, and minimal clutter.

## Decision
1. **Angular 22 Standalone Components**: Utilizing modern signals, standalone architecture, and zoneless-ready primitives for maximum performance.
2. **Tailwind CSS v4**: Utility-first CSS configured with custom touch button classes (`min-h-[56px]`, `text-lg`, high-contrast states).
3. **Desktop Shell Ready**: UI designed to be wrapped in Electron or Tauri for Windows desktop execution, with support for local shortcuts (e.g., F1 search, F9 pay, F12 clear).

## Consequences
* **Positive**: Lightning-fast UI rendering; ergonomic for touchscreens and barcode guns; low cognitive load for cashiers.
* **Negative**: Tailwind v4 requires modern PostCSS configuration integrated into Angular build pipeline.
