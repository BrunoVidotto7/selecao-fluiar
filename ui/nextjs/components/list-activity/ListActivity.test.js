import { act, render } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import ListActivity from './ListActivity';
import { recordAdminListActivity, recordClientListActivity } from './actions';
import { LIST } from '@/test-support/fixtures';
vi.mock('./actions', () => ({ recordAdminListActivity: vi.fn().mockResolvedValue({ ok: true }), recordClientListActivity: vi.fn().mockResolvedValue({ ok: true }) }));
test('only a committed mounted detail screen records its profile activity and rerenders do not repeat it', async () => {
  vi.clearAllMocks();
  const element = <ListActivity listId={LIST.id} />;
  expect(recordAdminListActivity).not.toHaveBeenCalled();
  const view = render(element);
  await act(async () => {});
  expect(recordAdminListActivity).toHaveBeenCalledExactlyOnceWith(LIST.id);
  view.rerender(<ListActivity listId={LIST.id} />);
  expect(recordAdminListActivity).toHaveBeenCalledTimes(1);
  view.rerender(<ListActivity listId={LIST.id} client />);
  await act(async () => {});
  expect(recordClientListActivity).toHaveBeenCalledExactlyOnceWith(LIST.id);
});
