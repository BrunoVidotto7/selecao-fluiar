import { beforeEach, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Page from './page';
import DetailPage, { generateMetadata } from './[id]/page';
import { getClientList, getClientLists } from '@/components/client-shopping/queries.server';
import { CLIENT_LIST, CLIENT_LIST_SUMMARY } from '@/test-support/fixtures';
import { FeedbackProvider } from '@/components/feedback/Feedback';
vi.mock('@/components/client-shopping/queries.server', () => ({ getClientList: vi.fn(), getClientLists: vi.fn() }));
vi.mock('next/navigation', async (original) => ({ ...(await original()), useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
beforeEach(() => { vi.clearAllMocks(); });
test('overview loads client summaries and links to owned details', async () => {
  getClientLists.mockResolvedValue([CLIENT_LIST_SUMMARY]);
  render(await Page());
  expect(screen.getByRole('heading', { name: 'Minhas listas' })).toBeTruthy();
  expect(screen.getByRole('link', { name: CLIENT_LIST.name }).getAttribute('href')).toBe('/my-lists/' + CLIENT_LIST.id);
});
test('detail and metadata use the same protected client query', async () => {
  getClientList.mockResolvedValue(CLIENT_LIST);
  const props = { params: Promise.resolve({ id: CLIENT_LIST.id }) };
  expect(await generateMetadata(props)).toEqual({ title: CLIENT_LIST.name });
  render(<FeedbackProvider>{await DetailPage(props)}</FeedbackProvider>);
  expect(screen.getByRole('heading', { name: CLIENT_LIST.name })).toBeTruthy();
  expect(getClientList).toHaveBeenCalledWith(CLIENT_LIST.id);
});
test('outages are propagated rather than presented as no lists', async () => {
  const failure = new Error('API unavailable');
  getClientLists.mockRejectedValue(failure);
  await expect(Page()).rejects.toBe(failure);
});
