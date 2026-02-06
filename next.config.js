/** @type {import('next').NextConfig} */
const nextConfig = {
  // Ignora erros de TypeScript durante o build (produção)
  typescript: {
    ignoreBuildErrors: true,
  },
  // Ignora erros de ESLint durante o build
  eslint: {
    ignoreDuringBuilds: true,
  },
  // (Opcional) Garante que o Webpack lide bem com bibliotecas pesadas como o PDF.js
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
};

module.exports = nextConfig;