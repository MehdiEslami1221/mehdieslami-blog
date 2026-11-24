import type { NextConfig } from "next";
const config: NextConfig = {
  output: process.env.NODE_ENV === "production" ? "export" : undefined,
  trailingSlash: true,
  basePath: process.env.BLOG_BASE_PATH || "",
  images: { unoptimized: true },
  experimental: { globalNotFound: true },
  env: {
    NEXT_PUBLIC_BASE_PATH: process.env.BLOG_BASE_PATH || "",
    NEXT_PUBLIC_SITE_URL:
      process.env.BLOG_SITE_URL || "https://blog.mehdieslami.ir",
  },
};
export default config;
