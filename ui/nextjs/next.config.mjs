/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: { serverActions: { bodySizeLimit: '6mb' } },
  async redirects() {
    return [
      { source: '/clientes', destination: '/perfis', permanent: true },
      { source: '/clientes/:path*', destination: '/perfis/:path*', permanent: true },
    ];
  },
};
export default nextConfig;
