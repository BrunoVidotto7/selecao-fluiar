import { expect, test, vi } from 'vitest';
import Page, { generateMetadata } from './page';
import { LIST, OFFICE } from '@/test-support/fixtures';
const { getList, readApi, markClientChangesRead } = vi.hoisted(() => ({ getList: vi.fn(), readApi: vi.fn(), markClientChangesRead: vi.fn() }));
vi.mock('@/components/listas/queries.server', () => ({ getList }));
vi.mock('@/lib/api.server', () => ({ readApi }));
vi.mock('@/components/client-changes/actions', () => ({ markClientChangesRead }));
test('server reads and metadata never confirm client changes', async () => {
  getList.mockResolvedValue(LIST);
  readApi.mockResolvedValue(OFFICE);
  const props = { params: Promise.resolve({ id: LIST.id }) };
  expect(await generateMetadata(props)).toEqual({ title: LIST.name });
  const page = await Page(props);
  expect(page.props.children[1].props.list).toEqual(LIST);
  expect(getList).toHaveBeenCalledWith(LIST.id);
  expect(readApi).toHaveBeenCalledWith('/api/office');
  expect(markClientChangesRead).not.toHaveBeenCalled();
});
