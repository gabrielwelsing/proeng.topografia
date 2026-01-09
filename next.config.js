/** @type {import('next').NextConfig} */
const nextConfig = {
    webpack: (config) => {
      // Isso diz pro Next.js ignorar módulos de servidor quando estiver no navegador
      config.resolve.alias.canvas = false;
      config.resolve.alias.encoding = false;
      return config;
    },
  };
  
  export default nextConfig;