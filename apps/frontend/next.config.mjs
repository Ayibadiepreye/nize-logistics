/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // Disabled to fix Leaflet map initialization in dev mode
  images: {
    domains: ['res.cloudinary.com'],
  },
  webpack: (config) => {
    config.externals = [...(config.externals || []), { canvas: 'canvas' }];
    return config;
  },
};

export default nextConfig;
