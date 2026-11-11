import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import PrintSheet from './PrintSheet';

const product = (id, name, extra = {}) => ({
  id, name, quantity: 2, unit: 'UNIT', bought: false, clientNotes: [], links: [], ...extra,
});
const rooms = [
  { id: 'r1', name: 'Sala', products: [
    product('a', 'Sofá', { quantity: 12.5, unit: 'SQUARE_METER', unitPrice: 987.65, notes: 'nota interna secreta', clientNotes: [{ clientId: 'c1', clientName: 'Mariana', text: 'prefiro cinza' }, { clientId: 'c2', clientName: 'Paulo', text: 'prefiro bege' }],
      links: [{ url: 'https://www.loja.com.br/sofa', note: 'versão 3 lugares' }] }),
    product('b', 'Mesa'),
  ] },
  { id: 'r2', name: 'Cozinha', products: [product('c', 'Geladeira'), product('d', 'Fogão')] },
];

describe('PrintSheet', () => {
  it('prints only selected items and rooms that contain them', () => {
    render(<PrintSheet title="Casa nova" rooms={rooms} selected={new Set(['a', 'd'])} />);
    expect(screen.getByText('Sofá')).toBeTruthy();
    expect(screen.getByText('Fogão')).toBeTruthy();
    expect(screen.queryByText('Mesa')).toBeNull();
    expect(screen.queryByText('Geladeira')).toBeNull();
    expect(screen.getByText('Sala')).toBeTruthy();
    expect(screen.getByText('Cozinha')).toBeTruthy();
  });

  it('renders into document.body through a portal and only with a selection', () => {
    const { rerender } = render(<PrintSheet title="Casa nova" rooms={rooms} selected={new Set(['a'])} />);
    expect(document.body.querySelectorAll(':scope > .print-sheet')).toHaveLength(1);
    rerender(<PrintSheet title="Casa nova" rooms={rooms} selected={new Set()} />);
    expect(document.body.querySelector('.print-sheet')).toBeNull();
  });

  it('omits a room without selected items', () => {
    render(<PrintSheet title="Casa nova" rooms={rooms} selected={new Set(['a'])} />);
    expect(screen.queryByText('Cozinha')).toBeNull();
  });

  it('shows quantity, link text and client note but no price or internal note', () => {
    const { container } = render(<PrintSheet title="Casa nova" rooms={rooms} selected={new Set(['a'])} />);
    const sheet = document.body.querySelector(':scope > .print-sheet');
    expect(screen.getByText('12,5 m²')).toBeTruthy();
    expect(screen.getByText(/loja\.com\.br/)).toBeTruthy();
    expect(screen.getByText(/versão 3 lugares/)).toBeTruthy();
    expect(screen.getByText('Mariana: prefiro cinza')).toBeTruthy();
    expect(screen.getByText('Paulo: prefiro bege')).toBeTruthy();
    expect(sheet.textContent).not.toMatch(/987|nota interna/);
    expect(sheet.querySelector('img')).toBeNull();
    expect(container.querySelector('.print-sheet')).toBeNull();
  });

  it('shows the title, client and date', () => {
    render(<PrintSheet title="Casa nova" clientName="Maria Souza" rooms={rooms} selected={new Set(['a'])} />);
    expect(screen.getByRole('heading', { name: 'Casa nova' })).toBeTruthy();
    expect(screen.getByText('Perfil: Maria Souza')).toBeTruthy();
    expect(screen.getByText(/\d{1,2} de \S+ de \d{4}/)).toBeTruthy();
  });
});
