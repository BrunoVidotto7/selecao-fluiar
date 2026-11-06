import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import PrintBar from './PrintBar';

describe('PrintBar', () => {
  it('renders nothing without a selection', () => {
    const { container } = render(<PrintBar count={0} onPrint={() => {}} onClear={() => {}} />);
    expect(container.innerHTML).toBe("");
  });

  it('pluralizes the count', () => {
    const { rerender } = render(<PrintBar count={1} onPrint={() => {}} onClear={() => {}} />);
    expect(screen.getByRole('status').textContent).toBe('1 item selecionado');
    rerender(<PrintBar count={2} onPrint={() => {}} onClear={() => {}} />);
    expect(screen.getByText('2 itens selecionados')).toBeTruthy();
  });

  it('prints and clears', () => {
    const onPrint = vi.fn();
    const onClear = vi.fn();
    render(<PrintBar count={2} onPrint={onPrint} onClear={onClear} />);
    fireEvent.click(screen.getByRole('button', { name: 'Imprimir selecionados' }));
    fireEvent.click(screen.getByRole('button', { name: 'Limpar' }));
    expect(onPrint).toHaveBeenCalledTimes(1);
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
