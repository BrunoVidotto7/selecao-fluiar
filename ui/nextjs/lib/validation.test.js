import { afterEach, describe, expect, test, vi } from 'vitest';
import { passwordStrength, validateAll, validateField, isValidTaxDocument } from './validation';

const MISMATCH = 'As senhas não são iguais.';

describe('validateField', () => {
  test('required rejects blank values and accepts a custom message', () => {
    expect(validateField('nome', { nome: '   ' }, { required: true })).toBe('Preencha este campo.');
    expect(validateField('cli', { cli: '' }, { required: 'Escolha o perfil.' })).toBe('Escolha o perfil.');
    expect(validateField('nome', { nome: 'Ana' }, { required: true })).toBe('');
  });

  test('email and minLength only check filled values', () => {
    expect(validateField('email', { email: 'ana@' }, { email: true })).toMatch(/e-mail válido/);
    expect(validateField('email', { email: 'ana@mail.com' }, { email: true })).toBe('');
    expect(validateField('senha', { senha: '1234567' }, { minLength: 8 })).toMatch(/8 caracteres/);
    expect(validateField('senha', { senha: '' }, { minLength: 8 })).toBe('');
  });

  test('min rejects numbers below the minimum', () => {
    expect(validateField('qtd', { qtd: '0' }, { min: 1 })).toBe('Use um valor a partir de 1.');
    expect(validateField('qtd', { qtd: '-3' }, { min: 1 })).toBe('Use um valor a partir de 1.');
    expect(validateField('qtd', { qtd: '2' }, { min: 1 })).toBe('');
  });

  test('when disables the rule until the condition holds', () => {
    const rule = { required: 'Informe a senha atual para trocar o e-mail.', when: (values) => values.email === 'nova@mail.com' };
    expect(validateField('senhaEmail', { senhaEmail: '', email: 'ana@mail.com' }, rule)).toBe('');
    expect(validateField('senhaEmail', { senhaEmail: '', email: 'nova@mail.com' }, rule)).toBe('Informe a senha atual para trocar o e-mail.');
  });

  test('requiredIf asks for the field only when the other one is filled', () => {
    expect(validateField('atual', { atual: '', nova: 'Senha123' }, { requiredIf: 'nova' })).toMatch(/senha atual/);
    expect(validateField('atual', { atual: '', nova: '' }, { requiredIf: 'nova' })).toBe('');
  });

  test('match accepts identical passwords', () => {
    expect(validateField('senha2', { senha: 'Password1', senha2: 'Password1' }, { match: 'senha' })).toBe('');
  });

  test('match rejects passwords that differ only by surrounding spaces', () => {
    expect(validateField('senha2', { senha: 'Password1', senha2: 'Password1 ' }, { match: 'senha' })).toBe(MISMATCH);
    expect(validateField('senha2', { senha: ' Password1', senha2: 'Password1' }, { match: 'senha' })).toBe(MISMATCH);
  });

  test.each(['https://example.com extra', 'https://example.com\nextra', 'javascript:alert(1)', 'https://.example.com'])(
    'url rejects an invalid complete link: %s', (url) => {
      expect(validateField('url', { url }, { url: true })).toBe('Cole o link completo, começando com https://');
    },
  );

  test.each(['https://example.com/product?x=1#details', 'http://shop.example.com', ''])(
    'url accepts an optional HTTP link: %s', (url) => {
      expect(validateField('url', { url }, { url: true })).toBe('');
    },
  );

  test.each(['', 'abc', '319999999', '319999999999'])('phone rejects an invalid digit count: %s', (tel) => {
    expect(validateField('tel', { tel }, { phone: true })).toBe('Digite o telefone com DDD, como (31) 99999-9999.');
  });

  test.each(['31999998888', '3133334444', '(31) 99999-8888', '(31) 3333-4444'])('phone accepts 10 or 11 normalized digits: %s', (tel) => {
    expect(validateField('tel', { tel }, { phone: true })).toBe('');
  });

  test.each([
    ['0', 'Use um valor a partir de 1.'],
    ['-1', 'Use um valor a partir de 1.'],
    ['1000', 'Use um valor até 999.'],
    ['1.5', 'Revise os dados enviados.'],
    ['1,5', 'Revise os dados enviados.'],
    ['abc', 'Revise os dados enviados.'],
    ['Infinity', 'Revise os dados enviados.'],
    ['', 'Preencha este campo.'],
    ['1', ''],
    ['999', ''],
  ])('quantity validates the draft %s without rounding or clamping', (qtd, message) => {
    expect(validateField('qtd', { qtd }, { required: true, min: 1, max: 999, integer: true })).toBe(message);
  });

  test.each([60, 120, 200, 254, 500, 1000, 2048])('maxLength enforces a text limit of %i', (maxLength) => {
    expect(validateField('texto', { texto: 'x'.repeat(maxLength) }, { maxLength })).toBe('');
    expect(validateField('texto', { texto: 'x'.repeat(maxLength + 1) }, { maxLength })).toBe(`Use no máximo ${maxLength} caracteres.`);
  });

  test.each(['', '  ', '0', '0,00', '12', '12,5', '12,50', '1.234,56', '1234,56', '9.999.999.999,99', '9999999999,99'])(
    'money accepts an optional Brazilian decimal: %s', (preco) => {
      expect(validateField('preco', { preco }, { money: true })).toBe('');
    },
  );

  test.each(['abc', 'NaN', 'Infinity', '1e3', 'R$ 12,50', '12.34', '1.23,45', '1,234', '1,', ',50', '10000000000', '10.000.000.000,00', '-', '-abc', '-1,234', '-12.34'])(
    'money rejects invalid syntax or excess digits: %s', (preco) => {
      expect(validateField('preco', { preco }, { money: true })).toBe('Use no máximo 10 dígitos e 2 casas decimais.');
    },
  );

  test.each(['-1', '-0,01', '-1.234,50'])('money rejects a negative price: %s', (preco) => {
    expect(validateField('preco', { preco }, { money: true })).toBe('Use um valor a partir de 0.00.');
  });

  test.each([
    ['1234567', 'Use entre 8 e 72 caracteres.'],
    ['x'.repeat(73), 'Use entre 8 e 72 caracteres.'],
    ['  abc123  ', ''],
    [' a12345 ', ''],
    ['x'.repeat(72), ''],
    ['á'.repeat(36), ''],
    ['á'.repeat(37), 'Senha longa demais: letras com acento e emojis ocupam mais de um caractere.'],
    ['😀'.repeat(18), ''],
    ['😀'.repeat(19), 'Senha longa demais: letras com acento e emojis ocupam mais de um caractere.'],
  ])('password checks untrimmed UTF-16 length before UTF-8 bytes: %s', (senha, message) => {
    expect(validateField('senha', { senha }, { password: true })).toBe(message);
  });

  test.each(['', '        '])('password rejects blank input with the existing required message', (senha) => {
    expect(validateField('senha', { senha }, { password: true })).toBe('Preencha este campo.');
  });
});

