/** @type {import('next').NextConfig} */
const nextConfig = {
  // Produces a minimal, self-contained server bundle (only the files
  // actually needed at runtime) — required for the lean Docker image
  // used in the Hostinger VPS deployment. See DEPLOY_HOSTINGER_VPS.md.
  output: "standalone",
};

export default nextConfig;
