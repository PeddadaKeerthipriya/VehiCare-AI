/** @type {import('next').NextConfig} */
const nextConfig = {
  // Produces a minimal, self-contained server bundle (only the files
  // actually needed at runtime) — required for the lean Docker image
  // used in the Hostinger VPS deployment. See DEPLOY_HOSTINGER_VPS.md.
  output: "standalone",

  async headers() {
    return [
      {
        source: "/models/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