test('validateAll returns only the fields with errors', () => {
  const rules = { nome: { required: true }, email: { required: true, email: true } };
  expect(validateAll({ nome: '', email: 'ana@mail.com' }, rules)).toEqual({ nome: 'Preencha este campo.' });
});

test('passwordStrength grows with length, mixed case and digits', () => {
  expect(passwordStrength('')).toBe(0);
  expect(passwordStrength('abc')).toBe(1);
  expect(passwordStrength('abcdefgh')).toBe(1);
  expect(passwordStrength('Abcdefgh')).toBe(2);
  expect(passwordStrength('Abcdefgh12')).toBe(3);
});

describe('list internal control rules', () => {
  test.each(['52998224725', '11222333000181', '12ABC34501DE35', '529.982.247-25', '12.abc.345/01de-35'])('accepts the valid document %s', (value) => {
    expect(isValidTaxDocument(value)).toBe(true);
    expect(validateField('doc', { doc: value }, { taxDocument: true })).toBe('');
  });

  test.each(['52998224724', '11111111111', '11222333000180', '12ABC34501DE36', '00000000000000', '1234567890', '12ABC3450IDE35', '529.982.247-24'])(
    'rejects the invalid document %s', (value) => {
      expect(isValidTaxDocument(value)).toBe(false);
      expect(validateField('doc', { doc: value }, { taxDocument: true })).toBe('Digite um CPF ou CNPJ válido.');
    });

  test('an empty document or CEP is valid', () => {
    expect(validateField('doc', { doc: '  ' }, { taxDocument: true })).toBe('');
    expect(validateField('cep', { cep: '' }, { zipCode: true })).toBe('');
  });

  test.each(['30140-071', '30140071', '30 140.071', '30140/071'])('accepts the CEP %s', (value) => {
    expect(validateField('cep', { cep: value }, { zipCode: true })).toBe('');
  });

  test.each(['3014-071', '301400711', 'abcdefgh'])('rejects the CEP %s', (value) => {
    expect(validateField('cep', { cep: value }, { zipCode: true })).toBe('Digite o CEP com 8 números, como 30140-071.');
  });

  test('size limits use the existing message', () => {
    expect(validateField('c', { c: 'a'.repeat(41) }, { maxLength: 40 })).toBe('Use no máximo 40 caracteres.');
  });
});

const CPF_MESSAGE = 'Digite um CPF válido.';
const BIRTH_DATE_MESSAGE = 'Digite uma data de nascimento válida, como 25/03/1985.';

afterEach(() => vi.useRealTimers());

test('cpf accepts a valid CPF with or without punctuation and nothing else', () => {
  for (const cpf of ['529.982.247-25', '52998224725', '']) expect(validateField('cpf', { cpf }, { cpf: true })).toBe('');
  for (const cpf of ['529.982.247-24', '111.111.111-11', '529.982.247', '11.222.333/0001-81'])
    expect(validateField('cpf', { cpf }, { cpf: true })).toBe(CPF_MESSAGE);
});

test('birth date accepts real dates from 1900 to today in Sao Paulo', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-12T02:30:00Z'));
  for (const d of ['11/11/2026', '01/01/1900', '29/02/2024', '']) expect(validateField('d', { d }, { birthDate: true })).toBe('');
  for (const d of ['12/11/2026', '31/12/1899', '29/02/2023', '25/03/85'])
    expect(validateField('d', { d }, { birthDate: true })).toBe(BIRTH_DATE_MESSAGE);
});
