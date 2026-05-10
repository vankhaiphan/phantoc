import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Photos uploaded via the uploadPhoto Server Action can be large.
      // 10 MB is a generous ceiling for a family genealogy app; Supabase
      // Storage itself enforces its own per-file limits.
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
