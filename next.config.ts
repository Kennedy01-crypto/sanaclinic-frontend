import type { NextConfig } from "next";

const djangoApiOrigin = (process.env.DJANGO_API_URL ?? "http://localhost:8000").replace(
  /\/$/,
  "",
);

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  skipTrailingSlashRedirect: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async rewrites() {
    return [
      {
        source: "/backend-api/:path*",
        destination: `${djangoApiOrigin}/api/:path*/`,
      },
    ];
  },
};

export default nextConfig;
