/** @type {import('next').NextConfig} */
const nextConfig = {
    devIndicators: false,
    transpilePackages: ['better-auth', '@polar-sh/better-auth', '@noble/ciphers'],
};

export default nextConfig;
