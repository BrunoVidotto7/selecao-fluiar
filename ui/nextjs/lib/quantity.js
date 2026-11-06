export const UNIT_OPTIONS = [
  { value: 'UNIT', label: 'Unidades' },
  { value: 'SQUARE_METER', label: 'm²' },
];

const NUMBER_FORMAT = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });

export function formatQuantity(quantity, unit) {
  return `${NUMBER_FORMAT.format(quantity)} ${unit === 'SQUARE_METER' ? 'm²' : 'un.'}`;
}

// Only digits with an optional comma decimal ("12,5"); anything else is NaN.
export function parseQuantity(text) {
  const value = String(text ?? '').trim();
  return /^\d+(,\d+)?$/.test(value) ? Number(value.replace(',', '.')) : NaN;
}

export const quantityRule = (unit) => ({ required: true, quantity: unit });
