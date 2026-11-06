import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import usePrintSelection from './usePrintSelection';

const rooms = [
  { id: 'r1', name: 'Sala', products: [{ id: 'a' }, { id: 'b' }] },
  { id: 'r2', name: 'Cozinha', products: [{ id: 'c' }] },
];

describe('usePrintSelection', () => {
  it('toggles one product', () => {
    const { result } = renderHook(() => usePrintSelection(rooms));
    act(() => result.current.toggle('a'));
    expect(result.current.selected.has('a')).toBe(true);
    act(() => result.current.toggle('a'));
    expect(result.current.selected.has('a')).toBe(false);
  });

  it('selects a whole room and then unselects it', () => {
    const { result } = renderHook(() => usePrintSelection(rooms));
    act(() => result.current.toggleRoom(rooms[0]));
    expect([...result.current.selected]).toEqual(['a', 'b']);
    expect(result.current.isRoomSelected(rooms[0])).toBe(true);
    act(() => result.current.toggleRoom(rooms[0]));
    expect(result.current.selected.size).toBe(0);
  });

  it('completes a partially selected room', () => {
    const { result } = renderHook(() => usePrintSelection(rooms));
    act(() => result.current.toggle('a'));
    expect(result.current.isRoomSelected(rooms[0])).toBe(false);
    act(() => result.current.toggleRoom(rooms[0]));
    expect(result.current.isRoomSelected(rooms[0])).toBe(true);
  });

  it('drops ids of products that no longer exist when rooms change', () => {
    const { result, rerender } = renderHook(({ r }) => usePrintSelection(r), { initialProps: { r: rooms } });
    act(() => { result.current.toggle('a'); result.current.toggle('c'); });
    rerender({ r: [{ ...rooms[0], products: [{ id: 'b' }] }, rooms[1]] });
    expect([...result.current.selected]).toEqual(['c']);
  });

  it('clears the selection', () => {
    const { result } = renderHook(() => usePrintSelection(rooms));
    act(() => result.current.toggle('a'));
    act(() => result.current.clear());
    expect(result.current.selected.size).toBe(0);
  });
});
