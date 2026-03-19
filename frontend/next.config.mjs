/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3001/api/:path*',
      },
    ];
  },
  webpack(config, { webpack }) {
    // @xyflow/react requires __VERSION__ to be defined at build time
    config.plugins.push(
      new webpack.DefinePlugin({
        __VERSION__: JSON.stringify('12.10.1'),
      }),
    );
    return config;
  },
};

export default nextConfig;
