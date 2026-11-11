import { expect, test } from 'vitest';
import nextConfig from './next.config.mjs';

test('the old clientes routes redirect permanently to perfis', async () => {
  const redirects = await nextConfig.redirects();
  expect(redirects).toContainEqual({ source: '/clientes', destination: '/perfis', permanent: true });
  expect(redirects).toContainEqual({ source: '/clientes/:path*', destination: '/perfis/:path*', permanent: true });
});
