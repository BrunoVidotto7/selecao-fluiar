import { describe, expect, it } from 'vitest';
import { UNIT_OPTIONS, formatQuantity, parseQuantity, quantityRule } from './quantity';
import { QUANTITY_AREA_INVALID, QUANTITY_UNIT_INVALID, validateField, validateQuantity } from './validation';

describe('quantity', () => {
  it('lists the unit options', () => {
    expect(UNIT_OPTIONS).toEqual([{ value: 'UNIT', label: 'Unidades' }, { value: 'SQUARE_METER', label: 'm²' }]);
  });

  it('formats quantities in pt-BR without trailing zeros', () => {
    expect(formatQuantity(3, 'UNIT')).toBe('3 un.');
    expect(formatQuantity(12.5, 'SQUARE_METER')).toBe('12,5 m²');
    expect(formatQuantity(8.75, 'SQUARE_METER')).toBe('8,75 m²');
    expect(formatQuantity(2.0, 'SQUARE_METER')).toBe('2 m²');
  });

  it('parses only comma decimals', () => {
    expect(parseQuantity('12,5')).toBe(12.5);
    expect(parseQuantity('3')).toBe(3);
    expect(Number.isNaN(parseQuantity('12.5'))).toBe(true);
    expect(Number.isNaN(parseQuantity('abc'))).toBe(true);
    expect(Number.isNaN(parseQuantity(''))).toBe(true);
  });

  it('validates by unit', () => {
    expect(validateQuantity('1,5', 'UNIT')).toBe(QUANTITY_UNIT_INVALID);
    expect(validateQuantity('0', 'UNIT')).toBe(QUANTITY_UNIT_INVALID);
    expect(validateQuantity('1000', 'UNIT')).toBe(QUANTITY_UNIT_INVALID);
    expect(validateQuantity('999', 'UNIT')).toBe('');
    expect(validateQuantity('0', 'SQUARE_METER')).toBe(QUANTITY_AREA_INVALID);
    expect(validateQuantity('0,005', 'SQUARE_METER')).toBe(QUANTITY_AREA_INVALID);
    expect(validateQuantity('1000', 'SQUARE_METER')).toBe(QUANTITY_AREA_INVALID);
    expect(validateQuantity('12.5', 'SQUARE_METER')).toBe(QUANTITY_AREA_INVALID);
    expect(validateQuantity('12,5', 'SQUARE_METER')).toBe('');
    expect(validateQuantity('999,99', 'SQUARE_METER')).toBe('');
  });

  it('exposes a validateField rule', () => {
    expect(validateField('quantity', { quantity: '2,5' }, quantityRule('UNIT'))).toBe(QUANTITY_UNIT_INVALID);
    expect(validateField('quantity', { quantity: '2,5' }, quantityRule('SQUARE_METER'))).toBe('');
    expect(validateField('quantity', { quantity: '' }, quantityRule('UNIT'))).toBe('Preencha este campo.');
  });
});
