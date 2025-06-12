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
            "stream": require.resolve("stream-browserify"),
            "crypto": require.resolve("crypto-browserify"),
            "util": require.resolve("util/"),
            "http": require.resolve("stream-http"),
            "https": require.resolve("https-browserify"),
            "os": require.resolve("os-browserify/browser"),
            "path": require.resolve("path-browserify"),
            "zlib": require.resolve("browserify-zlib"),
            "fs": false, // Indicates that this module is not available on the client
            "net": false,
            "tls": false,
        };
    }
    
    // Return the modified config
    return config;
  },
};

export default nextConfig;