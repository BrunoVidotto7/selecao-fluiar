import { toIsoDate, todayIsoDate } from './format';
// Field rules: { required: true | 'message', email: true, url: true, minLength: 8,
//   maxLength: 120, maxLengthMessage: 'custom text', min: 1, max: 999, integer: true, phone: true, password: true, money: true,
//   quantity: 'UNIT' | 'SQUARE_METER',
//   zipCode: true, taxDocument: true, cpf: true, birthDate: true,
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
export const QUANTITY_UNIT_INVALID = 'Use um número inteiro de 1 a 999.';
export const QUANTITY_AREA_INVALID = 'Use um valor de 0,01 a 999,99, com até 2 casas decimais.';
export const PRODUCT_IMAGE_TYPES = ['image/jpeg', 'image/png'];
const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024;
const INVALID_IMAGE_MESSAGE = 'Escolha um arquivo de imagem (JPG ou PNG).';
const IMAGE_TOO_LARGE_MESSAGE = 'A imagem deve ter até 5 MB.';

export const LIST_CODE_MAX_LENGTH = 40;
export const LIST_CONTRACT_MAX_LENGTH = 120;
export const LIST_CONTRACTOR_NAME_MAX_LENGTH = 120;
export const LIST_ADDRESS_MAX_LENGTH = 300;
const ZIP_CODE_MESSAGE = 'Digite o CEP com 8 números, como 30140-071.';
const TAX_DOCUMENT_MESSAGE = 'Digite um CPF ou CNPJ válido.';
const CPF_MESSAGE = 'Digite um CPF válido.';
const BIRTH_DATE_MESSAGE = 'Digite uma data de nascimento válida, como 25/03/1985.';
const BIRTH_DATE_MIN = '1900-01-01';
const CODE_SEPARATORS = /[\s.\-/]/g;

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

function checkDigit(chars, weights) {
  const sum = chars.reduce((total, char, i) => total + (char.charCodeAt(0) - 48) * weights[i], 0);
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

function validCpf(code) {
  if (!/^\d{11}$/.test(code) || /^(\d)\1{10}$/.test(code)) return false;
  const chars = [...code];
  const first = checkDigit(chars.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = checkDigit(chars.slice(0, 10), [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
  return first === Number(chars[9]) && second === Number(chars[10]);
}

function validCnpj(code) {
  if (!/^[0-9A-Z]{12}\d{2}$/.test(code) || /^(.)\1{13}$/.test(code)) return false;
  const chars = [...code];
  const first = checkDigit(chars.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = checkDigit(chars.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return first === Number(chars[12]) && second === Number(chars[13]);
}

export function isValidTaxDocument(value) {
  const code = String(value ?? '').replace(CODE_SEPARATORS, '').toUpperCase();
  return validCpf(code) || validCnpj(code);
}

function isValidBirthDate(text) {
  const iso = toIsoDate(text);
  return iso !== null && iso >= BIRTH_DATE_MIN && iso <= todayIsoDate();
}

export function validateQuantity(text, unit) {
  const value = String(text ?? '').trim();
  if (unit === 'SQUARE_METER') {
    const valid = /^\d{1,3}(?:,\d{1,2})?$/.test(value) && Number(value.replace(',', '.')) >= 0.01;
    return valid ? '' : QUANTITY_AREA_INVALID;
  }
  return /^\d{1,3}$/.test(value) && Number(value) >= 1 ? '' : QUANTITY_UNIT_INVALID;
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
  if (v && rule.zipCode && !/^\d{8}$/.test(v.replace(CODE_SEPARATORS, ''))) return ZIP_CODE_MESSAGE;
  if (v && rule.taxDocument && !isValidTaxDocument(v)) return TAX_DOCUMENT_MESSAGE;
  if (v && rule.cpf && !validCpf(v.replace(CODE_SEPARATORS, ''))) return CPF_MESSAGE;
  if (v && rule.birthDate && !isValidBirthDate(v)) return BIRTH_DATE_MESSAGE;
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
  if (v && rule.quantity) {
    const message = validateQuantity(v, rule.quantity);
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
