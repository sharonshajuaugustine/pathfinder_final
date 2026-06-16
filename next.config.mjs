/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // PII and AI calls run only in server routes/actions; never bundle secrets to client.
  experimental: {
    serverComponentsExternalPackages: ["groq-sdk"],
  },
};

export default nextConfig;
