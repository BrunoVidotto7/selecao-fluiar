// Field rules: { required: true | 'message', email: true, url: true, minLength: 8,
//   maxLength: 120, maxLengthMessage: 'custom text', min: 1, max: 999, integer: true, phone: true, password: true, money: true,
//   match: 'otherField', requiredIf: 'otherField',
//   when: (values) => boolean }
export const EMAIL_PASSWORD_REQUIRED = 'Informe a senha atual para trocar o e-mail.';
export const CATEGORY_REQUIRED = 'Escolha uma categoria.';
export const CATEGORY_NAME_MAX_LENGTH = 60;
export const CATEGORY_NAME_RULE = {
  required: 'Informe o nome da categoria.',
  maxLength: CATEGORY_NAME_MAX_LENGTH,
  maxLengthMessage: `Use até ${CATEGORY_NAME_MAX_LENGTH} caracteres.`,
};
export const PRODUCT_IMAGE_TYPES = ['image/jpeg', 'image/png'];
const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024;
const INVALID_IMAGE_MESSAGE = 'Escolha um arquivo de imagem (JPG ou PNG).';
const IMAGE_TOO_LARGE_MESSAGE = 'A imagem deve ter até 5 MB.';

const REQUIRED_MESSAGE = 'Preencha este campo.';
const INVALID_REQUEST_MESSAGE = 'Revise os dados enviados.';
const PHONE_MESSAGE = 'Digite o telefone com DDD, como (31) 99999-9999.';
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 72;
const PASSWORD_MAX_BYTES = 72;
const PASSWORD_SIZE_MESSAGE = 'Use entre 8 e 72 caracteres.';
const PASSWORD_BYTES_MESSAGE = 'Senha longa demais: letras com acento e emojis ocupam mais de um caractere.';
const MONEY_INTEGER_DIGITS = 10;
const MONEY_FORMAT = /^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/;
const MONEY_PRECISION_MESSAGE = 'Use no máximo 10 dígitos e 2 casas decimais.';
const MONEY_NEGATIVE_MESSAGE = 'Use um valor a partir de 0.00.';

function validatePassword(raw) {
  if (!raw.trim()) return REQUIRED_MESSAGE;
  if (raw.length < PASSWORD_MIN_LENGTH || raw.length > PASSWORD_MAX_LENGTH) return PASSWORD_SIZE_MESSAGE;
  if (new TextEncoder().encode(raw).length > PASSWORD_MAX_BYTES) return PASSWORD_BYTES_MESSAGE;
  return '';
}

function validateMoney(value) {
  if (!value) return '';
  const negative = value.startsWith('-');
  const unsigned = negative ? value.slice(1) : value;
  if (!MONEY_FORMAT.test(unsigned)) return MONEY_PRECISION_MESSAGE;
  const integerDigits = unsigned.split(',')[0].replace(/\./g, '').length;
  if (integerDigits > MONEY_INTEGER_DIGITS) return MONEY_PRECISION_MESSAGE;
  return negative ? MONEY_NEGATIVE_MESSAGE : '';
}

export function validateProductImage(file) {
  if (!(file instanceof File) || !file.size || !PRODUCT_IMAGE_TYPES.includes(file.type)) return INVALID_IMAGE_MESSAGE;
  return file.size > MAX_PRODUCT_IMAGE_BYTES ? IMAGE_TOO_LARGE_MESSAGE : '';
}

export function validateField(name, values, rule = {}) {
  if (rule.when && !rule.when(values)) return '';
  const raw = String(values[name] ?? '');
  const v = raw.trim();
  if (rule.required && !v) return typeof rule.required === 'string' ? rule.required : REQUIRED_MESSAGE;
  if (rule.requiredIf && !v && values[rule.requiredIf]) return 'Informe a senha atual para trocar a senha.';
  if (v && rule.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Digite um e-mail válido, como nome@email.com.';
  if (v && rule.url && !/^https?:\/\/[^\s.]+\.\S+$/.test(v)) return 'Cole o link completo, começando com https://';
  if (rule.phone && !/^\d{10,11}$/.test(v.replace(/\D/g, ''))) return PHONE_MESSAGE;
  if (rule.password) {
    const message = validatePassword(raw);
    if (message) return message;
  }
  if (v && rule.minLength && v.length < rule.minLength) return `Use pelo menos ${rule.minLength} caracteres.`;
  if (rule.maxLength != null && v.length > rule.maxLength) return rule.maxLengthMessage ?? `Use no máximo ${rule.maxLength} caracteres.`;
  if (v && rule.integer && !Number.isInteger(Number(v))) return INVALID_REQUEST_MESSAGE;
  if (v && rule.min != null && Number(v) < rule.min) return `Use um valor a partir de ${rule.min}.`;
  if (v && rule.max != null && Number(v) > rule.max) return `Use um valor até ${rule.max}.`;
  if (rule.money) {
    const message = validateMoney(v);
    if (message) return message;
  }
  if (rule.match && String(values[name] ?? '') !== String(values[rule.match] ?? '')) return 'As senhas não são iguais.';
  return '';
}

export function validateAll(values, rules) {
  const errors = {};
  for (const name of Object.keys(rules)) {
    const msg = validateField(name, values, rules[name]);
    if (msg) errors[name] = msg;
  }
  return errors;
}

export function passwordStrength(v) {
  if (!v) return 0;
  let s = 0;
  if (v.length >= 8) s++;
  if (/[A-Z]/.test(v) && /[a-z]/.test(v)) s++;
  if (/\d|[^\w]/.test(v) && v.length >= 10) s++;
  return Math.max(1, s);
}

export const CLIENT_NOTES_MAX_LENGTH = 1000;
export function validateClientNotes(value) {
  if (value !== null && typeof value !== 'string') return INVALID_REQUEST_MESSAGE;
  return validateField('clientNotes', { clientNotes: value }, { maxLength: CLIENT_NOTES_MAX_LENGTH });
}
