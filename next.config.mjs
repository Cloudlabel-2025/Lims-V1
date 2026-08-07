/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  reactCompiler: true,
  serverExternalPackages: ["sharp", "cloudinary"],
  async redirects() {
    return [
      { source: "/system", destination: "/settings", permanent: false },
      { source: "/settings/system", destination: "/settings", permanent: false },
      { source: "/settings/configuration", destination: "/settings", permanent: false },
      { source: "/system-configuration", destination: "/settings", permanent: false },
    ];
  },
};

export default nextConfig;
