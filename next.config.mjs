// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        port: '',
        pathname: '/a/**',
      },
      {
        protocol: 'https',
        hostname: 'lefvtgqockzqkasylzwb.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/media/**',
      },
      {
        protocol: 'https',
        hostname: 'img.heroui.chat',
        port: '',
        pathname: '/**',
      }
    ],
  },
  webpack: (config, { isServer }) => {
    // Add a rule to handle .node files
    config.module.rules.push({
      test: /\.node$/,
      use: 'raw-loader',
    });

    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        "stream": "stream-browserify",
        "crypto": "crypto-browserify",
        "util": "util/",
        "http": "stream-http",
        "https": "https-browserify",
        "os": "os-browserify/browser",
        "path": "path-browserify",
        "zlib": "browserify-zlib",
        "fs": false,
        "net": false,
        "tls": false,
      };
    }

    return config;
  },
};

export default nextConfig;