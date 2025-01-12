import fs from 'fs';
import path from 'path';

function getConfigPath() {
  if (process.env.MASTRA_APP_DIR) {
    const configPath = path.resolve(process.env.MASTRA_APP_DIR, 'mastra.config');
    if (fs.existsSync(configPath + '.ts')) {
      return configPath;
    }
  }
  return path.resolve(process.cwd(), 'example.mastra.config');
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    esmExternals: 'loose',
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve = {
        ...config.resolve,
        fallback: {
          ...config.resolve.fallback,
          fs: false,
        },
      };
    }
    config.module = {
      ...config.module,
      exprContextCritical: false,
    };
    return config;
  },
  env: {
    CONFIG_PATH: getConfigPath(),
    APP_DIR: process.env.MASTRA_APP_DIR,
    APP_URL: 'http://localhost:3456', // Override the user's app URL for admin
  },
  redirects() {
    return [
      {
        source: '/',
        destination: '/agents',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
