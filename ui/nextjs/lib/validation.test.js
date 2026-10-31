import { describe, expect, test } from 'vitest';
import { passwordStrength, validateAll, validateField } from './validation';

const MISMATCH = 'As senhas não são iguais.';

describe('validateField', () => {
  test('required rejects blank values and accepts a custom message', () => {
    expect(validateField('nome', { nome: '   ' }, { required: true })).toBe('Preencha este campo.');
    expect(validateField('cli', { cli: '' }, { required: 'Escolha o cliente.' })).toBe('Escolha o cliente.');
    expect(validateField('nome', { nome: 'Ana' }, { required: true })).toBe('');
  });

  test('email and minLength only check filled values', () => {
    expect(validateField('email', { email: 'ana@' }, { email: true })).toMatch(/e-mail válido/);
    expect(validateField('email', { email: 'ana@mail.com' }, { email: true })).toBe('');
    expect(validateField('senha', { senha: '1234567' }, { minLength: 8 })).toMatch(/8 caracteres/);
    expect(validateField('senha', { senha: '' }, { minLength: 8 })).toBe('');
  });

  test('min rejects numbers below the minimum', () => {
    expect(validateField('qtd', { qtd: '0' }, { min: 1 })).toBe('Use um número a partir de 1.');
    expect(validateField('qtd', { qtd: '-3' }, { min: 1 })).toBe('Use um número a partir de 1.');
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
