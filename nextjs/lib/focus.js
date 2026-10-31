// Mantém o foco do teclado dentro de um painel aberto (diálogo, menu) com Tab e Shift+Tab.
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea';

export function keepFocusInside(event, container) {
  if (event.key !== 'Tab' || !container) return;
  const items = container.querySelectorAll(FOCUSABLE);
  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement;

  if (!container.contains(active) || (event.shiftKey ? active === first : active === last)) {
    event.preventDefault();
    (event.shiftKey && container.contains(active) ? last : first).focus();
  }
}
